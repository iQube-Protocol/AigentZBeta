# Commit Brief: `35f92d0` — fix blockKinds missing from make_bundle on session completion

| Field | Value |
|-------|-------|
| SHA | [`35f92d0`](https://github.com/iQube-Protocol/AigentZBeta/commit/35f92d094f649a02a6c82c68e68e103a5fd63fbb) |
| Author | Claude |
| Date | 2026-03-20T16:19:59Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix blockKinds missing from make_bundle on session completion

editingExpForBundleCheck was computed after completedExperience was already
built, so make_bundle was written with block_statuses but no blockKinds.
Move the lookup before completedExperience construction and include blockKinds
from the applied bundle preset so the Generate Images button renders correctly.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
