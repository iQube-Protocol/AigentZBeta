# Commit Brief: `be20060` — fix: CRITICAL - Use relative URLs on production Netlify

| Field | Value |
|-------|-------|
| SHA | [`be20060`](https://github.com/iQube-Protocol/AigentZBeta/commit/be20060ed987a0fea560d0af1078261845678e25) |
| Author | Kn0w-1 |
| Date | 2025-12-31T19:48:14Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: CRITICAL - Use relative URLs on production Netlify

- Production Netlify now uses relative URLs (/api/*) for Netlify proxy
- Localhost uses absolute URLs (https://dev-beta.aigentz.me/api/*)
- This ensures production uses the Netlify proxy redirect correctly
- Fixes content not loading on live production site

Root Cause:
- Previous logic forced absolute URLs on production
- This bypassed the Netlify proxy configuration
- Content API calls were failing due to CORS/connection issues

Solution:
- Simple hostname check: localhost = absolute, production = relative
- Production uses /api/* which Netlify proxies to backend
- Localhost directly calls live API to avoid proxy issues
```

## Files Changed

_File details not available in backfill — see commit link above._
