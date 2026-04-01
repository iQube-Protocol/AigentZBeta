# Commit Brief: `cdb8298` — Debug/cross chain logging (#30)

| Field | Value |
|-------|-------|
| SHA | [`cdb8298`](https://github.com/iQube-Protocol/AigentZBeta/commit/cdb8298697a9d3ec1c7b4bd2e40ea712420e6b11) |
| Author | Kn0w1 |
| Date | 2025-10-06T23:06:48Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Debug/cross chain logging (#30)

* CRITICAL: Force ic0.app for mainnet by completely ignoring ICP_HOST env vars

Production was still using NEXT_PUBLIC_ICP_HOST=https://icp-api.io which overrode
our hardcoded ic0.app logic. This fix completely ignores all ICP_HOST environment
variables and forces https://ic0.app directly for mainnet.

Changes:
- Remove explicitHost logic that read env vars
- Force ic0.app directly when isMainnet=true
- Update debug endpoint to show FORCED_OVERRIDE
- This should finally resolve EVM canister query signature issues

* TEST: Use anonymous EVM canister calls to test access control

- Replace getActor with getAnonymousActor for EVM RPC calls
- This bypasses identity/PEM issues to test if access control is the problem
- If this works in production, we know the issue is authentication
- Temporary test branch - will revert after confirming

* CRITICAL: Add Node.js runtime to all chain endpoints to fix production

- Added 'export const runtime = nodejs' to all EVM and non-EVM chain endpoints
- Edge Runtime was blocking external HTTP requests to RPC providers in production
- This caused all live chain checks to fail, forcing reliance on EVM canister fallback
- Node.js runtime allows external HTTP requests needed for RPC calls

Fixed endpoints:
- /api/ops/ethereum/sepolia
- /api/ops/polygon/amoy
- /api/ops/optimism/sepolia
- /api/ops/arbitrum/sepolia
- /api/ops/base/sepolia
- /api/ops/btc/status
- /api/ops/solana/testnet

Expected result: Production should now show 5-7 supported chains

* DEBUG: Add detailed logging to Cross-Chain API

- Log live check results to see what's actually being returned
- Log EVM canister fallback execution and results
- This will help identify exactly where the logic is failing in production

* FIX: Use official DFINITY EVM RPC canister on mainnet

- Changed from non-existent uzt4z-lp777-77774-qaabq-cai to official 7hfb6-caaaa-aaaar-qadga-cai
- Verified official canister exists and is active on IC mainnet
- Updated canister_ids.json and .env.local
- This should finally resolve production EVM chain detection
```

## Files Changed

_File details not available in backfill — see commit link above._
