# Commit Brief: `d2bb41f` — capability gateway phase 2a — adapter pattern, openclaw shim, kn0w1 wiring

| Field | Value |
|-------|-------|
| SHA | [`d2bb41f`](https://github.com/iQube-Protocol/AigentZBeta/commit/d2bb41ffd66b16c8f519e671480c63d555679a13) |
| Author | Claude |
| Date | 2026-05-24T09:04:38Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
capability gateway phase 2a — adapter pattern, openclaw shim, kn0w1 wiring

Lands the executable slice of the Universal Capability Gateway:

  services/capabilities/adapters/
    types.ts            — CapabilityAdapter interface, AdapterResult.
                          Adapters receive CapabilityWorkOrder only —
                          no ActivePersonaContext, no PolicyEnvelope,
                          no T0 surface (Phase 1 invariants hold).
    openclawAdapter.ts  — minimal phase-2 adapter with three Pattern A
                          tools: echo, web-search (stub), and
                          owned-content-scan (stub). Adapter re-checks
                          forbidden_actions + approval_state for
                          defence-in-depth against gateway bypass.
    registry.ts         — getAdapter(id) dispatch; one-line add for
                          future adapters.
  services/capabilities/execute.ts
                        — executeCapability(): single function that
                          issues the work order, dispatches to the
                          adapter, and records one receipt. Pending-
                          approval state short-circuits without
                          adapter dispatch and still emits a receipt.
  app/api/capabilities/invoke/route.ts
                        — POST /api/capabilities/invoke smoke endpoint.
                          Builds PolicyEnvelope server-side (T0 stays
                          here), runs through executeCapability, and
                          returns workOrder + adapterResult + receiptId
                          with no T0 leaking into the response.

First specialist hitting the gateway:
  app/api/assistant/ask-agent/route.ts
                        — Gated behind CAPABILITY_GATEWAY_PREFLIGHT
                          env flag and limited to specialistId 'kn0w1'.
                          When enabled, runs Pattern A pre-flight
                          web-search using intentName as the query,
                          and prepends the result summary to
                          intentRationale. Best-effort: any gateway
                          deny / adapter failure / throw falls through
                          silently — gather enriches, never blocks.

Patterns B and C continue to be rejected at the gateway with
capability-intent-not-yet-wired per the B/C backlog doc.

Phase 2b (next session) will do the true extract-and-share of
clawhack-group-agents/openclaw-wrapper/mcpInvoker.ts into a shared
core so the CLI worker and the new adapter run the same tool loop.
The current adapter has a small in-file tool table flagged with
explicit phase-2b TODOs so the drift is visible.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Lands the executable slice of the Universal Capability Gateway:

  services/capabilities/adapters/
    types.ts            — CapabilityAdapter interface, AdapterResult.
                          Adapters receive CapabilityWorkOrder only —
                          no ActivePersonaContext, no PolicyEnvelope,
                          no T0 surface (Phase 1 invariants hold).
    openclawAdapter.ts  — minimal phase-2 adapter with three Pattern A
                          tools: echo, web-search (stub), and
                          owned-content-scan (stub). Adapter re-checks
                          forbidden_actions + approval_state for
                          defence-in-depth against gateway bypass.
    registry.ts         — getAdapter(id) dispatch; one-line add for
                          future adapters.
  services/capabilities/execute.ts
                        — executeCapability(): single function that
                          issues the work order, dispatches to the
                          adapter, and records one receipt. Pending-
                          approval state short-circuits without
                          adapter dispatch and still emits a receipt.
  app/api/capabilities/invoke/route.ts
                        — POST /api/capabilities/invoke smoke endpoint.
                          Builds PolicyEnvelope server-side (T0 stays
                          here), runs through executeCapability, and
                          returns workOrder + adapterResult + receiptId
                          with no T0 leaking into the response.

First specialist hitting the gateway:
  app/api/assistant/ask-agent/route.ts
                        — Gated behind CAPABILITY_GATEWAY_PREFLIGHT
                          env flag and limited to specialistId 'kn0w1'.
                          When enabled, runs Pattern A pre-flight
                          web-search using intentName as the query,
                          and prepends the result summary to
                          intentRationale. Best-effort: any gateway
                          deny / adapter failure / throw falls through
                          silently — gather enriches, never blocks.

Patterns B and C continue to be rejected at the gateway with
capability-intent-not-yet-wired per the B/C backlog doc.

Phase 2b (next session) will do the true extract-and-share of
clawhack-group-agents/openclaw-wrapper/mcpInvoker.ts into a shared
core so the CLI worker and the new adapter run the same tool loop.
The current adapter has a small in-file tool table flagged with
explicit phase-2b TODOs so the drift is visible.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/assistant/ask-agent/route.ts` |
| Added | `app/api/capabilities/invoke/route.ts` |
| Added | `services/capabilities/adapters/openclawAdapter.ts` |
| Added | `services/capabilities/adapters/registry.ts` |
| Added | `services/capabilities/adapters/types.ts` |
| Added | `services/capabilities/execute.ts` |

## Stats

 7 files changed, 518 insertions(+), 2 deletions(-)
