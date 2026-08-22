# VELA-001 Slice 2G — Bounded Execution, Observed Consequence, Consequence Validation, and the Commerce receipt taxonomy

**Date:** 2026-08-22
**Workstream:** VELA-001 — MoneyPenny × Vela: Confidential Constitutional Execution
**Status:** Slice 2G closed. 19/19 deterministic canaries green; live tier gated behind `VELA_SLICE2G_LIVE=1`.

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
2. **Live** (opt-in, `VELA_SLICE2G_LIVE=1`) — the identical traversal extended through execution/observation/validation against the real running local Vela stack, for ACCEPTABLE (executes, observes, validates `MATCHED_PROJECTION`), UNACCEPTABLE (execution refused), and UNRESOLVED (execution refused).

Full regression: `npx vitest run` — 7203 passed / 46 pre-existing failures (confirmed unrelated: `git stash` reproduces the identical failures with none of this slice's changes present) / 2 skipped. `tsc --noEmit` — 1085 errors, identical count and identical file set to the pre-existing baseline; zero new errors in any file this slice touched.

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
- Prior session docs: `2026-08-22_vela-001-slice-2f-gate2-authorisation.md`, `2026-08-22_vela-001-slice-2e-unified-consequence-projection.md`

## Next

Remaining VELA-001 tracked work: SmartWallet `CONFIDENTIAL_PROJECTION_REQUEST` pending-action type, Journey Consequence Modal alignment, the full §31 security/constitutional canary list, and `VELA_EARLY_ACCESS_HANDOFF.md` once locally-provable work is exhausted.
