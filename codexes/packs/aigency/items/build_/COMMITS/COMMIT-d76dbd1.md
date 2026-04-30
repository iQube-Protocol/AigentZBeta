# Commit Brief: `d76dbd1` — nest STATE_SYNC processing flags per Lovable spec; bump KB search timeout

| Field | Value |
|-------|-------|
| SHA | [`d76dbd1`](https://github.com/iQube-Protocol/AigentZBeta/commit/d76dbd11a8eab89163b0deee496ac6dae0428f5d) |
| Author | Claude |
| Date | 2026-04-30T03:42:32Z |
| Branch | dev (direct push) |
| Type | `chore` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
nest STATE_SYNC processing flags per Lovable spec; bump KB search timeout

Two fixes responding to user-reported regressions on welcome screen.

1. Thinking-dots animation never fired from STATE_SYNC because the shell
   listens for nested shape per Lovable's spec
   (src/lib/shell-messages.ts):

     payload.state.processing | busy | inferring === true

   The runtime was sending a STRING `state: "welcome"|"post_welcome"`
   with FLAT processing siblings — `state.processing` was undefined so
   the trigger never qualified. Fix:
   - Send `state` as an OBJECT containing screen + processing flags
     (matches the spec)
   - Move the screen string to its own top-level `screen` field
   - Keep flat processing siblings around for any legacy consumer
   - signalRuntimeBusy() now also explicitly emits a STATE_SYNC with
     state.processing=true on every navigation (and a state.processing=false
     after the auto-clear timeout) so dots fire immediately, not only on
     the next dependency-driven STATE_SYNC effect re-fire

   Affected paths that should now light dots: NBA codex/route/action,
   "Explore the KNYT World" / "Go to KNYT Store" / "Sign in" quick
   links, takeover context toggle, prompt input, and cartridge-open
   from welcome banner. INFERENCE_START + PROCESSING_START continue
   to fire as redundant explicit triggers per spec.

2. Aigent KB access intermittently failed ("I don't have specific
   information about iQubes…") because the per-query KB search had a
   5s timeout that routinely blew through on cold-Lambda starts. The
   agent then composed an answer without RAG context. Bumped the
   timeout to 15s — well within the route's overall budget — and added
   the domain to the diagnostic logs so a future failure can be
   triaged faster.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Two fixes responding to user-reported regressions on welcome screen.

1. Thinking-dots animation never fired from STATE_SYNC because the shell
   listens for nested shape per Lovable's spec
   (src/lib/shell-messages.ts):

     payload.state.processing | busy | inferring === true

   The runtime was sending a STRING `state: "welcome"|"post_welcome"`
   with FLAT processing siblings — `state.processing` was undefined so
   the trigger never qualified. Fix:
   - Send `state` as an OBJECT containing screen + processing flags
     (matches the spec)
   - Move the screen string to its own top-level `screen` field
   - Keep flat processing siblings around for any legacy consumer
   - signalRuntimeBusy() now also explicitly emits a STATE_SYNC with
     state.processing=true on every navigation (and a state.processing=false
     after the auto-clear timeout) so dots fire immediately, not only on
     the next dependency-driven STATE_SYNC effect re-fire

   Affected paths that should now light dots: NBA codex/route/action,
   "Explore the KNYT World" / "Go to KNYT Store" / "Sign in" quick
   links, takeover context toggle, prompt input, and cartridge-open
   from welcome banner. INFERENCE_START + PROCESSING_START continue
   to fire as redundant explicit triggers per spec.

2. Aigent KB access intermittently failed ("I don't have specific
   information about iQubes…") because the per-query KB search had a
   5s timeout that routinely blew through on cold-Lambda starts. The
   agent then composed an answer without RAG context. Bumped the
   timeout to 15s — well within the route's overall budget — and added
   the domain to the diagnostic logs so a future failure can be
   triaged faster.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/codex/chat/route.ts` |
| Modified | `components/metame/MetaMeRuntimeClient.tsx` |

## Stats

 2 files changed, 42 insertions(+), 11 deletions(-)
