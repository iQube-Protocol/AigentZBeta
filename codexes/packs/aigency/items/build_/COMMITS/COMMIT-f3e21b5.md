# Commit Brief: `f3e21b5` — Fix CSP frame-ancestors in edge functions for Lovable

| Field | Value |
|-------|-------|
| SHA | [`f3e21b5`](https://github.com/iQube-Protocol/AigentZBeta/commit/f3e21b59e4a109d433099a458cfd44cd8011079e) |
| Author | Kn0w-1 |
| Date | 2026-02-24T07:06:43Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix CSP frame-ancestors in edge functions for Lovable

🚨 COMPLETE CSP FIX FOR ALL ENVIRONMENTS

Updated hardcoded CSP values in edge functions:
- netlify/edge-functions/embed-headers.ts
- apps/theqriptopian-web/netlify/edge-functions/embed-headers.ts

Added comprehensive Lovable domain support:
- *.lovable.app
- *.lovable.dev
- *.lovableproject.com
- *.aigentz.me

This ensures iframe embedding works across ALL deployment environments:
- dev-beta.aigentz.me (via policy.v1.json + middleware)
- Netlify deployments (via edge functions)
- All metaMe runtime embedding scenarios
```

## Files Changed

_File details not available in backfill — see commit link above._
