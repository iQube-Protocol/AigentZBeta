# Commit Brief: `25797da` — XP-1: first live AEE convergence loop, wired against the FS branch [merge review/irl-scoped-restoration-2026-08-27]

| Field | Value |
|-------|-------|
| SHA | [`25797da`](https://github.com/iQube-Protocol/AigentZBeta/commit/25797da80a88bde16f7930e9d0e5799580bd63d5) |
| Author | Claude |
| Date | 2026-09-01T07:58:51Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
XP-1: first live AEE convergence loop, wired against the FS branch [merge review/irl-scoped-restoration-2026-08-27]

authoritative state -> AdaptiveInteractionContext -> AEE/NBE ->
ExperienceProjection -> surface -> evidence/state change -> re-evaluation

Journey Spine (resolveJourneyState.ts):
- Real dependenciesMet (was a stub always returning true) via the
  existing evaluateCondition evaluator, over a global flattened view of
  all stages' evidence.
- New computeJourneyReachability: DAG-correct, branch-aware reachable
  stages + nextStageId, independent of the legacy linear
  READY-computation several non-linear journeys (KNYTS/CI) already
  navigate around. Focus rule: once any branch is activated, ambient
  gate-less stages step aside for that branch's own sequence.
- resolveJourneyState takes an optional activatedBranches param
  (caller-supplied, never invented) and returns it plus
  reachableStageIds/nextReachableStageId on JourneyRuntimeState.

AEE adapter (services/adaptive/journeyAeeOrchestrator.ts, new):
- The first live caller of services/adaptive/* (Phase 0 audit found
  zero outside its own test). Binds resolveJourneyState,
  assembleInteractionContext, buildAdaptiveInteractionContext and
  produceExperienceProjection -- reimplements none of them.
- journeySpineAdapter.ts's buildJourneyProjectionContext now prefers
  reachableStageIds when present (zero other callers exist, so this
  changes no live behavior elsewhere).
- Pure read: no Supabase client, no mutation function, cannot mark a
  stage complete -- enforced by an import-authority test.
- Legacy NBE candidate seam (legacyCandidateStageId) documents the
  convergence contract without fabricating an integration the KNYT
  depth-ladder vocabulary has no real mapping for yet.
- Re-evaluation trigger contract (JourneyReEvaluationTrigger) named,
  not a new observation store -- DCIR remains the observation owner.

Live wiring: KNYTS bridge state route parses a client-relayed
activatedBranches query param (declared via a real activateJourneyBranch
click, never server-guessed), passes it to resolveJourneyState, and
attaches the AEE outcome additively as a new response key (aee) inside
a try/catch that falls open to null -- never blocks state. JourneyRunSurface
relays the current sessionStorage-declared branch on every state fetch.

app/api/runtime/nbe/route.ts is now documented as a candidate/fallback/
compatibility source, never an independent authority for AEE-adopted
journeys -- unchanged otherwise; KNYT depth-ladder callers are
unaffected.

Acceptance (tests/adaptive-fs-branch-acceptance.test.ts): case A proven
on the real, deployed KNYTS Bridge journey (JOIN_FINANCIAL_SERVICES,
no evidence -> DISCOVER). Cases B/C/D proven on a fixture sharing the
FS branch's exact grammar, since the live FS branch's DISCOVER/LEARN/
EXPLORE deliberately carry zero completionEvidence (an honest
informational on-ramp, unchanged per this task's own scope) -- there is
no real evidence source on the live journey to prove evidence-gated
advancement past them yet. Case E proven against both a throwing and a
postflight-invalid provider, falling back to the same correct native
recommendation.
```

## Body

authoritative state -> AdaptiveInteractionContext -> AEE/NBE ->
ExperienceProjection -> surface -> evidence/state change -> re-evaluation

Journey Spine (resolveJourneyState.ts):
- Real dependenciesMet (was a stub always returning true) via the
  existing evaluateCondition evaluator, over a global flattened view of
  all stages' evidence.
- New computeJourneyReachability: DAG-correct, branch-aware reachable
  stages + nextStageId, independent of the legacy linear
  READY-computation several non-linear journeys (KNYTS/CI) already
  navigate around. Focus rule: once any branch is activated, ambient
  gate-less stages step aside for that branch's own sequence.
- resolveJourneyState takes an optional activatedBranches param
  (caller-supplied, never invented) and returns it plus
  reachableStageIds/nextReachableStageId on JourneyRuntimeState.

AEE adapter (services/adaptive/journeyAeeOrchestrator.ts, new):
- The first live caller of services/adaptive/* (Phase 0 audit found
  zero outside its own test). Binds resolveJourneyState,
  assembleInteractionContext, buildAdaptiveInteractionContext and
  produceExperienceProjection -- reimplements none of them.
- journeySpineAdapter.ts's buildJourneyProjectionContext now prefers
  reachableStageIds when present (zero other callers exist, so this
  changes no live behavior elsewhere).
- Pure read: no Supabase client, no mutation function, cannot mark a
  stage complete -- enforced by an import-authority test.
- Legacy NBE candidate seam (legacyCandidateStageId) documents the
  convergence contract without fabricating an integration the KNYT
  depth-ladder vocabulary has no real mapping for yet.
- Re-evaluation trigger contract (JourneyReEvaluationTrigger) named,
  not a new observation store -- DCIR remains the observation owner.

Live wiring: KNYTS bridge state route parses a client-relayed
activatedBranches query param (declared via a real activateJourneyBranch
click, never server-guessed), passes it to resolveJourneyState, and
attaches the AEE outcome additively as a new response key (aee) inside
a try/catch that falls open to null -- never blocks state. JourneyRunSurface
relays the current sessionStorage-declared branch on every state fetch.

app/api/runtime/nbe/route.ts is now documented as a candidate/fallback/
compatibility source, never an independent authority for AEE-adopted
journeys -- unchanged otherwise; KNYT depth-ladder callers are
unaffected.

Acceptance (tests/adaptive-fs-branch-acceptance.test.ts): case A proven
on the real, deployed KNYTS Bridge journey (JOIN_FINANCIAL_SERVICES,
no evidence -> DISCOVER). Cases B/C/D proven on a fixture sharing the
FS branch's exact grammar, since the live FS branch's DISCOVER/LEARN/
EXPLORE deliberately carry zero completionEvidence (an honest
informational on-ramp, unchanged per this task's own scope) -- there is
no real evidence source on the live journey to prove evidence-gated
advancement past them yet. Case E proven against both a throwing and a
postflight-invalid provider, falling back to the same correct native
recommendation.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/journey/knyts-bridge/state/route.ts` |
| Modified | `app/api/runtime/nbe/route.ts` |
| Modified | `components/journey/JourneyRunSurface.tsx` |
| Added | `services/adaptive/journeyAeeOrchestrator.ts` |
| Modified | `services/adaptive/journeySpineAdapter.ts` |
| Modified | `services/journey/journeyBranchActivation.ts` |
| Modified | `services/journey/resolveJourneyState.ts` |
| Added | `tests/adaptive-fs-branch-acceptance.test.ts` |
| Added | `tests/journey-spine-reachability.test.ts` |
| Added | `tests/knyts-bridge-state-aee-wiring.test.ts` |
| Modified | `types/journey.ts` |

## Stats

 12 files changed, 972 insertions(+), 25 deletions(-)
