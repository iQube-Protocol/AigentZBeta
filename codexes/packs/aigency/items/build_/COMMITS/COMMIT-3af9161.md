# Commit Brief: `3af9161` — TTS: 8s Cartesia abort + 18s OpenAI ceiling + per-provider error JSON

| Field | Value |
|-------|-------|
| SHA | [`3af9161`](https://github.com/iQube-Protocol/AigentZBeta/commit/3af916191e0dd308f952bf9f879c2046713afd9a) |
| Author | Claude |
| Date | 2026-05-29T20:43:39Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
TTS: 8s Cartesia abort + 18s OpenAI ceiling + per-provider error JSON

Operator hit a 504 Gateway Timeout at 28s on /api/skills/tts because
synthCartesia had no fetch timeout — when Cartesia hangs (TCP
connect / TLS handshake / slow body stream), the fetch can wait
indefinitely and eat the whole Lambda 30s budget before OpenAI even
runs. API Gateway then returns 504 with an empty body and the FE
just sees "TTS 504: " in console.

Fix: AbortController wrapping the Cartesia fetch with an 8s ceiling
(aborts via controller.abort() → throws AbortError → returns
"cartesia-timeout-8s"). Drop OpenAI client timeout from 22s → 18s so
worst-case 8 + 18 + serialization = ~27s, comfortably inside the 30s
Lambda budget with 3s margin.

Also enrich the dual-failure JSON response to carry cartesia + openai
error strings on separate keys so the FE doesn't have to parse a
pipe-delimited blob to surface a useful error to the user. Existing
X-TTS-Cartesia-Error header (when OpenAI succeeds) is unchanged.

Cartesia status-code path also gains the response body (first 200
chars) appended to the error so a 400 / 401 from Cartesia tells the
operator what Cartesia rejected (model id, version, voice id, etc.)
instead of just "cartesia-400".
```

## Body

Operator hit a 504 Gateway Timeout at 28s on /api/skills/tts because
synthCartesia had no fetch timeout — when Cartesia hangs (TCP
connect / TLS handshake / slow body stream), the fetch can wait
indefinitely and eat the whole Lambda 30s budget before OpenAI even
runs. API Gateway then returns 504 with an empty body and the FE
just sees "TTS 504: " in console.

Fix: AbortController wrapping the Cartesia fetch with an 8s ceiling
(aborts via controller.abort() → throws AbortError → returns
"cartesia-timeout-8s"). Drop OpenAI client timeout from 22s → 18s so
worst-case 8 + 18 + serialization = ~27s, comfortably inside the 30s
Lambda budget with 3s margin.

Also enrich the dual-failure JSON response to carry cartesia + openai
error strings on separate keys so the FE doesn't have to parse a
pipe-delimited blob to surface a useful error to the user. Existing
X-TTS-Cartesia-Error header (when OpenAI succeeds) is unchanged.

Cartesia status-code path also gains the response body (first 200
chars) appended to the error so a 400 / 401 from Cartesia tells the
operator what Cartesia rejected (model id, version, voice id, etc.)
instead of just "cartesia-400".

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/skills/tts/route.ts` |

## Stats

 1 file changed, 23 insertions(+), 4 deletions(-)
