# Commit Brief: `0e293fe` — Add stale-cohort protection, scoped population labels, Copilot cohort admission

| Field | Value |
|-------|-------|
| SHA | [`0e293fe`](https://github.com/iQube-Protocol/AigentZBeta/commit/0e293fe3fb334dc9209fa02f3e1a2ec5019148eb) |
| Author | Claude |
| Date | 2026-09-01T15:24:27Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add stale-cohort protection, scoped population labels, Copilot cohort admission

Corpus Scout Track 2 Stage 2 (Review & Admit) already had the duplicate-
resolution and bulk-admission machinery this closes gaps around — no new
write paths are introduced.

1. Stale-cohort protection: computeCohortHash (already used by the crystal
   assign route for display) is now actually asserted. bulk-review and
   resolve-duplicates accept an optional expectedCohortHash; when present
   they recompute the current eligible/resolvable cohort at write time and
   refuse (409 recommendation-set-changed) if it no longer matches — the
   named-but-never-implemented GlobalStopReason. Fails closed on the whole
   batch, never a partial admission under a stale premise. Opt-in — every
   existing caller without the field is unaffected.

2. Population scope labels: PopulationDisclosure gets an optional scope
   ('current-acquisition-round' | 'cumulative-programme'). The corpus-scout
   Stage 2 routes (whose candidatesExtracted/validated/assignedToCrystal are
   honestly 0 — downstream of that stage) declare current-acquisition-round;
   resolveTrack2Population (the freeze package's real cumulative counts)
   declares cumulative-programme. Track2ProgrammePanel's hardcoded "Full
   population —" label is replaced by populationScopeLabel(population.scope).

3. Research Copilot cohort admission: admissionQueue's eligible sources
   (ready | ready-with-warning — manual-review exceptions are never
   included) can now be admitted as one Steward judgement (provenance class
   + rationale) instead of only deep-linking into Review & Admit. Groups by
   the recommendation's own reviewDecision, batches through the existing
   bulk-review route via partitionForExecution, echoes admissionCohortHash
   as expectedCohortHash, and continues the programme via the same
   runProgramme loop resolveDeterministicDuplicates already uses.

[merge review/irl-scoped-restoration-2026-08-27]
```

## Body

Corpus Scout Track 2 Stage 2 (Review & Admit) already had the duplicate-
resolution and bulk-admission machinery this closes gaps around — no new
write paths are introduced.

1. Stale-cohort protection: computeCohortHash (already used by the crystal
   assign route for display) is now actually asserted. bulk-review and
   resolve-duplicates accept an optional expectedCohortHash; when present
   they recompute the current eligible/resolvable cohort at write time and
   refuse (409 recommendation-set-changed) if it no longer matches — the
   named-but-never-implemented GlobalStopReason. Fails closed on the whole
   batch, never a partial admission under a stale premise. Opt-in — every
   existing caller without the field is unaffected.

2. Population scope labels: PopulationDisclosure gets an optional scope
   ('current-acquisition-round' | 'cumulative-programme'). The corpus-scout
   Stage 2 routes (whose candidatesExtracted/validated/assignedToCrystal are
   honestly 0 — downstream of that stage) declare current-acquisition-round;
   resolveTrack2Population (the freeze package's real cumulative counts)
   declares cumulative-programme. Track2ProgrammePanel's hardcoded "Full
   population —" label is replaced by populationScopeLabel(population.scope).

3. Research Copilot cohort admission: admissionQueue's eligible sources
   (ready | ready-with-warning — manual-review exceptions are never
   included) can now be admitted as one Steward judgement (provenance class
   + rationale) instead of only deep-linking into Review & Admit. Groups by
   the recommendation's own reviewDecision, batches through the existing
   bulk-review route via partitionForExecution, echoes admissionCohortHash
   as expectedCohortHash, and continues the programme via the same
   runProgramme loop resolveDeterministicDuplicates already uses.

[merge review/irl-scoped-restoration-2026-08-27]

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/corpus-scout/candidates/bulk-review/route.ts` |
| Modified | `app/api/corpus-scout/candidates/prepare-recommendations/route.ts` |
| Modified | `app/api/corpus-scout/candidates/resolve-duplicates/route.ts` |
| Modified | `components/composer/IRLResearchCopilotTab.tsx` |
| Modified | `components/research/Track2ProgrammePanel.tsx` |
| Modified | `services/corpusScout/admissionPreparation.ts` |
| Modified | `services/research/exceptionIsolation.ts` |
| Modified | `services/research/researchProgrammeOrchestrator.ts` |
| Modified | `services/research/track2Population.ts` |
| Added | `tests/track2-admission-cohort-ratification.test.ts` |

## Stats

 11 files changed, 842 insertions(+), 8 deletions(-)
