# Commit Brief: `36ef953` — fix: Remove duplicate header from evidence form to show domain selector

| Field | Value |
|-------|-------|
| SHA | [`36ef953`](https://github.com/iQube-Protocol/AigentZBeta/commit/36ef95328f61c926d25f85a68cdc52db3bcc4abe) |
| Author | Know1 |
| Date | 2025-10-21T20:59:43Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Remove duplicate header from evidence form to show domain selector

BUG FIX: Domain selector was hidden by duplicate headers

ISSUE:
- Modal had 'Submit Evidence' header
- Form component also had 'Submit Evidence' header
- Created duplicate headers and pushed domain selector out of view

SOLUTION:
- Removed duplicate header from form component
- Removed redundant wrapper styling
- Domain selector now visible at top of modal
- Cleaner, more streamlined UI

NOW VISIBLE:
✅ Domain selector dropdown at top
✅ Current reputation stats for selected domain
✅ Evidence submission form below
```

## Files Changed

_File details not available in backfill — see commit link above._
