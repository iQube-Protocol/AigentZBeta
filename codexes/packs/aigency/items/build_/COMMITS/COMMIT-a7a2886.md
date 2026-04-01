# Commit Brief: `a7a2886` — fix: Replace pdfjs-dist with pdf-parse for Node.js compatibility

| Field | Value |
|-------|-------|
| SHA | [`a7a2886`](https://github.com/iQube-Protocol/AigentZBeta/commit/a7a2886577aa06f42ae51d57a751b9d8660cb29b) |
| Author | Kn0w-1 |
| Date | 2025-12-27T00:46:26Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Replace pdfjs-dist with pdf-parse for Node.js compatibility

pdfjs-dist requires worker files that aren't included in Next.js standalone
build. pdf-parse is designed for Node.js and doesn't need workers.

- Moved pdf-parse from devDependencies to dependencies
- Replaced pdfjs-dist implementation with pdf-parse
- Simpler API, no worker dependencies, better for server-side use
```

## Files Changed

_File details not available in backfill — see commit link above._
