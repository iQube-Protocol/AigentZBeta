# Commit Brief: `07c6010` — fix experiences tab: check local fallbacks on empty Supabase result, fix cache race on handleComplete

| Field | Value |
|-------|-------|
| SHA | [`07c6010`](https://github.com/iQube-Protocol/AigentZBeta/commit/07c601041e572bed7ad37779683ab8c2f58cf5d3) |
| Author | Claude |
| Date | 2026-03-25T03:57:03Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix experiences tab: check local fallbacks on empty Supabase result, fix cache race on handleComplete

- composerPersistence: when Supabase returns 0 rows (write silently fell back to
  local JSON DB due to missing service role key or RLS), check listExperiencesLocal
  and in-memory store before returning empty — previously the fallback only fired
  on Supabase error, never on a successful-but-empty response

- ComposerStudio: move cacheExperiencesForTenant inside the if(active) guard in
  fetchExperiences — a cancelled effect run was overwriting the module-level cache
  with stale Supabase data after refreshExperienceFromServer (called inside
  handleComplete for image/video auto-gen) had set a fresh single-item cache

- ComposerStudio: remove experience?.id from fetchExperiences dep array — the dep
  caused the effect to re-run on every setExperience call, serving the single-item
  poisoned cache and hiding all previously loaded experiences; handleComplete already
  manages the list directly via setExperiences so the dep was redundant

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
