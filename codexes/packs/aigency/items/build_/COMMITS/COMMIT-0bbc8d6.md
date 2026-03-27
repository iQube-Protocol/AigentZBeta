# Commit Brief: `0bbc8d6` — fix: Use Supabase wallet_transactions for DVN events instead of canister

| Field | Value |
|-------|-------|
| SHA | [`0bbc8d6`](https://github.com/iQube-Protocol/AigentZBeta/commit/0bbc8d68ca835a73962b60facae1f5d2a96c87c7) |
| Author | Kn0w-1 |
| Date | 2026-01-03T02:22:53Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Use Supabase wallet_transactions for DVN events instead of canister

- Replace missing @dfinity/agent and DID file imports
- Query wallet_transactions table for persona transaction history
- Map transactions to event format with amount, type, status
- Fixes build error: Module not found cross_chain_service.did
- Graceful fallback to empty array on errors
```

## Files Changed

_File details not available in backfill — see commit link above._
