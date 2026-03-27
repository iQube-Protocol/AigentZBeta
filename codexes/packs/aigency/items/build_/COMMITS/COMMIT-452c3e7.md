# Commit Brief: `452c3e7` — fix: Add Promise.withResolvers polyfill for Node.js 20 compatibility

| Field | Value |
|-------|-------|
| SHA | [`452c3e7`](https://github.com/iQube-Protocol/AigentZBeta/commit/452c3e72c8c28aedae62a6507a7a6581b67ee98d) |
| Author | Kn0w-1 |
| Date | 2025-12-27T00:07:58Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Add Promise.withResolvers polyfill for Node.js 20 compatibility

PDF.js or Autonomys library requires Promise.withResolvers which is only
available in Node.js 22+. Amplify uses Node 20.18.0, so adding polyfill
to enable PDF metadata processing.
```

## Files Changed

_File details not available in backfill — see commit link above._
