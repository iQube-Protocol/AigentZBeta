# Vela Risk-Invariant Telemetry Hook — Use Case Zero Build-Order Item 6 (direct sequel to the underwriting vertical slice)

**Date:** 13 September 2026
**Status:** Implemented, tested, committed locally (not pushed).
**Scope:** A small, purely additive telemetry hook onto the completed
underwriting projection
(`services/vela/velaUnderwritingProjection.ts`, item 5) that emits ONE
normalized `golden_cycle_records` evidence row per run, using ONLY
already-authorized outputs / receipt evidence.

Operator ruling, verbatim: *"Its job should be very small and additive: take
the completed underwriting activity receipt and emit a normalized telemetry
record containing the constitutional and actuarial observables we care
about... The important rule is that telemetry must use only already-authorized
outputs / receipt evidence, not reopen confidential raw party data. Invariant
Intelligence should learn from constitutional outcomes, not become a side
channel around the privacy boundary."*

## 1. Preflight

Reviewed before writing any code:

- `services/vela/velaUnderwritingProjection.ts` in full — the file being
  extended, including `buildUnderwritingActionInput`'s exact
  already-authorized-only field set and `runVelaUnderwritingProjection`'s
  control flow (prepare -> submit -> poll -> quote -> receipt -> return).
- `services/financialServices/providers/underwriting/underwritingProviderTypes.ts`
  and `simulatedUnderwritingProvider.ts` — confirmed `UnderwritingQuote`'s
  nine operator-specified fields were exactly right and not to be extended;
  `policyVersion` belongs on the PROVIDER instead.
- `supabase/migrations/20260912195402_golden_cycle_evidence_records.sql` — the
  exact column shape of `golden_cycle_records`, confirmed via the migration's
  own header to be the canonical Use Case Zero Sec.12 evidence substrate, with
  no writer anywhere in the repo before this item (grep-confirmed).
- **Three differently-shaped, unrelated systems ruled out as the destination**
  (read in full, not guessed from their names):
  - `types/invariantIntelligence.ts` (CRP-002 IRL research programme) — an
    intent/knowledge-compression research contract.
  - `services/consequence/operatingModel.ts` (CFS-006a) — an intentRef-keyed
    invariant-grounding/knowledge-evolution loop; this item has no intentRef
    and no grounding set.
  - `services/venture/ventureOutcomeAccrual.ts` — venture outcome
    verification -> Standing accrual; a different accrual concern.
- `services/venture/ventureOutcomeAccrual.ts` and
  `services/consequence/operatingModel.ts` were ALSO read as the two style
  precedents to mirror: the former for `getSupabaseServer()`-unavailable
  fail-closed discipline, the latter for fire-and-forget
  `.catch((err) => { console.error(...); return null; })` discipline on a
  side-effect write that must never block the caller.
- `tests/vela-underwriting-projection.test.ts` in full — the one existing
  test file extended (see §4).
- `tests/_lib/fakeSupabase.ts` — the existing multi-table in-memory Postgrest
  fake, reused (Extend, Don't Duplicate) for the new test file's Supabase
  mocking rather than a second hand-rolled fake.
- Resolution records reviewed: `RES-2026-09-13-VELA-UNDERWRITING-VERTICAL-SLICE-001`
  and its candidate `CI-2026-09-13-VELA-UNDERWRITING-VERDICT-ONLY-QUOTE-PROVIDER-001`
  — this item's own candidate is parented to it.
- Unresolved risk this item does NOT invalidate, duplicate, bypass, or
  regress: the underwriting vertical slice's own eight gates (untouched, its
  own test suite passes unchanged plus 6 new additive tests), the multi-party
  substrate, and the single-party substrate.

## 2. What was built

### Provider — one additive field

`services/financialServices/providers/underwriting/underwritingProviderTypes.ts`:
added `readonly policyVersion: string` to `UnderwritingProvider`, alongside the
existing `mode` field — a property of the PROVIDER (which pricing/policy
formula generation is running), not of each individual `UnderwritingQuote`
(whose nine operator-specified fields were left untouched).
`simulatedUnderwritingProvider.ts`: `SimulatedUnderwritingProvider` sets
`policyVersion = 'vela-use-case-zero-underwriting-simulated-v1'` as a named
class field; `createUnderwritingProvider()` needed no change.

