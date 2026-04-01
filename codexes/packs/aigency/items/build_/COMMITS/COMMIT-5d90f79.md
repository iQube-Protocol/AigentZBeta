# Commit Brief: `5d90f79` — fix: Use correct AcquisitionMethod values for paid entitlement check

| Field | Value |
|-------|-------|
| SHA | [`5d90f79`](https://github.com/iQube-Protocol/AigentZBeta/commit/5d90f790bbcc97766b1c2c0342896bcac4e278a9) |
| Author | Kn0w-1 |
| Date | 2025-12-07T01:40:17Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Use correct AcquisitionMethod values for paid entitlement check

- AcquisitionMethod type only includes: purchase, subscription, questReward, airdrop, admin
- 'free' is not a valid value in AcquisitionMethod enum
- Check for 'purchase' or 'subscription' to identify paid entitlements

Fixes TypeScript compilation error:
This comparison appears to be unintentional because the types 'AcquisitionMethod' and '"free"' have no overlap at line 240
```

## Files Changed

_File details not available in backfill — see commit link above._
