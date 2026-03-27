# Commit Brief: `b007ecc` — fix: use valid SlotDataSource type for curated list sourceType

| Field | Value |
|-------|-------|
| SHA | [`b007ecc`](https://github.com/iQube-Protocol/AigentZBeta/commit/b007ecc753806b630552b3df285d555252d0134f) |
| Author | Kn0w-1 |
| Date | 2025-12-06T20:12:57Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: use valid SlotDataSource type for curated list sourceType

- Change sourceType from 'curatedList' to 'library' in resolveCuratedList
- 'library' is a valid SlotDataSource['type'] union member
- Keeps semantics (curated list from library) while satisfying type system

Fixes TypeScript compilation error:
Type 'curatedList' is not assignable to SlotDataSource['type'] at line 279
```

## Files Changed

_File details not available in backfill — see commit link above._
