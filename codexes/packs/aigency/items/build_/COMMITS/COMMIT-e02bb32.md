# Commit Brief: `e02bb32` — fix: Firefox Phantom wallet + ICP status badge

| Field | Value |
|-------|-------|
| SHA | [`e02bb32`](https://github.com/iQube-Protocol/AigentZBeta/commit/e02bb325bf346647c07a92302af56f9209aff6f6) |
| Author | Know1 |
| Date | 2025-10-10T03:09:43Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Firefox Phantom wallet + ICP status badge

Firefox Phantom Wallet Fix:
- Added retry logic with 100ms delay for Firefox timing issues
- Double-check wallet detection before throwing error
- Firefox sometimes needs extra time for wallet injection

ICP Status Badge Fix:
- Added proper timeouts (5s primary, 3s fallback)
- Fallback to local dev assumption if both fail
- More robust error handling for network issues
- Should now show green status in local development

Both fixes target browser-specific quirks and network reliability.
```

## Files Changed

_File details not available in backfill — see commit link above._
