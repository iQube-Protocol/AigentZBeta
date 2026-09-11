# MoneyPenny registration script + BitCent name-availability check (2026-07-30)

**Operator directive this session:** proceed with BitCent testnet minting (confirm `BITCENT` name
availability) and proceed with registering MoneyPenny in Horizen's registry via the already-confirmed
MCP onboarding surface, without asking Horizen for further confirmation or another SDK.

Both are real, network-dependent operations. This sandbox's outbound network policy blocks
`mempool.space`, `agent-registry.horizenlabs.io`, and `sepolia.base.org` (confirmed live, this
session — CONNECT 403/405 from the proxy for all three). Neither script could be executed to
completion from here. What follows is what *was* built, verified as far as possible without live
network, and handed to the operator to run for real.

## 1. R-12 — `scripts/check-bitcent-name-availability.js`

Loads the ratified Rune name from `scripts/bitcent-issuance-record.json` via
`deploy-qct-bitcoin.js`'s own `loadIssuanceRecord()` (single source of truth — no re-parsing, no
hardcoded `"BITCENT"` literal). Queries `https://mempool.space/testnet/api/v1/runes/{name}` — the
same host this repo already documents as the canonical testnet explorer
(`scripts/QCT_RUNES_DEPLOYMENT.md`).

**Deliberately abstains rather than guesses.** A 404 is reported as `LIKELY AVAILABLE (not found on
this indexer)` with `conclusive: false` — it is evidence of absence from ONE indexer, not proof of
global availability. Any other status (including one this sandbox actually observed: HTTP 405 from
the blocking proxy, which is not a real answer from mempool.space) is reported as `INCONCLUSIVE`,
never coerced into "available". A 200 with an existing Rune record is the only `conclusive: true`
outcome, and it is a hard "do not use this name".

Injectable `httpGet` (mirrors the transport-injection convention already used in
`services/horizen/client.ts`) lets `tests/bitcent-name-availability.test.ts` (5 tests) exercise the
404 / 200 / other-status / transport-failure branches deterministically, without a socket.

**Run for real:**
```bash
npm run check:bitcent-name
```
Cross-check the result manually against a second testnet Rune indexer before spending on the etch —
the script says so in its own output. A Rune name is immutable once etched; there is no second
attempt.

## 2. MoneyPenny → Horizen registration — `scripts/register-moneypenny-horizen.ts`

Implements the operator's ratified outbound sequence:

```
MoneyPenny Agent Card
→ build_registration_tx
→ local owner-wallet signature
→ submit_registry_tx
→ get_onboarding_status
→ verify registry resolution
```

**Why this uses live MCP discovery instead of a hardcoded call shape.** The operator's brief names
the Horizen MCP tool IDs (`build_registration_tx`, `submit_registry_tx`, `get_onboarding_status`) and
the on-chain method (`IdentityRegistry.register(string agentURI)`), and confirmed the MCP onboarding
path is the closed, preferred pilot path — that decision is not reopened here. But this repo has
never called that MCP endpoint, and does not have those three tools' exact JSON Schema on file.
Per CLAUDE.md's "No Guessing" rule, the script does not fabricate parameter names for a write call
against a real registry. Instead it:

1. Connects with the real `@modelcontextprotocol/sdk` client (added as a genuine dependency,
   `@modelcontextprotocol/sdk@^1.30.0` — this is standard MCP client machinery, not a Horizen-specific
   guess) via `StreamableHTTPClientTransport` against `services/horizen/client.ts`'s existing
   `HORIZEN_REGISTRY_MCP` constant (no new URL literal).
2. Calls `tools/list` and prints each of the three tools' server-declared `inputSchema` in full,
   before ever calling one.
3. Matches its known values (the Agent Card URL, `base-sepolia`, the signed tx hex) against the
   schema's own property names (`matchSchemaFields` — case-insensitive substring match against the
   schema, not an invented name), prints the exact arguments it is about to send, and requires a typed
   `"yes"` confirmation before every write call (`build_registration_tx`, then again before signing,
   then again before `submit_registry_tx`). Propose-and-confirm, never guess-and-broadcast.
