# Vela Accelerator — Asset-Neutrality Transport Widening (Phase 9, item 2 of 4)

**Date:** 13 September 2026
**Status:** Implemented, locally tested, not pushed (isolated worktree, commit-local per task
instructions). Second item of the recommended build order in
`docs/vela/accelerator/constitutional-financial-services/09_CLAUDE_IMPLEMENTATION_HANDOFF_v0.2.md`
("Phase 9 — asset neutrality"), following the gap identified in
`codexes/packs/agentiq/updates/2026-09-11_vela-accelerator-phase0-code-inventory.md` §2.2.

## Preflight (Resolution → Invariant Loop)

Reviewed before writing any code:

- `codexes/packs/agentiq/updates/2026-09-11_vela-accelerator-phase0-code-inventory.md` §2.2 (the
  gap this item closes) and §5 (recommended phase ordering, item 2).
- `RES-2026-08-22-VELA-APPLICATION-ID-EPHEMERAL-001.json` /
  `CI-2026-08-22-VELA-APPLICATION-ID-DEPLOYMENT-RECORD-001.json` — confirms `applicationId` stays a
  per-call parameter; this change does not touch that.
- `RES-2026-08-22-VELA-ASSOCIATEKEY-PROVISIONING-001.json` — confirms the "no new custody surface"
  discipline for Vela key material; this change adds no custody surface (it reuses the existing
  `requesterPrivateKeyHex`/`requesterP521PrivateKeyHex` already on `VelaClientAdapterOptions`).
- `inv.engineering.036`/`037` (source-of-truth parity / no parallel implementations) — checked
  `services/venture/trading/serviceLedger.ts` (a deterministic *simulated* obligation ledger, no
  chain calls, no asset/token type — confirmed unrelated, not reusable here) and
  `services/financialServices/**`, `services/wallet/**`, `services/financialServices/providers/bankr/**`
  for an existing `AssetDescriptor`/`TokenRef` abstraction (grep for `tokenAddress`/`assetAmount`/
  `ERC-20` across `services/`) — none found generalised enough to reuse; each hit is domain-specific
  (Bankr's own `tokenAddress: string | null` on its launch types, QCT's own ERC-20 balance reader).
  Per the task's own instruction, defined the smallest new type directly in `velaTypes.ts` next to
  the existing wire types, matching the on-chain ABI's own parameter names
  (`tokenAddress`/`assetAmount`) rather than inventing new vocabulary.
- No existing resolution record or candidate invariant already covers Vela asset-neutrality
  (grepped `codexes/packs/agentiq/resolution-records/` for "asset"/"neutral" — the only hits are
  unrelated DIDQube/Horizen-registry records). This is genuinely new ground, not a duplicate.
- Unresolved risk carried forward (not closed by this item, correctly out of scope): the ERC-20
  `TokenAllowlist`/approval path is Vela-Engineering's own deployment concern (§10 of
  `11_VELA_TEAM_CONFIRMED_BASELINE_v0.1.md`) — this repo has no allowlist-management surface and
  none was built. See "Open external dependency" below.

## What already existed vs. what was added

**Already existed and unchanged:**
- `VelaTransport.submitProcessRequest(applicationId, encryptedPayload)` — the no-funds confidential
  projection path `velaProjectionProvider.ts` calls. Its wire behaviour (ETH sentinel,
  zero-value `submitRequest` call) is frozen and untouched.
- The on-chain `submitRequest` ABI already accepted `tokenAddress`/`assetAmount` — the gap was
  purely that nothing in this repo's transport layer threaded a real value through those two
  parameters.

**Added (additive only):**
1. `services/vela/velaTypes.ts` — `VelaAssetRef` (`{ tokenAddress: string; assetAmount: bigint }`),
   the exported `ETH_SENTINEL_ADDRESS` constant (moved out of `velaClientAdapter.ts`'s private
   `ETH_SENTINEL` so both the real transport and any asset-bearing caller share one spelling —
   an "extend, don't duplicate" refactor, not a behaviour change), and `validateVelaAssetRef()` —
   a pure, fail-closed validator (malformed address / non-bigint / non-positive amount) callable
   before any network I/O.
2. `VelaTransport` interface — one new method, `submitAssetBearingProcessRequest(applicationId,
   encryptedPayload, asset)`. `submitProcessRequest`'s own signature is unchanged.
3. `VelaClientAdapter` — implements the new method against the exact same `PROCESSOR_ABI.submitRequest`
   call already in the file, now passing `asset.tokenAddress`/`asset.assetAmount` instead of the
   hardcoded sentinel/zero. The maxFee-resolution and requestId-extraction logic (previously inlined
   in `submitProcessRequest`) was factored into two small private helpers
   (`resolveMaxFee`, `submitAndAwaitRequestId`) shared by both public methods — refactor only, no
   behavioural change to the existing path (verified: same `minFeePerRequest` read, same
   `maxFee < minFee` guard, same `submitRequest` argument order/values, same `RequestSubmitted`
   log-based requestId extraction, same `submitBlock` bookkeeping).
4. `VelaTestTransport` — mirrors the same additive shape deterministically:
   `submitAssetBearingProcessRequest` validates, then records the submission AND the asset
   (`assetSubmittedFor(requestId)`, a test-only accessor), so a test can assert the asset threaded
   through without touching cryptography.
