# Commit Brief: `835dd25` — fix: Add content table fallback and DVN events from ICP canister

| Field | Value |
|-------|-------|
| SHA | [`835dd25`](https://github.com/iQube-Protocol/AigentZBeta/commit/835dd25520d98eef549b9e62db685ceab53eb238) |
| Author | Kn0w-1 |
| Date | 2026-01-03T02:03:37Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Add content table fallback and DVN events from ICP canister

Content Service:
- Add fallback to 'content' table when article not in 'smart_content_qubes'
- Fixes 404 for articles that exist in legacy content table
- Maintains backward compatibility with both table structures

DVN Events:
- Implement actual DVN event fetching from ICP canister sp5ye-2qaaa-aaaao-qkqla-cai
- Use @dfinity/agent to query canister for persona messages
- Map canister messages to event format for frontend
- Graceful fallback to empty array on errors

Fixes:
- Article deep links now work for all content
- DVN transaction history displays for KNYT purchases
```

## Files Changed

_File details not available in backfill — see commit link above._
