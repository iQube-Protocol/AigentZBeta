# Commit Brief: `c5c76eb` — fix(agents): Resolve agent transfer insufficient balance issue

| Field | Value |
|-------|-------|
| SHA | [`c5c76eb`](https://github.com/iQube-Protocol/AigentZBeta/commit/c5c76eb34ead46e9fab41ed86b5500a80254bf17) |
| Author | Know1 |
| Date | 2025-10-16T12:36:50Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix(agents): Resolve agent transfer insufficient balance issue

- Fixed wrong private keys stored in Supabase causing transfers to fail
- Added scripts for key verification and re-encryption
- Updated aigent-z with correct private key that generates expected address
- All agent transfers now work correctly with proper wallet funding
- Resolves issue where dummy fallback key was used instead of real agent keys

Scripts added:
- scripts/direct-update-aigent-z.ts - Direct Supabase key update
- scripts/fix-aigent-z-key.ts - Key verification and update
- scripts/re-encrypt-keys.ts - Bulk key re-encryption utility

Fixes: Agent transfers failing with 'execution reverted' despite funded wallets
```

## Files Changed

_File details not available in backfill — see commit link above._
