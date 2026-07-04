# Commit Brief: `fba56dc` — Add model dropdowns to EXP-001/003 lab runners (allowlisted per provider)

| Field | Value |
|-------|-------|
| SHA | [`fba56dc`](https://github.com/iQube-Protocol/AigentZBeta/commit/fba56dc87ce552d9c4b78f289a31778010527abb) |
| Author | Claude |
| Date | 2026-07-04T20:37:24Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add model dropdowns to EXP-001/003 lab runners (allowlisted per provider)

Both text-experiment runners gain a Model selector next to Provider,
mirroring the video tab. The per-provider options come from a server
allowlist (EXPERIMENT_MODEL_OPTIONS) built strictly from model ids with
real call sites/registrations in the codebase: anthropic sonnet-4-6 /
haiku-4-5 / opus-4-6, openai gpt-4o-mini / gpt-4o, venice llama-3.3-70b
/ venice-uncensored / venice-reasoning. Overrides are validated
server-side (arbitrary strings rejected), threaded through every answer
and judge step so a run never mixes models, reset on provider change,
and recorded in the results JSON so cross-model runs stay separate
experiment instances.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Both text-experiment runners gain a Model selector next to Provider,
mirroring the video tab. The per-provider options come from a server
allowlist (EXPERIMENT_MODEL_OPTIONS) built strictly from model ids with
real call sites/registrations in the codebase: anthropic sonnet-4-6 /
haiku-4-5 / opus-4-6, openai gpt-4o-mini / gpt-4o, venice llama-3.3-70b
/ venice-uncensored / venice-reasoning. Overrides are validated
server-side (arbitrary strings rejected), threaded through every answer
and judge step so a run never mixes models, reset on provider change,
and recorded in the results JSON so cross-model runs stay separate
experiment instances.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/experiments/exp001/route.ts` |
| Modified | `app/api/experiments/exp003/route.ts` |
| Modified | `components/composer/Exp001EvaluationRunner.tsx` |
| Modified | `components/composer/Exp003RediscoveryRunner.tsx` |
| Modified | `services/experiments/exp001.ts` |
| Modified | `services/experiments/exp003.ts` |
| Modified | `services/experiments/llm.ts` |

## Stats

 7 files changed, 120 insertions(+), 22 deletions(-)
