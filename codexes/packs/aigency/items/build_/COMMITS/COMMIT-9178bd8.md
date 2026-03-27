# Commit Brief: `9178bd8` — fix video preview pipeline: move polling useEffect after declaration

| Field | Value |
|-------|-------|
| SHA | [`9178bd8`](https://github.com/iQube-Protocol/AigentZBeta/commit/9178bd89972a8e56615db8be620ec32ec51e5312) |
| Author | Claude |
| Date | 2026-03-22T16:57:46Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix video preview pipeline: move polling useEffect after declaration

The polling useEffect that watches for Sora video completion was placed
before refreshExperienceFromServer was declared, causing a TypeScript
build error. Moved it to after the useCallback declaration.

All other video pipeline fixes remain in place:
- canInlineVideoUri() gates proxy URLs out of the iframe experienceVideo param
- Status polling auto-refreshes experience and reloads preview on completion
- Launcher link and video state chips on experience cards

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
