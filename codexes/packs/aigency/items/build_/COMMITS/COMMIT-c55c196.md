# Commit Brief: `c55c196` — fix video status: check supabase cache first, handle expired videos, clear banner

| Field | Value |
|-------|-------|
| SHA | [`c55c196`](https://github.com/iQube-Protocol/AigentZBeta/commit/c55c19624377423813319a67f0a32047b0dad45f) |
| Author | Claude |
| Date | 2026-03-22T20:26:50Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix video status: check supabase cache first, handle expired videos, clear banner

- status route: check Supabase storage before calling OpenAI API — videos uploaded
  by the proxy route are returned as ready:true immediately, without needing OpenAI
  (whose generations expire ~1 h after completion); also returns thumbnail_url if
  cached thumbnail exists
- status route: avoid redundant thumbnail download when video already in Supabase
- polling effect: refactor into markComplete() helper shared by ready and error paths;
  after MAX_CONSECUTIVE_ERRORS (3) back-to-back status errors, mark as complete and
  clear the banner (video was completed but expired — can no longer be generating)

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
