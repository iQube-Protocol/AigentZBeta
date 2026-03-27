# Commit Brief: `3b1fe66` — Fix video experience pipeline: polling, no-proxy-iframe, launcher link, chip states

| Field | Value |
|-------|-------|
| SHA | [`3b1fe66`](https://github.com/iQube-Protocol/AigentZBeta/commit/3b1fe665c95b1bcd15db66790373f48c340179ab) |
| Author | Claude |
| Date | 2026-03-22T16:41:44Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix video experience pipeline: polling, no-proxy-iframe, launcher link, chip states

- Gate experienceVideo iframe param on canInlineVideoUri() — prevents 'No video
  with supported format and MIME type found' error while Sora video is generating
- Add status-polling useEffect: while preview videoAssetUrl is a proxy URL, polls
  /api/skills/video/{id}/status every 15s; on ready, refreshes experience and bumps
  previewNonce so the iframe auto-reloads with real Supabase URL + thumbnail
- Make 'launcher' text in the generating banner a clickable <a> link to the
  /studio/composer/experience/{id} launcher page
- Add video state chip to experience cards: spinning 'Video generating' badge when
  proxy URL detected in generated_assets; 'Video ready' badge when Supabase URL present
  Aligns experience capsule surface with DIS portrait-poster and video-ready states

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
