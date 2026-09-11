# Capability Gateway — Patterns B & C backlog

**Date:** 2026-05-25
**Workstream:** Universal Capability Gateway (OpenClaw integration)
**Status:** Reserved — do NOT implement until Phase 1/2 lands and stabilises

This document is a forward placeholder. Patterns A, B, and C were all
agreed in the original integration plan, but only Pattern A is being
built first. B and C are explicitly deferred so the foundation can
prove out under real traffic before action-execution and multi-step
planning add their own failure modes.

The neutral Capability Gateway (`services/capabilities/`) was designed
to support all three patterns from day one — adding B or C is purely
additive at the gateway. No entry-point churn is needed.

---

## Pattern A — Pre-flight tool gather (IN PROGRESS)

Recap (already wired in Phase 1):

```
ask-agent
  → getActivePersona
  → buildPolicyEnvelope
  → capabilityGateway.issueCapabilityWorkOrder({
      capability_intent: 'tool_gather',
      capability_class:  'read' | 'search',
      ...
    })
  → adapter executes (Phase 2: OpenClaw)
  → enrich SpecialistContext
  → askSpecialist (existing path)
```

Acceptance for Pattern A is tracked separately under the Phase 1/2
spec; this document only records what is deferred.

---

## Pattern B — Post-reply tool action (DEFERRED)

### What it does
After a specialist composes a reply that includes a *suggested action*
(send this email, post this calendar invite, file this registry
update), the Capability Gateway executes the action under the same
policy regime — with second-tier approval surfaced via the existing
`SecondTierApprovalCard` UI when required.

### Target call shape
```
askSpecialist
  → SpecialistResponse.suggestedArtifacts[i]  (existing)
  → capabilityGateway.issueCapabilityWorkOrder({
      capability_intent: 'tool_execute',
      capability_class:  'send' | 'write' | 'payment',
      tool_name:         <connector id, e.g. 'gmail.send'>,
      input:             <artifact payload>,
      ...
    })
  → if approval_state === 'pending' → SecondTierApprovalCard
  → adapter executes
  → recordCapabilityReceipt({ status: 'success' | 'failure', artifactsCreated })
  → return artifact to UI
```

### Prereqs before B can be implemented
1. **Phase 1/2 of Pattern A** is in production and the gateway has
   logged at least one week of `tool_gather` work orders without
   policy violations (T0 leak canary clean, deny reasons distribution
   matches expectations).
2. **OpenClaw adapter** (Phase 2 of A) is the shared execution
   substrate — Pattern B reuses the same adapter, no new substrate.
3. **`mcpInvoker` extract-and-share** from `clawhack-group-agents/`
   into a shared library is complete; B-class tools (gmail.send,
   calendar.invite) are registered via the same MCP registry.
4. **Approval queue** — the existing `SecondTierApprovalCard` is the
   UI; backend needs a small persistence layer that holds
   `pending`-state work orders until the user approves or cancels.
   New table: `capability_pending_approvals`.

### Gateway changes when B lands
- Allow `capability_intent: 'tool_execute'` in
  `issueCapabilityWorkOrder` (today it returns
  `capability-intent-not-yet-wired`).
- Add `approval_state: 'pending'` → SecondTierApprovalCard wiring on
  the calling specialist's surface.
- Add `POST /api/capabilities/approve` and `POST
  /api/capabilities/cancel` routes that resume / reject a pending
  work order by `workOrderId`.
- Extend `recordCapabilityReceipt` to handle `'failure'` and
  `'denied'` outcomes (today only `'success'` and `'pending_approval'`
  are exercised).

### Open questions for when B is greenlit
- Should approval queue rows be one-per-action or one-per-batch (a
  reply that suggests three actions)?
- How does Pattern B interact with Marketa's existing approval
  channel (Marketa already mediates campaign sends)? Likely:
  Marketa-routed actions skip the SecondTierApprovalCard since
  Marketa is the approval surface.
- Q¢ debit semantics — does the user pay per executed action, per
  approved batch, or as part of the parent specialist consultation?
- Failure-mode UX — what does the user see when an approved Pattern
  B action fails mid-execution (gmail outage, third-party 5xx)?

---

## Pattern C — Multi-step plan (DEFERRED FURTHER)

### What it does
aigentMe builds an NBE plan with multiple steps (research → draft →
review → publish). The Capability Gateway runs the plan end-to-end —
streaming each step's result back to the UI, pausing for approvals
between steps when policy demands, recording one receipt per step.

