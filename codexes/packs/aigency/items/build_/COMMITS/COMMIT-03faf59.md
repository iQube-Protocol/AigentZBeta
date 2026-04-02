# Commit Brief: `03faf59` — fix: Disable PDF.js worker for server-side execution

| Field | Value |
|-------|-------|
| SHA | [`03faf59`](https://github.com/iQube-Protocol/AigentZBeta/commit/03faf597bd067268dafaa106aa31c47caa18e985) |
| Author | Kn0w-1 |
| Date | 2025-12-27T00:23:18Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Disable PDF.js worker for server-side execution

PDF.js worker file is not included in Next.js standalone build. Since we're
running server-side, we can disable the worker and run PDF parsing in the
main thread. This avoids the missing pdf.worker.mjs module error.
```

## Files Changed

_File details not available in backfill — see commit link above._
