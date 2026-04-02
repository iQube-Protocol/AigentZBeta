# Commit Brief: `f93ea1e` — Feat: Separate home page content from domain drawers

| Field | Value |
|-------|-------|
| SHA | [`f93ea1e`](https://github.com/iQube-Protocol/AigentZBeta/commit/f93ea1e61574b92ce23060babebe10fcc1f4217e) |
| Author | Kn0w-1 |
| Date | 2025-12-08T00:28:05Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Feat: Separate home page content from domain drawers

PROBLEM:
- Home page content mixed with PennyDrops domain (17 items)
- Home hero, latest news, second hero appearing in drawer
- PennyDrops drawer showing home content instead of stories

SOLUTION:
- Created 'home' domain for home-only content
- Updated constraint to allow 'home' domain
- Fetch script now properly marks domains as published/unpublished
- Home page content won't appear in any drawer

FILES:
- scripts/fix-home-content.sql (SQL to move 10 items to 'home')
- scripts/check-home-content.ts (analysis script)
- scripts/fetch-qubebase-content.ts (updated domain configs)
- Updated 3 drawers to use live CodexQube data

DISTRIBUTION AFTER FIX:
- home: 10 items (home-hero:3, latest-news:5, second-hero:2)
- pennydrops: 7 items (actual Q¢ stories)
- scrolls: 15 items
- kn0wdz: 15 items

Next: Run fix-home-content.sql then re-fetch
```

## Files Changed

_File details not available in backfill — see commit link above._
