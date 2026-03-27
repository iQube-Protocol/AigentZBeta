# Commit Brief: `bfac4ae` — fix: FIO SDK getFee - use default fee instead of EndPoint enum

| Field | Value |
|-------|-------|
| SHA | [`bfac4ae`](https://github.com/iQube-Protocol/AigentZBeta/commit/bfac4ae6283d30f67a0d74e4f67fc9e7d8999929) |
| Author | Know1 |
| Date | 2025-10-17T22:22:45Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: FIO SDK getFee - use default fee instead of EndPoint enum

- FIO SDK's EndPoint enum not properly exposed in TypeScript
- Simplified to return default 40 FIO registration fee
- Avoids TypeScript compilation error with enum types
- Resolves Amplify build failure
```

## Files Changed

_File details not available in backfill — see commit link above._
