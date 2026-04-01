# Commit Brief: `eb87e0e` — strip large metadata from experience list response to fix 413

| Field | Value |
|-------|-------|
| SHA | [`eb87e0e`](https://github.com/iQube-Protocol/AigentZBeta/commit/eb87e0e6a9f3add69dc72a793bee28bd2a9d83cb) |
| Author | Claude |
| Date | 2026-03-25T20:37:37Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
strip large metadata from experience list response to fix 413

meta_qube stores a spread of all metadata fields including large ai-generated
artifact content. the list endpoint now returns only the four typed metadata
fields (category, tags, version, created_at, updated_at) so the lambda
response stays well under the 6mb limit

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
