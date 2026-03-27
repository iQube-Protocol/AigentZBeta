# Commit Brief: `a632c55` — fix runtime preview video rendering and discord embed image fallback

| Field | Value |
|-------|-------|
| SHA | [`a632c55`](https://github.com/iQube-Protocol/AigentZBeta/commit/a632c55e6cff73f4ebc028dad2c14a8c1f4f3521) |
| Author | Claude |
| Date | 2026-03-22T02:25:18Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix runtime preview video rendering and discord embed image fallback

1. isLikelyVideoUri: recognize /api/skills/video/ proxy URLs so the
   Runtime Preview renders a <video> tag for videos stored with proxy
   URLs (previously fell through to the image/placeholder path)

2. selectPreviewCandidate: for Discord variants, skip returning the
   video artifact as the preview (Discord silently drops video/mp4 in
   embed images).  Instead prefer landscape/portrait images, then fall
   back to null so the caller uses context media (codex hero image).
   Also added portrait image fallback for all variants.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
