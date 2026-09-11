# DVN-anchor the shadow→authoritative flip (CFS-035 §11)

**Date:** 2026-07-18
**Branch:** `claude/agentiq-onboarding-docs-jrbeha`

The operator-gated flip (Invariant Decision Node shadow↔authoritative) now lands
in tamper-evident memory — a chain-of-provenance for the ratification act.

## What changed

- **New action type `invariant_node_flipped`** added to:
  - `services/receipts/activityReceiptService.ts` — the `ActivityActionType` union.
  - `services/dvn/activityReceiptDvnPipeline.ts` — `ANCHORABLE_ACTION_TYPES`. This
    is the **only permitted unilateral change** to the DVN pipeline (adding an
    action type); no state machine, payload shape, hashing, or finalizer logic was
    touched. The change is operator-approved.
- **`/api/invariants/flip` POST** — on a successful flip, emits an activity receipt
  via the unified `createActivityReceipt`. `createActivityReceipt` auto-enqueues the
  DVN anchor for anchorable types, so the receipt flows `local → dvn_pending →
  dvn_recorded` through the existing pipeline (with its standard `[DVN ESCALATION]`
  failure path untouched).

## T2 / privacy discipline

- The receipt **summary** carries only T2-safe content: the node id (a public
  identifier like `discovery.ranking`), the new state (AUTHORITATIVE/shadow), and a
  **sha256 commitment** of the flip act (`nodeId : state : flippedAt : rationale`).
- No raw `personaId` reaches the receipt payload — the DVN pipeline hashes the
  persona via its existing `hashPersonaRef` (unmodified).
- Emission is **best-effort**: the flip state is already persisted before the
  receipt is attempted, so a receipt/anchor failure never fails the flip.

## Result

Every shadow→authoritative ratification (and every revert) is now an anchored,
tamper-evident record — the constitutional provenance the flip's consequence
warrants, consistent with the invariant-lifecycle anchors already in the set
(`invariant_validated` / `invariant_canonized` / `invariant_superseded`).
