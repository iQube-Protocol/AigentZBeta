# Commit Brief: `67f7b61` — fix: PDF viewer iframe rendering with debugging and CSP support

| Field | Value |
|-------|-------|
| SHA | [`67f7b61`](https://github.com/iQube-Protocol/AigentZBeta/commit/67f7b6181c655d2c9b9269d3124e4dfb062278bc) |
| Author | Kn0w-1 |
| Date | 2025-12-27T04:21:12Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: PDF viewer iframe rendering with debugging and CSP support

- Add build marker (2025-12-26a) and mode indicator to verify deployment
- Add console logging for iframe load success and fallback warnings
- Ensure iframe has min-h-[70vh] to prevent collapse
- Add fallback controls (Open in new tab, Download buttons)
- Add CSP headers to allow Supabase iframe embedding
- Improve header layout with mode visibility

This enables deterministic debugging of PDF viewing issues.
```

## Files Changed

_File details not available in backfill — see commit link above._
