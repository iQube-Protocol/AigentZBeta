# Commit Brief: `70fdc87` — CI AEE parity: identical wiring to KNYTS, no CI-specific logic [merge review/irl-scoped-restoration-2026-08-27]

| Field | Value |
|-------|-------|
| SHA | [`70fdc87`](https://github.com/iQube-Protocol/AigentZBeta/commit/70fdc87d7fe3f64f2ada313ece1c9e49dc34ddb6) |
| Author | Claude |
| Date | 2026-09-01T08:31:00Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
CI AEE parity: identical wiring to KNYTS, no CI-specific logic [merge review/irl-scoped-restoration-2026-08-27]

app/api/journey/constitutional-internet-bridge/state/route.ts now
parses ?activatedBranches=, passes it to resolveJourneyState, and
calls the SAME computeJourneyAeeOutcome orchestrator KNYTS uses --
line-for-line the same pattern (parseActivatedBranchesParam ->
resolveJourneyState(..., activatedBranches) -> try/catch
computeJourneyAeeOutcome -> additive `aee` response key, fail-open to
null). No new adapter, no new state model, no CI-specific
recommendation logic -- the client-side wiring (activateJourneyBranch,
JourneyRunSurface's re-evaluation listener) was already journey-
agnostic and needed no changes at all.

Acceptance is proven by PARAMETRIZING the existing KNYTS test suites
over both bridges (describe.each) rather than writing a parallel CI
copy -- identical test logic run twice against KNYTS_BRIDGE_CROSSING_
JOURNEY and CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY is what "no
CI-specific AEE logic" actually demonstrates:
- tests/adaptive-fs-branch-acceptance.test.ts: Case A and Case E now
  run against both journeys (13 tests, was 9).
- tests/journey-branch-immediate-reevaluation.test.ts: the full
  7-point end-to-end sequence (dormant at CHOOSE -> activate ->
  visible -> trigger fires -> refetch -> fs-discover recommended ->
  journeyId unchanged -> nothing marked complete) now runs against
  both journeys.
- tests/ci-bridge-state-aee-wiring.test.ts (new): mirrors knyts-
  bridge-state-aee-wiring.test.ts's structural canary for the CI
  route, plus one extra check that the route imports no adaptive
  module beyond the shared orchestrator.

Typecheck 678/678 (unchanged), full suite 17 failed files / 50 failed
tests (unchanged baseline -- repo-weight, resolution-records, one
flaky file). Zero regressions.
```

## Body

app/api/journey/constitutional-internet-bridge/state/route.ts now
parses ?activatedBranches=, passes it to resolveJourneyState, and
calls the SAME computeJourneyAeeOutcome orchestrator KNYTS uses --
line-for-line the same pattern (parseActivatedBranchesParam ->
resolveJourneyState(..., activatedBranches) -> try/catch
computeJourneyAeeOutcome -> additive `aee` response key, fail-open to
null). No new adapter, no new state model, no CI-specific
recommendation logic -- the client-side wiring (activateJourneyBranch,
JourneyRunSurface's re-evaluation listener) was already journey-
agnostic and needed no changes at all.

Acceptance is proven by PARAMETRIZING the existing KNYTS test suites
over both bridges (describe.each) rather than writing a parallel CI
copy -- identical test logic run twice against KNYTS_BRIDGE_CROSSING_
JOURNEY and CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY is what "no
CI-specific AEE logic" actually demonstrates:
- tests/adaptive-fs-branch-acceptance.test.ts: Case A and Case E now
  run against both journeys (13 tests, was 9).
- tests/journey-branch-immediate-reevaluation.test.ts: the full
  7-point end-to-end sequence (dormant at CHOOSE -> activate ->
  visible -> trigger fires -> refetch -> fs-discover recommended ->
  journeyId unchanged -> nothing marked complete) now runs against
  both journeys.
- tests/ci-bridge-state-aee-wiring.test.ts (new): mirrors knyts-
  bridge-state-aee-wiring.test.ts's structural canary for the CI
  route, plus one extra check that the route imports no adaptive
  module beyond the shared orchestrator.

Typecheck 678/678 (unchanged), full suite 17 failed files / 50 failed
tests (unchanged baseline -- repo-weight, resolution-records, one
flaky file). Zero regressions.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/journey/constitutional-internet-bridge/state/route.ts` |
| Modified | `tests/adaptive-fs-branch-acceptance.test.ts` |
| Added | `tests/ci-bridge-state-aee-wiring.test.ts` |
| Modified | `tests/journey-branch-immediate-reevaluation.test.ts` |

## Stats

 5 files changed, 159 insertions(+), 60 deletions(-)
