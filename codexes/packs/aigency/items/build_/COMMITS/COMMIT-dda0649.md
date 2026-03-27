# Commit Brief: `dda0649` — Feat/qct send functionality (#50)

| Field | Value |
|-------|-------|
| SHA | [`dda0649`](https://github.com/iQube-Protocol/AigentZBeta/commit/dda0649a5547148f510bf1fcbb84f24acf251d7d) |
| Author | Kn0w1 |
| Date | 2025-10-10T03:28:16Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Feat/qct send functionality (#50)

* fix: UI improvements for QCT Trading Card

- Made wallet badges/connect button full width for symmetry
- Fixed mint/burn buttons to work with ALL wallet types (EVM/Solana/BTC)
- Added helpful tooltips for disabled states

* fix: Firefox Phantom wallet + ICP status badge

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

* fix: Replace AbortSignal.timeout with AbortController for Node.js compatibility

- AbortSignal.timeout() not available in older Node.js versions
- Replaced with AbortController + setTimeout pattern
- Fixes dev server crash on ICP health check
- Maintains same timeout functionality (5s primary, 3s fallback)
```

## Files Changed

_File details not available in backfill — see commit link above._
