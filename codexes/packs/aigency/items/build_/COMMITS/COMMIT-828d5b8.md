# Commit Brief: `828d5b8` — capability gateway phase 1 — types, policy compiler, gateway, receipt wrapper

| Field | Value |
|-------|-------|
| SHA | [`828d5b8`](https://github.com/iQube-Protocol/AigentZBeta/commit/828d5b8fa6f8bca76fd9203b02ca5129b68da572) |
| Author | Claude |
| Date | 2026-05-24T08:42:04Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
capability gateway phase 1 — types, policy compiler, gateway, receipt wrapper

Lands the first slice of the OpenClaw integration plan agreed in the
session:

  services/capabilities/
    types.ts                — CapabilityPolicyEnvelope + CapabilityWorkOrder
                              (T0-free sibling types, compile-time canary
                              that fails the build if T0 leaks in)
    policyCompiler.ts       — compileCapabilityPolicy() intersects
                              Identifiability × disclosure_class ×
                              surface × cartridge × tool_name and
                              produces a T0-free CapabilityPolicyEnvelope
                              with deterministic policyHash + T2
                              cohortAliasCommitment
    gateway.ts              — issueCapabilityWorkOrder() rejects requests
                              without persona or envelope, dispatches via
                              the compiler, and returns the T0-free
                              CapabilityWorkOrder. Adapters never see
                              PolicyEnvelope, ActivePersonaContext, or
                              any other T0 surface.
    receipts/capabilityReceiptService.ts
                            — recordCapabilityReceipt() composes over
                              activityReceiptService (one receipt spine,
                              one DVN write path). Capability metadata
                              packed into existing receipt slots so no
                              schema migration needed in phase 1.

Decisions implemented:
  1. T0 leak — sibling envelope, narrower change (no widening of
     existing PolicyEnvelope).
  2. Allowlist axis — Identifiability primary, disclosure_class
     intersecting secondary constraint. Not collapsed.
  3. OpenClaw runtime — types only in phase 1; extract-and-share
     of mcpInvoker / policy logic lands in phase 2 with the first
     adapter.
  4. Receipts — thin wrapper over activityReceiptService.

Explicit PRD ↔ repo terminology map exported as
prdToRepoIdentifiabilityMap so future contributors don't confuse
'identified' (PRD) with 'semi_identifiable' (repo).

Phase 1 acceptance:
  - TypeScript compiles (build verifies on Amplify)
  - Gateway rejects requests without persona context
  - Gateway rejects requests without policy envelope
  - CapabilityWorkOrder contains no T0 (compile-time canary)
  - Capability receipts contain no T0 in payload (T0 personaId
    stays only as the underlying activity_receipts.persona_id key)
  - Work orders keyed by UUID + T2 cohortAliasCommitment only
  - Policy compiled from Identifiability AND disclosure_class
  - No adapter wired
  - No MCP execution path exists yet

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Lands the first slice of the OpenClaw integration plan agreed in the
session:

  services/capabilities/
    types.ts                — CapabilityPolicyEnvelope + CapabilityWorkOrder
                              (T0-free sibling types, compile-time canary
                              that fails the build if T0 leaks in)
    policyCompiler.ts       — compileCapabilityPolicy() intersects
                              Identifiability × disclosure_class ×
                              surface × cartridge × tool_name and
                              produces a T0-free CapabilityPolicyEnvelope
                              with deterministic policyHash + T2
                              cohortAliasCommitment
    gateway.ts              — issueCapabilityWorkOrder() rejects requests
                              without persona or envelope, dispatches via
                              the compiler, and returns the T0-free
                              CapabilityWorkOrder. Adapters never see
                              PolicyEnvelope, ActivePersonaContext, or
                              any other T0 surface.
    receipts/capabilityReceiptService.ts
                            — recordCapabilityReceipt() composes over
                              activityReceiptService (one receipt spine,
                              one DVN write path). Capability metadata
                              packed into existing receipt slots so no
                              schema migration needed in phase 1.

Decisions implemented:
  1. T0 leak — sibling envelope, narrower change (no widening of
     existing PolicyEnvelope).
  2. Allowlist axis — Identifiability primary, disclosure_class
     intersecting secondary constraint. Not collapsed.
  3. OpenClaw runtime — types only in phase 1; extract-and-share
     of mcpInvoker / policy logic lands in phase 2 with the first
     adapter.
  4. Receipts — thin wrapper over activityReceiptService.

Explicit PRD ↔ repo terminology map exported as
prdToRepoIdentifiabilityMap so future contributors don't confuse
'identified' (PRD) with 'semi_identifiable' (repo).

Phase 1 acceptance:
  - TypeScript compiles (build verifies on Amplify)
  - Gateway rejects requests without persona context
  - Gateway rejects requests without policy envelope
  - CapabilityWorkOrder contains no T0 (compile-time canary)
  - Capability receipts contain no T0 in payload (T0 personaId
    stays only as the underlying activity_receipts.persona_id key)
  - Work orders keyed by UUID + T2 cohortAliasCommitment only
  - Policy compiled from Identifiability AND disclosure_class
  - No adapter wired
  - No MCP execution path exists yet

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Added | `services/capabilities/gateway.ts` |
| Added | `services/capabilities/policyCompiler.ts` |
| Added | `services/capabilities/receipts/capabilityReceiptService.ts` |
| Added | `services/capabilities/types.ts` |

## Stats

 5 files changed, 659 insertions(+), 1 deletion(-)
