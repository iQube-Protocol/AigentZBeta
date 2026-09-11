# Commit Brief: `d0825fd` — nbe rerank: fold Capability Gateway preflight summary into LLM rerank prompt

| Field | Value |
|-------|-------|
| SHA | [`d0825fd`](https://github.com/iQube-Protocol/AigentZBeta/commit/d0825fd14ab99cdedd29da5c40ba0bb68582a3ae) |
| Author | Claude |
| Date | 2026-05-24T10:09:51Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
nbe rerank: fold Capability Gateway preflight summary into LLM rerank prompt

Extends the existing nbeLlmRerank pass (the one that already reorders
the deterministic catalogue survivors against persona strategy + stage)
to also consume a fresh signal from the Capability Gateway pre-flight
gather when one is present.

Changes:

- RerankContext gains optional liveContext?: string | null. When non-
  empty, summariseForPrompt folds it into the JSON body as a top-level
  field, capped at 600 chars so it can't blow the prompt budget.
- SYSTEM_PROMPT gets one new rule: treat liveContext as a fresh signal
  from a capability tool, use it to break ties / boost a candidate
  whose rationale lines up — but never let it override the
  deterministic eligibility set, never invent ids, ignore noise. The
  topReason field is allowed to cite it when it drove the pick.
- BuildBriefInput + the buildMoveForward input gain a matching
  optional liveContext field that the rerank call site forwards.
- /api/assistant/brief and /api/assistant/move-forward pass
  preflight?.summary into the builder. Triple-gated no-op: nothing
  changes unless CAPABILITY_GATEWAY_PREFLIGHT covers the surface AND
  the gather succeeded AND the LLM rerank pass is enabled
  (ANTHROPIC_API_KEY present). Failure on any path falls back to the
  deterministic order, same as the existing rerank contract.

Today's web-search adapter is still stubbed, so the signal in
production is "web-search ran (stub) for 'X'" — useful for verifying
the pipe end-to-end but won't move rankings meaningfully until the
real MCP-resolved search lands in Phase 2b. Venture-progress is
unaffected because it doesn't go through the rerank pass.
```

## Body

Extends the existing nbeLlmRerank pass (the one that already reorders
the deterministic catalogue survivors against persona strategy + stage)
to also consume a fresh signal from the Capability Gateway pre-flight
gather when one is present.

Changes:

- RerankContext gains optional liveContext?: string | null. When non-
  empty, summariseForPrompt folds it into the JSON body as a top-level
  field, capped at 600 chars so it can't blow the prompt budget.
- SYSTEM_PROMPT gets one new rule: treat liveContext as a fresh signal
  from a capability tool, use it to break ties / boost a candidate
  whose rationale lines up — but never let it override the
  deterministic eligibility set, never invent ids, ignore noise. The
  topReason field is allowed to cite it when it drove the pick.
- BuildBriefInput + the buildMoveForward input gain a matching
  optional liveContext field that the rerank call site forwards.
- /api/assistant/brief and /api/assistant/move-forward pass
  preflight?.summary into the builder. Triple-gated no-op: nothing
  changes unless CAPABILITY_GATEWAY_PREFLIGHT covers the surface AND
  the gather succeeded AND the LLM rerank pass is enabled
  (ANTHROPIC_API_KEY present). Failure on any path falls back to the
  deterministic order, same as the existing rerank contract.

Today's web-search adapter is still stubbed, so the signal in
production is "web-search ran (stub) for 'X'" — useful for verifying
the pipe end-to-end but won't move rankings meaningfully until the
real MCP-resolved search lands in Phase 2b. Venture-progress is
unaffected because it doesn't go through the rerank pass.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/assistant/brief/route.ts` |
| Modified | `app/api/assistant/move-forward/route.ts` |
| Modified | `services/orchestration/briefBuilder.ts` |
| Modified | `services/orchestration/nbeLlmRerank.ts` |

## Stats

 4 files changed, 37 insertions(+), 1 deletion(-)
