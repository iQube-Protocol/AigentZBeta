# Commit Brief: `aec0d2d` — generalize the pending-decision filter: actionable, not just remedies

| Field | Value |
|-------|-------|
| SHA | [`aec0d2d`](https://github.com/iQube-Protocol/AigentZBeta/commit/aec0d2d6f42df9391efb3b543317ced763014cc2) |
| Author | Claude |
| Date | 2026-08-30T22:56:36Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
generalize the pending-decision filter: actionable, not just remedies

prepare-independent-review was invisible in the Research Copilot even when
ReviewPackageControl (a real, complete action surface) was ready to use:
firstPendingDecision excluded any partially-complete stage with an empty
remedies array, on the theory that empty remedies means "nothing left to
do" -- true for Classify Provenance's historical-exclusions-only case, but
wrong for Stage 10, where the review itself IS the act and there is nothing
to remediate.

Fix is generic, not a stage-name special case: services/research/
track2Programme.ts's Track2Stage gains an `actionable?: boolean` field,
declared by the stage itself from its own observed state (the same way it
already declares status/detail/remedies) -- true only when a real, existing
decision surface is available right now. prepare-independent-review sets it
when independentReviewRequestOpen is true; every other stage is unchanged
(field defaults to falsy).

researchProgrammeOrchestrator.ts's firstPendingDecision filter becomes
`remedies.length > 0 || stage.actionable === true`, and PendingGovernance
Decision carries `actionable` verbatim so a consumer never has to re-derive
it. buildAcquisitionPendingDecision also sets actionable: true (it already
was one, this just states it explicitly).

No change to any already-actionable stage: review-and-admit, classify-
provenance (real exclusion case unchanged, still filtered), add-
relationships, assign-to-crystal, review-and-promote, and freeze all follow
their existing derivation. Freeze remains separately gated -- this touches
only the filter that decides which stage becomes the SUGGESTED pending
decision; the orchestrator still holds no path to the freeze act.

5 new tests: the generic mechanism proven on a synthetic stage (not
prepare-independent-review itself), the real Stage 10 fix end-to-end (open
vs closed review request), and a freeze-immunity canary. Full suite matches
the pre-existing 17-file/49-test baseline with zero new regressions;
typecheck clean.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9
```

## Body

prepare-independent-review was invisible in the Research Copilot even when
ReviewPackageControl (a real, complete action surface) was ready to use:
firstPendingDecision excluded any partially-complete stage with an empty
remedies array, on the theory that empty remedies means "nothing left to
do" -- true for Classify Provenance's historical-exclusions-only case, but
wrong for Stage 10, where the review itself IS the act and there is nothing
to remediate.

Fix is generic, not a stage-name special case: services/research/
track2Programme.ts's Track2Stage gains an `actionable?: boolean` field,
declared by the stage itself from its own observed state (the same way it
already declares status/detail/remedies) -- true only when a real, existing
decision surface is available right now. prepare-independent-review sets it
when independentReviewRequestOpen is true; every other stage is unchanged
(field defaults to falsy).

researchProgrammeOrchestrator.ts's firstPendingDecision filter becomes
`remedies.length > 0 || stage.actionable === true`, and PendingGovernance
Decision carries `actionable` verbatim so a consumer never has to re-derive
it. buildAcquisitionPendingDecision also sets actionable: true (it already
was one, this just states it explicitly).

No change to any already-actionable stage: review-and-admit, classify-
provenance (real exclusion case unchanged, still filtered), add-
relationships, assign-to-crystal, review-and-promote, and freeze all follow
their existing derivation. Freeze remains separately gated -- this touches
only the filter that decides which stage becomes the SUGGESTED pending
decision; the orchestrator still holds no path to the freeze act.

5 new tests: the generic mechanism proven on a synthetic stage (not
prepare-independent-review itself), the real Stage 10 fix end-to-end (open
vs closed review request), and a freeze-immunity canary. Full suite matches
the pre-existing 17-file/49-test baseline with zero new regressions;
typecheck clean.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `services/research/researchProgrammeOrchestrator.ts` |
| Modified | `services/research/track2Programme.ts` |
| Modified | `tests/research-programme-orchestrator.test.ts` |

## Stats

 4 files changed, 215 insertions(+), 13 deletions(-)
