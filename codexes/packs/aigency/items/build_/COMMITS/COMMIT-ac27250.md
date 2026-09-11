# Commit Brief: `ac27250` — capability gateway phase 2b — openclawCore extract, real web-search + owned-content-scan

| Field | Value |
|-------|-------|
| SHA | [`ac27250`](https://github.com/iQube-Protocol/AigentZBeta/commit/ac27250d378be9ff5e4fbed564ff81c5758e20d0) |
| Author | Claude |
| Date | 2026-05-24T09:58:46Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
capability gateway phase 2b — openclawCore extract, real web-search + owned-content-scan

services/capabilities/openclawCore/
  types.ts        — OpenClawTool / OpenClawToolHandler /
                    OpenClawToolResult / OpenClawToolServerContext.
                    Generic tool shape, T0-segregated.
  registry.ts     — module-scoped registerTool / getTool / listTools.
                    Re-registration throws in dev, overwrites silently
                    in prod so hot-reload doesn't crash.
  tools/echo.ts            — smoke test, returns input verbatim.
  tools/webSearch.ts       — REAL search via Serper (SERPER_API_KEY)
                             or Tavily (TAVILY_API_KEY), stub fallback
                             when neither is configured. 8s timeout,
                             provider failure → stub so the affordance
                             never dead-ends.
  tools/ownedContentScan.ts — REAL via getOwnedAssetIds(personaId,
                              series). Returns capped count summary +
                              sampled ids (max 20 each) to keep receipts
                              small.
  index.ts        — barrel; side-effect imports register all tools.

Adapter interface changes:
  - CapabilityAdapter.execute() now takes optional serverContext
    carrying T0 personaId. Side-channel exists ONLY because the
    in-process adapter runs in the same Node process as the gateway.
    A future out-of-process sidecar adapter would receive undefined.
  - CapabilityWorkOrder JSON stays T0-free (compile-time canary still
    holds); serverContext is the explicit, audited exception.

Adapter implementation:
  - openclawAdapter.ts replaced in-file TOOL_HANDLERS table with
    openclawCore registry lookup via getTool().
  - Honours tool.needsServerContext — refuses to dispatch with
    'server-context-required' if a T0-needing tool is invoked from
    an adapter dispatch that didn't provide serverContext.
  - Defence-in-depth checks for approval_state + forbidden_actions
    kept; gateway is still the primary gate, adapter is the backstop.

Pipeline:
  - execute.ts now passes { personaId: input.persona.personaId } as
    serverContext when invoking the adapter. Receipt write path
    unchanged (T0 still only on the underlying activity_receipts row
    PK, never in capability-visible payload fields).

CLI worker convergence: still pending. clawhack-group-agents/run.ts
keeps its own MCPInvoker for now — converging it onto openclawCore is
a separate, worker-side session.

Operator action: set SERPER_API_KEY or TAVILY_API_KEY in Amplify env
to switch web-search from stub to real results. Neither is required —
stub fallback keeps the affordance live.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

services/capabilities/openclawCore/
  types.ts        — OpenClawTool / OpenClawToolHandler /
                    OpenClawToolResult / OpenClawToolServerContext.
                    Generic tool shape, T0-segregated.
  registry.ts     — module-scoped registerTool / getTool / listTools.
                    Re-registration throws in dev, overwrites silently
                    in prod so hot-reload doesn't crash.
  tools/echo.ts            — smoke test, returns input verbatim.
  tools/webSearch.ts       — REAL search via Serper (SERPER_API_KEY)
                             or Tavily (TAVILY_API_KEY), stub fallback
                             when neither is configured. 8s timeout,
                             provider failure → stub so the affordance
                             never dead-ends.
  tools/ownedContentScan.ts — REAL via getOwnedAssetIds(personaId,
                              series). Returns capped count summary +
                              sampled ids (max 20 each) to keep receipts
                              small.
  index.ts        — barrel; side-effect imports register all tools.

Adapter interface changes:
  - CapabilityAdapter.execute() now takes optional serverContext
    carrying T0 personaId. Side-channel exists ONLY because the
    in-process adapter runs in the same Node process as the gateway.
    A future out-of-process sidecar adapter would receive undefined.
  - CapabilityWorkOrder JSON stays T0-free (compile-time canary still
    holds); serverContext is the explicit, audited exception.

Adapter implementation:
  - openclawAdapter.ts replaced in-file TOOL_HANDLERS table with
    openclawCore registry lookup via getTool().
  - Honours tool.needsServerContext — refuses to dispatch with
    'server-context-required' if a T0-needing tool is invoked from
    an adapter dispatch that didn't provide serverContext.
  - Defence-in-depth checks for approval_state + forbidden_actions
    kept; gateway is still the primary gate, adapter is the backstop.

Pipeline:
  - execute.ts now passes { personaId: input.persona.personaId } as
    serverContext when invoking the adapter. Receipt write path
    unchanged (T0 still only on the underlying activity_receipts row
    PK, never in capability-visible payload fields).

CLI worker convergence: still pending. clawhack-group-agents/run.ts
keeps its own MCPInvoker for now — converging it onto openclawCore is
a separate, worker-side session.

Operator action: set SERPER_API_KEY or TAVILY_API_KEY in Amplify env
to switch web-search from stub to real results. Neither is required —
stub fallback keeps the affordance live.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `services/capabilities/adapters/openclawAdapter.ts` |
| Modified | `services/capabilities/adapters/types.ts` |
| Modified | `services/capabilities/execute.ts` |
| Added | `services/capabilities/openclawCore/index.ts` |
| Added | `services/capabilities/openclawCore/registry.ts` |
| Added | `services/capabilities/openclawCore/tools/echo.ts` |
| Added | `services/capabilities/openclawCore/tools/ownedContentScan.ts` |
| Added | `services/capabilities/openclawCore/tools/webSearch.ts` |
| Added | `services/capabilities/openclawCore/types.ts` |

## Stats

 10 files changed, 418 insertions(+), 77 deletions(-)
