# Commit Brief: `b575dad` — fix experiences broad fallback, discord video proxy resolution, and auto-gen logging

| Field | Value |
|-------|-------|
| SHA | [`b575dad`](https://github.com/iQube-Protocol/AigentZBeta/commit/b575dad1435f9877b2ca48910ce1319d4d0e2495) |
| Author | Claude |
| Date | 2026-03-24T21:02:30Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix experiences broad fallback, discord video proxy resolution, and auto-gen logging

- fetchExperiences: always run the broad ?limit=100 fetch (no tenant filter)
  and merge unique items so experiences stored under null or mismatched
  tenant_ids (pre-wallet orphans) are always surfaced regardless of what the
  tenant-specific fetches return

- messenger/dispatch: add resolveVideoProxyUrl helper that follows the 302
  from /api/skills/video/* server-side (5 s timeout, redirect:manual) so
  Discord receives the direct Supabase CDN .mp4 URL for asset_link deploys
  rather than a redirect it won't embed

- handleComplete: surface video auto-gen failures to console.warn instead of
  silently swallowing them so failures are visible in browser devtools

https://claude.ai/code/session_017i9fiEGA3zMjxFonVYZCQT
```

## Files Changed

_File details not available in backfill — see commit link above._
