# Commit Brief: `b9af52a` — fix video chrome, receipt routing, templates, and copilot intent routing

| Field | Value |
|-------|-------|
| SHA | [`b9af52a`](https://github.com/iQube-Protocol/AigentZBeta/commit/b9af52ab80d07c57fdc3f90678f43b32838272e5) |
| Author | Claude |
| Date | 2026-03-20T23:17:53Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix video chrome, receipt routing, templates, and copilot intent routing

- fix primaryKind for video bundle pre-generation: check make_bundle.presetId
  and runtimeContentKind so video furniture shows before media is generated
- gate receipt icon on previewMedia existence (hide before generation)
- fix receipt link: point to experience viewer with focus=receipt param
- fix runtimeAuthoringHref regression: use panel=exqubes not panel=customizer
- auto-show packet in ComposerExperienceViewer when focus=receipt param present
- add ai-image-generation and ai-article-draft templates to configurator
- add copilot routing for image-only and article-only prompt intents

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
