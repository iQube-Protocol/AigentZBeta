# Commit Brief: `90cf489` — Test/anonymous evm calls (#27)

| Field | Value |
|-------|-------|
| SHA | [`90cf489`](https://github.com/iQube-Protocol/AigentZBeta/commit/90cf489a745ea596d5aaf95384459ab022045851) |
| Author | Kn0w1 |
| Date | 2025-10-06T21:23:00Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Test/anonymous evm calls (#27)

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
```

## Files Changed

_File details not available in backfill — see commit link above._
