# Commit Brief: `0f62f3e` — feat: live Sora API integration — video generation via OpenAI Videos API

| Field | Value |
|-------|-------|
| SHA | [`0f62f3e`](https://github.com/iQube-Protocol/AigentZBeta/commit/0f62f3efc266dd2b6056c2cd5f686a3b88256643) |
| Author | Kn0w-1 |
| Date | 2026-03-07T22:51:01Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
feat: live Sora API integration — video generation via OpenAI Videos API

- POST /v1/videos (multipart/form-data) with polling for completion
- Video proxy endpoint GET /api/skills/video/[id] streams MP4 without exposing API key
- SkillVideoPlayer updated with live playback, timeout state, progress messaging
- Supported: sora-2 model, 4/8/12s durations, 1280x720 & 720x1280 sizes
- Graceful fallback to simulation mode if Sora access unavailable
```

## Files Changed

_File details not available in backfill — see commit link above._
