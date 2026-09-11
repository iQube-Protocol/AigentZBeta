# DVN Finality Transition Matrix — Horizen Pilot Closure Item 6

**Date:** 2026-08-09
**Status:** Analysis + recommendations. No journey-stage gating logic changed in this pass.

## The instruction this answers

> The canonical hierarchy remains: Created < DVN Pending < DVN Minted < BTC Anchored. DVN Minted is
> the normal operational finality threshold wherever DVN finality is actually required. BTC
> Anchored is stronger external finality and must be required only explicitly. The audit
> established that the current journey gates on evidence EXISTENCE rather than DVN STATE. Do not
> mechanically change every journey stage to wait for DVN Minted. Produce a transition matrix, and
> only introduce a Minted gate where the semantics clearly require the downstream stage to consume
> finalized DVN evidence.

## What "DVN Minted" / "BTC Anchored" actually are in this codebase

- `dvn_recorded` is the raw `activity_receipts.receipt_status` value the finalizer
  (`finalizeReadyActivityReceipts`, `services/dvn/activityReceiptDvnPipeline.ts`) sets once the DVN
  canister's `get_ready_messages()` confirms the message. **"DVN Minted" is a UI label for this same
  state** (`components/metame/cards/ActivityReceiptCard.tsx`) — not a different state.
- `pos_status` (`activity_receipts.pos_status`) is the **separate, independent** Bitcoin
  anchoring leg. `POS_LEG_SUBMISSION_ENABLED = false` platform-wide today — no receipt can reach
  `anchored` regardless of its DVN state, and the deployed PoS/PSBT canisters were found to
  synthesize mock txids rather than perform real anchoring. **BTC Anchored is therefore already
  fully non-blocking everywhere** — there is nothing to loosen.

Hierarchy confirmed: `local → dvn_pending → dvn_recorded ("DVN Minted") → anchored ("BTC
Anchored")`, exactly as stated. Item 1 of this same closure pass (the registration reconciler) and
the earlier `activity-receipts-finalizer.yml` workflow are what make `dvn_pending → dvn_recorded`
a bounded wait (≤10 min / ≤5 min respectively) rather than an indefinite one — a precondition for
any stage to responsibly gate on it at all.

## The matrix

Every completion check below currently reads **evidence existence** — a receipt row, or a
canonical-record row (`registry_assets`, `delegation_grants`, `agent_root_identity`,
`constitutional_agreements`) — never `receipt_status`. Source: `app/api/journey/moneypenny-horizen/state/route.ts`
(`resolveState`), cross-checked against `services/journey/agentAdmissionState.ts`.

