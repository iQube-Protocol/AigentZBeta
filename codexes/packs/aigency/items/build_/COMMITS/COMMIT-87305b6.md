# Commit Brief: `87305b6` — fix: use cross-fetch for FIO SDK Node.js compatibility

| Field | Value |
|-------|-------|
| SHA | [`87305b6`](https://github.com/iQube-Protocol/AigentZBeta/commit/87305b654bf3ae6a4cf83a56ab87d25483e8d5b1) |
| Author | Know1 |
| Date | 2025-10-17T23:25:00Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: use cross-fetch for FIO SDK Node.js compatibility

- Import cross-fetch instead of relying on global fetch
- Fixes 'fetch failed' error in server-side FIO SDK calls
- Add detailed error logging for debugging
- cross-fetch provides better Node.js/browser compatibility
```

## Files Changed

_File details not available in backfill — see commit link above._
