# Commit Brief: `0b7998c` — 🔒 SECURITY: Move Solana addresses to environment variables

| Field | Value |
|-------|-------|
| SHA | [`0b7998c`](https://github.com/iQube-Protocol/AigentZBeta/commit/0b7998cb2e436cdc25c8b48b5b702b99ac585ee1) |
| Author | Know1 |
| Date | 2025-10-12T10:02:58Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
🔒 SECURITY: Move Solana addresses to environment variables

- Moved Solana public addresses to environment variables to satisfy GitGuardian
- Added NEXT_PUBLIC_* prefixes for client-side access
- Updated env.example with Solana address configuration
- Added clear documentation that these are PUBLIC addresses, not secrets
- Provides fallback values for backward compatibility

This resolves the remaining GitGuardian security alert in config/qct-contracts.ts
```

## Files Changed

_File details not available in backfill — see commit link above._
