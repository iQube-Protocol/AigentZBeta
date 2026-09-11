# Commit Brief: `9dce3d2` — llmDraftHelper: add Venice (Llama 3.3 70B) as third-tier fallback

| Field | Value |
|-------|-------|
| SHA | [`9dce3d2`](https://github.com/iQube-Protocol/AigentZBeta/commit/9dce3d294f1c2d5e6cd9273bc3b84326b031ce4e) |
| Author | Claude |
| Date | 2026-05-29T08:52:52Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
llmDraftHelper: add Venice (Llama 3.3 70B) as third-tier fallback

Operator hit the templateDraft prompt-leak twice today: first because
draft services were OpenAI-only and the OpenAI account is quota-
throttled (78bea0fc moved to Anthropic primary), then because the
Anthropic model id I used was wrong (6903e15b fixed claude-sonnet-4-5
→ claude-sonnet-4-6). A third tier removes the next failure mode:
if Anthropic itself ever returns 5xx / rate-limits, OR a future bad
model id costs another iteration, drafts should still come back as
real LLM prose rather than the system prompt rendered in the email
body.

Add callVeniceJson(system, user, maxTokens?) using Venice's
OpenAI-compatible /chat/completions endpoint at api.venice.ai/api/v1,
pinned to llama-3.3-70b — same OSS model specialistRouter already
uses, so dev + prod accounts share the same model allowlist.
VENICE_API_KEY is already in the env (specialistRouter consumes it).

callDraftLlm becomes Anthropic → OpenAI → Venice → null. Each draft
service still owns its templateDraft() as the last resort; the chain
just makes the template harder to reach.

Tradeoff: Venice's OSS models are weaker at strict-JSON obedience than
Sonnet 4.6 / gpt-4o-mini. The system prompt nudges them with "Return a
single valid JSON object only. Do not include any commentary, markdown
fences, or prose outside the JSON.", and stripJsonFences() unwraps any
backtick fences the model emits anyway, but JSON.parse may still fail
sometimes when Venice is the one serving — in which case the draft
service falls through to template as before. That's still strictly
better than reaching template on a clean Anthropic/OpenAI outage.
```

## Body

Operator hit the templateDraft prompt-leak twice today: first because
draft services were OpenAI-only and the OpenAI account is quota-
throttled (78bea0fc moved to Anthropic primary), then because the
Anthropic model id I used was wrong (6903e15b fixed claude-sonnet-4-5
→ claude-sonnet-4-6). A third tier removes the next failure mode:
if Anthropic itself ever returns 5xx / rate-limits, OR a future bad
model id costs another iteration, drafts should still come back as
real LLM prose rather than the system prompt rendered in the email
body.

Add callVeniceJson(system, user, maxTokens?) using Venice's
OpenAI-compatible /chat/completions endpoint at api.venice.ai/api/v1,
pinned to llama-3.3-70b — same OSS model specialistRouter already
uses, so dev + prod accounts share the same model allowlist.
VENICE_API_KEY is already in the env (specialistRouter consumes it).

callDraftLlm becomes Anthropic → OpenAI → Venice → null. Each draft
service still owns its templateDraft() as the last resort; the chain
just makes the template harder to reach.

Tradeoff: Venice's OSS models are weaker at strict-JSON obedience than
Sonnet 4.6 / gpt-4o-mini. The system prompt nudges them with "Return a
single valid JSON object only. Do not include any commentary, markdown
fences, or prose outside the JSON.", and stripJsonFences() unwraps any
backtick fences the model emits anyway, but JSON.parse may still fail
sometimes when Venice is the one serving — in which case the draft
service falls through to template as before. That's still strictly
better than reaching template on a clean Anthropic/OpenAI outage.

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/agents/_lib/llmDraftHelper.ts` |

## Stats

 1 file changed, 71 insertions(+), 5 deletions(-)
