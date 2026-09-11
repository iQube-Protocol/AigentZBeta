# Commit Brief: `86d150a` — Qriptopian cartridge: add qriptopia.com iframe tab (mirrors metaMe)

| Field | Value |
|-------|-------|
| SHA | [`86d150a`](https://github.com/iQube-Protocol/AigentZBeta/commit/86d150a417b33b2a91ec52bd177b27d0939894aa) |
| Author | Claude |
| Date | 2026-05-29T14:34:59Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Qriptopian cartridge: add qriptopia.com iframe tab (mirrors metaMe)

Same first-class web-embed pattern the metaMe cartridge got: new
tabGroups entry { id: 'web', icon: 'Globe', iconOnly: true, order: -1 }
sitting before Codex, and a tabs entry mounting the generic IframeTab
component with props.src = 'https://qriptopia.com'. No activation
gating; tab persists as a first-class menu item.

Operator has separately briefed Lovable on the qriptopia.com server-
side change (delete X-Frame-Options + set CSP frame-ancestors to allow
the embedding domains), so the embed should resolve cleanly once that
ships. If the page renders blank after the deploy lands, the cause is
on the qriptopia.com response headers, not on this tab.
```

## Body

Same first-class web-embed pattern the metaMe cartridge got: new
tabGroups entry { id: 'web', icon: 'Globe', iconOnly: true, order: -1 }
sitting before Codex, and a tabs entry mounting the generic IframeTab
component with props.src = 'https://qriptopia.com'. No activation
gating; tab persists as a first-class menu item.

Operator has separately briefed Lovable on the qriptopia.com server-
side change (delete X-Frame-Options + set CSP frame-ancestors to allow
the embedding domains), so the embed should resolve cleanly once that
ships. If the page renders blank after the deploy lands, the cause is
on the qriptopia.com response headers, not on this tab.

## Files Changed

| Change | File |
|--------|------|
| Modified | `data/codex-configs.ts` |

## Stats

 1 file changed, 29 insertions(+)
