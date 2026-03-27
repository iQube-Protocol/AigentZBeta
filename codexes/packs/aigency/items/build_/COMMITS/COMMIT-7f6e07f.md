# Commit Brief: `7f6e07f` — fix: CRITICAL - Add missing VITE_API_URL to root netlify.toml + API proxy

| Field | Value |
|-------|-------|
| SHA | [`7f6e07f`](https://github.com/iQube-Protocol/AigentZBeta/commit/7f6e07f27b478ed2c7226d4f7f6f4330218985c9) |
| Author | Kn0w-1 |
| Date | 2025-12-23T20:08:19Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: CRITICAL - Add missing VITE_API_URL to root netlify.toml + API proxy

ROOT CAUSE IDENTIFIED:
- Root netlify.toml was missing VITE_API_URL environment variables
- Vite compiled with undefined API URL → relative /api/* requests
- Netlify served HTML for /api/* → JSON.parse errors

FIXES:
1. Added VITE_API_URL env vars to root netlify.toml [build.environment]
2. Added /api/* → Amplify proxy redirect (prevents CORS + relative URL bugs)
3. Added debug echo to build command to verify env vars
4. Created api-fetch.ts with fail-fast JSON validation
5. Fixed BuyKnytModal.tsx to check response.ok before .json()

This should fix:
- Codex not loading on Netlify (all browsers)
- PDFs failing to load
- Payment JSON.parse errors
- All relative /api/* request issues

DEPLOYMENT INSTRUCTIONS:
1. Push this commit
2. Go to Netlify dashboard
3. Click 'Clear cache and deploy site'
4. Check build logs for: VITE_API_URL=https://dev-beta.aigentz.me
5. Verify production bundle contains 'dev-beta.aigentz.me' string
```

## Files Changed

_File details not available in backfill — see commit link above._
