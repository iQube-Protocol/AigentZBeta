# Commit Brief: `da0c735` — TTS: expose Cartesia error in response header + pulse R/T dots during loading

| Field | Value |
|-------|-------|
| SHA | [`da0c735`](https://github.com/iQube-Protocol/AigentZBeta/commit/da0c735747325c937786704a32ed138ae41bde55) |
| Author | Claude |
| Date | 2026-05-29T15:48:14Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
TTS: expose Cartesia error in response header + pulse R/T dots during loading

Two changes that make the Cartesia path debuggable from the browser
without CloudWatch access, plus richer user feedback while audio is
being fetched:

1. /api/skills/tts — when Cartesia fails and the route falls through
   to OpenAI, the OpenAI 200 response now carries an additional
   X-TTS-Cartesia-Error header with the Cartesia failure reason
   (first 200 chars). Operator can DevTools the /api/skills/tts
   network row and see whether Cartesia is returning 401 (auth /
   wrong env), 400 (model_id / version mismatch), 429 (quota), etc.
   X-TTS-Provider stays as the primary signal ("cartesia" vs "openai")
   so we know which tier served the bytes.

2. SmartTriadCopilotLayer — the R/T score dots already pulse during
   chat round-trips via the isProcessing state. Extend the pulse
   condition to also fire while ttsIsLoading is true so the operator
   gets a visual signal that the copilot is fetching the Cartesia
   audio. Same staggered animation-delay pattern as before; no
   change to idle/playing visuals.
```

## Body

Two changes that make the Cartesia path debuggable from the browser
without CloudWatch access, plus richer user feedback while audio is
being fetched:

1. /api/skills/tts — when Cartesia fails and the route falls through
   to OpenAI, the OpenAI 200 response now carries an additional
   X-TTS-Cartesia-Error header with the Cartesia failure reason
   (first 200 chars). Operator can DevTools the /api/skills/tts
   network row and see whether Cartesia is returning 401 (auth /
   wrong env), 400 (model_id / version mismatch), 429 (quota), etc.
   X-TTS-Provider stays as the primary signal ("cartesia" vs "openai")
   so we know which tier served the bytes.

2. SmartTriadCopilotLayer — the R/T score dots already pulse during
   chat round-trips via the isProcessing state. Extend the pulse
   condition to also fire while ttsIsLoading is true so the operator
   gets a visual signal that the copilot is fetching the Cartesia
   audio. Same staggered animation-delay pattern as before; no
   change to idle/playing visuals.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/skills/tts/route.ts` |
| Modified | `components/smarttriad/copilot/SmartTriadCopilotLayer.tsx` |

## Stats

 2 files changed, 11 insertions(+), 2 deletions(-)
