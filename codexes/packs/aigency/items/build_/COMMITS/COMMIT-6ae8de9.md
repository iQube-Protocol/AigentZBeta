# Commit Brief: `6ae8de9` — fix: Remove package-lock.json to force fresh install

| Field | Value |
|-------|-------|
| SHA | [`6ae8de9`](https://github.com/iQube-Protocol/AigentZBeta/commit/6ae8de9b02a34907ab88408e3e0db5dd657a5fa9) |
| Author | Kn0w-1 |
| Date | 2025-12-30T08:35:23Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Remove package-lock.json to force fresh install

- Delete lock file and node_modules before install
- Prevents npm ci from running with outdated lock file
- Forces npm install to generate fresh lock file for Linux environment
```

## Files Changed

_File details not available in backfill — see commit link above._
