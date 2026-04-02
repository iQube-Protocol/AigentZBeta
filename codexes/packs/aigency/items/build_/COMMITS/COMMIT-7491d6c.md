# Commit Brief: `7491d6c` — fix: Remove tab-level visibilityRules check in visibilityEvaluator

| Field | Value |
|-------|-------|
| SHA | [`7491d6c`](https://github.com/iQube-Protocol/AigentZBeta/commit/7491d6c5baeea26af1cb0f5b9f7ffd8f326825d6) |
| Author | Kn0w-1 |
| Date | 2025-12-07T00:55:21Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Remove tab-level visibilityRules check in visibilityEvaluator

- DrawerTab interface doesn't have visibilityRules property
- Tabs are always visible, only slots have visibility constraints
- Remove the non-existent property access

Fixes TypeScript compilation error:
Property 'visibilityRules' does not exist on type 'DrawerTab' at line 176
```

## Files Changed

_File details not available in backfill — see commit link above._
