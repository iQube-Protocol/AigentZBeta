# Commit Brief: `f0496f2` — resume sora polling in bundle flow via initial_generation_id

| Field | Value |
|-------|-------|
| SHA | [`f0496f2`](https://github.com/iQube-Protocol/AigentZBeta/commit/f0496f2924f8ad5cde7f57359ba9bf31b2161f95) |
| Author | Claude |
| Date | 2026-03-22T01:16:03Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
resume sora polling in bundle flow via initial_generation_id

When the bundle auto-generates a video, the invoke returns a generation_id
before Sora finishes. The proxy URL saved to the asset is filtered by
isLegacyVideoProxyUrl in SkillVideoPlayer, leaving it in idle state and
requiring a manual re-invoke.

Fix: add initial_generation_id / initial_venice_model props to
SkillVideoPlayer. When set (and no resolved initial video URL), the player
starts in "done + live + no video_url" state which triggers the existing
auto-poll loop immediately — exactly as it does after a live invoke that
returns job_accepted.

Packet route extracts generation_id from the persisted asset id (format
"${experienceId}:video:${generationId}") and the venice_model from the
Venice proxy URL query string. ExperienceLiquidRenderer passes both props
through to SkillVideoPlayer.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
