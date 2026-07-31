# Commit Brief: `78bea0f` — draft services: Anthropic primary, OpenAI secondary (was OpenAI-only)

| Field | Value |
|-------|-------|
| SHA | [`78bea0f`](https://github.com/iQube-Protocol/AigentZBeta/commit/78bea0fcc98199c82f64829dfc6727ff3952610e) |
| Author | Claude |
| Date | 2026-05-29T05:54:57Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
draft services: Anthropic primary, OpenAI secondary (was OpenAI-only)

All six aigentMe draft services (draftEmail, draftMarketaEmail,
draftGoogleDoc, draftGoogleSheet, draftSlideOutline, draftCalendarEvent)
were OpenAI-only via response_format=json_object. When the OpenAI
account hit quota (today's 429 from the image-vision indexer), every
draft endpoint fell back to its templateDraft() — which embeds
input.prompt.trim() verbatim as the body. The operator saw their own
system-prompt rendered in the email body field instead of an LLM-
drafted reply ("Draft a gmail-draft that operationalises this next-
best action..." etc.).

Fix: introduce shared services/agents/_lib/llmDraftHelper.ts with a
callDraftLlm(system, user, maxTokens?) helper that tries Anthropic
Messages first (model claude-sonnet-4-5, matching nbeLlmRerank +
specialistRouter call sites that already use ANTHROPIC_API_KEY), then
falls through to OpenAI chat/completions response_format=json_object,
returning the first non-null model text. Each draft service replaces
its `await callOpenAi(...)` with `await callDraftLlm(...)`. JSON-fence
unwrapping is handled in the helper so Anthropic responses parse
cleanly via the existing JSON.parse(raw) caller path.

ANTHROPIC_API_KEY is already configured in dev/prod (nbeLlmRerank +
specialistRouter would have been silently template-only otherwise).
No env-var changes required. OpenAI-quota outages no longer leak the
system prompt into operator-facing draft bodies.

Local callOpenAi functions in each draft service are left as dead
code rather than removed in this commit to keep the diff surgical;
they'll get pruned in a follow-up once the Anthropic path is verified
in prod.
```

## Body

All six aigentMe draft services (draftEmail, draftMarketaEmail,
draftGoogleDoc, draftGoogleSheet, draftSlideOutline, draftCalendarEvent)
were OpenAI-only via response_format=json_object. When the OpenAI
account hit quota (today's 429 from the image-vision indexer), every
draft endpoint fell back to its templateDraft() — which embeds
input.prompt.trim() verbatim as the body. The operator saw their own
system-prompt rendered in the email body field instead of an LLM-
drafted reply ("Draft a gmail-draft that operationalises this next-
best action..." etc.).

Fix: introduce shared services/agents/_lib/llmDraftHelper.ts with a
callDraftLlm(system, user, maxTokens?) helper that tries Anthropic
Messages first (model claude-sonnet-4-5, matching nbeLlmRerank +
specialistRouter call sites that already use ANTHROPIC_API_KEY), then
falls through to OpenAI chat/completions response_format=json_object,
returning the first non-null model text. Each draft service replaces
its `await callOpenAi(...)` with `await callDraftLlm(...)`. JSON-fence
unwrapping is handled in the helper so Anthropic responses parse
cleanly via the existing JSON.parse(raw) caller path.

ANTHROPIC_API_KEY is already configured in dev/prod (nbeLlmRerank +
specialistRouter would have been silently template-only otherwise).
No env-var changes required. OpenAI-quota outages no longer leak the
system prompt into operator-facing draft bodies.

Local callOpenAi functions in each draft service are left as dead
code rather than removed in this commit to keep the diff surgical;
they'll get pruned in a follow-up once the Anthropic path is verified
in prod.

## Files Changed

| Change | File |
|--------|------|
| Added | `services/agents/_lib/llmDraftHelper.ts` |
| Modified | `services/agents/draftCalendarEvent.ts` |
| Modified | `services/agents/draftEmail.ts` |
| Modified | `services/agents/draftGoogleDoc.ts` |
| Modified | `services/agents/draftGoogleSheet.ts` |
| Modified | `services/agents/draftMarketaEmail.ts` |
| Modified | `services/agents/draftSlideOutline.ts` |

## Stats

 7 files changed, 158 insertions(+), 6 deletions(-)
