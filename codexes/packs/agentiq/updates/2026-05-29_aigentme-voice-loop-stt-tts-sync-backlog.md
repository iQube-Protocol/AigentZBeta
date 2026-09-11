# Phase 2 backlog — Seamless STT ↔ TTS ↔ quick-action turn loop

**Date:** 2026-05-29
**Status:** backlog · high-impact Phase 2 candidate
**Surface:** SmartTriadCopilotLayer (chat input + Listen / speaker icon + quick-action chip strip)
**Workstream:** aigentMe voice protocol

## Goal

Today the copilot has three independent voice surfaces:

| Surface | Current wiring |
|---|---|
| Mic input at bottom of copilot | `/api/skills/stt` → OpenAI Whisper-1 primary, Groq Whisper-large-v3 fallback |
| Listen / speaker icon | `/api/skills/tts` → Cartesia Sonic English primary, OpenAI tts-1 fallback |
| Quick-action chips | text-only dispatch via `quickPrompts[].onSelect` |

The operator experiences these as three separate buttons. The Phase 2 goal is to fuse them into one continuous voice loop where:

1. Operator speaks → STT transcribes → input lands in the chat box → optionally fires the same quick-action chip dispatch the operator would have clicked.
2. The copilot replies → TTS auto-plays the reply in the Cartesia voice without the operator clicking the speaker icon.
3. While TTS is playing, the mic re-arms automatically so the operator's next sentence is captured the moment TTS ends — no button-pressing.
4. Quick-action chips ("Brief me" / "Move forward" / "Venture progress" / "Ask specialists") are dispatchable by voice too — e.g. "brief me" spoken → STT → fuzzy-match against quickPrompts → fire the chip's onDispatchOnSend + onSelect.

## Constraints to honour

- The R/T scoring dots already pulse during chat round-trip + TTS load (see `codexes/packs/agentiq/updates/2026-05-29_metame-client-rt-dots-spec.md`). The voice loop must extend that pulse signal to also cover the STT capture window — operator should see "the copilot is listening" without ambiguity.
- The mic re-arm must be opt-in (operator can disable continuous mode). A bargein during TTS playback should cancel the audio cleanly via `useTTSPlayer.stopAll()`.
- Quick-action voice match should be conservative — only fire the chip dispatch when the transcript matches a quickPrompt label with high confidence. Anything ambiguous routes through the normal chat path.
- The voice id (Cartesia voiceId `694f9389-aac1-45b6-b726-9d9369183238`, model `sonic-english`) must be the same Cartesia uses for Marketa / CodexCopilotLayer — operator identity stays consistent across surfaces.

## Slice plan (sketch)

| Slice | Scope |
|---|---|
| 0 | Add `continuousVoice: boolean` toggle to SmartTriadCopilotLayer. Operator opts in via a small badge next to the mic icon. |
| 1 | After TTS `playing` → `idle`, auto-call `startRecording()` from `useSpeechRecognition`. Stop after N seconds of silence. |
| 2 | After chat response lands, auto-fire `handleListen()` from `useTTSPlayer` so the reply speaks without operator click. |
| 3 | Voice-bargein — when mic detects speech during TTS playback, `stopAll()` on the TTS player + restart recognition. |
| 4 | Quick-action voice match — fuzzy-match STT transcript against `quickPrompts[].label` (Levenshtein < 3 or substring). On match, fire `onDispatchOnSend()` + `onSelect()` instead of routing to chat. |
| 5 | R/T pulse extension — set `isBusy = true` during the STT capture window so the dots ripple while the operator is being heard. |

## DVN receipt

Each voice-loop turn (STT capture → chat → TTS playback) should emit a single `voice_turn_completed` receipt with:

```ts
{
  turnId: string;             // uuid
  transcript: string;         // STT result
  matchedQuickAction: string | null;  // if quick-action fuzzy-matched
  chatRequestMs: number;      // chat round-trip latency
  ttsProvider: 'cartesia' | 'openai';
  ttsLatencyMs: number;
  totalTurnMs: number;
}
```

Lets us audit voice-loop quality and spot drift between STT confidence + quick-action match rate later.

## Why high-impact

Every operator interaction with aigentMe today costs at least one tap. The voice loop drops that to zero for the common "ask + listen + ask again" pattern, which is the natural rhythm for a chief-of-staff agent. Operator-self-reported friction with the current "click mic, click send, click speaker" sequence is the highest-friction part of the cartridge per the 2026-05-29 session feedback.

## Not in scope

- Multi-speaker diarization
- Calling Cartesia's real-time WebSocket TTS — the current bytes endpoint at `/tts/bytes` is fine for Phase 2.
- Voice authentication / persona switching by voice. Persona stays sticky for the session.

## Dependencies

- `/api/skills/tts` Cartesia path is stable (lands once the 2026-05-29 503/504 timeout-tuning settles in dev).
- `/api/skills/stt` Groq fallback live (requires `GROQ_API_KEY` set in Amplify env, operator action pending as of 2026-05-29).
- R/T dots animation primitive spec must be canonical before Slice 5 lands so the busy-pulse extension matches the spec line-for-line.
