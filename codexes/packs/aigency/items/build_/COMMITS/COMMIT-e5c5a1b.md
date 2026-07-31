# Commit Brief: `e5c5a1b` — copilot speaker icon: swap browser-native TTS → /api/skills/tts (Cartesia)

| Field | Value |
|-------|-------|
| SHA | [`e5c5a1b`](https://github.com/iQube-Protocol/AigentZBeta/commit/e5c5a1b719d1669665288482f1b10c5f9cf266f1) |
| Author | Claude |
| Date | 2026-05-29T14:49:44Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
copilot speaker icon: swap browser-native TTS → /api/skills/tts (Cartesia)

The Volume2 / VolumeX speaker button in SmartTriadCopilotLayer header
was wired to useSpeechSynthesis (window.speechSynthesis, browser-
native robotic TTS). My earlier /api/skills/tts route switch to
Cartesia primary never reached this surface because the button never
hit the route — it just spoke through the OS-level engine. So the
operator kept hearing the old robotic voice and assumed the deploy
hadn't landed.

Swap useSpeechSynthesis → useTTSPlayer (the same hook the
ListenButton uses) so the speaker icon now hits /api/skills/tts and
plays Cartesia Sonic English (Marketa voice). Browser-native is kept
around as a feature-detect only — when neither Cartesia nor OpenAI
are configured, the route returns 503 and the FE shows error state.

ttsState ('idle' / 'loading' / 'playing' / 'error') drives the icon:
loading disables the button with a tooltip explaining Cartesia is
being fetched; playing shows VolumeX + the cyan-glow active state
exactly the way the prior wiring rendered it.

lastAssistantMessageRef shim keeps useTTSPlayer's getText closure
fresh across re-renders without re-instantiating the hook on every
message tick.
```

## Body

The Volume2 / VolumeX speaker button in SmartTriadCopilotLayer header
was wired to useSpeechSynthesis (window.speechSynthesis, browser-
native robotic TTS). My earlier /api/skills/tts route switch to
Cartesia primary never reached this surface because the button never
hit the route — it just spoke through the OS-level engine. So the
operator kept hearing the old robotic voice and assumed the deploy
hadn't landed.

Swap useSpeechSynthesis → useTTSPlayer (the same hook the
ListenButton uses) so the speaker icon now hits /api/skills/tts and
plays Cartesia Sonic English (Marketa voice). Browser-native is kept
around as a feature-detect only — when neither Cartesia nor OpenAI
are configured, the route returns 503 and the FE shows error state.

ttsState ('idle' / 'loading' / 'playing' / 'error') drives the icon:
loading disables the button with a tooltip explaining Cartesia is
being fetched; playing shows VolumeX + the cyan-glow active state
exactly the way the prior wiring rendered it.

lastAssistantMessageRef shim keeps useTTSPlayer's getText closure
fresh across re-renders without re-instantiating the hook on every
message tick.

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/smarttriad/copilot/SmartTriadCopilotLayer.tsx` |

## Stats

 1 file changed, 29 insertions(+), 13 deletions(-)
