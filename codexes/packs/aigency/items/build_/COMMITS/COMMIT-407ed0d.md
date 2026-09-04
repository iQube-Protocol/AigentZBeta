# Commit Brief: `407ed0d` — Batch reconcilePromotedCohort's exact-match repair lookup to close a latent N+1

| Field | Value |
|-------|-------|
| SHA | [`407ed0d`](https://github.com/iQube-Protocol/AigentZBeta/commit/407ed0dadf02b5f7426834efb8bde4f1295ac664) |
| Author | Claude |
| Date | 2026-09-04T17:16:08Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Batch reconcilePromotedCohort's exact-match repair lookup to close a latent N+1

The missing-invariant-id repair path called findDuplicates (a fresh
up-to-500-row domain scan) once per candidate, sequentially — the same
shape just fixed in provenanceCohortPreparation.ts for classify-provenance.
Zero live impact today (every promoted candidate already carries a
promoted_invariant_id), but it sits in the same hot path
(reconcilePromotedCohort composes on every Track 2 Stage 5/6/7 render) and
would reproduce the identical timeout once any candidate lacks one.

Replaced with one listInvariants read per distinct namespace across the
whole batch, then a local exact-match test per candidate — same behaviour,
proven via mock call-count assertions in the test.

Also sharpens tests/pipeline-continuity.test.ts's source-authority canary,
which literally forbade the substring "listInvariants(" anywhere in
populationReconciliation.ts. That canary's actual subject (per its own
comment) is cohort MEMBERSHIP resolved by domain query, not this file's
unrelated namespace-scoped exact-match lookup — narrowed to the real shape
of the historical defect (a domain:-keyed call) rather than the call's mere
presence, which the pre-fix code already made via findDuplicates one layer
down where the canary could not see it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

The missing-invariant-id repair path called findDuplicates (a fresh
up-to-500-row domain scan) once per candidate, sequentially — the same
shape just fixed in provenanceCohortPreparation.ts for classify-provenance.
Zero live impact today (every promoted candidate already carries a
promoted_invariant_id), but it sits in the same hot path
(reconcilePromotedCohort composes on every Track 2 Stage 5/6/7 render) and
would reproduce the identical timeout once any candidate lacks one.

Replaced with one listInvariants read per distinct namespace across the
whole batch, then a local exact-match test per candidate — same behaviour,
proven via mock call-count assertions in the test.

Also sharpens tests/pipeline-continuity.test.ts's source-authority canary,
which literally forbade the substring "listInvariants(" anywhere in
populationReconciliation.ts. That canary's actual subject (per its own
comment) is cohort MEMBERSHIP resolved by domain query, not this file's
unrelated namespace-scoped exact-match lookup — narrowed to the real shape
of the historical defect (a domain:-keyed call) rather than the call's mere
presence, which the pre-fix code already made via findDuplicates one layer
down where the canary could not see it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/research/populationReconciliation.ts` |
| Modified | `tests/pipeline-continuity.test.ts` |
| Modified | `tests/population-reconciliation.test.ts` |

## Stats

 3 files changed, 112 insertions(+), 25 deletions(-)
