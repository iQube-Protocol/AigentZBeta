# Commit Brief: `370e1a0` — fix: Address inference truncation and episode covers in single shot

| Field | Value |
|-------|-------|
| SHA | [`370e1a0`](https://github.com/iQube-Protocol/AigentZBeta/commit/370e1a05f7a867c79012c6941d63f6d70cc4368e) |
| Author | Kn0w-1 |
| Date | 2025-12-28T17:41:20Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Address inference truncation and episode covers in single shot

- Increase max_tokens from 4000 to 8000 to prevent copilot truncation
- Fix episode covers by adding fallback to print assets when cover_image missing
- This ensures episodes always have a coverCid for wallet library rendering
```

## Files Changed

_File details not available in backfill — see commit link above._
