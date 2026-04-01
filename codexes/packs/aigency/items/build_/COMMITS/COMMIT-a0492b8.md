# Commit Brief: `a0492b8` — debug: add minimal /api/test route to diagnose Amplify API routing

| Field | Value |
|-------|-------|
| SHA | [`a0492b8`](https://github.com/iQube-Protocol/AigentZBeta/commit/a0492b8896e85dd1690093571d6130762c1f532f) |
| Author | Know1 |
| Date | 2025-10-23T04:08:19Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
debug: add minimal /api/test route to diagnose Amplify API routing

- Simple test route to confirm API routes work at all
- Reports env presence without secrets
- Will help isolate whether issue is route-specific or global

If this route also fails with NS_BINDING_ABORTED, the problem is:
- Amplify build/deploy issue
- Rewrite rule blocking /api/*
- Edge runtime incompatibility

If this route works, the issue is specific to /api/health/fio
```

## Files Changed

_File details not available in backfill — see commit link above._
