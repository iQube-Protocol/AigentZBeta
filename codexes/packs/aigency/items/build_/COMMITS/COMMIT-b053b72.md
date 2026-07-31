# Commit Brief: `b053b72` — Add Researcher as the fifth operator pathway + wire into subscription/FO flow

| Field | Value |
|-------|-------|
| SHA | [`b053b72`](https://github.com/iQube-Protocol/AigentZBeta/commit/b053b72b03968cfc8af11f1201d525dc3fbd27e7) |
| Author | Claude |
| Date | 2026-07-16T03:47:58Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add Researcher as the fifth operator pathway + wire into subscription/FO flow

- research OperatorArchetype: type union + VALID_ARCHETYPES (experienceQube),
  ARCHETYPE_DOMAINS (standingScore), setup wizard (type + picker + default-type)
- widen operator_archetype DB CHECK constraint to admit 'research' (migration)
- register 'researcher' activation gate reusing aigentzLiteAccess / sovereign_citizen
  (same tier as the aigentZ/DevOn developer copilot — no new pricing)
- activation-catalog 'researcher' entry (gated) + 'researcher' specialist
- gated metaMe 'research' tab group + Research Copilot tab (IRLResearchCopilotTab)
- updates doc + collections.json registration

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

- research OperatorArchetype: type union + VALID_ARCHETYPES (experienceQube),
  ARCHETYPE_DOMAINS (standingScore), setup wizard (type + picker + default-type)
- widen operator_archetype DB CHECK constraint to admit 'research' (migration)
- register 'researcher' activation gate reusing aigentzLiteAccess / sovereign_citizen
  (same tier as the aigentZ/DevOn developer copilot — no new pricing)
- activation-catalog 'researcher' entry (gated) + 'researcher' specialist
- gated metaMe 'research' tab group + Research Copilot tab (IRLResearchCopilotTab)
- updates doc + collections.json registration

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-07-16_researcher-pathway-fo-subscription-integration.md` |
| Modified | `components/metame/setup/ExperienceModelSetupWizard.tsx` |
| Modified | `data/activation-catalog.ts` |
| Modified | `data/codex-configs.ts` |
| Modified | `services/activations/activationPlanGate.ts` |
| Modified | `services/iqube/experienceQube.ts` |
| Modified | `services/standing/standingScore.ts` |
| Added | `supabase/migrations/20260716000000_experience_qubes_archetype_add_research.sql` |

## Stats

 9 files changed, 189 insertions(+), 4 deletions(-)
