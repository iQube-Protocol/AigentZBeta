# Commit Brief: `8360afc` — Execute institution verification as a bounded machine act, not a dead end [merge review/irl-scoped-restoration-2026-08-27]

| Field | Value |
|-------|-------|
| SHA | [`8360afc`](https://github.com/iQube-Protocol/AigentZBeta/commit/8360afc64a3e09ba2cf05e1d2c5197f83fadc84c) |
| Author | Claude |
| Date | 2026-08-31T15:19:06Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Execute institution verification as a bounded machine act, not a dead end [merge review/irl-scoped-restoration-2026-08-27]

Diagnosis (traced from services/corpusScout/registryVerification.ts before
coding): verifyInstitutionEntry is a deterministic, bounded, already-
Steward-authorised act. The whole-domain sweep is unbounded wall-clock in
one request against up to 19 sites -- the same shape that already keeps
discover-sources out of PROGRAMME_ACT_KINDS -- so verification gets the
identical bounded treatment: a new runOneInstitutionVerificationStep +
POST .../acquisition/verify-step route, exactly one ratified institution
per call, reusing verifyInstitutionEntry verbatim.

buildAcquisitionPendingDecision's ratified-but-unverified branch is now
actionable:true with a verificationTarget (the zero-ratified branch stays
diagnostic-only -- a genuine governance act). The Research Copilot and the
Track 2 panel both read the SAME field and render the SAME "Run
institution verification" control, which drives verify-step to exhaustion
then the shared discovery run-step loop then the programme, in one bounded
run where eligible institutions result.

Pins the exact live EXP-P1 case (19 ratified, 0 verified) end to end,
including exception isolation and that redirect_changed/deprecated entries
are never auto-run. No scientific criteria, acquisition policy, institution
ratification, or readiness logic changed.
```

## Body

Diagnosis (traced from services/corpusScout/registryVerification.ts before
coding): verifyInstitutionEntry is a deterministic, bounded, already-
Steward-authorised act. The whole-domain sweep is unbounded wall-clock in
one request against up to 19 sites -- the same shape that already keeps
discover-sources out of PROGRAMME_ACT_KINDS -- so verification gets the
identical bounded treatment: a new runOneInstitutionVerificationStep +
POST .../acquisition/verify-step route, exactly one ratified institution
per call, reusing verifyInstitutionEntry verbatim.

buildAcquisitionPendingDecision's ratified-but-unverified branch is now
actionable:true with a verificationTarget (the zero-ratified branch stays
diagnostic-only -- a genuine governance act). The Research Copilot and the
Track 2 panel both read the SAME field and render the SAME "Run
institution verification" control, which drives verify-step to exhaustion
then the shared discovery run-step loop then the programme, in one bounded
run where eligible institutions result.

Pins the exact live EXP-P1 case (19 ratified, 0 verified) end to end,
including exception isolation and that redirect_changed/deprecated entries
are never auto-run. No scientific criteria, acquisition policy, institution
ratification, or readiness logic changed.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Added | `app/api/research/programme/[experimentId]/acquisition/verify-step/route.ts` |
| Modified | `components/composer/IRLResearchCopilotTab.tsx` |
| Modified | `components/research/Track2ProgrammePanel.tsx` |
| Modified | `services/research/crystalAcquisitionJob.ts` |
| Modified | `services/research/researchProgrammeOrchestrator.ts` |
| Modified | `tests/crystal-acquisition-job.test.ts` |
| Added | `tests/crystal-acquisition-verify-step-route.test.ts` |
| Added | `tests/institution-verification-ui.test.ts` |
| Modified | `tests/research-programme-orchestrator.test.ts` |
| Modified | `tests/track2-copilot-deep-link.test.ts` |

## Stats

 11 files changed, 987 insertions(+), 39 deletions(-)
