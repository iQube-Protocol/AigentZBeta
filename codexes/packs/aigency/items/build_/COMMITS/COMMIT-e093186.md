# Commit Brief: `e093186` — CRITICAL: Force ic0.app for mainnet by completely ignoring ICP_HOST env vars (#26)

| Field | Value |
|-------|-------|
| SHA | [`e093186`](https://github.com/iQube-Protocol/AigentZBeta/commit/e093186ea3e9c6e5dd1738d7fe5bb1493d3b31c7) |
| Author | Kn0w1 |
| Date | 2025-10-06T18:39:28Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
CRITICAL: Force ic0.app for mainnet by completely ignoring ICP_HOST env vars (#26)

Production was still using NEXT_PUBLIC_ICP_HOST=https://icp-api.io which overrode
our hardcoded ic0.app logic. This fix completely ignores all ICP_HOST environment
variables and forces https://ic0.app directly for mainnet.

Changes:
- Remove explicitHost logic that read env vars
- Force ic0.app directly when isMainnet=true
- Update debug endpoint to show FORCED_OVERRIDE
- This should finally resolve EVM canister query signature issues
```

## Files Changed

_File details not available in backfill — see commit link above._
