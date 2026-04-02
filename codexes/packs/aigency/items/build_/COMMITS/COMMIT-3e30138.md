# Commit Brief: `3e30138` — surface supabase write failures and merge in-memory store into list results

| Field | Value |
|-------|-------|
| SHA | [`3e30138`](https://github.com/iQube-Protocol/AigentZBeta/commit/3e3013896281b30590ab3e611b1c789f95a8f96f) |
| Author | Claude |
| Date | 2026-03-24T22:39:24Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
surface supabase write failures and merge in-memory store into list results

- listExperienceRecords: after Supabase query, merge any experiences held in
  the Lambda in-memory store that are not in Supabase — fixes the case where
  a Supabase write failed silently (RLS, schema mismatch) and the experience
  only exists in the ephemeral store

- createExperienceRecord: tag the returned experience with _supabase_write_error
  when the Supabase upsert fails so the caller can propagate the error

- session complete API: log and return a warning field when Supabase write
  failed so the error is visible in the Network tab / server logs

https://claude.ai/code/session_017i9fiEGA3zMjxFonVYZCQT
```

## Files Changed

_File details not available in backfill — see commit link above._
