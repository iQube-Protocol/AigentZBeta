# Commit Brief: `eb7df70` — Revert ffmpeg-static bundle tracing — broke Amplify build size cap

| Field | Value |
|-------|-------|
| SHA | [`eb7df70`](https://github.com/iQube-Protocol/AigentZBeta/commit/eb7df70111822300afa079833afa2bad449252bd) |
| Author | Claude |
| Date | 2026-07-05T19:34:04Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Revert ffmpeg-static bundle tracing — broke Amplify build size cap

The previous commit (495307d1) traced ffmpeg-static's pre-compiled
binary (~70-80MB) into three routes to fix "ffmpeg binary unavailable"
on the stitch route. That pushed the Amplify build output to
299582522 bytes, over the platform's 230686720-byte (220 MiB) hard
cap, and broke every deploy off this branch.

Reverting the tracing only — the rest of the same commit (relative
proxy URL resolution, retry-stitch-only UI, the segment recovery
panel/route) is unaffected and stays. The underlying ffmpeg-unavailable
bug needs a bundle-size-safe fix (a smaller binary, or fetching one
into /tmp at cold start from an operator-approved source) rather than
static tracing — left as a follow-up, noted in next.config.js.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

The previous commit (495307d1) traced ffmpeg-static's pre-compiled
binary (~70-80MB) into three routes to fix "ffmpeg binary unavailable"
on the stitch route. That pushed the Amplify build output to
299582522 bytes, over the platform's 230686720-byte (220 MiB) hard
cap, and broke every deploy off this branch.

Reverting the tracing only — the rest of the same commit (relative
proxy URL resolution, retry-stitch-only UI, the segment recovery
panel/route) is unaffected and stays. The underlying ffmpeg-unavailable
bug needs a bundle-size-safe fix (a smaller binary, or fetching one
into /tmp at cold start from an operator-approved source) rather than
static tracing — left as a follow-up, noted in next.config.js.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `next.config.js` |

## Stats

 1 file changed, 8 insertions(+), 9 deletions(-)
