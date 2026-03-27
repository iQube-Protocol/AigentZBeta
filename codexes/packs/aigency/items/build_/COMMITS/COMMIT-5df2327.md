# Commit Brief: `5df2327` — fix: Add _redirects file to fix Netlify API proxy

| Field | Value |
|-------|-------|
| SHA | [`5df2327`](https://github.com/iQube-Protocol/AigentZBeta/commit/5df2327e9f07ebe2cc7980401b84b650244cb88f) |
| Author | Kn0w-1 |
| Date | 2025-12-31T20:11:27Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Add _redirects file to fix Netlify API proxy

CRITICAL FIX: Netlify proxy was completely broken, returning HTML instead of API responses.

Root Cause:
- netlify.toml redirects were being ignored or overridden
- SPA fallback was catching /api/* routes before proxy could handle them
- Frontend making API calls but getting HTML responses

Solution:
- Created public/_redirects file with explicit redirect rules
- API proxy redirect with 200! (force) comes FIRST
- SPA fallback comes LAST
- _redirects file takes precedence over netlify.toml

This should fix the content loading issue on production.
```

## Files Changed

_File details not available in backfill — see commit link above._
