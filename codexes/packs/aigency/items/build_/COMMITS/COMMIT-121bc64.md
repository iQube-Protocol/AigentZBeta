# Commit Brief: `121bc64` — fix: Add CORS headers to all pdf-meta error responses

| Field | Value |
|-------|-------|
| SHA | [`121bc64`](https://github.com/iQube-Protocol/AigentZBeta/commit/121bc648f3e49f35aaa559ad8637f5676e136cc6) |
| Author | Kn0w-1 |
| Date | 2025-12-26T23:20:12Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Add CORS headers to all pdf-meta error responses

Wrap GET handler in try-catch to ensure CORS headers are always returned,
even when PDF processing fails with 500 error. This fixes CORS blocking
when PDF metadata endpoint encounters errors.
```

## Files Changed

_File details not available in backfill — see commit link above._
