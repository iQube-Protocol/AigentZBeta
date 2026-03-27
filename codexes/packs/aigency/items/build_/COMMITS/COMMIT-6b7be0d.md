# Commit Brief: `6b7be0d` — fix: Add SSR environment variables to amplify.yml for runtime injection

| Field | Value |
|-------|-------|
| SHA | [`6b7be0d`](https://github.com/iQube-Protocol/AigentZBeta/commit/6b7be0d886a9619bde4bf4c4b56b42a18d8e7855) |
| Author | Know1 |
| Date | 2025-10-23T04:46:37Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Add SSR environment variables to amplify.yml for runtime injection

CRITICAL FIX: Server-side env vars not available to API routes

ROOT CAUSE:
- /api/test confirmed API routes work but env vars return false
- Amplify injects env vars at build time but NOT SSR runtime by default
- Next.js API routes running in Lambda need explicit env configuration

SOLUTION:
- Added environment.variables section to amplify.yml
- Maps Amplify Console env vars to SSR function runtime
- Uses ${VAR} syntax to reference Console values
- Separates secrets (private keys) from regular variables

VARIABLES MAPPED:
- FIO_API_ENDPOINT
- FIO_CHAIN_ID
- FIO_SYSTEM_PUBLIC_KEY
- FIO_MOCK_MODE
- NEXT_PUBLIC_FIO_NETWORK
- SUPABASE_URL

SECRETS MAPPED:
- FIO_SYSTEM_PRIVATE_KEY
- SUPABASE_SERVICE_ROLE_KEY

EXPECTED RESULT:
- /api/test will show hasFioEndpoint: true, hasSupabaseUrl: true
- /api/health/fio will show real config values (not 'unset')
- FIO registration will stop falling back to mock

TESTING:
1. Redeploy dev branch on Amplify
2. Check /api/test for env.hasFioEndpoint: true
3. Check /api/health/fio for real endpoint/chainId
4. Try persona creation with alice@knyt
```

## Files Changed

_File details not available in backfill — see commit link above._
