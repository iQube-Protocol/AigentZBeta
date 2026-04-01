# Commit Brief: `905de42` — 🔒 SECURITY: Remove hardcoded Bitcoin private key

| Field | Value |
|-------|-------|
| SHA | [`905de42`](https://github.com/iQube-Protocol/AigentZBeta/commit/905de427024a6a178a9e0ba1c12b0a54db8abf15) |
| Author | Know1 |
| Date | 2025-10-12T09:50:31Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
🔒 SECURITY: Remove hardcoded Bitcoin private key

- Moved Bitcoin private key to environment variable (BITCOIN_PRIVATE_KEY)
- Removed private key from QCT registry object
- Added validation to ensure environment variable is provided
- Created env.example file with required environment variables
- Fixes GitGuardian security alerts for hardcoded secrets

This resolves the security vulnerability detected in PR #53.
```

## Files Changed

_File details not available in backfill — see commit link above._
