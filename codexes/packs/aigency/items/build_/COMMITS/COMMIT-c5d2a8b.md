# Commit Brief: `c5d2a8b` — fix discord URLs using localhost:3000 behind Amplify proxy

| Field | Value |
|-------|-------|
| SHA | [`c5d2a8b`](https://github.com/iQube-Protocol/AigentZBeta/commit/c5d2a8baf212667261cca77268b0d151fa9ffb22) |
| Author | Claude |
| Date | 2026-03-22T03:19:41Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix discord URLs using localhost:3000 behind Amplify proxy

request.nextUrl.origin returns the internal address (localhost:3000) on
Amplify. Resolve the real external origin from x-forwarded-proto and
x-forwarded-host headers so all absolute URLs in Discord messages point
to the correct external domain.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
