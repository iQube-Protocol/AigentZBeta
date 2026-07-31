# Commit Brief: `d9d63b0` — Reframe EXP-004 as graded sovereignty-scale measurement + fix experiment_results EXP-004 constraint (operator correction)

| Field | Value |
|-------|-------|
| SHA | [`d9d63b0`](https://github.com/iQube-Protocol/AigentZBeta/commit/d9d63b031de4c984b3da10981a6a5afbb167399b) |
| Author | Claude |
| Date | 2026-07-07T07:37:27Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Reframe EXP-004 as graded sovereignty-scale measurement + fix experiment_results EXP-004 constraint (operator correction)

Operator correction (2026-07-07): the PSE series claim is that platform
sovereignty is a measurable BUNDLE (model, provider choice, commercial
independence, infrastructure). A frontier-provider run MEASURES real bundle
components (provider interchangeability, commercial independence from any
single vendor) — it is legitimate sovereignty data at S1/S2, NOT "not a
sovereignty claim." Open-weight/self-hosted is the S3 APEX, not the validity
gate. Publishing measurements across rungs and concluding across them IS the
experiment's purpose. The prior "rehearsal — not a sovereignty claim… reads
as partial, never pass" framing was too restrictive and contradicted the
claim the experiment exists to prove.

DB fix (hard publish-blocker): experiment_results' CHECK constraint enumerated
only EXP-001/002/003, so every EXP-004 publish was rejected at insert
(field-reported 2026-07-07). New migration 20260707000000 drops and re-adds it
as a pattern check (experiment ~ '^EXP-[0-9]{3}$'), future-proofing PSE-2..5.
The original migration is not edited (already applied).

Runner: both modes now publish as sovereignty-scale measurement runs — a
completed frontier run carries sovereigntyRung 's2-substitutable', a completed
open-weight (venice) run 's3-open-weight', both with a bundleComponentsMeasured
array. The rehearsal:true / "never a sovereignty claim" framing is dropped;
banners and copy read graded + honest scope.

Graded criterion: the Chrysalis sovereignty criterion now passes the
measurable-bundle claim on ANY completed run (frontier or open-weight), naming
the highest rung reached and flagging apex status; a failed/incomplete run is
partial, nothing published is pending. Reads aggregates.sovereigntyRung and
tolerates legacy rows (rehearsal→s2, sovereigntyHolds:true→s3).

Docs: CFS-018 gains an Interpretation correction section; CFS-015 gains one
record paragraph. Canaries updated to the graded semantics + a new pure helper
(sovereigntyRungForRun/bundleComponentsForArm) with a frontier→S2 / open-weight
→S3 mapping pin. Provider allowlists unchanged (SOVEREIGN_PROVIDER=venice,
REHEARSAL_PROVIDERS=chaingpt,openai).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Operator correction (2026-07-07): the PSE series claim is that platform
sovereignty is a measurable BUNDLE (model, provider choice, commercial
independence, infrastructure). A frontier-provider run MEASURES real bundle
components (provider interchangeability, commercial independence from any
single vendor) — it is legitimate sovereignty data at S1/S2, NOT "not a
sovereignty claim." Open-weight/self-hosted is the S3 APEX, not the validity
gate. Publishing measurements across rungs and concluding across them IS the
experiment's purpose. The prior "rehearsal — not a sovereignty claim… reads
as partial, never pass" framing was too restrictive and contradicted the
claim the experiment exists to prove.

DB fix (hard publish-blocker): experiment_results' CHECK constraint enumerated
only EXP-001/002/003, so every EXP-004 publish was rejected at insert
(field-reported 2026-07-07). New migration 20260707000000 drops and re-adds it
as a pattern check (experiment ~ '^EXP-[0-9]{3}$'), future-proofing PSE-2..5.
The original migration is not edited (already applied).

Runner: both modes now publish as sovereignty-scale measurement runs — a
completed frontier run carries sovereigntyRung 's2-substitutable', a completed
open-weight (venice) run 's3-open-weight', both with a bundleComponentsMeasured
array. The rehearsal:true / "never a sovereignty claim" framing is dropped;
banners and copy read graded + honest scope.

Graded criterion: the Chrysalis sovereignty criterion now passes the
measurable-bundle claim on ANY completed run (frontier or open-weight), naming
the highest rung reached and flagging apex status; a failed/incomplete run is
partial, nothing published is pending. Reads aggregates.sovereigntyRung and
tolerates legacy rows (rehearsal→s2, sovereigntyHolds:true→s3).

Docs: CFS-018 gains an Interpretation correction section; CFS-015 gains one
record paragraph. Canaries updated to the graded semantics + a new pure helper
(sovereigntyRungForRun/bundleComponentsForArm) with a frontier→S2 / open-weight
→S3 mapping pin. Provider allowlists unchanged (SOVEREIGN_PROVIDER=venice,
REHEARSAL_PROVIDERS=chaingpt,openai).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/constitutional/chrysalis-test/route.ts` |
| Modified | `codexes/packs/ccrl/foundation/CFS-015_operation-chrysalis-2-prd.md` |
| Modified | `codexes/packs/ccrl/foundation/CFS-018_platform-sovereignty.md` |
| Modified | `components/composer/Exp004SovereigntyRunner.tsx` |
| Modified | `services/experiments/exp004.ts` |
| Added | `supabase/migrations/20260707000000_experiment_results_allow_exp004.sql` |
| Modified | `tests/constitutional-contracts.test.ts` |

## Stats

 7 files changed, 230 insertions(+), 80 deletions(-)
