# Commit Brief: `7158a15` — fix: Embed batch rendering logic directly in admin endpoint

| Field | Value |
|-------|-------|
| SHA | [`7158a15`](https://github.com/iQube-Protocol/AigentZBeta/commit/7158a157d3bbfd8dace944b1c95c39870b345f85) |
| Author | Kn0w-1 |
| Date | 2025-12-27T08:05:19Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Embed batch rendering logic directly in admin endpoint

- Move all rendering logic from separate script into API route
- Avoids node_modules resolution issues in Lambda
- Uses Ghostscript + sharp directly in endpoint
- Processes PDFs, uploads to Supabase, creates manifests
```

## Files Changed

_File details not available in backfill — see commit link above._
