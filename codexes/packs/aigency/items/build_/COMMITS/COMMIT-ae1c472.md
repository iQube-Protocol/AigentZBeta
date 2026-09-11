# Commit Brief: `ae1c472` — Wire the Classify Provenance cohort board as Stage 5's primary decision surface

| Field | Value |
|-------|-------|
| SHA | [`ae1c472`](https://github.com/iQube-Protocol/AigentZBeta/commit/ae1c472bb84c837e41a3b10afdf512800c2214da) |
| Author | Claude |
| Date | 2026-09-03T21:26:32Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Wire the Classify Provenance cohort board as Stage 5's primary decision surface

Track2ProgrammePanel.tsx: the deployed Stage 5 UI still required per-record
"Accept" then "Classify & next" clicks even after the backend cohort
machinery (services/research/provenanceCohortPreparation.ts, the prior
commit) existed. Adds ProvenanceCohortRatificationBoard — the ONE decision
surface: "Prepared — Classify Provenance · N invariants", the ready count
with its distinct source-document signatures and cohortHash, the exception
count grouped by cause, and a single "Ratify provenance cohort" button that
POSTs dryRun:false with the exact expectedCohortHash the GET just showed
(refuses and refreshes on recommendation-set-changed, same stale-cohort
protection Stage 2's admission board and Stage 8's assignment board use).
Rendered as the first offer for classify-provenance, above the existing
per-record ClassificationQueue, which stays available underneath for the
exceptions this board never proposes a class for and as a manual override.

tests/provenance-cohort-ui.test.ts: source canaries pinning the render
order, the real endpoint calls (GET read-only / POST dryRun:false +
expectedCohortHash), the rationale-required gate, and that ClassificationQueue
was not removed.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Track2ProgrammePanel.tsx: the deployed Stage 5 UI still required per-record
"Accept" then "Classify & next" clicks even after the backend cohort
machinery (services/research/provenanceCohortPreparation.ts, the prior
commit) existed. Adds ProvenanceCohortRatificationBoard — the ONE decision
surface: "Prepared — Classify Provenance · N invariants", the ready count
with its distinct source-document signatures and cohortHash, the exception
count grouped by cause, and a single "Ratify provenance cohort" button that
POSTs dryRun:false with the exact expectedCohortHash the GET just showed
(refuses and refreshes on recommendation-set-changed, same stale-cohort
protection Stage 2's admission board and Stage 8's assignment board use).
Rendered as the first offer for classify-provenance, above the existing
per-record ClassificationQueue, which stays available underneath for the
exceptions this board never proposes a class for and as a manual override.

tests/provenance-cohort-ui.test.ts: source canaries pinning the render
order, the real endpoint calls (GET read-only / POST dryRun:false +
expectedCohortHash), the rationale-required gate, and that ClassificationQueue
was not removed.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/research/Track2ProgrammePanel.tsx` |
| Added | `tests/provenance-cohort-ui.test.ts` |

## Stats

 2 files changed, 350 insertions(+), 9 deletions(-)