### Target call shape
```
/api/assistant/plan-execute
  → capabilityGateway.createPlan({
      planId,
      persona, envelope,
      steps: [
        { intent: 'tool_gather',  class: 'search', tool_name: 'web-search',  input: {...} },
        { intent: 'tool_gather',  class: 'read',   tool_name: 'registry',    input: {...} },
        { intent: 'tool_execute', class: 'compose', tool_name: 'whisper-tts', input: {...} },
        { intent: 'tool_execute', class: 'send',    tool_name: 'gmail.send',  input: {...},
          requires_guardian_approval: true },
      ],
    })
  → capabilityGateway.runPlan(planId, { onStep: streamEvent })
  → SSE: step_started / step_completed / step_failed / step_pending_approval
  → one CapabilityWorkOrder per step, all share planId
  → one CapabilityReceipt per step, all linked via planId
```

### Prereqs before C can be implemented
1. **Pattern A and B both shipped** and stable in production.
2. **Streaming infra** — current Lambda routes are short-lived; SSE
   from `/api/assistant/plan-execute` either:
     a. Runs as edge-runtime route (Vercel Edge / Lambda@Edge);
        constraints around `crypto`, `setInterval`, etc. need a
        compatibility audit.
     b. OR Plan runner is the out-of-process OpenClaw sidecar from
        Option (b) of the Phase 1 runtime decision, and the API route
        is a thin SSE pump.
   The decision blocks C — re-open it when A/B have proven the
   capability volume.
3. **Plan persistence** — a `capability_plans` table holds the plan
   spec and step state so runs survive Lambda timeouts and can be
   resumed.
4. **Plan composer UI** — aigentMe needs a UI for showing the
   in-flight plan (per-step spinners, approval prompts, abort).
5. **Cancellation semantics** — what does cancelling a plan mid-flight
   mean? Refund of unconsumed Q¢? Rollback of any committed steps?

### Gateway changes when C lands
- Add `createPlan(input): { planId }` and
  `runPlan(planId, opts): AsyncGenerator<PlanEvent>` to the gateway.
- Allow `capability_intent: 'plan_step'` in
  `issueCapabilityWorkOrder` (gateway issues these internally as it
  walks the plan).
- Extend `recordCapabilityReceipt` to accept a `planId` foreign key
  so the receipts viewer can group plan steps together.
- Add `POST /api/capabilities/plan/:planId/cancel` route.

### Open questions for when C is greenlit
- Where does the plan-spec live for replay / audit — DVN anchor of
  the plan hash, or just the receipt linkage?
- Step parallelism — does the gateway run independent steps
  concurrently (with policy-aware throttling) or strictly serially?
- Mid-plan policy change — if the persona's `Identifiability` drops
  during a long-running plan, do remaining steps abort or downgrade?

---

## Cross-cutting principles (apply to both B and C)

1. **One gateway entry point.** Patterns A, B, C all flow through
   `issueCapabilityWorkOrder`. No pattern gets a bespoke service.
2. **One receipt spine.** Every step of every plan emits via
   `recordCapabilityReceipt` (composed over `activityReceiptService`).
   No parallel write paths.
3. **T0 stops at the gateway.** Patterns B and C MUST NOT relax the
   compile-time `_AssertNoT0<T>` canary. Adapters never receive
   `personaId`, `authProfileId`, `rootDid`.
4. **Approval is policy, not pattern.** Pattern A can also surface
   approvals if a `tool_gather` happens to touch a sovereign-class
   surface. The SecondTierApprovalCard is shared.
5. **The CLI worker stays.** OpenClaw's standalone XMTP/Discord
   worker (`clawhack-group-agents/`) continues to run for group-chat
   coordination. The capability gateway uses the same shared
   `mcpInvoker` library extracted in Phase 2 of A, not a separate
   tool registry.

---

## Status board

| Pattern | Phase | Status | Blocked on |
|---|---|---|---|
| A — Pre-flight gather | 1 (types + gateway) | ✅ Shipped | — |
| A — Pre-flight gather | 2 (OpenClaw adapter + first wiring) | 🚧 In progress | Phase 1 stabilises |
| B — Post-reply action | — | ⏸ Backlog | Pattern A in prod ≥ 1 week clean |
| C — Multi-step plan | — | ⏸ Backlog (deferred further) | Patterns A + B both shipped |

When opening the B or C ticket, link this document and mark it
**"Re-validate prereqs before scoping"** — the platform will have
moved by then and several open questions above may have answered
themselves.
