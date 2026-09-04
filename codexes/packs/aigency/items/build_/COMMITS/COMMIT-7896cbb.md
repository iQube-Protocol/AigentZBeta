# Commit Brief: `7896cbb` — Fix Track 2 frontier regression + parallelize provenance-cohort inference calls

| Field | Value |
|-------|-------|
| SHA | [`7896cbb`](https://github.com/iQube-Protocol/AigentZBeta/commit/7896cbbe99785a63e1042b698eedff0d1fa2f2c3) |
| Author | Claude |
| Date | 2026-09-04T20:49:21Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix Track 2 frontier regression + parallelize provenance-cohort inference calls

Two distinct, independently-verified defects behind the live EXP-P1 Crystal
v2 close-out blocker:

1. buildTrack2Programme (services/research/track2Programme.ts) treated a
   stage's 'unknown' status (its own substrate read failed) identically to
   the ordinary open lifecycle statuses when picking currentStageId and
   computing unblockedStageIds. Stage 1 (Discover Sources) reporting
   'unknown' on a candidate-source read failure hijacked currentStageId away
   from Stage 5's real 53/58-unclassified work, and excluded EVERY later
   stage — not just Stage 1's own label — from unblockedStageIds, which is
   what the orchestrator's act-offering gates read. Fixed by adding 'unknown'
   to PASSES_THROUGH and preferring any genuinely open stage over an unknown
   one when selecting currentStageId, falling back to the unknown stage only
   when nothing else in the programme is open.

   Verified this is safe for this pipeline's actual architecture (not a
   blanket "unknown always harmless" assumption): every stage derives its
   own status from its own direct substrate read (candidateSources,
   discoveryCandidates, or the shared cohortGate() reading promotedCohort),
   never by inheriting a completion judgement from an earlier stage — traced
   and pinned with a boundary test proving an unrelated stage's own
   unreadable substrate still correctly blocks its own real dependents.

   The Research Copilot (IRLResearchCopilotTab.tsx) needed no change — it
   already implements RES-2026-09-01-TRACK2-FAIL-SOFT-SWALLOWED-001's rule of
   preferring the computed pending-decision over the raw currentStageId
   label; the corruption was upstream of that decision (empty
   unblockedStageIds), not a gap in the Copilot's own display logic.

2. provenanceCohortPreparation.ts's prepareProvenanceCohort resolved each
   distinct source-document signature's suggestion (a real callSovereign
   inference round-trip) in a strictly sequential loop. The live EXP-P1
   corpus collapses onto seven distinct signatures, serializing seven
   inference calls inside one 60s-budget request — the actual cause of the
   observed HTTP 504 on GET .../provenance-cohort, distinct from the
   2026-09-03 fix that batched this module's deterministic DB-read triage.
   Now resolved via Promise.all (no concurrency limiter — unwarranted at this
   documented scale); every exception-cause semantic preserved exactly.

Two resolution records + candidate invariants filed per the mandatory
Resolution -> Invariant Loop; both new regression tests confirmed failing
against the pre-fix code before being confirmed passing against the fix.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Two distinct, independently-verified defects behind the live EXP-P1 Crystal
v2 close-out blocker:

1. buildTrack2Programme (services/research/track2Programme.ts) treated a
   stage's 'unknown' status (its own substrate read failed) identically to
   the ordinary open lifecycle statuses when picking currentStageId and
   computing unblockedStageIds. Stage 1 (Discover Sources) reporting
   'unknown' on a candidate-source read failure hijacked currentStageId away
   from Stage 5's real 53/58-unclassified work, and excluded EVERY later
   stage — not just Stage 1's own label — from unblockedStageIds, which is
   what the orchestrator's act-offering gates read. Fixed by adding 'unknown'
   to PASSES_THROUGH and preferring any genuinely open stage over an unknown
   one when selecting currentStageId, falling back to the unknown stage only
   when nothing else in the programme is open.

   Verified this is safe for this pipeline's actual architecture (not a
   blanket "unknown always harmless" assumption): every stage derives its
   own status from its own direct substrate read (candidateSources,
   discoveryCandidates, or the shared cohortGate() reading promotedCohort),
   never by inheriting a completion judgement from an earlier stage — traced
   and pinned with a boundary test proving an unrelated stage's own
   unreadable substrate still correctly blocks its own real dependents.

   The Research Copilot (IRLResearchCopilotTab.tsx) needed no change — it
   already implements RES-2026-09-01-TRACK2-FAIL-SOFT-SWALLOWED-001's rule of
   preferring the computed pending-decision over the raw currentStageId
   label; the corruption was upstream of that decision (empty
   unblockedStageIds), not a gap in the Copilot's own display logic.

2. provenanceCohortPreparation.ts's prepareProvenanceCohort resolved each
   distinct source-document signature's suggestion (a real callSovereign
   inference round-trip) in a strictly sequential loop. The live EXP-P1
   corpus collapses onto seven distinct signatures, serializing seven
   inference calls inside one 60s-budget request — the actual cause of the
   observed HTTP 504 on GET .../provenance-cohort, distinct from the
   2026-09-03 fix that batched this module's deterministic DB-read triage.
   Now resolved via Promise.all (no concurrency limiter — unwarranted at this
   documented scale); every exception-cause semantic preserved exactly.

Two resolution records + candidate invariants filed per the mandatory
Resolution -> Invariant Loop; both new regression tests confirmed failing
against the pre-fix code before being confirmed passing against the fix.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Added | `codexes/packs/agentiq/resolution-records/candidate-invariants/CI-2026-09-04-PARALLELIZE-INDEPENDENT-PER-KEY-INFERENCE-CALLS-001.json` |
| Added | `codexes/packs/agentiq/resolution-records/candidate-invariants/CI-2026-09-04-UNKNOWN-STATUS-NEVER-HIJACKS-VERIFIED-DOWNSTREAM-FRONTIER-001.json` |
| Added | `codexes/packs/agentiq/resolution-records/records/RES-2026-09-04-TRACK2-CLASSIFY-PROVENANCE-FRONTIER-REGRESSION-001.json` |
| Modified | `services/research/provenanceCohortPreparation.ts` |
| Modified | `services/research/track2Programme.ts` |
| Added | `tests/provenance-cohort-preparation-concurrency.test.ts` |
| Added | `tests/track2-classify-provenance-monotonic-projection.test.ts` |

## Stats

 7 files changed, 638 insertions(+), 15 deletions(-)