| Stage completion | Current evidence requirement | Source of truth | Should require DVN Minted now? | Reason |
|---|---|---|---|---|
| **Claim** (`controlProofFresh`) | `hasReceipt('agent_control_proven')` | The receipt itself — a fresh signature verification | **No** | Control proof is true the instant the signature verifies. DVN anchoring is the audit trail *of* that fact, not the fact itself; gating on Minted would add anchoring latency to a synchronous act for no correctness gain. |
| **Passport** (`sponsorBinding`, `delegatePassportIssued`) | `agent_sponsorship_recorded` row OR receipt; `passport_issued`/`agent_delegate_passport_issued` row OR receipt | `agent_root_identity` row (canonical), receipt is corroboration | **No** | The canonical half already reads the governed DB row written by the sponsorship/issuance route, not the receipt. That row *is* the authority; DVN anchoring is provenance on top of an already-true fact. |
| **Delegate** (`delegatePassportActive`, `boundedDelegationActive`) | `delegation_grants.status='active'` row OR receipt | `delegation_grants` row (canonical) | **No** | Same shape as Passport — the grant row is the authority. |
| **aigentMe** (`aigentMeActive`, `focusDispositionRecorded`) | `hasReceipt('aigentme_activated')`, `hasReceipt('experienceqube_focus_disposition_recorded')` | The receipts themselves — an operator disposition act | **No** | A disposition the operator explicitly recorded is true when recorded, not when anchored. |
| **Ratify** (`agreementReceiptsAnchored`) | `!!ratifyAgreement.formedReceiptId && !!ratifyAgreement.authorizedReceiptId` — checks only that an **id string** is stored on the `constitutional_agreements` row; never re-reads `activity_receipts.receipt_status` for those ids | `constitutional_agreements` row, field literally named `...Anchored` | **Naming defect, flagged — not fixed in this pass** | The field's own name promises anchoring; the code checks id-presence only. This is the one place in the matrix where "evidence existence" is being *represented* as "anchored" when it structurally is not. Recommend: either rename the field to reflect what it actually checks, or wire a real `receipt_status === 'dvn_recorded'` check for both ids — deferred to the Chrysalis DVN Spine fast-follow (event-driven finality propagation is that workstream's stated scope, not this pilot-closure pass's). |
| **Deploy** / "Ingest into Factory" (`factoryIngested`) | `registry_assets` row exists OR `hasReceipt('capability_registered')` | `registry_assets` row (canonical) | **No** | Registry presence is a database fact (the row exists or it doesn't); the receipt is corroboration, same shape as Passport/Delegate. |
| **Standing** (`standingGatewayEnabled`) | `hasReceipt('standing_accrued')` — any receipt of that type, regardless of `receipt_status` | The receipt itself | **Candidate for a future pass, not this one** | Standing is the most consequential state in this ladder (participation/reputation weight) and, per `CI-2026-08-03-ELIGIBILITY-IS-NOT-ACCRUAL-001`, the receipt *is* the accrual event — there is no separate canonical row underneath it the way Passport/Delegate/Deploy have. That makes it the one stage where "has this genuinely been recorded, tamper-evidently" is a meaningful question DVN Minted could answer. Now that item 1's registration reconciler establishes the pattern for bounding a `dvn_pending` wait, gating Standing on `dvn_recorded` is *feasible* without indefinite staleness risk — but it is a real behavior change (a freshly-awarded seed would show "pending" for up to ~5 minutes) that deserves its own decision, not a decision folded into this closure pass. |

## Why nothing here was changed mechanically

Six of the seven checks resolve to a **canonical DB row** or a **synchronous sovereign act** as
their real source of truth — the receipt is corroboration/audit trail, not the fact. Gating any of
those on `dvn_recorded` would add real latency (anchoring is asynchronous, batched every 5–10
minutes) to acts that are already true the moment they're performed, for no correctness benefit —
exactly the "mechanical" over-application the operator's instruction warned against.

The two genuine candidates — Ratify's naming mismatch and Standing's evidence-is-the-fact
shape — are named explicitly above rather than fixed here, because:

1. Ratify's fix is a naming/semantics correction that belongs with whoever owns the Constitutional
   Agreement lifecycle's next revision, not a silent rename inside a closure pass about a different
   pilot.
2. Standing's fix is a genuine behavior change (a visible delay before a fresh award reads as
   accrued) that the operator should decide on its own merits, with the reconciliation pattern from
   item 1 as the enabling precedent — not bundled into "closure."

## What this pass DID change (for context — see the other item docs)

- Item 1 (`services/horizen/registrationReconciliation.ts`): gave `dvn_pending → dvn_recorded` a
  bounded wait for Horizen registration confirmation specifically (not the journey-stage gates
  above) — the precondition that makes gating Standing on Minted *responsible* in a future pass.
- Item 4 (`services/horizen/pnlVerificationBoundary.ts`): P&L verification is intentionally the
  opposite shape — an independent, asynchronous, non-gating signal by the operator's own ratified
  rule (`RES-2026-08-08-PNL-INDEPENDENT-EVIDENCE-001`). It is not part of this matrix because it
  gates no journey stage at all, by design.

## Reading

- Standing seed production wiring (item 2 of this closure pass): resolution record
  `codexes/packs/agentiq/resolution-records/records/RES-2026-08-09-STANDING-SEED-PRODUCTION-WIRING-001.json`.
- Repo file path for this document: `codexes/packs/agentiq/updates/2026-08-09_dvn-finality-transition-matrix.md`
