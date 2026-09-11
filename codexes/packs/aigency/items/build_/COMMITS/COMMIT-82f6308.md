# Commit Brief: `82f6308` — fix empty-504 on /advance and turn Discover Sources into a Copilot approval

| Field | Value |
|-------|-------|
| SHA | [`82f6308`](https://github.com/iQube-Protocol/AigentZBeta/commit/82f6308b4a5fa66dd896bec04c30aa4767597df1) |
| Author | Claude |
| Date | 2026-08-30T21:57:56Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix empty-504 on /advance and turn Discover Sources into a Copilot approval

Task A — the empty HTTP 504 on POST /api/research/programme/EXP-P1/advance:
the one-time state composition (readiness + candidate/source/artifact reads
+ frozen-manifest verification + cohort reconciliation) plus measurement-
layer gate resolution had no time bound before the act-execution loop even
began. Add a hard Promise.race backstop (STATE_COMPOSITION_DEADLINE_MS)
around the initial state load that returns a structured 503 instead of
letting the request die, move the loop's own soft time-budget check to the
top of every iteration, reduce DEFAULT_TIME_BUDGET_MS from 45s to 20s (this
repo's own "~30s real ceiling regardless of declared maxDuration"
convention), and add PhaseTimer instrumentation covering auth, programme-
state derivation, readiness, measurement-layer resolution, each act, and the
final re-read — always present in ProgrammeRunResult.diagnostics.

Task B — Discover Sources is now a precise Copilot authorization instead of
a navigation exercise: "Approve targeted acquisition" (POST .../acquisition/
approve) writes the one durable fact authorizing a bounded acquisition job,
built from the SAME already-computed CrystalAcquisitionBrief the operator
was shown. POST .../acquisition/run-step then performs exactly ONE
ratified+verified institution's discovery per call, re-derives readiness
fresh after each step, and marks the approval complete the moment readiness
no longer needs it or every ratified institution is exhausted — never a
fixed acquisition quota. The Research Copilot's ObjectiveCard renders this
as the primary CTA when the discover-sources stop carries an
acquisitionBrief, driving approve -> bounded step loop -> "Run until you
need me" to continue the programme; "Open Discover Sources" survives as a
demoted secondary inspection link.

Adds crystal_acquisition_approvals (durable fact only, never a cached
decision — the deficit is always re-derived from live readiness).

79 orchestrator tests + 28 new Task B tests pass; full suite matches the
pre-existing 17-file/49-test baseline with zero new regressions; typecheck
clean. No live approve/run-step call was made against EXP-P1.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9
```

## Body

Task A — the empty HTTP 504 on POST /api/research/programme/EXP-P1/advance:
the one-time state composition (readiness + candidate/source/artifact reads
+ frozen-manifest verification + cohort reconciliation) plus measurement-
layer gate resolution had no time bound before the act-execution loop even
began. Add a hard Promise.race backstop (STATE_COMPOSITION_DEADLINE_MS)
around the initial state load that returns a structured 503 instead of
letting the request die, move the loop's own soft time-budget check to the
top of every iteration, reduce DEFAULT_TIME_BUDGET_MS from 45s to 20s (this
repo's own "~30s real ceiling regardless of declared maxDuration"
convention), and add PhaseTimer instrumentation covering auth, programme-
state derivation, readiness, measurement-layer resolution, each act, and the
final re-read — always present in ProgrammeRunResult.diagnostics.

Task B — Discover Sources is now a precise Copilot authorization instead of
a navigation exercise: "Approve targeted acquisition" (POST .../acquisition/
approve) writes the one durable fact authorizing a bounded acquisition job,
built from the SAME already-computed CrystalAcquisitionBrief the operator
was shown. POST .../acquisition/run-step then performs exactly ONE
ratified+verified institution's discovery per call, re-derives readiness
fresh after each step, and marks the approval complete the moment readiness
no longer needs it or every ratified institution is exhausted — never a
fixed acquisition quota. The Research Copilot's ObjectiveCard renders this
as the primary CTA when the discover-sources stop carries an
acquisitionBrief, driving approve -> bounded step loop -> "Run until you
need me" to continue the programme; "Open Discover Sources" survives as a
demoted secondary inspection link.

Adds crystal_acquisition_approvals (durable fact only, never a cached
decision — the deficit is always re-derived from live readiness).

79 orchestrator tests + 28 new Task B tests pass; full suite matches the
pre-existing 17-file/49-test baseline with zero new regressions; typecheck
clean. No live approve/run-step call was made against EXP-P1.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Added | `app/api/research/programme/[experimentId]/acquisition/approve/route.ts` |
| Added | `app/api/research/programme/[experimentId]/acquisition/run-step/route.ts` |
| Modified | `app/api/research/programme/[experimentId]/advance/route.ts` |
| Modified | `components/composer/IRLResearchCopilotTab.tsx` |
| Added | `services/research/crystalAcquisitionJob.ts` |
| Modified | `services/research/researchProgrammeOrchestrator.ts` |
| Added | `supabase/migrations/20260830213500_crystal_acquisition_approvals.sql` |
| Added | `tests/crystal-acquisition-approve-route.test.ts` |
| Added | `tests/crystal-acquisition-job.test.ts` |
| Added | `tests/crystal-acquisition-run-step-route.test.ts` |
| Modified | `tests/research-programme-orchestrator.test.ts` |
| Modified | `tests/track2-copilot-deep-link.test.ts` |

## Stats

 13 files changed, 1713 insertions(+), 52 deletions(-)
