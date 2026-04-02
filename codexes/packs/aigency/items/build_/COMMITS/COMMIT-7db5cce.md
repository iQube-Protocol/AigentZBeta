# Commit Brief: `7db5cce` — debug: Add detailed FIO registration error logging

| Field | Value |
|-------|-------|
| SHA | [`7db5cce`](https://github.com/iQube-Protocol/AigentZBeta/commit/7db5cce2e737a72a7830f078617bba868f634cd9) |
| Author | Know1 |
| Date | 2025-10-22T21:33:45Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
debug: Add detailed FIO registration error logging

DEBUGGING:

Added comprehensive error logging for FIO registration failures:
- Full error message
- Stack trace
- JSON error details
- Error codes
- Field validation errors

This will help diagnose why:
- System wallet (25,000 FIO) not being charged
- Registration falling back to fallback_tx_*
- Actual blockchain transaction not happening

NEXT STEPS:
1. Create a new persona
2. Check server console logs for detailed error
3. Identify exact failure point
4. Fix registration issue

The issue is likely:
- SDK not properly initialized
- Owner public key parameter not working as expected
- FIO API rejecting the transaction
- Network/endpoint issue
```

## Files Changed

_File details not available in backfill — see commit link above._
