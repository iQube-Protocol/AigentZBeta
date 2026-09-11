# Commit Brief: `3ea2f4a` — Add Track 2 Stage 5 provenance-cohort mechanical preparation and one-act ratification

| Field | Value |
|-------|-------|
| SHA | [`3ea2f4a`](https://github.com/iQube-Protocol/AigentZBeta/commit/3ea2f4a6f1a9b6fc796903bbc89ed3771618f81c) |
| Author | Claude |
| Date | 2026-09-03T21:18:54Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add Track 2 Stage 5 provenance-cohort mechanical preparation and one-act ratification

Closes the "Classify Provenance" 55-invariant manual-classification burden:
services/research/provenanceCohortPreparation.ts triages each unclassified
successor-scoped invariant deterministically (no-evidence, incomplete-lineage,
repo-internal-citation) and groups the rest by their exact resolved
source-document signature, calling the existing suggestProvenanceClass once
per DISTINCT signature rather than once per invariant. A mixed lineage
(some self-authored, some not) is always isolated as an exception, never
silently accepted just because the write-time gate would tolerate it.

experimentalPopulations.ts gains looksSelfAuthored() — closes a real gap
found while triaging the live 55: looksInternal only matched repo paths and
document codes, so a reclassification citing only this platform's own
deployed host or a private Google Docs/Drive draft would have passed the
anti-laundering gate uncaught.

New route app/api/research/track2/[experimentId]/provenance-cohort:
GET returns the fresh cohortHash-bound recommendation set (ready vs
exception, read-only); POST is the Steward's one ratification act —
recomputes the cohort fresh, refuses on a stale expectedCohortHash (409),
writes every ready member through the existing applyProvenanceReclassification
(never a parallel authority), skips already-classified members so a resumed
call after a partial run is idempotent, writes one lifecycle receipt for
the batch, and immediately runs Validate (machine-run, no per-record human
content) over the newly-eligible members. Add Relationships and Assign to
Crystal remain separate Steward acts.

track2Programme.ts / researchProgrammeOrchestrator.ts / populationReconciliation.ts:
Stage 5 now reads partially-complete (not in-progress forever) once its
unclassified remainder is mechanically confirmed to be all isolated
exceptions, unblocking Stage 6/7 for the members already classified.

Backend + API only in this slice — the existing per-record Classify
Provenance UI still needs to be pointed at this new cohort endpoint to
expose the single "Ratify provenance cohort" decision surface.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Closes the "Classify Provenance" 55-invariant manual-classification burden:
services/research/provenanceCohortPreparation.ts triages each unclassified
successor-scoped invariant deterministically (no-evidence, incomplete-lineage,
repo-internal-citation) and groups the rest by their exact resolved
source-document signature, calling the existing suggestProvenanceClass once
per DISTINCT signature rather than once per invariant. A mixed lineage
(some self-authored, some not) is always isolated as an exception, never
silently accepted just because the write-time gate would tolerate it.

experimentalPopulations.ts gains looksSelfAuthored() — closes a real gap
found while triaging the live 55: looksInternal only matched repo paths and
document codes, so a reclassification citing only this platform's own
deployed host or a private Google Docs/Drive draft would have passed the
anti-laundering gate uncaught.

New route app/api/research/track2/[experimentId]/provenance-cohort:
GET returns the fresh cohortHash-bound recommendation set (ready vs
exception, read-only); POST is the Steward's one ratification act —
recomputes the cohort fresh, refuses on a stale expectedCohortHash (409),
writes every ready member through the existing applyProvenanceReclassification
(never a parallel authority), skips already-classified members so a resumed
call after a partial run is idempotent, writes one lifecycle receipt for
the batch, and immediately runs Validate (machine-run, no per-record human
content) over the newly-eligible members. Add Relationships and Assign to
Crystal remain separate Steward acts.

track2Programme.ts / researchProgrammeOrchestrator.ts / populationReconciliation.ts:
Stage 5 now reads partially-complete (not in-progress forever) once its
unclassified remainder is mechanically confirmed to be all isolated
exceptions, unblocking Stage 6/7 for the members already classified.

Backend + API only in this slice — the existing per-record Classify
Provenance UI still needs to be pointed at this new cohort endpoint to
expose the single "Ratify provenance cohort" decision surface.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/research/track2/[experimentId]/provenance-cohort/route.ts` |
| Modified | `services/research/experimentalPopulations.ts` |
| Modified | `services/research/populationReconciliation.ts` |
| Added | `services/research/provenanceCohortPreparation.ts` |
| Modified | `services/research/researchProgrammeOrchestrator.ts` |
| Modified | `services/research/track2Programme.ts` |
| Added | `tests/provenance-cohort-preparation.test.ts` |
| Added | `tests/provenance-cohort-route.test.ts` |
| Added | `tests/track2-classify-provenance-exception-only-status.test.ts` |

## Stats

 9 files changed, 1342 insertions(+), 5 deletions(-)
