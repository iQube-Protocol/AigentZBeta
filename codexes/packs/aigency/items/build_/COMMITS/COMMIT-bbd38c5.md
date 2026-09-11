# Commit Brief: `bbd38c5` — fix move-forward NBE regression + add operator archetype to experience model setup

| Field | Value |
|-------|-------|
| SHA | [`bbd38c5`](https://github.com/iQube-Protocol/AigentZBeta/commit/bbd38c5638aa0d4cd3bd5b9e4e35f6de77c5cc6b) |
| Author | Claude |
| Date | 2026-06-25T18:29:07Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix move-forward NBE regression + add operator archetype to experience model setup

NBE regression: buildMoveForward was missing getCommercialSpineState, so
spineStagesComplete was always {} — causing all golden-path NBEs
(establish-standing, open-founder-office, advance-venture-lab) to fail their
spineStagePrereq gate. Now mirrors buildBrief exactly.

Archetype: add OperatorArchetype (citizen|entrepreneurial|technical|creative)
from the Polity Participation Model as a T1 meta field on ExperienceQubeMeta.
Wizard Step 1 leads with archetype selector; selection auto-defaults
experienceType and feeds the NBE reranker so aigentMe biases toward
archetype-appropriate next-best actions. Migration adds operator_archetype
column to experience_qubes.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA
```

## Body

NBE regression: buildMoveForward was missing getCommercialSpineState, so
spineStagesComplete was always {} — causing all golden-path NBEs
(establish-standing, open-founder-office, advance-venture-lab) to fail their
spineStagePrereq gate. Now mirrors buildBrief exactly.

Archetype: add OperatorArchetype (citizen|entrepreneurial|technical|creative)
from the Polity Participation Model as a T1 meta field on ExperienceQubeMeta.
Wizard Step 1 leads with archetype selector; selection auto-defaults
experienceType and feeds the NBE reranker so aigentMe biases toward
archetype-appropriate next-best actions. Migration adds operator_archetype
column to experience_qubes.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/assistant/experience-model/route.ts` |
| Modified | `components/metame/setup/ExperienceModelSetupWizard.tsx` |
| Modified | `services/iqube/experienceQube.ts` |
| Modified | `services/orchestration/briefBuilder.ts` |
| Modified | `services/orchestration/nbeCatalog.ts` |
| Modified | `services/orchestration/nbeLlmRerank.ts` |
| Added | `supabase/migrations/20260625000001_experience_qubes_operator_archetype.sql` |

## Stats

 7 files changed, 125 insertions(+), 4 deletions(-)
