# Commit Brief: `f171df5` — fix: Add missing asset parameter to A2A Test Card transfer request

| Field | Value |
|-------|-------|
| SHA | [`f171df5`](https://github.com/iQube-Protocol/AigentZBeta/commit/f171df56bd4a768382595e0ce5a1513d968cf9ea) |
| Author | Know1 |
| Date | 2025-10-19T18:37:02Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Add missing asset parameter to A2A Test Card transfer request

CRITICAL FIX: A2A transactions were failing because the transfer request
was missing the 'asset' parameter required by the backend for:
1. DVN flow tracking
2. Proper transaction settlement
3. Event Register visibility

This was causing:
- Polygon: 404 errors from malformed RPC routing
- Ethereum: 'unsupported chainId' errors
- All A2A E2E flows to fail

The asset parameter (ETH_QCENT, POLY_QCENT, etc.) is required for
the backend to properly route transactions and trigger DVN flows.
```

## Files Changed

_File details not available in backfill — see commit link above._
