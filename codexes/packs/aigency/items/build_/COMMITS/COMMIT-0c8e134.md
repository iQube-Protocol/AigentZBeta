# Commit Brief: `0c8e134` — Distinguish acquisition-blocked from not-started in Track 2 Stage 1 [merge review/irl-scoped-restoration-2026-08-27]

| Field | Value |
|-------|-------|
| SHA | [`0c8e134`](https://github.com/iQube-Protocol/AigentZBeta/commit/0c8e13479425eca1383419158f2a0d9db3196013) |
| Author | Claude |
| Date | 2026-08-31T05:53:17Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Distinguish acquisition-blocked from not-started in Track 2 Stage 1 [merge review/irl-scoped-restoration-2026-08-27]

Root cause of the "approved acquisition resolves 0 ratified institutions"
incident: no domain mismatch. financial-services (the acquisition domain,
deliberately distinct from the crystal domain) has ratified institutions,
but SPEC-CIR-001 section 9's verification gate (ratified 2026-07-27) blocks
discovery until they complete verification -- documented in migration
20260828000000_corpus_registry_verification.sql as the expected starting
state, not a regression.

Add summarizeAcquisitionSourceUniverse (read-only, reuses
canRunInstitutionDiscovery) and use it to give Stage 1 four honest states
instead of one generic "not started": unknown (unreadable), not-started
(nothing ratified), blocked (ratified but unverified -- the live case,
with a verification remedy instead of a misleading re-ratify one), and
not-started worded as ready (ratified + verified, discovery just not run).

Add regression tests proving every acquisition-domain-scoped collaborator
(listCandidateSources, listCandidates, summarizeAcquisitionSourceUniverse,
runConstitutionalDiscovery) resolves the identical domain string within one
loadTrack2ProgrammeState/advanceResearchProgramme call.
```

## Body

Root cause of the "approved acquisition resolves 0 ratified institutions"
incident: no domain mismatch. financial-services (the acquisition domain,
deliberately distinct from the crystal domain) has ratified institutions,
but SPEC-CIR-001 section 9's verification gate (ratified 2026-07-27) blocks
discovery until they complete verification -- documented in migration
20260828000000_corpus_registry_verification.sql as the expected starting
state, not a regression.

Add summarizeAcquisitionSourceUniverse (read-only, reuses
canRunInstitutionDiscovery) and use it to give Stage 1 four honest states
instead of one generic "not started": unknown (unreadable), not-started
(nothing ratified), blocked (ratified but unverified -- the live case,
with a verification remedy instead of a misleading re-ratify one), and
not-started worded as ready (ratified + verified, discovery just not run).

Add regression tests proving every acquisition-domain-scoped collaborator
(listCandidateSources, listCandidates, summarizeAcquisitionSourceUniverse,
runConstitutionalDiscovery) resolves the identical domain string within one
loadTrack2ProgrammeState/advanceResearchProgramme call.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `services/corpusScout/domainConstitution.ts` |
| Modified | `services/research/researchProgrammeOrchestrator.ts` |
| Modified | `services/research/track2Programme.ts` |
| Added | `tests/corpus-scout-acquisition-source-universe.test.ts` |
| Modified | `tests/crystal-freeze-rehearsal.test.ts` |
| Modified | `tests/pipeline-continuity.test.ts` |
| Modified | `tests/research-programme-orchestrator.test.ts` |
| Added | `tests/track2-stage1-source-universe-derivation.test.ts` |
| Modified | `tests/track2-steward-workflow.test.ts` |

## Stats

 10 files changed, 505 insertions(+), 14 deletions(-)
