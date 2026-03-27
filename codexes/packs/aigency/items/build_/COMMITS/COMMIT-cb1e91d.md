# Commit Brief: `cb1e91d` — fix: Resolve referral validation and invite button issues

| Field | Value |
|-------|-------|
| SHA | [`cb1e91d`](https://github.com/iQube-Protocol/AigentZBeta/commit/cb1e91d9e013b15411c339e6fec06c484485e8ef) |
| Author | Kn0w-1 |
| Date | 2026-01-02T15:03:23Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Resolve referral validation and invite button issues

- Add format normalization to handle both user@knyt and @knyt:user formats
- Create socialSharing utility for invite friends functionality
- Update SmartWalletDrawer to use new social sharing utility
- Fix referrer validation to properly query existing personas

Fixes:
1. Referrer validation now accepts arkagent@knyt format
2. Invite friends button now opens social sharing dialog
3. Wizard can progress past step 2 with proper referrer validation
```

## Files Changed

_File details not available in backfill — see commit link above._
