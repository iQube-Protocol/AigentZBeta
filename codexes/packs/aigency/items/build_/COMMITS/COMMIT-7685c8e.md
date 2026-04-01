# Commit Brief: `7685c8e` — fix: Add NEXT_PUBLIC_ fallbacks for environment variables

| Field | Value |
|-------|-------|
| SHA | [`7685c8e`](https://github.com/iQube-Protocol/AigentZBeta/commit/7685c8e63710adced611034d53b39ef2c8d1b2e5) |
| Author | Know1 |
| Date | 2025-10-19T04:35:04Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Add NEXT_PUBLIC_ fallbacks for environment variables

Add fallback support for NEXT_PUBLIC_ prefixed environment variables
in case they were set with those names in Amplify:

- SUPABASE_URL || NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
- AGENT_KEY_ENCRYPTION_SECRET || NEXT_PUBLIC_AGENT_KEY_ENCRYPTION_SECRET

This should resolve the 'Missing environment variables' errors
if the variables were set with NEXT_PUBLIC_ prefixes in Amplify.
```

## Files Changed

_File details not available in backfill — see commit link above._
