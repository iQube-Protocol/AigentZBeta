# Commit Brief: `35fecd5` — fix: Correct home-hero API table and query

| Field | Value |
|-------|-------|
| SHA | [`35fecd5`](https://github.com/iQube-Protocol/AigentZBeta/commit/35fecd59e8acf33dd917b19127e47119b59ac46d) |
| Author | Kn0w-1 |
| Date | 2025-12-29T01:11:37Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Correct home-hero API table and query

- Change table from content_items to content
- Query by domain='home' and placement->>'section'='home-hero'
- This matches the actual database schema from fix-home-content.sql
- Should fix the 500 error on home-hero endpoint
```

## Files Changed

_File details not available in backfill — see commit link above._
