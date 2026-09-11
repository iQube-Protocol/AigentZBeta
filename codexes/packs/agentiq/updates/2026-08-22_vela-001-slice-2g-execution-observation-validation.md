# VELA-001 Slice 2G — Bounded Execution, Observed Consequence, Consequence Validation, and the Commerce receipt taxonomy

**Date:** 2026-08-22
**Workstream:** VELA-001 — MoneyPenny × Vela: Confidential Constitutional Execution
**Status:** Slice 2G code-complete, ontology FROZEN. 20/20 deterministic + live canaries green (`VELA_SLICE2G_LIVE=1`, real Vela enclave, `applicationId 7738404303895312998`); standalone narrated live proof also passed with the complete reference chain persisted to disk.

## Part 0 — Slice 2F declared LIVE-PROVEN, and frozen

Per the operator's ruling, Slice 2F is recorded LIVE-PROVEN with the following evidence, unchanged from `2026-08-22_vela-001-slice-2f-gate2-authorisation.md`:

- Vela `applicationId 2089125378143059424` (real enclave-executed WASM, real on-chain transaction, local Vela stack).
- Traversal: ACTIVE authority → CFS-006a public projection → live Vela confidential projection → unified `ConsequenceProjection` → `invocationGateway`'s Gate 2 → `deriveActionAuthorisation()`.
- Three observed outcomes, verbatim: `ACCEPTABLE → AUTHORISED`; `UNACCEPTABLE → CONSEQUENCE_PROJECTION_UNACCEPTABLE → REFUSED`; `REQUIRED confidential absent/unavailable → CONSEQUENCE_PROJECTION_UNRESOLVED → UNRESOLVED`.

**Gate 2 architecture is frozen as of this slice.** `services/registry/capabilityInvocationGates.ts` and `services/registry/invocationGateway.ts` are untouched by Slice 2G — no new Vela-specific authorisation path was created. Every new module in this slice sits downstream of `deriveActionAuthorisation()`'s output, consuming it as a plain `ActionAuthorisation` value.

The "absent required confidential ⇒ UNRESOLVED" rule from Slice 2F applies **only** when `attestationRequirement`/`confidentialRequirement` is `REQUIRED`. It is explicitly NOT generalised to `NOT_REQUIRED` actions — proven directly (see Part 3).

## Part 1 — Bounded Execution (`services/constitutionalCommerce/boundedExecution.ts`)

`bindExecution()` mirrors `services/constitutional/settlementExecutor.ts`'s established pattern exactly: pure, deterministic, and it **never signs or broadcasts** anything. It binds an execution *intent* — a `CommerceExecution` record — to a specific, current `ActionAuthorisation`. `transactionRef` is intentionally always absent; real on-chain dispatch remains a separate, human-supervised step outside the constitutional layer, matching PRD-VELA-001's scope for this phase (no production execution, no fund movement).

"Execution requires a specific, current authorisation" is enforced two ways, both proven:

1. `authorisation.status !== 'AUTHORISED'` → refused. REFUSED and UNRESOLVED authorisations are both non-executable — neither is silently treated as "close enough."
2. `now > authorisation.expiresAt` → refused, **even when `status` still literally reads `'AUTHORISED'`** — a lapsed authorisation is not a current one, and this is the one place that must not trust a stale status word over an actual clock comparison.

## Part 2 — Observed Consequence + Consequence Validation (`services/constitutionalCommerce/observedConsequence.ts`)

`compareProjectionToObservation()` implements the exact ratified vocabulary:

```
observed === null              → UNRESOLVED             (nothing was established — no comparison was possible)
observed === projected         → MATCHED_PROJECTION
observed !== projected         → DIVERGED_FROM_PROJECTION
```

`ObservedConsequence.validationState` was renamed from `'DIVERGED'` to `'DIVERGED_FROM_PROJECTION'` in `types/constitutionalCommerce.ts` to match this exactly — no other file referenced the old literal.

UNRESOLVED here means precisely what it means everywhere else in this ontology: the observation itself could not be established. A definite but unfavourable observation (the observed disposition really was UNACCEPTABLE) is still a real comparison, never UNRESOLVED. TEE attestation independence carries forward unchanged — proven directly: `recordObservedConsequence()` never reads or mutates `projection.confidential.teeAttestationVerified`, so a successful observation can never retroactively "prove" an attestation that was never independently verified.

`recordObservedConsequence()` builds the full `ObservedConsequence` record, deterministically deriving `consequenceRef` from `executionRef` + `projectionRef`.

## Part 3 — Causal Chain assembly (`services/constitutionalCommerce/causalChain.ts`)

