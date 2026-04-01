# Commit Brief: `b41b276` — Fix/cross chain gateway only (#25)

| Field | Value |
|-------|-------|
| SHA | [`b41b276`](https://github.com/iQube-Protocol/AigentZBeta/commit/b41b2765c0ac269a292333e98c7b0ab29584afc5) |
| Author | Kn0w1 |
| Date | 2025-10-06T18:05:46Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix/cross chain gateway only (#25)

* PRODUCTION-SAFE: Force ic0.app gateway for mainnet to fix Cross-Chain EVM canister queries

- Hardcodes https://ic0.app for DFX_NETWORK=ic to bypass ICP_HOST env issues
- Ensures query signatures are available for EVM RPC canister calls
- Fixes production Cross-Chain Status showing 0 EVM chains instead of 5
- No changes to DVN, sync, or other functionality - gateway fix only

* Add gateway debug endpoint to verify ic0.app override is working
```

## Files Changed

_File details not available in backfill — see commit link above._
