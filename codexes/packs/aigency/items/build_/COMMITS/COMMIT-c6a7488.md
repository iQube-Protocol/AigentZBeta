# Commit Brief: `c6a7488` — fix: Load referrer fields when fetching persona data

| Field | Value |
|-------|-------|
| SHA | [`c6a7488`](https://github.com/iQube-Protocol/AigentZBeta/commit/c6a7488458dfd8410bd64a59c33e31a097fbba63) |
| Author | Kn0w-1 |
| Date | 2026-01-03T01:37:17Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Load referrer fields when fetching persona data

- Add referrerIdentifier, referrerId, referralLockedAt to persona fetch
- Ensures saved referrer persists when modal reopens
- Maps snake_case DB fields to camelCase form state

Fixes issue where referrer would disappear after saving and reopening modal.
```

## Files Changed

_File details not available in backfill — see commit link above._
