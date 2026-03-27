# Commit Brief: `45af805` — fix video regression: persist generation_id in asset id and add proxy timeout

| Field | Value |
|-------|-------|
| SHA | [`45af805`](https://github.com/iQube-Protocol/AigentZBeta/commit/45af805d28f9b9e4612b6d6d241005bb0d656b97) |
| Author | Claude |
| Date | 2026-03-22T01:49:39Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix video regression: persist generation_id in asset id and add proxy timeout

After the status endpoint was changed to return a proxy URL on completion,
reloading the experience page left SkillVideoPlayer in idle state because:
1. isLegacyVideoProxyUrl filtered the stored proxy URL → no initial_video_url
2. The asset was saved with id "${exp}:video" (no generation_id), so the
   packet route could not extract a generation_id to resume polling

Fix: include result.generation_id in the persisted asset id so the packet
route extracts it and passes it as initial_generation_id, triggering the
resume-poll path that immediately resolves the proxy URL on page load.

Also add a 30 s AbortController timeout to the proxy endpoint to prevent
the OpenAI content fetch from hanging indefinitely.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
