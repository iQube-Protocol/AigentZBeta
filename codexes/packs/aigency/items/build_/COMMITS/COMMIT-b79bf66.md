# Commit Brief: `b79bf66` — fix: Improve cover image loading and add SmartContent actions to metaKnyts

| Field | Value |
|-------|-------|
| SHA | [`b79bf66`](https://github.com/iQube-Protocol/AigentZBeta/commit/b79bf6689da1e5696f36b6a575c48f7a5d96d2ee) |
| Author | Kn0w-1 |
| Date | 2025-12-23T23:55:16Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Improve cover image loading and add SmartContent actions to metaKnyts

- Enhanced image loader with content-type validation and better error logging
- Added SmartContentActions to ContentCard for metaKnyts articles
- Wired up smart action handlers for read/watch modalities
- Fixed activeLoads decrement in retry logic to prevent queue stalls
- Added modalities metadata to metaKnyts content items
- Connected article reader for metaKnyts text content
- Wrapped video player in error boundary for Codex tab

Fixes:
- Cover images showing error icons due to content-type mismatches
- Missing action icons on metaKnyts articles (SmartTriad protocol)
- Image loader queue stalling on retries
```

## Files Changed

_File details not available in backfill — see commit link above._
