# Commit Brief: `40632ee` — Fix targeted-acquisition dead end: consume approval judgement once [merge review/irl-scoped-restoration-2026-08-27]

| Field | Value |
|-------|-------|
| SHA | [`40632ee`](https://github.com/iQube-Protocol/AigentZBeta/commit/40632eea3552a020947e940bba06cc93d49c7898) |
| Author | Claude |
| Date | 2026-08-31T13:31:35Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix targeted-acquisition dead end: consume approval judgement once [merge review/irl-scoped-restoration-2026-08-27]

Diagnosis: clicking "Approve targeted acquisition" produced no durable
transition because run-step marked the approval 'completed' the instant
zero ratified+verified institutions were eligible -- before anything was
ever attempted -- destroying the durable record that a steward had
authorized acquisition. The next read then re-derived "acquisition still
needed" purely from readiness (buildAcquisitionPendingDecision never
consulted the approval substrate at all) and re-offered the identical
"Approve targeted acquisition" card, which read as "nothing happened".

Fix:
- crystalAcquisitionJob.ts: runOneAcquisitionStep now reports
  ratifiedVerifiedInstitutionCount (total eligible in the domain,
  regardless of prior attempts) alongside the existing unattempted-
  remaining count, so run-step can tell "genuinely completed round" apart
  from "the domain never had anything eligible to begin with" and only
  completes the approval in the former case.
- buildAcquisitionPendingDecision now consults getActiveAcquisitionApproval
  before ever offering "Approve targeted acquisition": an active approval
  with zero eligible institutions routes to an explicit
  TARGETED_ACQUISITION_APPROVED -> BLOCKED_SOURCE_UNIVERSE_UNCONSTITUTED
  decision (naming ratification or verification as the exact governed
  action needed), never re-asking for approval.
- Approval now carries a durable identity beyond experiment+domain --
  crystal generation + a content hash of the brief -- so an unchanged
  brief short-circuits idempotently while a materially changed brief is
  recognised as a genuinely new judgement.

Regression tests reproduce the exact EXP-P1 state end to end. No
scientific/invariant/namespace/provenance/freeze state changed.
```

## Body

Diagnosis: clicking "Approve targeted acquisition" produced no durable
transition because run-step marked the approval 'completed' the instant
zero ratified+verified institutions were eligible -- before anything was
ever attempted -- destroying the durable record that a steward had
authorized acquisition. The next read then re-derived "acquisition still
needed" purely from readiness (buildAcquisitionPendingDecision never
consulted the approval substrate at all) and re-offered the identical
"Approve targeted acquisition" card, which read as "nothing happened".

Fix:
- crystalAcquisitionJob.ts: runOneAcquisitionStep now reports
  ratifiedVerifiedInstitutionCount (total eligible in the domain,
  regardless of prior attempts) alongside the existing unattempted-
  remaining count, so run-step can tell "genuinely completed round" apart
  from "the domain never had anything eligible to begin with" and only
  completes the approval in the former case.
- buildAcquisitionPendingDecision now consults getActiveAcquisitionApproval
  before ever offering "Approve targeted acquisition": an active approval
  with zero eligible institutions routes to an explicit
  TARGETED_ACQUISITION_APPROVED -> BLOCKED_SOURCE_UNIVERSE_UNCONSTITUTED
  decision (naming ratification or verification as the exact governed
  action needed), never re-asking for approval.
- Approval now carries a durable identity beyond experiment+domain --
  crystal generation + a content hash of the brief -- so an unchanged
  brief short-circuits idempotently while a materially changed brief is
  recognised as a genuinely new judgement.

Regression tests reproduce the exact EXP-P1 state end to end. No
scientific/invariant/namespace/provenance/freeze state changed.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/research/programme/[experimentId]/acquisition/approve/route.ts` |
| Modified | `app/api/research/programme/[experimentId]/acquisition/run-step/route.ts` |
| Modified | `services/research/crystalAcquisitionBrief.ts` |
| Modified | `services/research/crystalAcquisitionJob.ts` |
| Modified | `services/research/researchProgrammeOrchestrator.ts` |
| Added | `supabase/migrations/20260930130000_crystal_acquisition_approval_identity.sql` |
| Modified | `tests/crystal-acquisition-approve-route.test.ts` |
| Modified | `tests/crystal-acquisition-job.test.ts` |
| Modified | `tests/crystal-acquisition-run-step-route.test.ts` |
| Modified | `tests/research-programme-orchestrator.test.ts` |

## Stats

 11 files changed, 700 insertions(+), 23 deletions(-)
