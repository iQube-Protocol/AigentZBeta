# Commit Brief: `2aa5335` — Add CFS-007 renderer seam: ExperienceRenderer + liquid/a2ui adapters

| Field | Value |
|-------|-------|
| SHA | [`2aa5335`](https://github.com/iQube-Protocol/AigentZBeta/commit/2aa5335344fc76d5544b868190264e5ac60f04bd) |
| Author | Claude |
| Date | 2026-07-04T06:27:00Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add CFS-007 renderer seam: ExperienceRenderer + liquid/a2ui adapters

Name the rendering seam (Law VI: separate architecture from rendering):
types/experienceRenderer.ts defines ExperienceRenderer, prescription and
citizen-context contracts plus normalizeExperienceDepth (the documented
mini_rt/mini_runtime bridge). Two adapters wrap the existing mechanisms
without rewriting them: the liquid adapter wraps liquidTemplateRegistry
(TabRenderer's liquid-ui branch now resolves through it) and the a2ui
adapter wraps the surface-plan-to-A2UI flow (the CopilotKit action now
delegates to it). Fixes a latent divergence bug found while wiring: two
copies of the liquid registry (registry.ts / registry.tsx) disagreed on
registered templates, so module resolution silently lost either
living_canon or cartridge_runtime; merged into one canonical
registry.tsx carrying both, duplicate deleted. Session doc covers this
plus the knowledge-init and EXP-003 commits.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Name the rendering seam (Law VI: separate architecture from rendering):
types/experienceRenderer.ts defines ExperienceRenderer, prescription and
citizen-context contracts plus normalizeExperienceDepth (the documented
mini_rt/mini_runtime bridge). Two adapters wrap the existing mechanisms
without rewriting them: the liquid adapter wraps liquidTemplateRegistry
(TabRenderer's liquid-ui branch now resolves through it) and the a2ui
adapter wraps the surface-plan-to-A2UI flow (the CopilotKit action now
delegates to it). Fixes a latent divergence bug found while wiring: two
copies of the liquid registry (registry.ts / registry.tsx) disagreed on
registered templates, so module resolution silently lost either
living_canon or cartridge_runtime; merged into one canonical
registry.tsx carrying both, duplicate deleted. Session doc covers this
plus the knowledge-init and EXP-003 commits.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/(shell)/copilot/actions/a2ui.ts` |
| Modified | `app/triad/components/codex/TabRenderer.tsx` |
| Added | `app/triad/components/codex/liquidTemplates/liquidExperienceRenderer.ts` |
| Deleted | `app/triad/components/codex/liquidTemplates/registry.ts` |
| Modified | `app/triad/components/codex/liquidTemplates/registry.tsx` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-07-04_cfs007-seam-knowledge-init-exp003.md` |
| Added | `services/a2ui/a2uiExperienceRenderer.ts` |
| Added | `types/experienceRenderer.ts` |

## Stats

 9 files changed, 366 insertions(+), 111 deletions(-)