5. `tests/vela-asset-bearing-request.test.ts` (new, 12 cases) — regression proof for the no-funds
   path (both at the `VelaTestTransport`/`VelaConfidentialProjectionProvider` level and a
   compile-time signature check on `VelaClientAdapter.submitProcessRequest`), asset-threading proof
   (ERC-20-shaped address, native ETH sentinel, still resolves via `fetchResult`), and fail-closed
   validation proof against BOTH the test transport and the REAL `VelaClientAdapter` — the real-adapter
   validation test points at an unreachable RPC port and shows the rejection is the specific
   validation error, not a network-timeout error, proving validation runs before any chain call.

## Exact new interface/method shape

```ts
// services/vela/velaTypes.ts
export const ETH_SENTINEL_ADDRESS = '0x0000000000000000000000000000000000000000';

export interface VelaAssetRef {
  tokenAddress: string;   // ERC-20 contract address, or ETH_SENTINEL_ADDRESS for native ETH
  assetAmount: bigint;    // smallest on-chain unit; must be > 0n
}

export function validateVelaAssetRef(asset: VelaAssetRef): void; // throws on malformed/non-positive

export interface VelaTransport {
  // ... unchanged members ...
  submitProcessRequest(applicationId: string, encryptedPayload: Uint8Array): Promise<string>;
  // NEW, additive:
  submitAssetBearingProcessRequest(
    applicationId: string,
    encryptedPayload: Uint8Array,
    asset: VelaAssetRef,
  ): Promise<string>;
}
```

**Proof the no-funds path is unaffected:**
- A compile-time signature check in the test file binds `adapter.submitProcessRequest` to the exact
  original 2-argument type — this fails to typecheck if the signature ever gains a required asset
  parameter.
- `submitProcessRequest`'s runtime body still calls `ETH_SENTINEL_ADDRESS`/`0n` and the exact same
  `submitRequest`/`{value: maxFee}` shape as before the refactor (verified by reading the diff, not
  merely asserted — see the refactor note above).
- `tests/vela-confidential-projection-provider.test.ts` (31 pre-existing tests, the full provider
  lifecycle across all three dispositions) and `tests/factor-vela-confidential-workload.test.ts` (8
  tests, the one other real caller) both still pass unmodified.
- The new test file's own no-funds-path tests assert `assetSubmittedFor(requestId)` is `undefined`
  for anything submitted via the original method — proving the old path never starts carrying an
  asset by accident.

## ERC-20 allowlist question

Confirmed: this repo has **no** ERC-20 allowlist-management surface for Vela, and none was built
(explicitly out of scope per the task). `TokenAllowlist` as a standalone contract "injected into
`ProcessorEndpoint`" is named only in the Vela-team-confirmed baseline
(`11_VELA_TEAM_CONFIRMED_BASELINE_v0.1.md` §10) — grepping this repo for any prior reference turned
up nothing. This is correctly an **external Vela-Engineering dependency**: before an ERC-20 asset
(anything other than `ETH_SENTINEL_ADDRESS`) can actually settle on a real deployment, Vela
Engineering must have allowlisted that token's contract address on their `ProcessorEndpoint`
deployment. This plumbing item threads the token address/amount through correctly on this repo's
side; it does not and cannot allowlist a token on Vela's side.

The EIP-2612 permit + `transferFrom` "gasless-style ERC-20 onboarding" mechanism the baseline also
names is a separate, further-out concern (how the caller authorises the ProcessorEndpoint to pull an
ERC-20 balance before/alongside the `submitRequest` call) — also correctly out of scope for this
plumbing item, and flagged rather than guessed at, per the task's explicit scope boundary.

## Resolution record + candidate invariant

- `codexes/packs/agentiq/resolution-records/records/RES-2026-09-13-VELA-ASSET-NEUTRALITY-TRANSPORT-001.json`
- `codexes/packs/agentiq/resolution-records/candidate-invariants/CI-2026-09-13-VELA-ASSET-BEARING-REQUEST-ADDITIVE-001.json`
- Trigger: `reusable-pattern-established` (#7 — a successful implementation established a reusable
  pattern: additive-sibling-method-over-frozen-existing-method, for any future Vela transport
  extension). Status: `candidate` — not self-ratified above `validated` per the Resolution → Invariant
  Loop rule; ratification is an operator act.
- Canary: `tests/vela-asset-bearing-request.test.ts`.

## Test results

Narrow suite (this item's files + everything that imports the touched modules):

```
✓ tests/unified-consequence-projection.test.ts (50 tests)
✓ tests/vela-confidential-projection-provider.test.ts (31 tests)
✓ tests/vela-asset-bearing-request.test.ts (12 tests, new)
✓ tests/vela-slice2g-execution-observation-validation.test.ts (20 tests | 1 skipped)
✓ tests/vela-slice2f-capability-invocation.test.ts (20 tests | 1 skipped)
✓ tests/factor-vela-confidential-workload.test.ts (8 tests)
✓ tests/vela-config-early-access.test.ts (9 tests)

Test Files  7 passed (7)
     Tests  148 passed | 2 skipped (150)
```

Full `npx vitest run` result and the pre-existing-vs-new failure breakdown are recorded in the
session's final report (this doc covers the Vela-specific work; the full-suite comparison is a
one-time gate, not a fact durable enough to freeze into this doc if the pre-existing noise floor
shifts between sessions).

## Commits (local only, not pushed)

See the session's final report for the exact commit list (SHA + subject + files) — omitted here to
avoid this document going stale if the branch is later rebased before push.
