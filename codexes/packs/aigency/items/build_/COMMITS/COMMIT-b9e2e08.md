# Commit Brief: `b9e2e08` — STT: add Groq Whisper-large-v3 as fallback when OpenAI fails

| Field | Value |
|-------|-------|
| SHA | [`b9e2e08`](https://github.com/iQube-Protocol/AigentZBeta/commit/b9e2e083f3507bb730b7dd8ee68b2b6b0e543a8f) |
| Author | Claude |
| Date | 2026-05-29T09:36:27Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
STT: add Groq Whisper-large-v3 as fallback when OpenAI fails

OpenAI Whisper is the only STT path in the repo today. When the OpenAI
account is quota-throttled (today's failure mode), the route returns
503 openai-quota-exhausted and the operator's mic effectively goes
offline. Groq runs the same Whisper family (whisper-large-v3) on
custom inference chips, exposes an OpenAI-compatible
/audio/transcriptions endpoint at api.groq.com/openai/v1, and has a
generous free tier — so it's a clean drop-in: same model quality, no
JSON-obedience drift like Venice's Llama models on the chat side.

Restructure /api/skills/stt:
  - transcribeOpenAi(file, lang) — primary
  - transcribeGroq(file, lang)   — fallback, uses the OpenAI SDK with
                                    baseURL: api.groq.com/openai/v1
  - POST tries primary → fallback → maps the combined upstream errors
    to a real status code (503 quota, 504 timeout, 500 other)
  - response includes provider: 'openai' | 'groq' so the FE can see
    which tier served the request (handy for diagnostics)

Add GROQ_API_KEY to scripts/create-env-production.js allowlist so it
ships through the dev/prod env-bootstrap path.

Operator action: set GROQ_API_KEY in Amplify env to enable the
fallback (grab a key from https://console.groq.com/keys — free
account). The route still works on OpenAI-only if Groq isn't set —
groq-not-configured is treated as a soft fall-through, not a hard
error.
```

## Body

OpenAI Whisper is the only STT path in the repo today. When the OpenAI
account is quota-throttled (today's failure mode), the route returns
503 openai-quota-exhausted and the operator's mic effectively goes
offline. Groq runs the same Whisper family (whisper-large-v3) on
custom inference chips, exposes an OpenAI-compatible
/audio/transcriptions endpoint at api.groq.com/openai/v1, and has a
generous free tier — so it's a clean drop-in: same model quality, no
JSON-obedience drift like Venice's Llama models on the chat side.

Restructure /api/skills/stt:
  - transcribeOpenAi(file, lang) — primary
  - transcribeGroq(file, lang)   — fallback, uses the OpenAI SDK with
                                    baseURL: api.groq.com/openai/v1
  - POST tries primary → fallback → maps the combined upstream errors
    to a real status code (503 quota, 504 timeout, 500 other)
  - response includes provider: 'openai' | 'groq' so the FE can see
    which tier served the request (handy for diagnostics)

Add GROQ_API_KEY to scripts/create-env-production.js allowlist so it
ships through the dev/prod env-bootstrap path.

Operator action: set GROQ_API_KEY in Amplify env to enable the
fallback (grab a key from https://console.groq.com/keys — free
account). The route still works on OpenAI-only if Groq isn't set —
groq-not-configured is treated as a soft fall-through, not a hard
error.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/skills/stt/route.ts` |
| Modified | `scripts/create-env-production.js` |

## Stats

 2 files changed, 99 insertions(+), 36 deletions(-)
