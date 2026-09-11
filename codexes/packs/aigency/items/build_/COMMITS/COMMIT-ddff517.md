# Commit Brief: `ddff517` — capability gateway — add CapabilityIntent axis + log B/C backlog

| Field | Value |
|-------|-------|
| SHA | [`ddff517`](https://github.com/iQube-Protocol/AigentZBeta/commit/ddff517c77f1cc59efe42aaf604ad3e23d441dbf) |
| Author | Claude |
| Date | 2026-05-24T08:56:28Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
capability gateway — add CapabilityIntent axis + log B/C backlog

Types:
  - Add CapabilityIntent = 'tool_gather' | 'tool_execute' | 'plan_step'
    as an orthogonal axis to CapabilityClass. Pattern A / B / C live
    behind the same gateway entry point — no new service per pattern.
  - CapabilityWorkOrder.capability_intent is required so adapters can
    branch on intent without re-inspecting the calling surface.

Gateway:
  - issueCapabilityWorkOrder accepts capability_intent (defaults to
    'tool_gather' for backwards compat with Phase 1 callers).
  - Rejects 'tool_execute' and 'plan_step' with
    capability-intent-not-yet-wired so any code path that tries to
    invoke Pattern B or C before its wiring lands fails loudly with
    a deterministic reason.

Backlog doc:
  - codexes/packs/agentiq/updates/2026-05-25_capability-gateway-
    patterns-b-c-backlog.md spells out the full target call shape,
    prereqs, gateway changes needed when each pattern lands, and
    cross-cutting principles (one entry point, one receipt spine,
    T0 stops at the gateway, CLI worker stays).
  - Registered in agentiq/collections.json col_updates so it surfaces
    in the AgentiQ cartridge Updates tab.

No Pattern B or C wiring shipped; the gateway will reject those
intents until the dedicated tickets open.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Types:
  - Add CapabilityIntent = 'tool_gather' | 'tool_execute' | 'plan_step'
    as an orthogonal axis to CapabilityClass. Pattern A / B / C live
    behind the same gateway entry point — no new service per pattern.
  - CapabilityWorkOrder.capability_intent is required so adapters can
    branch on intent without re-inspecting the calling surface.

Gateway:
  - issueCapabilityWorkOrder accepts capability_intent (defaults to
    'tool_gather' for backwards compat with Phase 1 callers).
  - Rejects 'tool_execute' and 'plan_step' with
    capability-intent-not-yet-wired so any code path that tries to
    invoke Pattern B or C before its wiring lands fails loudly with
    a deterministic reason.

Backlog doc:
  - codexes/packs/agentiq/updates/2026-05-25_capability-gateway-
    patterns-b-c-backlog.md spells out the full target call shape,
    prereqs, gateway changes needed when each pattern lands, and
    cross-cutting principles (one entry point, one receipt spine,
    T0 stops at the gateway, CLI worker stays).
  - Registered in agentiq/collections.json col_updates so it surfaces
    in the AgentiQ cartridge Updates tab.

No Pattern B or C wiring shipped; the gateway will reject those
intents until the dedicated tickets open.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-05-25_capability-gateway-patterns-b-c-backlog.md` |
| Modified | `services/capabilities/gateway.ts` |
| Modified | `services/capabilities/types.ts` |

## Stats

 5 files changed, 269 insertions(+), 3 deletions(-)
