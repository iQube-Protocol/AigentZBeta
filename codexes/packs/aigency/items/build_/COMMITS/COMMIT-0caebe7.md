# Commit Brief: `0caebe7` — fix: Replace AbortSignal.timeout with AbortController for Node.js compatibility

| Field | Value |
|-------|-------|
| SHA | [`0caebe7`](https://github.com/iQube-Protocol/AigentZBeta/commit/0caebe7ba5daa1081d6b6edfa30ef114d5221763) |
| Author | Know1 |
| Date | 2025-10-10T03:22:23Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Replace AbortSignal.timeout with AbortController for Node.js compatibility

- AbortSignal.timeout() not available in older Node.js versions
- Replaced with AbortController + setTimeout pattern
- Fixes dev server crash on ICP health check
- Maintains same timeout functionality (5s primary, 3s fallback)
```

## Files Changed

_File details not available in backfill — see commit link above._
