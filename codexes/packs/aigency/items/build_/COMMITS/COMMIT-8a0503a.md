# Commit Brief: `8a0503a` — fix EXP-P1 Track2 15s timeout: batch review-queue duplicate-check by namespace

| Field | Value |
|-------|-------|
| SHA | [`8a0503a`](https://github.com/iQube-Protocol/AigentZBeta/commit/8a0503a13e5cb7d13f215fc6f7aa65d714487dc4) |
| Author | Claude |
| Date | 2026-09-05T01:46:59Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix EXP-P1 Track2 15s timeout: batch review-queue duplicate-check by namespace

buildReviewAndPromoteQueue called findDuplicates (a fresh listInvariants
scan) once per awaiting candidate instead of once per distinct namespace —
the identical N+1 shape fixed twice the prior day elsewhere in this file
family, but this call site was missed by both reviews. It stayed invisible
because firstPendingDecision kept Stage 2 (review-and-admit) as the pending
decision for as long as any source awaited review, so Stage 4's queue never
ran for EXP-P1 until the final admission cleared Stage 2 for the first
time — at which point the entire accumulated ~58-candidate backlog paid its
own round trip in one composition pass, blowing the 15s budget.

Split findDuplicates into a pure findDuplicatesInPool (scoring only) plus
the existing fetch-then-score wrapper, and batch one listInvariants read
per distinct namespace across the awaiting-candidate batch, mirroring
evidenceByDomain two lines above and populationReconciliation.ts's
batchFindExactStatementMatches. Narrowed pipeline-continuity.test.ts's
composer canary to the domain-keyed shape (the actual historical defect)
rather than the bare listInvariants substring, mirroring the identical
narrowing already applied to populationReconciliation.ts's canary the
prior day for the same reason.

Added a regression test seeding 58 candidates in one namespace asserting
exactly one listInvariants call, never 58. Captured as a resolution record
+ candidate invariant (third occurrence of this exact batching shape in
two days) per the Resolution -> Invariant Loop.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

buildReviewAndPromoteQueue called findDuplicates (a fresh listInvariants
scan) once per awaiting candidate instead of once per distinct namespace —
the identical N+1 shape fixed twice the prior day elsewhere in this file
family, but this call site was missed by both reviews. It stayed invisible
because firstPendingDecision kept Stage 2 (review-and-admit) as the pending
decision for as long as any source awaited review, so Stage 4's queue never
ran for EXP-P1 until the final admission cleared Stage 2 for the first
time — at which point the entire accumulated ~58-candidate backlog paid its
own round trip in one composition pass, blowing the 15s budget.

Split findDuplicates into a pure findDuplicatesInPool (scoring only) plus
the existing fetch-then-score wrapper, and batch one listInvariants read
per distinct namespace across the awaiting-candidate batch, mirroring
evidenceByDomain two lines above and populationReconciliation.ts's
batchFindExactStatementMatches. Narrowed pipeline-continuity.test.ts's
composer canary to the domain-keyed shape (the actual historical defect)
rather than the bare listInvariants substring, mirroring the identical
narrowing already applied to populationReconciliation.ts's canary the
prior day for the same reason.

Added a regression test seeding 58 candidates in one namespace asserting
exactly one listInvariants call, never 58. Captured as a resolution record
+ candidate invariant (third occurrence of this exact batching shape in
two days) per the Resolution -> Invariant Loop.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Added | `codexes/packs/agentiq/resolution-records/candidate-invariants/CI-2026-09-05-BATCH-PER-ITEM-SUBSTRATE-READS-BY-GROUPING-KEY-001.json` |
| Added | `codexes/packs/agentiq/resolution-records/records/RES-2026-09-05-TRACK2-REVIEW-QUEUE-DUPLICATE-N+1-001.json` |
| Modified | `services/invariants/comparison.ts` |
| Modified | `services/research/researchProgrammeOrchestrator.ts` |
| Modified | `tests/pipeline-continuity.test.ts` |
| Modified | `tests/research-programme-orchestrator.test.ts` |

## Stats

 6 files changed, 264 insertions(+), 30 deletions(-)
