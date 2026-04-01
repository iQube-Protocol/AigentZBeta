# Commit Brief: `435649d` — Refactor: Implement route groups (shell) and (embed) for chrome-free SmartTriad embeds

| Field | Value |
|-------|-------|
| SHA | [`435649d`](https://github.com/iQube-Protocol/AigentZBeta/commit/435649d34a82e780fc3900caaf1c276532122332) |
| Author | Kn0w-1 |
| Date | 2025-12-31T07:21:19Z |
| Branch | dev (direct push) |
| Type | `refactor` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Refactor: Implement route groups (shell) and (embed) for chrome-free SmartTriad embeds

- Create minimal root layout with no shell/sidebar
- Add (shell) route group with full AigentiQ UI (sidebar, nav, chrome)
- Add (embed) route group with chrome-free layout for iframe embedding
- Move all dashboard/admin routes to (shell) group
- Move /triad/embed/* routes to (embed) group
- Fix all import paths after route restructure
- Embed routes now render only SmartWallet/Codex panels without shell
- Preserves existing query param API (theme, density, tab, personaId)
- Ready for Lovable thin client integration
```

## Files Changed

_File details not available in backfill — see commit link above._
