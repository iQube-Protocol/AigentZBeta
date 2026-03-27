# Commit Brief: `413a1b5` — Fix: Sort home page content by position & apply image positioning

| Field | Value |
|-------|-------|
| SHA | [`413a1b5`](https://github.com/iQube-Protocol/AigentZBeta/commit/413a1b50fb9f8ed111e444423df5dd5d64c16250) |
| Author | Kn0w-1 |
| Date | 2025-12-08T01:12:01Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix: Sort home page content by position & apply image positioning

FIXES:
1. Content Ordering - All three sections now sort by placement.position
   - home-hero: Now displays in correct order (1, 2, 3)
   - latest-news: Now displays in correct order (1-5)
   - second-hero: Now displays in correct order (1, 2)

2. Image Positioning - Hero sections now use placement metadata
   - Applies imageScale, imageX, imageY from database
   - Uses CSS background properties for dynamic positioning
   - Example: QriptoCENT has imageX:65, imageY:55 (custom positioning)

COMPONENTS UPDATED:
- HeroSection.tsx: Added sort + image positioning
- LatestNewsCarousel.tsx: Added sort by position
- SecondHeroSection.tsx: Added sort + image positioning

STILL NEEDED (per JSON spec):
- Modalities field (read/watch/listen/link) not yet in database
- Read/watch/listen buttons exist but not connected to content

Note: Inline styles required for dynamic image positioning per database values.
```

## Files Changed

_File details not available in backfill — see commit link above._
