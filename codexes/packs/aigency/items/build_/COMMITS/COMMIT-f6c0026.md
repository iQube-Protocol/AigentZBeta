# Commit Brief: `f6c0026` — Fix video auto-generation: detect sora session by template_id

| Field | Value |
|-------|-------|
| SHA | [`f6c0026`](https://github.com/iQube-Protocol/AigentZBeta/commit/f6c00269b4db36d4d4c2e959230649b2f2d5f243) |
| Author | Claude |
| Date | 2026-03-22T04:41:15Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix video auto-generation: detect sora session by template_id

isVideoBundle detection relied entirely on bundle metadata propagating
through the editing experience and session data. When the experiences
array doesn't have the composition_bundle metadata (e.g. stale state
or new session without editingExperienceId), isVideoBundle = false,
causing shouldAutoGenerateImages to run instead of video.

Add direct template check: if session.template_id === "sora-video-generation"
treat it as a video session. This is canonical – the bundle flow always
opens this exact template for video_article_bundle. Also add sessionTemplateId
to the [AutoGen] diagnostic log for traceability.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
