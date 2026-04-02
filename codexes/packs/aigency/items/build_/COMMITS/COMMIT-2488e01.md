# Commit Brief: `2488e01` — PRODUCTION-SAFE: Force ic0.app gateway for mainnet to fix Cross-Chain EVM canister queries (#23)

| Field | Value |
|-------|-------|
| SHA | [`2488e01`](https://github.com/iQube-Protocol/AigentZBeta/commit/2488e019ec6dd374f24f96cb947bd4c781d4e7b6) |
| Author | Kn0w1 |
| Date | 2025-10-06T17:28:37Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
PRODUCTION-SAFE: Force ic0.app gateway for mainnet to fix Cross-Chain EVM canister queries (#23)

- Hardcodes https://ic0.app for DFX_NETWORK=ic to bypass ICP_HOST env issues
- Ensures query signatures are available for EVM RPC canister calls
- Fixes production Cross-Chain Status showing 0 EVM chains instead of 5
- No changes to DVN, sync, or other functionality - gateway fix only
```

## Files Changed

_File details not available in backfill — see commit link above._
