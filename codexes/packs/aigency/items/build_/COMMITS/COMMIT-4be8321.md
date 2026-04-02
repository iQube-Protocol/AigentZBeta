# Commit Brief: `4be8321` — extract video thumbnail with ffmpeg at generation completion

| Field | Value |
|-------|-------|
| SHA | [`4be8321`](https://github.com/iQube-Protocol/AigentZBeta/commit/4be832142f4634cbd5ae3e58c6d542943dc7b6eb) |
| Author | Claude |
| Date | 2026-03-21T20:06:40Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
extract video thumbnail with ffmpeg at generation completion

- add app/api/skills/video/_thumbnail.ts — shared utility that spawns
  ffmpeg-static at -ss 00:00:01 -frames:v 1, persists the JPEG to
  Supabase storage, and returns the public URL; gracefully returns null
  if the binary is unavailable (dev/CI without the downloaded binary)
- OpenAI status route: extract thumbnail from the in-memory video buffer
  immediately after video persistence; include thumbnail_url in response
- Venice status route: extract thumbnail from binary stream (when Venice
  returns the video body directly) or via a 4 MB range request against
  the remote/proxy URL (when Venice returns JSON with a remoteVideoUrl)
- SkillVideoPlayer: add thumbnail_url to InvocationResult; capture it
  from checkStatus response; persist it alongside the video as a portrait
  image asset so it surfaces as coverImageUri and OG image automatically

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
