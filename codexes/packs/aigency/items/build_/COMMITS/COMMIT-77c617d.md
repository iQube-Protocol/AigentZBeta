# Commit Brief: `77c617d` — fix: add support for fetching single persona by ID

| Field | Value |
|-------|-------|
| SHA | [`77c617d`](https://github.com/iQube-Protocol/AigentZBeta/commit/77c617de198c00841bf8be2d30a10e73e132a4b3) |
| Author | Know1 |
| Date | 2025-10-18T01:53:47Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: add support for fetching single persona by ID

- Add id query parameter support to persona GET endpoint
- Return single persona object when id provided
- Return all personas when no id provided
- Use .single() for single persona queries
- Fixes FIO card not finding persona data

This resolves: FIOInfoCard getting array instead of single persona
```

## Files Changed

_File details not available in backfill — see commit link above._
