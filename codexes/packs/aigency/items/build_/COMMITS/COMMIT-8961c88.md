# Commit Brief: `8961c88` — fix supabase timeout and query limit to prevent lambda hangs

| Field | Value |
|-------|-------|
| SHA | [`8961c88`](https://github.com/iQube-Protocol/AigentZBeta/commit/8961c8800e6a6e68f270cbf6f421b966b6017262) |
| Author | Claude |
| Date | 2026-03-25T18:33:44Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix supabase timeout and query limit to prevent lambda hangs

always apply fetch timeout (8s prod / 4s dev) on supabase client so
a stalled connection returns an error instead of hanging the lambda
indefinitely. add .limit() + .order() to listExperienceRecords so the
query is bounded rather than a full table scan on every request.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
