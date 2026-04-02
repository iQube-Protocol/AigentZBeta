# Commit Brief: `5988f37` — fix: Update /api/codex/owned to return actual character asset IDs

| Field | Value |
|-------|-------|
| SHA | [`5988f37`](https://github.com/iQube-Protocol/AigentZBeta/commit/5988f37facfcecc165980b34d907816e44167371) |
| Author | Kn0w-1 |
| Date | 2025-12-28T16:53:36Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Update /api/codex/owned to return actual character asset IDs

- Query codex_media_assets to get actual database IDs for character_poster assets
- Extract character names from entitlement asset IDs (e.g., mk_char_aigent_z)
- Match against character_poster titles in database
- This fixes owned badges not showing in Characters tab

Remaining issues to investigate:
- Episode covers not rendering in wallet library
- Copilot inference still truncating despite max_tokens=4000
```

## Files Changed

_File details not available in backfill — see commit link above._
