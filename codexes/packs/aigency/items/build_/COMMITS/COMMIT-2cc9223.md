# Commit Brief: `2cc9223` — add Marketa voice to ComposerStudio via VAPI + Cartesia

| Field | Value |
|-------|-------|
| SHA | [`2cc9223`](https://github.com/iQube-Protocol/AigentZBeta/commit/2cc9223c0e672127fa2429b131b37c2f7fd0931a) |
| Author | Claude |
| Date | 2026-03-25T00:27:22Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add Marketa voice to ComposerStudio via VAPI + Cartesia

- add @vapi-ai/web SDK to package.json
- lazy-init Vapi instance in useEffect (SSR-safe dynamic import)
- state machine: idle | connecting | active | speaking
- transcript messages from VAPI append to mcpMessage field
- mic toggle button inline with Intent/Message label
  - idle: Mic icon + "Marketa" (hover fuchsia)
  - connecting: spinner + "Connecting…" (amber pulse)
  - active: MicOff + "Listening" (fuchsia)
  - speaking: Volume2 + "Speaking…" (green pulse)
- Cartesia voice: sonic-english, voiceId 694f9389-aac1-45b6-b726-9d9369183238
- persona: Marketa, creative ComposerStudio co-pilot on gpt-4o-mini

env: NEXT_PUBLIC_VAPI_PUBLIC_KEY + CARTESIA_API_KEY must be set in Amplify env

https://claude.ai/code/session_017i9fiEGA3zMjxFonVYZCQT
```

## Files Changed

_File details not available in backfill — see commit link above._
