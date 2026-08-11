# Commit Brief: `a37a29e` — Implement focusedNavDepth support for depth-aware chrome suppression

| Field | Value |
|-------|-------|
| SHA | [`a37a29e`](https://github.com/iQube-Protocol/AigentZBeta/commit/a37a29edbc6ef846a4be576104cb65ed2cbf87ba) |
| Author | Claude |
| Date | 2026-08-10T22:50:19Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Implement focusedNavDepth support for depth-aware chrome suppression

Extended the focused-surface contract (utils/codex-nav.ts, embed route, JourneySurfaceDescriptor)
to support explicit focusedNavDepth parameter controlling navigation tier visibility when focused:
- depth 0: content surface only (no cartridge nav, no domain nav)
- depth >= 1: show chrome with depth-aware limiting
- undefined: fall back to suppressPrimaryChrome for backward compatibility

Threading sequence:
- CodexNavOptions.focusedNavDepth → buildCodexUrl emits ?depth=N
- Embed route parses ?depth= and forwards focusedNavDepth to CodexPanelDynamic
- CodexPanelDynamic implements depth-aware primaryChromeHidden logic
- focusedNavDepth forwarded through TabRenderer → tab components
- buildEmbedSurfaceSrc threads focusedNavDepth from descriptor to buildCodexUrl

Enables KNYTS depth map (Pulse depth 0, Store depth 1, myCanvas depth 0)
and Passport progressive depth resolution (depth 0 → 1 post-crossing).
```

## Body

Extended the focused-surface contract (utils/codex-nav.ts, embed route, JourneySurfaceDescriptor)
to support explicit focusedNavDepth parameter controlling navigation tier visibility when focused:
- depth 0: content surface only (no cartridge nav, no domain nav)
- depth >= 1: show chrome with depth-aware limiting
- undefined: fall back to suppressPrimaryChrome for backward compatibility

Threading sequence:
- CodexNavOptions.focusedNavDepth → buildCodexUrl emits ?depth=N
- Embed route parses ?depth= and forwards focusedNavDepth to CodexPanelDynamic
- CodexPanelDynamic implements depth-aware primaryChromeHidden logic
- focusedNavDepth forwarded through TabRenderer → tab components
- buildEmbedSurfaceSrc threads focusedNavDepth from descriptor to buildCodexUrl

Enables KNYTS depth map (Pulse depth 0, Store depth 1, myCanvas depth 0)
and Passport progressive depth resolution (depth 0 → 1 post-crossing).

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/(embed)/triad/embed/codex/[codexSlug]/page.tsx` |
| Modified | `app/triad/components/CodexPanelDynamic.tsx` |
| Modified | `app/triad/components/codex/TabRenderer.tsx` |
| Modified | `services/journey/journeySurfaceRegistry.ts` |
| Modified | `utils/codex-nav.ts` |

## Stats

 5 files changed, 109 insertions(+), 14 deletions(-)
