# Commit Brief: `ff5abef` — Promote ChainGPT to experiment adapter; rehearsal chain chaingpt → openai → venice-sovereign

| Field | Value |
|-------|-------|
| SHA | [`ff5abef`](https://github.com/iQube-Protocol/AigentZBeta/commit/ff5abef797368d776606d4fe120f13f856bb8fbc) |
| Author | Claude |
| Date | 2026-07-06T15:40:31Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Promote ChainGPT to experiment adapter; rehearsal chain chaingpt → openai → venice-sovereign

Operator-directed provider chain: chaingpt is the rehearsal default,
openai the fallback, venice remains the sovereign run. The adapter mirrors
the platform's proven codex-chat call exactly (endpoint, four env-key
spellings, question/chatHistory:off payload, data.bot-or-raw extraction).
Honest limits in-code: no temperature/max_tokens on this endpoint and no
usage tokens — reported null, never fabricated. Canaries pin the chain
order, venice/anthropic exclusions, and the single verified model id.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Operator-directed provider chain: chaingpt is the rehearsal default,
openai the fallback, venice remains the sovereign run. The adapter mirrors
the platform's proven codex-chat call exactly (endpoint, four env-key
spellings, question/chatHistory:off payload, data.bot-or-raw extraction).
Honest limits in-code: no temperature/max_tokens on this endpoint and no
usage tokens — reported null, never fabricated. Canaries pin the chain
order, venice/anthropic exclusions, and the single verified model id.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/agentiq/foundation/CFS-015_operation-chrysalis-2-prd.md` |
| Modified | `components/composer/Exp004SovereigntyRunner.tsx` |
| Modified | `services/experiments/exp004.ts` |
| Modified | `services/experiments/llm.ts` |
| Modified | `tests/constitutional-contracts.test.ts` |

## Stats

 5 files changed, 74 insertions(+), 7 deletions(-)
