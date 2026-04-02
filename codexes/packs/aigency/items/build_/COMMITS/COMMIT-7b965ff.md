# Commit Brief: `7b965ff` — fix: Use AgentKeyService for agent transfers instead of SIGNER_PRIVATE_KEY

| Field | Value |
|-------|-------|
| SHA | [`7b965ff`](https://github.com/iQube-Protocol/AigentZBeta/commit/7b965ffe3f425b7ac9692d66f672116cded5e27e) |
| Author | Know1 |
| Date | 2025-10-15T23:36:36Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Use AgentKeyService for agent transfers instead of SIGNER_PRIVATE_KEY

- Updated /api/a2a/signer/transfer to retrieve agent keys from Supabase
- Updated /api/a2a/signer/address to support agentId query param
- AgentWalletDrawer now passes agentId in transfer requests
- Each agent now uses their own private key from encrypted storage
- Fixes 'SIGNER_PRIVATE_KEY not set' error in production
```

## Files Changed

_File details not available in backfill — see commit link above._
