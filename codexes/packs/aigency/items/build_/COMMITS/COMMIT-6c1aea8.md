# Commit Brief: `6c1aea8` — read image prompts from bundle source experience, collapse to single generate call

| Field | Value |
|-------|-------|
| SHA | [`6c1aea8`](https://github.com/iQube-Protocol/AigentZBeta/commit/6c1aea886394c8e3fd52feb0c8545bb21b47ee57) |
| Author | Claude |
| Date | 2026-03-20T05:06:31Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
read image prompts from bundle source experience, collapse to single generate call

When editingExperienceId is set, prompts live on the editing experience
(bundleCheckSource), not on completedExperience. Reading from the wrong
source caused null prompts and image generation to silently skip, leaving
only the fallback image.

Also collapse the sequential portrait/landscape fetch loop into a single
/api/skills/image/generate call so both orientations generate in parallel
in one request.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
