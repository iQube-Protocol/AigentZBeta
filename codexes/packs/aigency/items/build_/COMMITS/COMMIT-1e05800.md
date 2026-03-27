# Commit Brief: `1e05800` — feat: Optimize Codex performance with persistent caching and error handling

| Field | Value |
|-------|-------|
| SHA | [`1e05800`](https://github.com/iQube-Protocol/AigentZBeta/commit/1e058003c6064be2081d50fcafe644f72ece5252) |
| Author | Kn0w-1 |
| Date | 2025-12-23T22:42:23Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
feat: Optimize Codex performance with persistent caching and error handling

- Implement React Query for persistent data caching across drawer navigation
  - Episodes, characters, and lore cached for 10 minutes
  - Cache survives drawer closes/opens
  - Automatic retry with exponential backoff

- Add image loading queue to prevent API overload
  - Max 3 concurrent decrypt requests
  - 3 retries per image with exponential backoff (2s, 4s, 6s)
  - Queue management prevents hanging on heavy covers
  - Object URL caching for loaded images

- Add error boundaries for video player
  - Video errors no longer crash entire Codex
  - User-friendly error modal with recovery button
  - Graceful error handling without page refresh

Fixes:
- Cache clearing when switching between drawers
- Cover images hanging/failing to load (episodes 1-5, 9-10)
- Video loading errors breaking the Codex UI

Files:
- NEW: apps/theqriptopian-web/src/hooks/useCodexData.ts
- NEW: apps/theqriptopian-web/src/utils/image-loader.ts
- NEW: apps/theqriptopian-web/src/components/content/VideoErrorBoundary.tsx
- MODIFIED: apps/theqriptopian-web/src/components/content/KnytCodexTab.tsx
- DOCS: CODEX_PERFORMANCE_FIXES.md
```

## Files Changed

_File details not available in backfill — see commit link above._
