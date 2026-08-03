# Horizen agentId recovery — decode the registration's own receipt, never the wallet-keyed registry (2026-08-03)

**Status:** shipped.

## The problem

`checkAgentRegistrationStatus` refuses to call Horizen's `get_onboarding_status` without an
`agentId` (the tool declares it required). For a registration whose `horizenAgentId` was never
persisted (predates that field, or `prepareAgentRegistration`'s build response omitted it), the
only recovery path in place was a **wallet-keyed registry lookup**:
`fetchRegistryAgent(ownerWalletAddress, network)`.

That lookup is structurally unsound. ERC-721 gives no reverse (wallet → tokenId) enumeration
guarantee — `balanceOf` returns a count, not a list — so a registry read keyed by the owner wallet
is a different tool contract than an agentId lookup, with no guarantee the two ever coincide. It
could answer confidently and **wrongly**, which is the more dangerous failure mode than an honest
refusal.

## The fix

`services/horizen/agentIdRecovery.ts` (new) decodes the minted `agentId` directly from the
registration transaction's **own receipt logs** — deterministic, requires no registry lookup:

1. `provider.getTransactionReceipt(txHash)` — read only.
2. Scans **every** log in the receipt (not just those whose `log.address` equals the transaction's
   `to`) for either the ERC-8004 `Registered(uint256 indexed agentId, string agentURI, address indexed owner)`
   event or the standard ERC-721 mint `Transfer(address indexed from, address indexed to, uint256 indexed tokenId)`
   (`from == address(0)`). Horizen may relay registration through a wrapper contract; the Identity
   Registry's own emitted event still appears in the outer receipt under its own `log.address`.
3. When `expectedRegistry` is supplied (the repo's own recorded `HORIZEN_NETWORK_FACTS[...].identityRegistry`),
   log scanning is restricted to that address — the primary defense against decoding an unrelated
   event from the same transaction.
4. **Refuses on ambiguity** — if the scan decodes more than one distinct `agentId`, it refuses
   rather than guessing which one is real.
5. **Mandatory verification**: the decoded `agentId`'s `ownerOf()` is read back from its own
   registry and compared against `expectedOwner` before the identifier is ever trusted. A mismatch
   is refused, not silently accepted.
6. `tokenURI()` is read best-effort only, to enrich `agentURI` when the `Registered` event's own
   field was absent (the bare `Transfer` case) — its failure never invalidates an already-verified
   identifier.

Read-only by construction: no signer, no write path. Recovery can never submit a new registration.

## Wiring

- `checkAgentRegistrationStatus` (`services/horizen/registrationClient.ts`) replaces the old
  `fetchRegistryAgent(ownerWalletAddress, network)` hop with `decodeAgentIdFromReceipt({ provider,
  txHash: input.txHash, expectedOwner: input.ownerWalletAddress, expectedRegistry:
  HORIZEN_NETWORK_FACTS[input.network].identityRegistry })`. The refusal fired when no identifier is
  recoverable is unchanged in shape (`STATUS_UNAVAILABLE`, "the on-chain transaction remains valid,
  do not re-register") — only its wording now names receipt-decode rather than registry-lookup as
  the failed source.
- `CheckAgentRegistrationStatusInput` gained an optional `rpcUrl?: string` — resolved by the
  caller, same discipline as `broadcastAgentRegistration`'s existing `rpcUrl` (this module never
  reads `process.env` internally).
- `app/api/journey/moneypenny-horizen/register/status/route.ts` now passes
  `rpcUrl: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || 'https://sepolia.base.org'` — the same
  literal `registerCeremony.ts` already uses for the broadcast step.
- The post-confirmation registry reread (`fetchRegistryAgent` for `tokenId`/`registryAlias`/
  `agentIdentifier` once Horizen reports `confirmed: true`) is untouched — it is a different,
  already-sound use of that function (reading the CONFIRMED record, not recovering a missing key).

## Tests

`tests/register-ceremony.test.ts`:
- Rewrote the obsolete canary asserting the wallet-keyed lookup (`fetchRegistryAgent`,
  `lookup(input.ownerWalletAddress, input.network)`) to instead assert the receipt-decode call
  shape (`decodeAgentIdFromReceipt`, `txHash`/`expectedOwner`/`expectedRegistry` fields) and assert
  the old wallet-keyed lookup is **gone** from this code path.
- Added a new `describe('agentIdRecovery — decoding the minted identifier from the receipt')` block
  covering: read-only construction (no `ethers.Wallet`), full-log scanning (not `tx.to`-filtered),
  both event shapes decoded, ambiguity refusal, mandatory `ownerOf` verification, best-effort
  `tokenURI`, and no-receipt refusal.

All 83 tests in `register-ceremony.test.ts` pass, plus the full existing Horizen suite
(`horizen-registration-client.test.ts`, `horizen-register-status-route.test.ts`,
`register-ceremony-routes.test.ts`, `register-moneypenny-horizen.test.ts`,
`horizen-integration.test.ts`, `horizen-agent-binding.test.ts` — 172 tests total).

## Files

- `services/horizen/agentIdRecovery.ts` — new
- `services/horizen/registrationClient.ts` — recovery hop replaced
- `app/api/journey/moneypenny-horizen/register/status/route.ts` — `rpcUrl` supplied
- `tests/register-ceremony.test.ts` — canary rewritten + new describe block

## Known repo-wide typecheck limitation

`npx tsc -p tsconfig.json --noEmit` fails before checking any file
(`TS5103: Invalid value for '--ignoreDeprecations'` + `TS2688: Cannot find type definition file for
'iqube'`) — this is the pre-existing, already-tracked issue, not something introduced here.
Verification for this change relied on the full relevant test suite (172 passing tests) instead.
