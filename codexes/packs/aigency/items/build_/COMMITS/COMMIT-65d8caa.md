# Commit Brief: `65d8caa` — fix: Remove all duplicate and broken embed/admin routes

| Field | Value |
|-------|-------|
| SHA | [`65d8caa`](https://github.com/iQube-Protocol/AigentZBeta/commit/65d8caa35b9919e41e161a3cac4d94a61238faa8) |
| Author | Kn0w-1 |
| Date | 2026-01-02T07:46:18Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Remove all duplicate and broken embed/admin routes

- Remove app/admin directory (duplicate of (shell)/admin)
- Remove app/(embed)/triad directory (broken imports)
- These were causing Next.js build failures
- Referral system API routes are unaffected
```

## Files Changed

_File details not available in backfill — see commit link above._
