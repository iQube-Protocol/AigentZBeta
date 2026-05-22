# Commit Brief: `8c31614` — add microphone to runtime iframe allow attr + log persona-stream errors

| Field | Value |
|-------|-------|
| SHA | [`8c31614`](https://github.com/iQube-Protocol/AigentZBeta/commit/8c3161468b4264bed3ac9e64413197db46ca1042) |
| Author | Claude |
| Date | 2026-05-22T17:50:40Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add microphone to runtime iframe allow attr + log persona-stream errors

The Web Speech API requires the embedding iframe to declare microphone
in its allow attribute. metame-runtime-shell's RuntimeFrame, the
in-runtime cartridge overlay, the cartridge-runtime iframe and the
PreviewFrame all loaded the metaMe Cartridge (which now hosts the
MicButton) without microphone permission, so clicks on the mic
silently no-op'd on Brave and iOS Safari.

Also wrap the persona-stream SSE route in a try/catch so any cold-start
or stream initialisation failure shows up in logs as
[persona-stream] route failed instead of a generic 500.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

The Web Speech API requires the embedding iframe to declare microphone
in its allow attribute. metame-runtime-shell's RuntimeFrame, the
in-runtime cartridge overlay, the cartridge-runtime iframe and the
PreviewFrame all loaded the metaMe Cartridge (which now hosts the
MicButton) without microphone permission, so clicks on the mic
silently no-op'd on Brave and iOS Safari.

Also wrap the persona-stream SSE route in a try/catch so any cold-start
or stream initialisation failure shows up in logs as
[persona-stream] route failed instead of a generic 500.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/a2a/agui/persona-stream/route.ts` |
| Modified | `apps/metame-runtime-shell/app/components/RuntimeFrame.tsx` |
| Modified | `components/metame/MetaMeRuntimeClient.tsx` |
| Modified | `components/preview/PreviewFrame.tsx` |

## Stats

 5 files changed, 51 insertions(+), 36 deletions(-)
