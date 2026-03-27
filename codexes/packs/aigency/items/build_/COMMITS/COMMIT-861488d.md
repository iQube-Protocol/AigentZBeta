# Commit Brief: `861488d` — increase sora poll attempts from 8 to 24

| Field | Value |
|-------|-------|
| SHA | [`861488d`](https://github.com/iQube-Protocol/AigentZBeta/commit/861488dd1133b0d239850520012a125e23799f5f) |
| Author | Claude |
| Date | 2026-03-21T23:01:54Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
increase sora poll attempts from 8 to 24

8 × 15 s = ~1 min 45 s was not enough for Sora jobs that typically take
3–5 minutes. 24 attempts covers ~5 min 45 s total (first check fires
immediately, subsequent checks every 15 s).

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
