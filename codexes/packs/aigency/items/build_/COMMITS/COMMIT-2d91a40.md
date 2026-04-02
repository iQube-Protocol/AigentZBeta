# Commit Brief: `2d91a40` — Fix Task UI components and dependencies

| Field | Value |
|-------|-------|
| SHA | [`2d91a40`](https://github.com/iQube-Protocol/AigentZBeta/commit/2d91a40047e59ea9f49923f3a37ecaab7838ecb6) |
| Author | Kn0w-1 |
| Date | 2025-11-30T06:02:37Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix Task UI components and dependencies

- Created missing shadcn UI components (label, slider, progress, dialog, alert-dialog)
- Updated tabs.tsx and Select.tsx to use radix-ui primitives with proper exports
- Created utils/cn.ts for className merging (lib/ is gitignored)
- Fixed CrmContext import path
- Created hooks/use-toast.ts for toast notifications
- Fixed AgentiQBootstrap to handle missing package gracefully
- Updated tasks page to fetch personas from API
- Renamed Button.tsx and Select.tsx to lowercase for consistent imports
```

## Files Changed

_File details not available in backfill — see commit link above._
