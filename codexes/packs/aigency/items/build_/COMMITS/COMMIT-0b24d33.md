# Commit Brief: `0b24d33` — Add provider fallback to EXP-003 benchmark (openai/venice via --provider)

| Field | Value |
|-------|-------|
| SHA | [`0b24d33`](https://github.com/iQube-Protocol/AigentZBeta/commit/0b24d33e0c2051f413cf1dffbd89d7ce5412910f) |
| Author | Claude |
| Date | 2026-07-04T06:36:45Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add provider fallback to EXP-003 benchmark (openai/venice via --provider)

The operator's Anthropic account had no credits, so the benchmark now
mirrors the platform's full LLM chain (llmDraftHelper) instead of
hard-requiring Anthropic: --provider anthropic|openai|venice, defaulting
to the first available key in platform order. Same env names, endpoints,
and default models as the helper (gpt-4o-mini, llama-3.3-70b at
VENICE_BASE_URL); both arms and the judge always run on the SAME
provider+model, and the provider is recorded in the results JSON so
cross-provider runs are never mistaken for comparable rows.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

The operator's Anthropic account had no credits, so the benchmark now
mirrors the platform's full LLM chain (llmDraftHelper) instead of
hard-requiring Anthropic: --provider anthropic|openai|venice, defaulting
to the first available key in platform order. Same env names, endpoints,
and default models as the helper (gpt-4o-mini, llama-3.3-70b at
VENICE_BASE_URL); both arms and the judge always run on the SAME
provider+model, and the provider is recorded in the results JSON so
cross-provider runs are never mistaken for comparable rows.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/agentiq/foundation/experiments/exp-003-rediscovery-savings/README.md` |
| Modified | `scripts/benchmark-rediscovery.mjs` |

## Stats

 2 files changed, 123 insertions(+), 33 deletions(-)
