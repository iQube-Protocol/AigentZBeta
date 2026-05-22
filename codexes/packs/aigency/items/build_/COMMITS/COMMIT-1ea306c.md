# Commit Brief: `1ea306c` — switch mic STT from Web Speech API to MediaRecorder + Whisper

| Field | Value |
|-------|-------|
| SHA | [`1ea306c`](https://github.com/iQube-Protocol/AigentZBeta/commit/1ea306cf7ecf513323d05ec7f1add9b671da3e07) |
| Author | Claude |
| Date | 2026-05-22T19:54:09Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
switch mic STT from Web Speech API to MediaRecorder + Whisper

Brave Shields blocks the Chromium Web Speech API's calls to Google's
STT servers (same way it blocks Sentry envelopes), iOS Safari support
is unreliable, and Firefox has no native impl at all. Replace the
browser-native path with a record-and-transcribe flow:

  - hook: record a clip via MediaRecorder + getUserMedia
  - on stop: POST the blob to /api/skills/stt via personaFetch (Bearer)
  - route: OpenAI Whisper transcription, 8MB cap, persona-gated
  - button: spinner state during transcription, idle/red/processing

useSpeechRecognition keeps the same export name and signature so all
existing call sites (six compose modals + three expGuide textareas)
work without modification. Web Speech wrapper deleted.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Brave Shields blocks the Chromium Web Speech API's calls to Google's
STT servers (same way it blocks Sentry envelopes), iOS Safari support
is unreliable, and Firefox has no native impl at all. Replace the
browser-native path with a record-and-transcribe flow:

  - hook: record a clip via MediaRecorder + getUserMedia
  - on stop: POST the blob to /api/skills/stt via personaFetch (Bearer)
  - route: OpenAI Whisper transcription, 8MB cap, persona-gated
  - button: spinner state during transcription, idle/red/processing

useSpeechRecognition keeps the same export name and signature so all
existing call sites (six compose modals + three expGuide textareas)
work without modification. Web Speech wrapper deleted.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Added | `app/api/skills/stt/route.ts` |
| Modified | `components/ui/MicButton.tsx` |
| Modified | `hooks/useSpeechRecognition.ts` |

## Stats

 4 files changed, 250 insertions(+), 124 deletions(-)
