# Commit Brief: `e21460f` — XP-1 follow-up: branch activation triggers immediate re-evaluation [merge review/irl-scoped-restoration-2026-08-27]

| Field | Value |
|-------|-------|
| SHA | [`e21460f`](https://github.com/iQube-Protocol/AigentZBeta/commit/e21460f8396559d38cc88c58092a90b27873f215) |
| Author | Claude |
| Date | 2026-09-01T08:21:52Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
XP-1 follow-up: branch activation triggers immediate re-evaluation [merge review/irl-scoped-restoration-2026-08-27]

activateJourneyBranch(...) now carries trigger: 'branch-intent-change'
in the SAME journey:select-stage CustomEvent it already dispatched --
no second event bus. JourneyRunSurface's existing listener reads
detail.trigger, checks it against the real typed
shouldReEvaluateAeeProjection/JourneyReEvaluationTrigger contract
(services/adaptive/journeyAeeOrchestrator.ts), and calls the SAME
refresh() this component already uses for every other trigger (mount,
auth transition, manual button) -- no client-side recommendation
engine, no parallel fetch path.

The state fetch itself was already relaying the current
sessionStorage-declared branch (serializeActivatedBranchesForJourney)
on every call; the only missing piece was causing that fetch to fire
the moment a branch activates rather than waiting for the next natural
refresh. That gap is now closed -- selecting a branch reveals it in
the stepper AND refetches authoritative state (reachableStageIds,
nextReachableStageId, aee) in the same interaction, no reload/remount/
navigation needed. Deterministic native fallback is unaffected --
computeJourneyAeeOutcome's own fail-open behavior inside the state
route is unchanged by this commit.

Acceptance (tests/journey-branch-immediate-reevaluation.test.ts):
proves the full sequence against the real, deployed KNYTS journey --
dormant at CHOOSE, JOIN_FINANCIAL_SERVICES activates the branch and
fires the trigger, the resulting refetch resolves fs-discover as the
AEE recommendation, the source journeyId is unchanged
(knyts-bridge-crossing throughout), and zero stages are marked
complete by the refetch itself (no evidence was supplied). A
structural canary confirms the listener wiring exists and that exactly
one event name is ever dispatched by journeyBranchActivation.ts.
```

## Body

activateJourneyBranch(...) now carries trigger: 'branch-intent-change'
in the SAME journey:select-stage CustomEvent it already dispatched --
no second event bus. JourneyRunSurface's existing listener reads
detail.trigger, checks it against the real typed
shouldReEvaluateAeeProjection/JourneyReEvaluationTrigger contract
(services/adaptive/journeyAeeOrchestrator.ts), and calls the SAME
refresh() this component already uses for every other trigger (mount,
auth transition, manual button) -- no client-side recommendation
engine, no parallel fetch path.

The state fetch itself was already relaying the current
sessionStorage-declared branch (serializeActivatedBranchesForJourney)
on every call; the only missing piece was causing that fetch to fire
the moment a branch activates rather than waiting for the next natural
refresh. That gap is now closed -- selecting a branch reveals it in
the stepper AND refetches authoritative state (reachableStageIds,
nextReachableStageId, aee) in the same interaction, no reload/remount/
navigation needed. Deterministic native fallback is unaffected --
computeJourneyAeeOutcome's own fail-open behavior inside the state
route is unchanged by this commit.

Acceptance (tests/journey-branch-immediate-reevaluation.test.ts):
proves the full sequence against the real, deployed KNYTS journey --
dormant at CHOOSE, JOIN_FINANCIAL_SERVICES activates the branch and
fires the trigger, the resulting refetch resolves fs-discover as the
AEE recommendation, the source journeyId is unchanged
(knyts-bridge-crossing throughout), and zero stages are marked
complete by the refetch itself (no evidence was supplied). A
structural canary confirms the listener wiring exists and that exactly
one event name is ever dispatched by journeyBranchActivation.ts.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `components/journey/JourneyRunSurface.tsx` |
| Modified | `services/journey/journeyBranchActivation.ts` |
| Added | `tests/journey-branch-immediate-reevaluation.test.ts` |

## Stats

 4 files changed, 162 insertions(+), 4 deletions(-)
