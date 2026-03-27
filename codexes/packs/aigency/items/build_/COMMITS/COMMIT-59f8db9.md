# Commit Brief: `59f8db9` — fix: Use Amplify Gen 2 compute.environment syntax for SSR env injection

| Field | Value |
|-------|-------|
| SHA | [`59f8db9`](https://github.com/iQube-Protocol/AigentZBeta/commit/59f8db9b849e6f91edda5cf25ae7757c8fb19686) |
| Author | Know1 |
| Date | 2025-10-23T04:59:07Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Use Amplify Gen 2 compute.environment syntax for SSR env injection

ATTEMPT #2: Previous environment section didn't work

CHANGES:
1. Added output: 'standalone' to next.config.js for better Amplify compatibility
2. Changed amplify.yml to use compute.environment syntax (Amplify Gen 2 format)
3. Moved from environment.variables to compute.type=ssr.environment

AMPLIFY GEN 2 SYNTAX:
compute:
  type: ssr
  environment:
    VAR_NAME: ${VAR_NAME}

This is the correct format for Next.js SSR on Amplify Gen 2.

TESTING:
After deploy, /api/test should show:
- hasSupabaseUrl: true
- hasFioEndpoint: true

If this still doesn't work, the issue is likely:
- Amplify Console env vars not set correctly
- Branch mismatch between domain and overrides
- Need to use Amplify Secrets instead of env vars
```

## Files Changed

_File details not available in backfill — see commit link above._
