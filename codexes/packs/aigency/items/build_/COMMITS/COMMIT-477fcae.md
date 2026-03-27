# Commit Brief: `477fcae` — fix: Resolve all remaining Next.js route conflicts

| Field | Value |
|-------|-------|
| SHA | [`477fcae`](https://github.com/iQube-Protocol/AigentZBeta/commit/477fcae90a0e5e1b83b914bd19d8ef398acbff5f) |
| Author | Kn0w-1 |
| Date | 2026-02-07T02:58:02Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Resolve all remaining Next.js route conflicts

- Remove duplicate pages conflicting with (shell) route group
- Deleted: app/iqube, app/settings, app/registry
- Keep only (shell) route group versions to avoid parallel path conflicts
- Fixes remaining Amplify build failures due to duplicate route resolution
- All functionality preserved in (shell) route group
```

## Files Changed

_File details not available in backfill — see commit link above._
