# Commit Brief: `f32d517` — copilot: wire mic to STT + add Listen TTS + persist messages + clear affordance

| Field | Value |
|-------|-------|
| SHA | [`f32d517`](https://github.com/iQube-Protocol/AigentZBeta/commit/f32d51767fafb82350355a26b99a64695f2a1d13) |
| Author | Claude |
| Date | 2026-05-26T14:19:24Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
copilot: wire mic to STT + add Listen TTS + persist messages + clear affordance

Three refinements to the SmartTriad copilot layer from operator
report 2026-05-26. #4 (brief prose lore-bias) is a separate
diagnosis covered in the session log + next commit train.

1) Mic → real STT (#1 — was cosmetic-only)
------------------------------------------
The mic toggle was bound to a local `micActive` boolean that nothing
else read — pressing it flipped the icon but never captured audio,
never transcribed, never populated the input. The bug was that the
useSpeechRecognition hook (MediaRecorder + Whisper via /api/skills/stt,
already wired into every compose modal) was never connected here.

Wires useSpeechRecognition into FloatingCopilot. The mic button now:
- Calls stt.toggle() on click
- Disables when MediaRecorder is unsupported or while a clip is
  still transcribing (amber spinner during processing)
- Appends the transcript to whatever's already in the input box on
  finalResult (so partial-typed prompts aren't clobbered)

2) Listen TTS icon next to trust/reliability dots (#2 — new)
------------------------------------------------------------
New hook hooks/useSpeechSynthesis.ts — minimal wrapper over
window.speechSynthesis with isSupported / isSpeaking state + speak()
/ cancel() handlers. SSR-safe, cleans up utterances on unmount,
cancels in-flight on a fresh speak() so utterances don't overlap.

New Volume2/VolumeX button injected in the FloatingCopilot header
to the LEFT of the R/T dot clusters. Click reads the latest
assistant message aloud; click again while speaking → cancel.
Disabled when no assistant message exists yet OR when the browser
doesn't expose speechSynthesis.

3) Session persistence + Clear affordance (#3 — new)
----------------------------------------------------
Copilot messages used to live in component state only — navigating
away to another tab and back wiped the conversation. Now:

- useState initializer hydrates from sessionStorage keyed by
  persistKey = `smarttriad.copilot.messages.<personaId|'anon'>`.
  Different personas don't leak each other's history on shared
  browsers; same persona's session survives surface remounts.
- Effect persists internalMessages to sessionStorage on every
  change. Skipped when the caller owns the message state via
  externalMessages + onMessagesChange (their concern).
- New handleClearMessages drops persisted history + resets to
  seedMessages. Wired into a RotateCcw refresh button placed in
  the bottom toggle row to the right of the chat/avatar toggle —
  matches the operator's requested location.

Lucide imports: + Volume2, VolumeX, RotateCcw.

All 44 admin canaries still pass; the copilot layer changes are
additive + isolated to FloatingCopilot. EmbeddedCopilot path
unchanged (no clear affordance there yet — different surface
contract).
```

## Body

Three refinements to the SmartTriad copilot layer from operator
report 2026-05-26. #4 (brief prose lore-bias) is a separate
diagnosis covered in the session log + next commit train.

1) Mic → real STT (#1 — was cosmetic-only)
------------------------------------------
The mic toggle was bound to a local `micActive` boolean that nothing
else read — pressing it flipped the icon but never captured audio,
never transcribed, never populated the input. The bug was that the
useSpeechRecognition hook (MediaRecorder + Whisper via /api/skills/stt,
already wired into every compose modal) was never connected here.

Wires useSpeechRecognition into FloatingCopilot. The mic button now:
- Calls stt.toggle() on click
- Disables when MediaRecorder is unsupported or while a clip is
  still transcribing (amber spinner during processing)
- Appends the transcript to whatever's already in the input box on
  finalResult (so partial-typed prompts aren't clobbered)

2) Listen TTS icon next to trust/reliability dots (#2 — new)
------------------------------------------------------------
New hook hooks/useSpeechSynthesis.ts — minimal wrapper over
window.speechSynthesis with isSupported / isSpeaking state + speak()
/ cancel() handlers. SSR-safe, cleans up utterances on unmount,
cancels in-flight on a fresh speak() so utterances don't overlap.

New Volume2/VolumeX button injected in the FloatingCopilot header
to the LEFT of the R/T dot clusters. Click reads the latest
assistant message aloud; click again while speaking → cancel.
Disabled when no assistant message exists yet OR when the browser
doesn't expose speechSynthesis.

3) Session persistence + Clear affordance (#3 — new)
----------------------------------------------------
Copilot messages used to live in component state only — navigating
away to another tab and back wiped the conversation. Now:

- useState initializer hydrates from sessionStorage keyed by
  persistKey = `smarttriad.copilot.messages.<personaId|'anon'>`.
  Different personas don't leak each other's history on shared
  browsers; same persona's session survives surface remounts.
- Effect persists internalMessages to sessionStorage on every
  change. Skipped when the caller owns the message state via
  externalMessages + onMessagesChange (their concern).
- New handleClearMessages drops persisted history + resets to
  seedMessages. Wired into a RotateCcw refresh button placed in
  the bottom toggle row to the right of the chat/avatar toggle —
  matches the operator's requested location.

Lucide imports: + Volume2, VolumeX, RotateCcw.

All 44 admin canaries still pass; the copilot layer changes are
additive + isolated to FloatingCopilot. EmbeddedCopilot path
unchanged (no clear affordance there yet — different surface
contract).

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/smarttriad/copilot/SmartTriadCopilotLayer.tsx` |
| Added | `hooks/useSpeechSynthesis.ts` |

## Stats

 2 files changed, 292 insertions(+), 28 deletions(-)
