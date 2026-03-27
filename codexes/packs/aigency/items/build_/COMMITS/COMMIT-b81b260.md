# Commit Brief: `b81b260` — fix video polling: cap at 40 attempts, stop on ready, auto-reload preview

| Field | Value |
|-------|-------|
| SHA | [`b81b260`](https://github.com/iQube-Protocol/AigentZBeta/commit/b81b260de5617c1f36e1a821522a707f34e1ce02) |
| Author | Claude |
| Date | 2026-03-22T17:41:21Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix video polling: cap at 40 attempts, stop on ready, auto-reload preview

Three targeted fixes:

1. Polling loop now stops immediately on first ready=true detection
   (set cancelled=true + clearInterval inside poll) and has a hard
   cutoff of 40 attempts × 15 s ≈ 10 minutes.

2. Both handlePersonaMediaUpdated and handlePersonaMediaMessage now
   bump previewNonce after refreshExperienceFromServer succeeds, so
   the iframe auto-reloads with the Supabase URL + portrait thumbnail
   without requiring a manual Reload Preview click. Mirrors exactly
   how the Thin Client fetches a fresh packet on each load.

3. Added backlog note: Venice + other providers need different status
   URL routing; SkillVideoPlayer inside the iframe already abstracts
   this — ComposerStudio polling is OpenAI-only for now.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
