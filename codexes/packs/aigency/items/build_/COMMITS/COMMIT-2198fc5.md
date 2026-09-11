# Commit Brief: `2198fc5` — Stop rendering duplicate raw JSON below media previews; hover-only video chrome

| Field | Value |
|-------|-------|
| SHA | [`2198fc5`](https://github.com/iQube-Protocol/AigentZBeta/commit/2198fc5a37c420a33b1e8b3329d66a75d56185c1) |
| Author | Claude |
| Date | 2026-09-04T20:54:26Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Stop rendering duplicate raw JSON below media previews; hover-only video chrome

Two related fixes to SmartTriadInferenceRenderer.tsx, the shared chat-message
renderer behind MoneyPenny's inline video/media chips (and A2UI surface
previews generally):

1. extractA2UIPayload/extractMediaVideoPayload only ever READ the fenced
   JSON block a structured payload was parsed from — they never removed it
   from what still got rendered. So whenever a payload parsed successfully,
   the operator saw the correct rich preview (video player, A2UI summary)
   AND the exact same fenced JSON rendered a second time as a raw
   syntax-highlighted code block directly beneath it, via the generic
   line-level renderer's normal ``` handling. Both extractors now return the
   matched raw fence text alongside the parsed payload; a new
   contentForDisplay strips every successfully-parsed extraction's rawMatch
   before the content reaches the line-level renderer, so a recognized
   payload renders ONLY as its preview component.

2. Operator request: MediaVideoPreview's native control bar is now floating
   chrome — shown only while the pointer is over the video or it holds
   keyboard focus, hidden otherwise, rather than a permanently visible strip
   inside the chat transcript.

Both new/updated tests confirmed failing against the pre-fix code.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Two related fixes to SmartTriadInferenceRenderer.tsx, the shared chat-message
renderer behind MoneyPenny's inline video/media chips (and A2UI surface
previews generally):

1. extractA2UIPayload/extractMediaVideoPayload only ever READ the fenced
   JSON block a structured payload was parsed from — they never removed it
   from what still got rendered. So whenever a payload parsed successfully,
   the operator saw the correct rich preview (video player, A2UI summary)
   AND the exact same fenced JSON rendered a second time as a raw
   syntax-highlighted code block directly beneath it, via the generic
   line-level renderer's normal ``` handling. Both extractors now return the
   matched raw fence text alongside the parsed payload; a new
   contentForDisplay strips every successfully-parsed extraction's rawMatch
   before the content reaches the line-level renderer, so a recognized
   payload renders ONLY as its preview component.

2. Operator request: MediaVideoPreview's native control bar is now floating
   chrome — shown only while the pointer is over the video or it holds
   keyboard focus, hidden otherwise, rather than a permanently visible strip
   inside the chat transcript.

Both new/updated tests confirmed failing against the pre-fix code.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/smarttriad/copilot/SmartTriadInferenceRenderer.tsx` |
| Modified | `tests/moneypenny-c15-educational-video.test.ts` |

## Stats

 2 files changed, 98 insertions(+), 13 deletions(-)
