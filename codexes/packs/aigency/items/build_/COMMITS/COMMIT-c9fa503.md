# Commit Brief: `c9fa503` — fix: QCT Trading Card wallet connection and balance loading

| Field | Value |
|-------|-------|
| SHA | [`c9fa503`](https://github.com/iQube-Protocol/AigentZBeta/commit/c9fa503adaa4cef6bf271d6a805d5e67d1ef40d9) |
| Author | Know1 |
| Date | 2025-10-08T21:07:38Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: QCT Trading Card wallet connection and balance loading

Fixed 3 issues:

1. Balance API Error (Invalid action)
   - Skip balance loading when no wallet connected
   - Don't send empty address parameter
   - Only load balances when address exists

2. Bitcoin Wallet Connection
   - Remove immediate loadBalances() calls
   - Let useEffect handle balance loading on state change
   - Add console logging for Bitcoin connection debugging
   - Proper state update flow

3. Default to Disconnected State
   - useEffect now triggers on wallet state changes
   - Balances reload when wallets connect/disconnect
   - Clean state management

Changes:
- loadBalances() skips if no address (prevents API error)
- useEffect dependencies: [evmAddress, solanaAddress, bitcoinAddress]
- Removed redundant loadBalances() calls after connect
- Better error handling and user feedback

Result:
- No more 'Invalid action' errors on page load
- Bitcoin wallet connects properly
- Balances update automatically when wallets connect
- Clean disconnected state on refresh
```

## Files Changed

_File details not available in backfill — see commit link above._
