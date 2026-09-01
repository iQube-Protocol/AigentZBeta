# Commit Brief: `efc9cf9` — Fix verification wall-clock granularity: one external op per request [merge review/irl-scoped-restoration-2026-08-27]

| Field | Value |
|-------|-------|
| SHA | [`efc9cf9`](https://github.com/iQube-Protocol/AigentZBeta/commit/efc9cf9935d3eeaf1929eaab2ce9d212907c6dfc) |
| Author | Claude |
| Date | 2026-08-31T16:27:36Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix verification wall-clock granularity: one external op per request [merge review/irl-scoped-restoration-2026-08-27]

Live evidence: clicking "Run institution verification" began a real
per-institution action (Discovering via BIS...) and then died with an
HTTP 504. Bounding to one INSTITUTION per call was not enough --
verifyInstitutionEntry chains resolve-seed + discover-candidates (up to
six sequential page fetches) + up to five document fetch+inspects in one
request, and any one of those can independently stall.

resolveSeedPhase / discoverCandidatesPhase / inspectCandidatePhase are now
factored out as the single authoritative decision logic, composed two
ways -- runVerification (unchanged one-shot behavior) and the new
runVerificationStep, which performs exactly ONE phase per call, races it
against a 20s internal deadline (same Promise.race discipline as the
"empty 504" precedent), and persists phase/cursor/evidence-so-far on a new
verification_progress column between calls. A losing race returns
status:'in-progress' at the same phase/cursor -- never an empty 504.

runOneInstitutionVerificationStep resumes an institution already
mid-verification before starting a fresh one. The verify-step route
returns institution/phase/cursor/elapsedMs/externalCallsAttempted
diagnostics plus outcome only on a terminal status. Client loops bumped
their backstop bound accordingly.

Pins the BIS slow-document scenario end to end. No scientific criteria,
acquisition policy, institution ratification, or readiness logic changed.
```

## Body

Live evidence: clicking "Run institution verification" began a real
per-institution action (Discovering via BIS...) and then died with an
HTTP 504. Bounding to one INSTITUTION per call was not enough --
verifyInstitutionEntry chains resolve-seed + discover-candidates (up to
six sequential page fetches) + up to five document fetch+inspects in one
request, and any one of those can independently stall.

resolveSeedPhase / discoverCandidatesPhase / inspectCandidatePhase are now
factored out as the single authoritative decision logic, composed two
ways -- runVerification (unchanged one-shot behavior) and the new
runVerificationStep, which performs exactly ONE phase per call, races it
against a 20s internal deadline (same Promise.race discipline as the
"empty 504" precedent), and persists phase/cursor/evidence-so-far on a new
verification_progress column between calls. A losing race returns
status:'in-progress' at the same phase/cursor -- never an empty 504.

runOneInstitutionVerificationStep resumes an institution already
mid-verification before starting a fresh one. The verify-step route
returns institution/phase/cursor/elapsedMs/externalCallsAttempted
diagnostics plus outcome only on a terminal status. Client loops bumped
their backstop bound accordingly.

Pins the BIS slow-document scenario end to end. No scientific criteria,
acquisition policy, institution ratification, or readiness logic changed.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/research/programme/[experimentId]/acquisition/verify-step/route.ts` |
| Modified | `components/composer/IRLResearchCopilotTab.tsx` |
| Modified | `components/research/Track2ProgrammePanel.tsx` |
| Modified | `services/corpusScout/registryVerification.ts` |
| Modified | `services/research/crystalAcquisitionJob.ts` |
| Added | `supabase/migrations/20260903100000_corpus_verification_progress.sql` |
| Added | `tests/corpus-scout-verification-step.test.ts` |
| Modified | `tests/crystal-acquisition-job.test.ts` |
| Modified | `tests/crystal-acquisition-verify-step-route.test.ts` |

## Stats

 10 files changed, 993 insertions(+), 193 deletions(-)
