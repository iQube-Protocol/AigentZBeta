# Commit Brief: `64a828f` — fix: Add CORS headers to all KNYT payment API endpoints

| Field | Value |
|-------|-------|
| SHA | [`64a828f`](https://github.com/iQube-Protocol/AigentZBeta/commit/64a828f3f0c554f6c44fd5c6fd44b311ccdfd581) |
| Author | Kn0w-1 |
| Date | 2025-12-23T18:44:49Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Add CORS headers to all KNYT payment API endpoints

- Added CORS headers to /api/wallet/knyt/purchase (GET and POST)
- Added CORS headers to /api/wallet/knyt/paypal/create-order
- Added CORS headers to /api/wallet/knyt/paypal/capture
- Added OPTIONS handlers for preflight requests
- This fixes 'failed to fetch' errors from Netlify thin client
```

## Files Changed

_File details not available in backfill — see commit link above._