`assembleCausalChain()` gathers every reference the operator specified — `authorityRef, mandateRef, proposedActionRef, projectionContextRef, projectionRef, publicForecastRef, confidentialEvidenceRef, confidentialRequestRef (Vela's own request/application reference), authorisationRef, executionRef, observedConsequenceRef, validation result` — **exclusively from the already-existing typed records** (`ProposedAction`, `ConsequenceProjection`, `ActionAuthorisation`, `CommerceExecution`, `ObservedConsequence`). It computes nothing and duplicates no field; `authorityRef`/`mandateRef` are read from the `ActionAuthorisation` (which `deriveActionAuthorisation()` already copied from the same `ConsequenceProjection`), not from a second `ConstitutionalAuthority` object, so there is exactly one copy of each ref to disagree with itself.

`executionRef`, `observedConsequenceRef` and `validationState` are `null` whenever execution never happened — proven directly for a REFUSED authorisation, where the refusal itself stays fully traceable via `authorisationRef`/`projectionRef` even though nothing downstream exists yet.

**Proven distinctly (operator's explicit constraint):** a `NOT_REQUIRED` action with no confidential evidence composes ACCEPTABLE/COMPLETE, reaches `allow` at Gate 2, derives `AUTHORISED`, and successfully binds an execution — the full chain runs to completion with zero confidential evidence, because none was ever required. The *same shape* of action with confidential `REQUIRED` and evidence absent instead resolves `UNRESOLVED` all the way through, and execution is refused. The two paths are exercised side by side in the same test file so they can never silently collapse into each other again.

## Part 4 — Commerce receipts (`services/constitutionalCommerce/commerceReceipts.ts`)

Six new `ActivityActionType` literals, one level downstream of the existing `capability_invocation_*` (GOVERNANCE-layer) types:

| Type | Fires when |
|---|---|
| `commerce_action_authorised` | `ActionAuthorisation.status === 'AUTHORISED'` |
| `commerce_action_refused` | `status === 'REFUSED'` |
| `commerce_action_unresolved` | `status === 'UNRESOLVED'` — kept as its own type, never folded into `_refused`, so PRD §31's fail-closed "nothing was established" outcome stays auditably distinct from "something concrete blocked it" |
| `commerce_execution_bound` | `bindExecution()` returns `execution_bound` |
| `commerce_execution_refused` | `bindExecution()` refuses (not AUTHORISED / expired) |
| `commerce_consequence_recorded` | `recordObservedConsequence()` writes an `ObservedConsequence` — the `validationState` rides in `actionInput`, not a seventh type |

All six added to `ANCHORABLE_ACTION_TYPES` in `services/dvn/activityReceiptDvnPipeline.ts` — the one change that protected file permits unilaterally — and to a wholesale CHECK-constraint rebuild in `supabase/migrations/20260930010100_commerce_authorisation_execution_consequence_receipt_types.sql`, keeping `tests/activity-receipts-action-type-parity.test.ts` green in both directions (TS union ↔ CHECK constraint, and call site ↔ TS union — `commerceReceipts.ts` is a real call site for all six, not dead vocabulary).

`emitActionAuthorisationReceipt`/`emitExecutionReceipt`/`emitConsequenceReceipt` mirror `invocationGateway.ts`'s `emitCapabilityReceipt()` precedent exactly: best-effort (`.catch(() => undefined)` — a receipt failure must never break the decision it describes), personaId-gated (no caller-resolved persona ⇒ silently skipped), and personaId is always passed separately from every T1-safe ref, never placed inside `actionInput`.

## Test methodology

`tests/vela-slice2g-execution-observation-validation.test.ts` reuses Slice 2F's exact mocking convention (same DB-backed seams stood in; Vela, composition, Gate 2, and authorisation/execution/observation/validation logic are all real). Two tiers:

1. **Deterministic** (19 tests, no Docker) — 19/19 green, covering: `bindExecution()`'s four behaviours (bind / refuse-not-authorised / refuse-expired / deterministic ref), the three-way validation comparison, `recordObservedConsequence()`, TEE-attestation independence, `assembleCausalChain()`'s full-chain and refused-chain shapes, the NOT_REQUIRED-vs-REQUIRED-absent distinction end to end, all six receipt call sites (including the personaId-skip path), and a Slice-2F regression re-proving Gate 2's three-way outcome is unchanged.
2. **Live** (opt-in, `VELA_SLICE2G_LIVE=1`) — the identical traversal extended through execution/observation/validation against the real running local Vela stack. Now proves all three operator-required cases in one traversal: ACCEPTABLE authorises, executes, and validates `MATCHED_PROJECTION`; the SAME live projection bound a SECOND, independent execution and validates `DIVERGED_FROM_PROJECTION` when the reported outcome differs; REQUIRED-and-absent confidential resolves `UNRESOLVED` with an explicit zero-execution assertion (`bound.execution` is `null`, not merely `status: 'refused'`).

Full regression: `npx vitest run` — 7204 passed / 45 pre-existing failures (confirmed unrelated: `git stash` reproduces the identical failure set with none of this slice's changes present) / 2 skipped. `tsc --noEmit` — 1085 errors, identical count and identical file set to the pre-existing baseline; zero new errors in any file this slice touched.

## Ontology freeze

Slice 2G is declared **code-complete**. `types/constitutionalCommerce.ts` — `ConstitutionalAuthority`, `ProposedAction`, `ConsequenceProjection` (+ `completeness`/`unresolvedComponents`/`AttestationRequirement`), `ActionAuthorisation`, `CommerceExecution`, `ObservedConsequence` (validationState: `MATCHED_PROJECTION | DIVERGED_FROM_PROJECTION | UNRESOLVED`) — is frozen as the canonical Constitutional/Conditional Commerce ontology. Future slices extend by composition (new providers, new capabilities, new receipt call sites) — they do not add fields to, or fork, these six types.

## Pre-deployment CHECK-constraint legacy verification (no live Supabase in this sandbox)

No `SUPABASE_URL`/`SUPABASE_ANON_KEY`/service-role credentials exist anywhere in this sandbox (checked: no `.env.local`, no matching env vars) — a live "every distinct `action_type` already in the table" query was not possible here. In its place: a **static superset proof** across the ENTIRE migration history, which is actually more exhaustive than a live sample (it does not depend on which rows happen to exist today).

Method: every migration that ever rebuilt `activity_receipts_action_type_check` wholesale (41 files, from the original `20260514000000_activity_receipts.sql` table creation through this slice's own migration) was parsed for its full `action_type` list, and the UNION of every literal ever declared valid at any point in history was computed (138 distinct literals). That union was diffed against `20260930010100_commerce_authorisation_execution_consequence_receipt_types.sql`'s rebuilt list (137 literals) — **exactly one** literal present in history but absent from the new list: `horizen_reconciliation_discrepancy_recorded`.

Traced to `20260930002100_reconciliation_discrepancy_protocol_level.sql`, which renamed it to `reconciliation_discrepancy_recorded` the SAME day it was added (`20260930002000_pulse_reconciliation_receipt_types.sql`) — the migration's own header states the rename happened "before any receipt has actually been written under the old name." Independently confirmed rather than trusted on the comment alone: `horizen_reconciliation_discrepancy_recorded` appears in **zero** `.ts` files anywhere in the repository (grepped) — no `createActivityReceipt` call site ever used that literal, so no row could exist with that `action_type` under any deployment of this codebase. The gap is real but proven harmless: **every `action_type` literal that any historical version of this codebase could actually have written is present in the new constraint.** No legacy row is rejected by this migration.

## Live proof — full chain, real Vela enclave

Two independent proofs were run against the real local Vela stack (`docker ps` confirmed all `vela-skit-*` containers healthy; chain RPC responsive at block `0x38`).

**Root cause found and fixed along the way:** the local Vela chain (`vela-skit-chain`, Anvil) does not persist in-memory state across a container restart. The `applicationId` recorded in Slice 2F's own session doc (`2089125378143059424`) no longer existed on the currently-running chain — confirmed live (`errorCode 9`-equivalent path: the WASM app itself was gone, though the ProcessorEndpoint/TeeAuthenticator contracts still existed at their deterministic Anvil-genesis addresses, redeployed by the `deployer` container on every stack start). The WASM artifact was untouched (found on disk in the `vela-skit-shared-data` volume at its recorded sha256, `b287b7e838d172d2acb196f248dc1d6a35ee70d4450ef88ca3dd11c83bd81c1c`), so only a fresh on-chain `submitDeployRequest` was needed — `scripts/vela-slice2g-redeploy.ts`, ABI verified directly against the pinned v0.2.0 Solidity source, produced **`applicationId 7738404303895312998`** (errorCode 0). A second root cause surfaced immediately after: a live PROCESS request against the fresh app failed with `errorCode 9 "no Secp521r1_PubKey found"` — the Vela protocol requires every requester's P-521 confidential-channel key be registered on-chain via an `ASSOCIATEKEY` request (RequestType=3) before any `PROCESS` request from that requester can be decrypted, undocumented in this repo until now. Fixed with `scripts/vela-slice2g-associate-key.ts` (standalone) and folded as a self-contained step into `scripts/vela-slice2g-live-proof.ts` (every run associates a fresh key before use). Neither fix touches Gate 2, `invocationGateway.ts`, or any constitutional-layer code — both are Vela wire-protocol mechanics.

**1. `tests/vela-slice2g-execution-observation-validation.test.ts`'s LIVE tier**, run with `VELA_SLICE2G_LIVE=1 VELA_APP_ID=7738404303895312998` against the real enclave: **20/20 passed**, proving in one traversal — ACTIVE authority → CFS-006a public projection → live Vela confidential projection → unified `ConsequenceProjection` → Gate 2 (`evaluateCapabilityAndRuntimeGate`, untouched) → `deriveActionAuthorisation()` → `bindExecution()` → `recordObservedConsequence()` → `assembleCausalChain()` — for `MATCHED_PROJECTION`, `DIVERGED_FROM_PROJECTION` (same live ACCEPTABLE projection, a second independent execution, reported outcome UNACCEPTABLE), and `REQUIRED`-absent → `UNRESOLVED` → zero execution (`bound.execution === null` asserted explicitly, plus the causal chain's `executionRef`/`observedConsequenceRef`/`validationState` all `null`).

**2. `scripts/vela-slice2g-live-proof.ts`** (standalone, narrated, persists evidence) — run against the same live app, all three cases passed. Gate 2 was called directly (`evaluateCapabilityAndRuntimeGate`, the exact frozen function, same fixture provider the test files use) rather than through the full `invokeCapability()` gateway, because the full gateway's Gate 1 additionally resolves the capability provider from a live Supabase-backed registry — the SAME already-documented, data-only gap Slice 2F's own doc named as out of scope for this sandbox. This did not touch or add an authorisation path; it exercised the identical frozen function the mocked test suite exercises, just without the DB-backed resolution step around it. The complete reference chain — every ref the operator required (`authorityRef, mandateRef, proposedActionRef, projectionContextRef, projectionRef, publicForecastRef, confidentialEvidenceRef, confidentialRequestRef, authorisationRef, executionRef, observedConsequenceRef, validation result`) for all three cases — is persisted at `codexes/packs/agentiq/updates/2026-08-22_vela-001-slice-2g-live-proof-evidence.json`.

**Constraints explicitly honoured, verified in the live run:**
- Gate 2 / `capabilityInvocationGates.ts` / `invocationGateway.ts` — **not modified**.
- No additional Vela-specific authorisation path was created (`deriveActionAuthorisation()` is the only authorisation derivation; the standalone script only skips the DB-backed provider-resolution step, it does not add a second way to become AUTHORISED).
- Execution binding never conflated with execution confirmation — every `bindExecution()` result asserted `transactionRef === undefined`; binding an intent is not confirming settlement.
- Consequence observation never conflated with consequence validation — `observedState` (opaque, caller-supplied) and `validationState` (computed by `compareProjectionToObservation`) are two independent fields on `ObservedConsequence`, asserted independently present in the live run.

## What remains explicitly out of scope for this slice

No production execution and no fund movement — `bindExecution()` never signs or broadcasts, consistent with `settlementExecutor.ts`'s established discipline for money-moving domains. Wiring these receipt/chain modules into a live MoneyPenny route (as opposed to proving them directly, as this slice does) is deployment integration work, tracked separately.

## Links

- `services/constitutionalCommerce/boundedExecution.ts`
- `services/constitutionalCommerce/observedConsequence.ts`
- `services/constitutionalCommerce/causalChain.ts`
- `services/constitutionalCommerce/commerceReceipts.ts`
- `types/constitutionalCommerce.ts` (`ObservedConsequence.validationState` renamed to `DIVERGED_FROM_PROJECTION`)
- `supabase/migrations/20260930010100_commerce_authorisation_execution_consequence_receipt_types.sql`
- `tests/vela-slice2g-execution-observation-validation.test.ts`
- `scripts/vela-slice2g-redeploy.ts`, `scripts/vela-slice2g-associate-key.ts`, `scripts/vela-slice2g-live-proof.ts`
- `codexes/packs/agentiq/updates/2026-08-22_vela-001-slice-2g-live-proof-evidence.json` — persisted complete reference chain
- Prior session docs: `2026-08-22_vela-001-slice-2f-gate2-authorisation.md`, `2026-08-22_vela-001-slice-2e-unified-consequence-projection.md`

## Next

`docs/vela/VELA_EARLY_ACCESS_HANDOFF.md` now captures the handoff. Remaining VELA-001 tracked work: SmartWallet `CONFIDENTIAL_PROJECTION_REQUEST` pending-action type, Journey Consequence Modal alignment, and the full §31 security/constitutional canary list — all deferred pending real Vela TEE attestation, per the handoff doc's determination that the next external milestone is production hardware attestation, not another local architecture pass.
