# Commit Brief: `ada6904` — fix: Expose PayPal env vars to Next.js API routes for Amplify SSR

| Field | Value |
|-------|-------|
| SHA | [`ada6904`](https://github.com/iQube-Protocol/AigentZBeta/commit/ada6904cb6c2c0e8b3afc5b42d15c0881209ceea) |
| Author | Kn0w-1 |
| Date | 2025-12-26T02:27:44Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Expose PayPal env vars to Next.js API routes for Amplify SSR

- Added env config in next.config.js to explicitly expose PayPal variables
- Fixes runtime environment variable access in Amplify standalone mode
- PayPal credentials now available to API routes at runtime
- Using live PayPal mode for production credentials
```

## Files Changed

_File details not available in backfill — see commit link above._
