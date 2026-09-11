# HORIZEN-FS-PILOT-CLOSURE-001 — Horizen / MoneyPenny Phase 3 final closeout

**Status: CLOSED.** This pilot path should not be modified further unless new live
evidence reveals a defect.

## What this closes

The Horizen / MoneyPenny Financial Services Phase 3 pilot — Standing accrual, the
provider-attribution correction, and the Runtime readiness projection all landed
correct in earlier passes this session. The final increment was purely UI: making
the already-correct architecture legible on screen. No threshold, accrual logic,
authority gate, Vela gate, or historical evidence was touched in this pass.

## Problem being closed

`ServiceOrchestrationPanel` rendered a consumer's Standing-below-threshold refusal
as one undifferentiated badge — `not eligible — STANDING_BELOW_THRESHOLD` — sitting
directly beside the Runtime readiness row. Read cold, that conflated two
independent facts into one: *"MoneyPenny Runtime is not eligible."* The Runtime
pipeline was never down; the SELECTED CONSUMER (Nakamoto/Kn0w1) simply had not
reached that service's Standing floor yet. Separately, `ParticipationStandingTab`
showed MoneyPenny's real Stand (Personal 3.0 / Delegated 0 / Stewardship 0 /
Capability 0 / overall 2.1, Stand ✓ complete) with no explanation of why "Stand
complete" and "overall 2.1" are not contradictory — 2.1 is well below Runtime's
Standing floor of 25, and nothing on screen said that floor existed or that
reaching it is a separate, later qualification.

## What changed (UI/copy only)

**`app/(shell)/moneypenny/components/ServiceOrchestrationPanel.tsx`** — each
service card now renders two explicit, separately labeled layers, derived from
the exact same server-computed facts (`readiness`, `eligibility`, `authority`,
`definition.governancePath`) already in place — no new field, gate, or decision:

- **Runtime system** — `Constitutional Runtime: READY` / `Execution path:
  Constitutional Service Pipeline` / `Vela: Not required` / `Attestation: Not
  required` for the Constitutional variant; `Confidential Runtime: PRE-VELA
  READY` / `Execution path: Constitutional Commerce` / `Vela Live attestation:
  Pending` for the Confidential variant. Always independent of the selected
  consumer below it.
- **Selected agent qualification** — Admission/Eligibility, Standing, Authority,
  Confidential assurance. A `STANDING_BELOW_THRESHOLD` refusal now reads
  `Selected agent Standing: {score} / {threshold} — not yet qualified`
  (score/threshold parsed from the existing `eligibility.reason` string that
  `evaluateFinancialServiceEligibility()` already returns — no backend change).
  The raw machine code (`STANDING_BELOW_THRESHOLD`, etc.) stays available via the
  badge's `title` tooltip. Tone is amber, never rose — a policy outcome for that
  consumer, not a Runtime-health failure.

**`app/triad/components/codex/tabs/ParticipationStandingTab.tsx`** — a compact
note beneath the Standing lanes (rendered only when a real `standing` record
exists, and never altering the lane values themselves): *"Stand established
means genuine Standing now exists. It does not mean the agent has reached every
downstream service's qualification threshold — Consequential Runtime
qualification threshold: 25."* The "25" is the real, live value of
`minimumStandingScore` on both Runtime service definitions in
`services/financialServices/serviceCatalog.ts` (verified from source, not
guessed).

**`app/(shell)/moneypenny/components/serviceOrchestrationPanelState.ts`** — added
an optional `governancePath?: string` field to `FinancialServiceDefinitionSummary`,
mirroring a field the API already returns (`types/financialServices.ts`'s
`FinancialServiceDefinition.governancePath`) but that the client-side summary
type had not previously declared.

## Verification

- New targeted suite: `tests/service-orchestration-panel-ui-semantics.test.ts`
  (14 cases) — proves the qualification copy never contains the word "Runtime",
  proves the Constitutional/Confidential Runtime field sets match the operator's
  literal spec, proves the Runtime-system layer never renders a "not-ready"/
  "failing"/"broken" word regardless of the selected consumer's own state, and
  proves the raw machine code survives in the tooltip.
- `npx tsc --noEmit`: 1085 errors — **identical with and without this session's
  changes** (verified via `git stash`/`git stash pop` around the same tsc run).
  The earlier-reported baseline of 674 had drifted from other concurrent work on
  this shared repo; this pass introduces zero new type errors.
- `npx vitest run` (full suite): 19 failed files / 47 failed tests — the exact
  same failing files as before this change (`constitutional-context`,
  `phase-a-baseline-canaries`, `repo-weight`, etc.), none of them touching any
  file this pass modified. `tests/service-orchestration-panel-state.test.ts` and
  `tests/moneypenny-service-orchestration-route.test.ts` (the two existing
  suites over the files this pass edited) both still pass in full.

## Acceptance criteria — verified

- MoneyPenny Stand remains complete (unedited; this pass touched no accrual
  path). ✓
- MoneyPenny Standing remains exactly 3.0 Personal / 2.1 overall (unedited). ✓
- Constitutional Runtime visibly reads system-ready even when the selected
  consumer is below Standing 25 — the two layers render independently, and
  `readiness.systemReady` is untouched (`runtimeReadinessProjection.ts`, still
  unmodified this pass). ✓
- Confidential Runtime visibly reads pre-Vela-ready with Vela Live attestation
  as the sole infrastructure dependency. ✓
- Nakamoto/Kn0w1 below-threshold states identify the selected consumer
  ("Selected agent Standing: ...") — never "MoneyPenny Runtime". ✓
- No threshold reduction, no Standing mutation, no gate change, no DVN work —
  confirmed by diff scope: three UI files + one new test file only. ✓
- Targeted + full regression run, baseline unchanged. ✓

## Disposition

Closed. Do not modify this pilot path further unless new live evidence reveals
a defect in the Standing/Runtime/eligibility semantics this session corrected
and then made legible.
