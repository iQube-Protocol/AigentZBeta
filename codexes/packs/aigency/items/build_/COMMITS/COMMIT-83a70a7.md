# Commit Brief: `83a70a7` — wire runtimeProcessing into CodexCopilotLayer trust indicator animation

| Field | Value |
|-------|-------|
| SHA | [`83a70a7`](https://github.com/iQube-Protocol/AigentZBeta/commit/83a70a74ba2fd7ea360ce345fa543158c12e1ba6) |
| Author | Claude |
| Date | 2026-03-24T08:18:50Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
wire runtimeProcessing into CodexCopilotLayer trust indicator animation

CodexCopilotLayer.renderDots was gated on its internal isLoading only, which
is never true in the runtime context since inference goes through handlePrompt
not the copilot layer's sendMessage. Added isProcessing prop to
CodexCopilotLayer (OR'd with isLoading), and pass runtimeProcessing as
isProcessing from MetaMeRuntimeClient so the R/T dots pulse during inference
in both the live runtime and studio preview.

https://claude.ai/code/session_017i9fiEGA3zMjxFonVYZCQT
```

## Files Changed

_File details not available in backfill — see commit link above._
