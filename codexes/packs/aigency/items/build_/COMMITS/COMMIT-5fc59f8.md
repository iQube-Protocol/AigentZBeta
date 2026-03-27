# Commit Brief: `5fc59f8` — Fix banner regression, remove video badges, revert carousel order

| Field | Value |
|-------|-------|
| SHA | [`5fc59f8`](https://github.com/iQube-Protocol/AigentZBeta/commit/5fc59f8ae1ac6cc22d7743032139a36f0a3e79f1) |
| Author | Claude |
| Date | 2026-03-23T01:55:19Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix banner regression, remove video badges, revert carousel order

- Fix banner not clearing: batch effect was adding genId to
  completedVideoGenerationIds without calling setConfirmedCompleteGenerationId,
  causing the polling effect to exit early before setting it; now both the
  batch effect and polling effect call setConfirmedCompleteGenerationId on ready

- Remove Video generating/Video ready badges from experience qube cards in
  the configurator; the runtime preview banner (which was already working)
  is the sole indicator of generation status

- Revert carousel message ordering: put carousel last again (as originally)
  so the thumbnail strip stays at the bottom of the preview panel; the
  previous embed-mode-first ordering moved thumbnails to top which was wrong

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
