# Commit Brief: `ccebd69` — fix Stage 3→4 handoff gap: scope extracted-candidate counts to the successor cohort

| Field | Value |
|-------|-------|
| SHA | [`ccebd69`](https://github.com/iQube-Protocol/AigentZBeta/commit/ccebd69fa0aaa1b0d709fe266929e5562345b488) |
| Author | Claude |
| Date | 2026-08-30T10:05:56Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix Stage 3→4 handoff gap: scope extracted-candidate counts to the successor cohort

Diagnosed 17 extracted candidates disappearing before Stage 4 ("17 extracted"
alongside a correctly-narrowed "0 promoted, 0 awaiting review"). Root cause:
the frozen-generation boundary only narrowed Stage 4's promoted count; Stage
3's total (and Stage 4's awaitingReview) still read the raw, all-time
discovery_candidates rows for the domain. Traced the 17 to vP1's own
historical extraction records — candidates that never resolved to an
invariant have no id to check against the frozen manifest, so the boundary
now falls back to creation time relative to the freeze for those.

- isSuccessorScopedCandidate is the one predicate Stage 3's total, Stage 4's
  awaitingReview AND Stage 4's promoted are all narrowed through, so a
  candidate can never appear in Stage 3's count while invisible to Stage 4's.
- discoveryCandidates gains an optional rejected count, computed from the
  same successor-scoped set, so total === awaitingReview + promoted +
  rejected holds by construction (CandidateRow.status is exhaustive over
  those three values) and Stage 3/4 disclose the breakdown.
- No vP1 row touched; no promotion of historical candidates; the 60-member
  requirement and frozen-generation boundary from the prior fix are
  unmodified.
```

## Body

Diagnosed 17 extracted candidates disappearing before Stage 4 ("17 extracted"
alongside a correctly-narrowed "0 promoted, 0 awaiting review"). Root cause:
the frozen-generation boundary only narrowed Stage 4's promoted count; Stage
3's total (and Stage 4's awaitingReview) still read the raw, all-time
discovery_candidates rows for the domain. Traced the 17 to vP1's own
historical extraction records — candidates that never resolved to an
invariant have no id to check against the frozen manifest, so the boundary
now falls back to creation time relative to the freeze for those.

- isSuccessorScopedCandidate is the one predicate Stage 3's total, Stage 4's
  awaitingReview AND Stage 4's promoted are all narrowed through, so a
  candidate can never appear in Stage 3's count while invisible to Stage 4's.
- discoveryCandidates gains an optional rejected count, computed from the
  same successor-scoped set, so total === awaitingReview + promoted +
  rejected holds by construction (CandidateRow.status is exhaustive over
  those three values) and Stage 3/4 disclose the breakdown.
- No vP1 row touched; no promotion of historical candidates; the 60-member
  requirement and frozen-generation boundary from the prior fix are
  unmodified.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `services/research/researchProgrammeOrchestrator.ts` |
| Modified | `services/research/track2Programme.ts` |
| Modified | `tests/research-programme-orchestrator.test.ts` |

## Stats

 4 files changed, 216 insertions(+), 14 deletions(-)
