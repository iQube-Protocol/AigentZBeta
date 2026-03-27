# Commit Brief: `ec64edc` — Fix video Runtime Preview broken state and improve thumbnail extraction

| Field | Value |
|-------|-------|
| SHA | [`ec64edc`](https://github.com/iQube-Protocol/AigentZBeta/commit/ec64edcb09d838fb0f42ebd901aa57f671b7575c) |
| Author | Claude |
| Date | 2026-03-22T06:14:46Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix video Runtime Preview broken state and improve thumbnail extraction

Runtime Preview:
- Filter proxy video URLs from experienceVideo iframe param; the iframe now
  loads the full experience packet so SkillVideoPlayer handles polling instead
  of the browser encountering a broken <video src=/api/skills/video/...>.
- Show a "Video generating" spinner banner above the preview while the video
  asset URL is still a proxy URL.

Sora thumbnail:
- Handle HTTP 416 (Range Not Satisfiable): if OpenAI ignores or rejects the
  Range header, retry the content fetch without it to get the full body.
- Increase thumb abort timeout to 25 s and clear it before awaiting the body.
```

## Files Changed

_File details not available in backfill — see commit link above._
