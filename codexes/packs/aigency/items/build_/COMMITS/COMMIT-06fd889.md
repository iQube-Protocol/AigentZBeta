# Commit Brief: `06fd889` — Fix supabaseServer.ts to use direct Supabase client

| Field | Value |
|-------|-------|
| SHA | [`06fd889`](https://github.com/iQube-Protocol/AigentZBeta/commit/06fd8893634eacad81da1748953b992802f38375) |
| Author | Kn0w-1 |
| Date | 2025-11-30T06:59:52Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix supabaseServer.ts to use direct Supabase client

Removed dependency on @qriptoagentiq/core-client which has missing dist folder.
Now uses @supabase/supabase-js directly with client caching.
```

## Files Changed

_File details not available in backfill — see commit link above._
