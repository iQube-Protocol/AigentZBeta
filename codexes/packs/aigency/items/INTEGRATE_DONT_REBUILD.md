# Directive: Integrate, Don't Rebuild (AgentiQ MVP Rule)

## Why this exists
AgentiQ already has multiple pockets of progress across the stack (SmartTriad, Smart Content, Liquid UI, DVN, Qc, AA API, DiDQube, iQube Registry patterns, etc.).
The MVP goal is to consolidate these into one complete working system, not to re-implement parallel versions of the same capability.

This directive applies to both development agents (Windsurf Cascade + OpenAI Codex in Windsurf).

---

## Core Rule
Default action is integration. Rebuilding is a last resort.

Before creating a new module/flow/system, the agent must:
1) Locate existing implementation(s)
2) Integrate or extend them
3) Only rebuild if the existing solution is provably unusable for MVP

---

## Required Process (every meaningful change)

### Step 1 -- "Existing Work First" Check
For any task, start with:
- What already exists in the repo?
- Which module already solves 60-80% of this?
- Can we extend it with minimal surface area change?

Output: 3-10 lines in the PR/receipt: "Existing work found -> chosen integration path -> files touched."

### Step 2 -- Minimal Extension over Replacement
- Prefer adapters, wrappers, and thin integration layers
- Prefer adding missing hooks (events, receipts, schema validation) over duplicating core logic
- Keep old code path behind a feature flag only if needed

### Step 3 -- Integration Receipt
Every integration must emit a receipt entry:
- what components were connected
- what was reused
- what was added
- what was explicitly NOT changed

---

## Allowed reasons to rebuild (must be stated explicitly)
Rebuild is allowed only if one or more are true:
1) No existing implementation exists
2) Existing code is irreparably incompatible with tenant/RBAC/security invariants
3) The existing module is blocked by external dependency that cannot be resolved in MVP timeframe
4) The rebuild is strictly smaller than integration + refactor and has no duplication risk (rare)

If rebuilding, you must:
- document why integration failed
- document how the new module replaces old paths
- remove or deprecate the old path to avoid dual systems

---

## "No Duplicate Subsystems" Guardrail
Do not introduce parallel versions of:
- entitlements checks
- receipt creation
- wallet connect flows
- unlock/payment logic
- tenant scoping
- registry publishing
- A2A/QubeTalk routing

There should be one authoritative implementation per subsystem.

---

## Canonical Integration Targets (MVP)
When in doubt, integrate into these canonical anchors:
- Codex Runtime (Next.js app) as the anchor experience
- SmartWallet gates as the single enforcement point
- Receipt + provenance as the canonical audit trail
- AA API as the action interface (even if stubbed)
- DVN + DiDQube as the identity/trust backbone (use existing work; don't fork)

---

## Definition of Done (integration-complete)
A feature is not "done" until it:
- works end-to-end in the unified system
- respects tenant + RBAC
- uses the canonical wallet gating
- emits receipts
- updates provenance where applicable

---

## Enforcement (practical)
- PRs/merges must include an "Integrate, Don't Rebuild" note:
  - Reused: ...
  - Extended: ...
  - Rebuilt: (only if necessary) ... + justification
- If a PR adds a new subsystem, it is rejected unless it proves no canonical subsystem exists.
