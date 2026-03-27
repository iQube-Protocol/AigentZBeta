# Commit Brief: `c3b8d8e` — fix: Use VITE_API_URL for production thin client API calls

| Field | Value |
|-------|-------|
| SHA | [`c3b8d8e`](https://github.com/iQube-Protocol/AigentZBeta/commit/c3b8d8ebccc7df2167ce4a123ce9ab9dade06be5) |
| Author | Kn0w-1 |
| Date | 2025-12-25T15:59:33Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Use VITE_API_URL for production thin client API calls

- Changed apiBase from empty string to import.meta.env.VITE_API_URL
- Fixes 'Missing required fields' error in production PayPal purchases
- Thin client now correctly calls backend API in production
- Local dev still works with empty string fallback
```

## Files Changed

_File details not available in backfill — see commit link above._