4. Cross-checks the unsigned transaction's `to` and `chainId` against this repo's own recorded facts
   (`services/horizen/identity.ts` `HORIZEN_NETWORK_FACTS['base-sepolia']` —
   `0x8004A818BFB912233c491871b3d84c89A494BD9e` / chainId `84532`) and refuses on any mismatch, rather
   than trusting the MCP response blindly.

**Pre-registration validation of MoneyPenny's own Agent Card** (`validateAgentCard`, before any
network call to Horizen): confirms `name === "Aigent MoneyPenny"`, `metadata.runtime_agent_id ===
"aigent-moneypenny"`, `metadata.horizen.network === "base-sepolia"`, that the card's recorded
`identityRegistry` matches the repo's own `HORIZEN_NETWORK_FACTS` (catches drift between the deployed
card and the source of truth), and refuses to re-register if the card's `tokenId` is already set.

**What never happens:** the script never prints, logs, or persists
`MONEYPENNY_OWNER_WALLET_PRIVATE_KEY`. It is read once from the environment, used in-memory by
`ethers.Wallet` to sign locally (`wallet.signTransaction`), and only the resulting signed transaction
hex — never the key — is sent to Horizen via `submit_registry_tx`.

**Verified without live network (this session):** the file type-checks cleanly under the project's
own `tsconfig.json`, and a direct run confirms it parses, connects its argument pipeline correctly,
and fails at exactly the expected boundary (the Agent Card fetch, HTTP 403 from this sandbox's proxy)
rather than crashing on a bug. 12 unit tests
(`tests/register-moneypenny-horizen.test.ts`) cover the pure helpers — schema-matching, Agent Card
validation (all four refusal conditions + the happy path), unsigned-tx extraction (direct shape,
nested `transaction` shape, and the honest `null` when nothing recognisable is present), tx-hash
extraction (declared field and regex fallback), and hash determinism — without a socket.

**Run for real (operator's machine, real network + real funds):**
```bash
# 1. Dry run first -- prints Agent Card validation, the MCP tools' real schemas,
#    and the proposed build_registration_tx arguments. Nothing is signed or submitted.
npx tsx scripts/register-moneypenny-horizen.ts --agent-card-base=https://dev-beta.aigentz.me

# 2. Review the printed schemas and proposed arguments. If they look right:
MONEYPENNY_OWNER_WALLET_PRIVATE_KEY=0x... \
  npx tsx scripts/register-moneypenny-horizen.ts \
    --agent-card-base=https://dev-beta.aigentz.me --execute
```
Every write step (build, sign, submit) requires its own typed `"yes"`.

## What is intentionally NOT built yet

The metaMe-side binding record + DVN receipt for this OUTBOUND registration (listed in the operator's
acceptance criteria: "metaMe binding receipt" / "DVN receipt"). This cannot be built honestly before
the real transaction hash, block number, and token ID exist — building it now would mean inventing
placeholder values for a receipt whose entire purpose is recording real facts. Once the operator has
run the script above and has real values in hand, the follow-up is a small addition mirroring
`services/horizen/operatorClaim.ts`'s existing pattern for the inbound direction (signature-verify →
persist → `createActivityReceipt` → `enqueueActivityReceiptAnchor`), not a new parallel mechanism.

## Files

- `scripts/check-bitcent-name-availability.js` (new)
- `scripts/register-moneypenny-horizen.ts` (new)
- `tests/bitcent-name-availability.test.ts` (new, 5 tests)
- `tests/register-moneypenny-horizen.test.ts` (new, 12 tests)
- `package.json` — `check:bitcent-name`, `register:moneypenny-horizen` script aliases;
  `@modelcontextprotocol/sdk@^1.30.0` added as a dependency
- `.env.example` — `BITCENT_TREASURY_CUSTODIAN_WIF`, `MONEYPENNY_OWNER_WALLET_PRIVATE_KEY`,
  `NEXT_PUBLIC_RPC_BASE_SEPOLIA` documented
