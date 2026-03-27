# Commit Brief: `6ba7300` — 🔧 BUILD: Fix Node.js version and dependency compatibility

| Field | Value |
|-------|-------|
| SHA | [`6ba7300`](https://github.com/iQube-Protocol/AigentZBeta/commit/6ba7300fcc53850a408ccc7c5c461dd7d7e94d6e) |
| Author | Know1 |
| Date | 2025-10-12T10:18:54Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
🔧 BUILD: Fix Node.js version and dependency compatibility

- Added .nvmrc specifying Node.js 20.18.0 for build environment
- Updated amplify.yml to use Node.js 20.18.0 via nvm
- Downgraded Solana dependencies to compatible versions:
  - @solana/spl-token: 0.4.14 → 0.3.11
  - @solana/web3.js: 1.98.4 → 1.95.0
- Regenerated package-lock.json with compatible dependency tree

This resolves the build failure caused by Node.js version requirements
and ensures compatibility with AWS Amplify build environment.
```

## Files Changed

_File details not available in backfill — see commit link above._
