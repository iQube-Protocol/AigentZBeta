# Commit Brief: `ce76a9e` — Add local recovery script for orphaned video segments

| Field | Value |
|-------|-------|
| SHA | [`ce76a9e`](https://github.com/iQube-Protocol/AigentZBeta/commit/ce76a9e3535e5ac445b1223a9c39a3d4112847bd) |
| Author | Claude |
| Date | 2026-07-05T19:41:32Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add local recovery script for orphaned video segments

Proportionate fix for the ffmpeg-unavailable stitch failure: one set
of clips needs recovering, which doesn't justify runtime ffmpeg
infrastructure in Lambda (static tracing already broke the build-size
cap and was reverted in eb7df701). Instead, a one-shot operator script
completes the stitch locally:

  node scripts/recover-stitch-segments.mjs --list
  node scripts/recover-stitch-segments.mjs --stitch <ref1> <ref2> ...

--list enumerates orphaned clips from storage (Sora videos directly,
Venice queueIds recovered from persisted thumbnails). --stitch takes
2-4 refs in play order, downloads them (Venice via /retrieve with
VENICE_API_KEY), concatenates with local ffmpeg (stream-copy first,
re-encode fallback — same strategy as the stitch route), uploads to
Supabase under the route's deterministic-id convention, and prints
the public URL. Env from .env.local, same loader as the ingest script.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Proportionate fix for the ffmpeg-unavailable stitch failure: one set
of clips needs recovering, which doesn't justify runtime ffmpeg
infrastructure in Lambda (static tracing already broke the build-size
cap and was reverted in eb7df701). Instead, a one-shot operator script
completes the stitch locally:

  node scripts/recover-stitch-segments.mjs --list
  node scripts/recover-stitch-segments.mjs --stitch <ref1> <ref2> ...

--list enumerates orphaned clips from storage (Sora videos directly,
Venice queueIds recovered from persisted thumbnails). --stitch takes
2-4 refs in play order, downloads them (Venice via /retrieve with
VENICE_API_KEY), concatenates with local ffmpeg (stream-copy first,
re-encode fallback — same strategy as the stitch route), uploads to
Supabase under the route's deterministic-id convention, and prints
the public URL. Env from .env.local, same loader as the ingest script.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Added | `scripts/recover-stitch-segments.mjs` |

## Stats

 1 file changed, 240 insertions(+)
