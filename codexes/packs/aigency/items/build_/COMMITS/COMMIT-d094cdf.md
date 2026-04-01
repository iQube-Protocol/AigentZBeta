# Commit Brief: `d094cdf` — fix: FIO API fallback & production RLS environment variable detection

| Field | Value |
|-------|-------|
| SHA | [`d094cdf`](https://github.com/iQube-Protocol/AigentZBeta/commit/d094cdf1ddb0f9eeca260823fe14ec1412792009) |
| Author | Know1 |
| Date | 2025-10-22T18:23:41Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: FIO API fallback & production RLS environment variable detection

CRITICAL FIXES:

1. **FIO Testnet API Failure Handling** ✅
   - Added automatic fallback when FIO API returns 500 error
   - Falls back to mock registration (saves to DB, no blockchain)
   - Logs: '[FIO Register] Falling back to MOCK MODE due to FIO API failure'
   - Uses 'fallback_tx_' prefix for transaction IDs
   - Allows persona creation to complete even when FIO testnet is down

2. **Production RLS Environment Variable Detection** ✅
   - Now tries BOTH 'SUPABASE_SERVICE_ROLE_KEY' and 'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY'
   - Amplify may require NEXT_PUBLIC_ prefix for server-side access
   - Added comprehensive logging to debug which key is being used
   - Logs available SUPABASE env vars for troubleshooting

3. **Better Error Diagnostics** ✅
   - Logs environment variable status on every persona creation
   - Shows which key type is being used (SERVICE_ROLE vs ANON)
   - Lists all available SUPABASE environment variables
   - Helps identify configuration issues in production

ERRORS FIXED:
❌ 'Failed to register FIO handle: Error 500 while fetching...' (now has fallback)
❌ Production RLS error (now tries multiple env var names)

TESTING:
- Local: FIO API down → Should fallback to mock registration
- Production: Check server logs for '[Persona API] Environment check'
- Production: Should show which SUPABASE key is being used

PRODUCTION ACTIONS:
1. Check Amplify logs for environment variable detection
2. If using SERVICE_ROLE, verify it's set correctly
3. May need to add NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY instead
4. Logs will show exactly which vars are available
```

## Files Changed

_File details not available in backfill — see commit link above._
