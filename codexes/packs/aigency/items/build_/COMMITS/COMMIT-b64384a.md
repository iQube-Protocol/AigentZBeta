# Commit Brief: `b64384a` — fix discord embed chip: exclude video proxy URLs from thumbnail

| Field | Value |
|-------|-------|
| SHA | [`b64384a`](https://github.com/iQube-Protocol/AigentZBeta/commit/b64384addcaa382f80c58792560041898492e0fe) |
| Author | Claude |
| Date | 2026-03-22T01:16:08Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix discord embed chip: exclude video proxy URLs from thumbnail

/api/skills/video/… proxy endpoints return video/mp4, not an image.
Discord silently drops video-content URLs in embed image fields, leaving
the chip blank. Resolve the thumbnail to an empty string when the URL
path matches the video proxy pattern so the embed is posted without a
broken image slot.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
