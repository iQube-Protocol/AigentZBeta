# Commit Brief: `ca17690` — fix system segment member lookup: query personas by order_tier/reputation_tier

| Field | Value |
|-------|-------|
| SHA | [`ca17690`](https://github.com/iQube-Protocol/AigentZBeta/commit/ca17690a6887d7a4d6992b916385141a152de39f) |
| Author | Claude |
| Date | 2026-03-24T12:42:15Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix system segment member lookup: query personas by order_tier/reputation_tier

System segments (order-*, rep-*) use synthetic IDs and live members come from
personas.order_tier / personas.reputation_tier, not crm_segment_members.
Custom segments continue to use crm_segment_members as before.

https://claude.ai/code/session_017i9fiEGA3zMjxFonVYZCQT
```

## Files Changed

_File details not available in backfill — see commit link above._
