# Commit Brief: `401db88` — fix sora status endpoint hanging on completed video

| Field | Value |
|-------|-------|
| SHA | [`401db88`](https://github.com/iQube-Protocol/AigentZBeta/commit/401db885f99f912104417a4c20cca7a201e1bd64) |
| Author | Claude |
| Date | 2026-03-21T22:02:43Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix sora status endpoint hanging on completed video

When a Sora job is marked completed the status endpoint was downloading
the full video content (no timeout), loading it into an ArrayBuffer, and
uploading to Supabase — all inline in the poll response. On Lambda this
reliably exceeded the function timeout and left the client hung.

Return the proxy URL immediately on completion instead. The proxy at
/api/skills/video/[id] already streams the video from OpenAI on demand
so no inline download is needed. Remove the now-dead storage adapter,
Supabase client, and thumbnail imports from this route.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
