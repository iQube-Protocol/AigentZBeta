# Commit Brief: `f8bc5a7` — fix experiences tab: prevent cache poisoning in refreshExperienceFromServer

| Field | Value |
|-------|-------|
| SHA | [`f8bc5a7`](https://github.com/iQube-Protocol/AigentZBeta/commit/f8bc5a79bc5b0f197c58bf12044455df567cab54) |
| Author | Claude |
| Date | 2026-03-25T15:45:22Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix experiences tab: prevent cache poisoning in refreshExperienceFromServer

When handleComplete calls refreshExperienceFromServer (for image/video
auto-generation) before the initial fetchExperiences has resolved,
experiences state is still empty (prev = []). The previous fix moved
cacheExperiencesForTenant inside if(active) in fetchExperiences, but
refreshExperienceFromServer has its own unconditional cacheExperiencesForTenant
call that was still stamping the module-level cache with [singleExp].

On component remount (e.g. navigating to the launcher and back), the
fresh single-item cache was served, hiding all previously generated
experiences. Fix: skip the cache write in refreshExperienceFromServer
when prev is empty — the in-flight fetchExperiences will populate the
cache correctly when it resolves.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
