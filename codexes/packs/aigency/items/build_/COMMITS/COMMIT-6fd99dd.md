# Commit Brief: `6fd99dd` — fix: Revert check-eth-balance API to use AgentKeyService

| Field | Value |
|-------|-------|
| SHA | [`6fd99dd`](https://github.com/iQube-Protocol/AigentZBeta/commit/6fd99ddaa61e8ef726dfd3cf59ae08d853956624) |
| Author | Know1 |
| Date | 2025-10-19T05:21:28Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Revert check-eth-balance API to use AgentKeyService

Maintain consistent SDK architecture across all agent key operations:
- Remove direct Supabase client usage
- Remove manual decryption logic
- Use AgentKeyService for proper QubeBase SDK integration

This should resolve the remaining balance checking issues and
complete the architectural alignment with the intended design.
```

## Files Changed

_File details not available in backfill — see commit link above._
