# Commit Brief: `632d4f9` — fix: use correct database constraint value for FIO registration status

| Field | Value |
|-------|-------|
| SHA | [`632d4f9`](https://github.com/iQube-Protocol/AigentZBeta/commit/632d4f9a7b1b7b49dbd6a019629e4c4a37344a10) |
| Author | Know1 |
| Date | 2025-10-18T01:21:16Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: use correct database constraint value for FIO registration status

- Change status from 'active' to 'confirmed' (matches DB constraint)
- Database only allows: pending, confirmed, failed, expired
- Update FIOInfoCard to handle all status values correctly
- Add status label formatter (confirmed -> Active)
- Add color coding for each status type
- Conditional pulsing dot for confirmed status only

Fixes: Registration succeeded but failed to save to database error
```

## Files Changed

_File details not available in backfill — see commit link above._
