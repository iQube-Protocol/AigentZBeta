# Commit Brief: `87cb746` — fix: Use object tag for PDF embed + add CSP headers for Supabase

| Field | Value |
|-------|-------|
| SHA | [`87cb746`](https://github.com/iQube-Protocol/AigentZBeta/commit/87cb7463430720872d0460f89f101e87837275a6) |
| Author | Kn0w-1 |
| Date | 2025-12-27T10:13:44Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Use object tag for PDF embed + add CSP headers for Supabase

- Replace iframe with object tag (more reliable for native PDF rendering)
- Add fallback content inside object for browsers that don't support inline PDF
- Add CSP headers to allow frame-src and object-src from Supabase
- Update build version to 2025-12-27a
```

## Files Changed

_File details not available in backfill — see commit link above._