### New file — the telemetry hook

`services/vela/velaUnderwritingRiskTelemetry.ts` exports
`VelaUnderwritingRiskTelemetryInput` (an explicit named interface — never
`Record<string, unknown>`, never a passthrough) and
`recordVelaUnderwritingRiskTelemetry`. The input type has structurally no
field shape for a party's raw financial inputs, `recipientAddress`, or any T0
identifier — mirroring `underwritingProviderTypes.ts`'s own gate-1 structural
proof. The function:

- Fails closed (`null`, never throws) when `getSupabaseServer()` returns
  `null`.
- Computes `record_key = "vela-underwriting:${onChainRequestId}"` and upserts
  ON that key (`{ onConflict: 'record_key' }`) — idempotent by construction.
- Maps every `golden_cycle_records` JSONB column exactly as specified; every
  column this item has no honest evidence for
  (`risk_cycle`, `information_provenance`, `observed_outcome`,
  `repair_or_claim`, `burden_bearer`, `calibration_error`,
  `constitutional_conditions`) is set to a literal empty object `{}` — never
  fabricated.
- Stamps `evidence_status: 'operational_hypothesis_generating'` EXPLICITLY on
  every row (never the column's own default), per CLAUDE.md's Hypothesis vs
  Canon discipline and the governing spec's own Sec.12 sentence.
- Wraps the write in try/catch, logs via `console.error` with a
  `[vela-underwriting-telemetry]` prefix, and resolves `null` on any failure
  — never throws.

### Composition into the orchestration function

`services/vela/velaUnderwritingProjection.ts`: `runVelaUnderwritingProjection`
now captures `startedAtMs` at entry, and — immediately AFTER the existing
`createActivityReceipt` call, with that call's own position/behaviour
unchanged — calls `recordVelaUnderwritingRiskTelemetry`, reusing the SAME
local variables already computed for the causal receipt's `actionInput`
(never recomputed) plus `receiptId`, `provider.policyVersion`,
`settlementOccurred: params.asset != null`, and `timeToCompletionMs: Date.now()
- startedAtMs`. `VelaUnderwritingProjectionResult` gained one new field,
`telemetryRecordId: string | null`. No additional try/catch was added at the
call site — `recordVelaUnderwritingRiskTelemetry` itself never throws, proven
directly by a test forcing the mocked telemetry call to resolve `null` and
asserting the run's own `disposition`/`quote`/`receiptId` are unchanged.

### No new receipt type, no new migration

The existing `vela_underwriting_projection_completed` receipt (item 5) remains
the ONE causal, DVN-anchorable receipt for this workload. The new
`golden_cycle_records` row is additional evidence that REFERENCES that
receipt's id (`provenance.receiptId`), never a peer or replacement.
`tests/activity-receipts-action-type-parity.test.ts` (3/3) confirmed
unchanged — no new `ActivityActionType` or CHECK-constraint migration was
added or needed.

## 3. Test changes

### `tests/vela-underwriting-projection.test.ts` (extended, not rewritten)

- The gate-1 spy provider literal gained `policyVersion: 'test-provider-v1'`
  — the ONE change to any pre-existing test in this file (needed to
  typecheck against the extended `UnderwritingProvider` interface).
- Added a mock for `@/services/vela/velaUnderwritingRiskTelemetry` alongside
  the pre-existing `createActivityReceipt` mock.
- New describe block, `'risk telemetry hook (item 6)'`, six tests proving:
  `telemetryRecordId` propagation (both the success and null-resolution
  cases); the telemetry call receives the SAME
  disposition/quote/applicationId/partyNamespaceRefs/onChainRequestId/receiptId
  the run itself actually produced (asserted against the run's own result,
  never hand-typed duplicate literals); `settlementOccurred` false/true for
  no-asset/asset runs; a non-negative `timeToCompletionMs`; and — most
  centrally — a telemetry failure never regresses the run's own
  disposition/quote/receiptId.
- All 13 pre-existing tests pass unchanged; the file now carries 19 tests
  total.

### `tests/vela-underwriting-risk-telemetry.test.ts` (new file, 9 tests)

- A `@ts-expect-error` gate proving the input type cannot accept an object
  shaped like raw `VelaProjectionInputs` (mirrors
  `tests/underwriting-provider-simulated.test.ts`'s own gate-1 proof).
- An exact field-mapping test spot-checking every `golden_cycle_records`
  column, including that every never-fabricated column is a literal empty
  object and `evidence_status` is exactly `'operational_hypothesis_generating'`.
- Two supporting mapping tests (`settlementOccurred: true`, and
  `requestingPartyNamespaceRef` defaulting to `null` when omitted).
- An idempotency pair: the SAME `record_key`/row id on a retried emission for
  the same `onChainRequestId` (with the second call's own data winning,
  proving a real update rather than a silently-dropped duplicate insert); a
  DIFFERENT `onChainRequestId` producing a second row.
- Three fail-closed tests: `getSupabaseServer()` returning `null`; the upsert
  itself returning a Postgrest error; the upsert call throwing outright — all
  three resolve `null` rather than propagating.
- Reuses `tests/_lib/fakeSupabase.ts`'s multi-table Postgrest fake for the
  mapping/idempotency tests (Extend, Don't Duplicate) rather than a second
  hand-rolled in-memory fake.

## 4. Verification

- `npx vitest run tests/vela-underwriting-risk-telemetry.test.ts
  tests/vela-underwriting-projection.test.ts` — **28/28 passed** (9 + 19).
- `npx vitest run tests/vela-*.test.ts
  tests/underwriting-provider-simulated.test.ts
  tests/vela-underwriting-risk-telemetry.test.ts` (11 files) — **184 passed +
  2 skipped (186 total)**, exactly the prior item's own recorded baseline
  (169 passed + 2 skipped, 10 files) plus this item's +6 additive tests in
  the pre-existing projection test file and +9 in the new telemetry test
  file (15 new, byte-for-byte), with the 10 pre-existing files' own
  pass/skip counts otherwise unchanged.
- `npx vitest run tests/factor-vela-confidential-workload.test.ts
  tests/activity-receipts-action-type-parity.test.ts` — **11/11 passed**,
  both files unchanged (confirms no new `ActivityActionType`/migration was
  introduced or needed).
- `npx tsc --noEmit` — 1018 pre-existing, unrelated errors across the repo
  (confirmed present before this item's own changes were introduced, in
  files this item never touched); grepping the full output for every file
  this item added or modified (`velaUnderwriting`, `underwritingProviderTypes`,
  `simulatedUnderwritingProvider`, the two test files) returns **zero
  matches** — no new type errors were introduced.

## 5. Resolution record + candidate invariant + canary

- Resolution record:
  `codexes/packs/agentiq/resolution-records/records/RES-2026-09-13-VELA-RISK-INVARIANT-TELEMETRY-HOOK-001.json`
- Candidate invariant:
  `codexes/packs/agentiq/resolution-records/candidate-invariants/CI-2026-09-13-VELA-TELEMETRY-AUTHORIZED-SURFACE-ONLY-001.json`
  (parented to `CI-2026-09-13-VELA-UNDERWRITING-VERDICT-ONLY-QUOTE-PROVIDER-001`)
- Canaries: `tests/vela-underwriting-risk-telemetry.test.ts`,
  `tests/vela-underwriting-projection.test.ts`

Status kept at `candidate` — not self-ratified, per the loop's own discipline
(first occurrence).

## 6. Explicitly out of scope (left for a later item)

Factor integration, Aegis integration, any UI/demo surface, any code that
READS/aggregates `golden_cycle_records` into invariant candidates (this item
is producer-only), any repair/claim outcome modeling, any new
`ActivityActionType` or Supabase migration. None of these were built.
