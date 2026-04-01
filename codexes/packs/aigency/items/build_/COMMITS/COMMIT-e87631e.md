# Commit Brief: `e87631e` — Fix CSP frame-ancestors for Lovable embedding

| Field | Value |
|-------|-------|
| SHA | [`e87631e`](https://github.com/iQube-Protocol/AigentZBeta/commit/e87631e3b306a02ed96b7641655782d71bab8d33) |
| Author | Kn0w-1 |
| Date | 2026-02-24T07:02:23Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix CSP frame-ancestors for Lovable embedding

🚨 CRITICAL FIX for iframe embedding

Added *.lovableproject.com to CSP frame-ancestors and authAllowedOrigins:
- Prevents X-Frame-Options blocking from dev-beta.aigentz.me
- Enables Lovable iframe embedding for metaMe runtime
- Required for core architecture stack to function

CSP now includes:
https://*.lovableproject.com

This fixes the 'Open in New Tab' fallback issue.
```

## Files Changed

_File details not available in backfill — see commit link above._
