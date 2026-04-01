# Commit Brief: `db5d17d` — fix: Unisat sendBitcoin API - add options parameter

| Field | Value |
|-------|-------|
| SHA | [`db5d17d`](https://github.com/iQube-Protocol/AigentZBeta/commit/db5d17d15047733c9d1844bfaf6909187bbf0965) |
| Author | Know1 |
| Date | 2025-10-08T20:27:15Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Unisat sendBitcoin API - add options parameter

Issue: 'satoshis is required' error when calling sendBitcoin
Root Cause: Unisat API requires 3 parameters, not 2

Unisat API signature:
sendBitcoin(address: string, satoshis: number, options?: { feeRate?: number })

Fixed:
- Added options object as third parameter
- Set feeRate: 1 sat/vB (let wallet optimize)
- Proper parameter naming for Unisat API

This should resolve the 'Failed to send Bitcoin: satoshis is required' error.
```

## Files Changed

_File details not available in backfill — see commit link above._
