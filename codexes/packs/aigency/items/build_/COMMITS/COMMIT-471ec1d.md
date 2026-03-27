# Commit Brief: `471ec1d` — fix build error: remove metadata access on RuntimeCapsule type

| Field | Value |
|-------|-------|
| SHA | [`471ec1d`](https://github.com/iQube-Protocol/AigentZBeta/commit/471ec1d38f2317d5f9cb23feb33f9df5e6c6edb3) |
| Author | Claude |
| Date | 2026-03-20T17:41:53Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix build error: remove metadata access on RuntimeCapsule type

RuntimeCapsule does not carry metadata; drop the hasGeneratedImages
check and rely solely on block_statuses.image_generation !== accepted
as the done signal for the Generate Images fallback button

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
