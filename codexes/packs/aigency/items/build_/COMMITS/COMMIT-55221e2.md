# Commit Brief: `55221e2` — fix: Force Netlify to use npm install instead of ci

| Field | Value |
|-------|-------|
| SHA | [`55221e2`](https://github.com/iQube-Protocol/AigentZBeta/commit/55221e2e05a838da3f6ddd4ad29c28df74de97a5) |
| Author | Kn0w-1 |
| Date | 2025-12-30T08:28:51Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Force Netlify to use npm install instead of ci

- Add NETLIFY_USE_NPM=true to environment
- Prevents npm ci from failing due to platform-specific packages
- Ensures Linux build environment gets correct dependencies
```

## Files Changed

_File details not available in backfill — see commit link above._
