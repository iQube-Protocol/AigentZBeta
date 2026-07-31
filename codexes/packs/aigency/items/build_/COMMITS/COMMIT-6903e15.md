# Commit Brief: `6903e15` — draftLlmHelper: fix Anthropic model id — claude-sonnet-4-5 → claude-sonnet-4-6

| Field | Value |
|-------|-------|
| SHA | [`6903e15`](https://github.com/iQube-Protocol/AigentZBeta/commit/6903e15b6b0524bf4159fcbd8d9aa0716b4897cb) |
| Author | Claude |
| Date | 2026-05-29T08:40:55Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
draftLlmHelper: fix Anthropic model id — claude-sonnet-4-5 → claude-sonnet-4-6

The Anthropic-primary cutover (78bea0fc) was hardcoded to
'claude-sonnet-4-5' which is not a valid model id — Anthropic returned
404 on every draft call, the helper logged "Anthropic returned 404;
falling through", and every draft request fell back to the OpenAI
secondary which is quota-throttled, then to templateDraft() which
embeds input.prompt.trim() verbatim. The operator kept seeing the
internal "Draft a gmail-draft that operationalises..." prompt as the
email body.

Correct ids per the Claude 4.X family registry (system prompt this
session): Opus 4.8 = 'claude-opus-4-8', Sonnet 4.6 = 'claude-sonnet-4-6',
Haiku 4.5 = 'claude-haiku-4-5-20251001'. Drafting benefits from Sonnet
quality so we pin to claude-sonnet-4-6 here (other Anthropic call sites
in this repo use Haiku for cheaper classification work).
```

## Body

The Anthropic-primary cutover (78bea0fc) was hardcoded to
'claude-sonnet-4-5' which is not a valid model id — Anthropic returned
404 on every draft call, the helper logged "Anthropic returned 404;
falling through", and every draft request fell back to the OpenAI
secondary which is quota-throttled, then to templateDraft() which
embeds input.prompt.trim() verbatim. The operator kept seeing the
internal "Draft a gmail-draft that operationalises..." prompt as the
email body.

Correct ids per the Claude 4.X family registry (system prompt this
session): Opus 4.8 = 'claude-opus-4-8', Sonnet 4.6 = 'claude-sonnet-4-6',
Haiku 4.5 = 'claude-haiku-4-5-20251001'. Drafting benefits from Sonnet
quality so we pin to claude-sonnet-4-6 here (other Anthropic call sites
in this repo use Haiku for cheaper classification work).

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/agents/_lib/llmDraftHelper.ts` |

## Stats

 1 file changed, 6 insertions(+), 2 deletions(-)
