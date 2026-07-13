# Receipt-System Reconciliation — AR Phase 1 design call (CFS-025)

**Status: DESIGN PLAN — operator sign-off required before any call-site migration.**
This document is a *plan*, not a runtime change. No `emitReceipt` call site is modified
by the AR Phase-1 skeleton. The operator ratified (CFS-025 v0.2, 2026-07-10) that the two
receipt systems be *reconciled* as part of the AR Phase-1 workstream — this is that plan.

---

## The two systems (audited 2026-07-10)

The platform has **two receipt writers** with different guarantees. AR must not silently
pick one; it standardises **new** production receipts on the unified path and lays out an
explicit, independently-verifiable migration for the existing ReceiptQube sites.

### System A — the unified, DVN-anchored writer (the target)

- **Writer:** `services/receipts/activityReceiptService.ts:createActivityReceipt`
- **Table:** `activity_receipts`
- **Anchoring:** on create, fire-and-forget enqueue to the **protected DVN pipeline**
  (`services/dvn/activityReceiptDvnPipeline.ts`) for any `actionType` in
  `ANCHORABLE_ACTION_TYPES`. State machine `local → dvn_pending → dvn_recorded / dvn_failed`.
- **Identity discipline:** takes a `personaId` (T0) it **never serialises**; the on-chain
  payload carries only a hashed persona ref (`hashPersonaRef`). T2-safe on the wire.
- **Already the IRL path:** `services/research/lifecycle.ts:writeLifecycleReceipt` →
  `createActivityReceipt` (`research_lifecycle_transition`). This is why IRL `research` is
  the AR Phase-2 pilot — zero new receipt plumbing.

### System B — the ReceiptQube emitter (a projection, no DVN)

- **Writer:** `services/registry/receiptEmitter.ts:emitReceipt` / `emitReceiptSilent`
  → `services/registry/persistence.ts:createReceipt`
- **Table:** `registry_receipts`
- **Anchoring:** **none.** The row has `dvn_message_id` / `dvn_submitted_at` columns but
  **nothing populates them** — there is no anchoring pipeline behind this writer. Receipts
  are content-hashed (`sha256` of the payload) but never land in tamper-evident memory.
- **Identity discipline:** takes a raw `actorId` string and writes it to `actor_id`
  **verbatim** — a T0-exposure risk that System A structurally avoids. Any migration MUST
  close this (commit the actor, do not store the raw id).
- **Event vocabulary:** `ReceiptEventType` (registry/ingestion lifecycle:
  `intake.created`, `asset.published`, `trust.assigned`, `review.approved`,
  `reward.granted`, …) — a *different* vocabulary from System A's `ActivityActionType`.

---

## The reconciliation decision (proposed)

**Do NOT rip out ReceiptQube.** It backs the registry-ingestion UI (per-intake / per-asset
receipt trails read via `listReceiptsByIntake` / `listReceiptsForAsset`) and the
`registry_receipts` table those reads depend on. Ripping it out is a large, cross-cutting
change with its own consequence surface.

**Instead — a two-part reconciliation:**

1. **AR constitutional receipts standardise on `createActivityReceipt` (System A).** Any
   receipt AR emits for a constitutional-tier publication rides the unified, DVN-anchored
   path. AR **never** calls `emitReceipt`. (Already true in
   `services/artifact/runArtifact.ts` — the `receipts` stage composes
   `createActivityReceipt`.)

2. **ReceiptQube becomes a PROJECTION of the unified path, via an adapter — not a second
   source of truth.** Rather than a risky big-bang rewrite of every emit site, introduce an
   adapter in `receiptEmitter.ts` that (a) writes the unified `activity_receipts` row
   (getting DVN anchoring + T0 discipline for free) and (b) continues to write the
   `registry_receipts` row **as a denormalised projection** so the registry UI keeps
   working unchanged. Emit sites keep calling `emitReceipt(...)`; the adapter routes to
   both. Once every read surface reads the unified table, the projection write can be
   dropped in a later, separately-ratified step.

This keeps every step **independently verifiable** and **reversible**, and it never leaves
the registry UI without its receipts.

---

## Prerequisite — a DVN action type for production receipts

System A only anchors `actionType`s present in `ANCHORABLE_ACTION_TYPES`
(`services/dvn/activityReceiptDvnPipeline.ts`). Constitutional artifact publications and the
migrated registry events need a home there.

- **Proposed new action type: `artifact_published`.**
  - Add to `ActivityActionType` (`services/receipts/activityReceiptService.ts`).
  - Add to `ANCHORABLE_ACTION_TYPES` (`services/dvn/activityReceiptDvnPipeline.ts`) — this
    is the **one permitted unilateral DVN edit** (CLAUDE.md; CFS-025 reuse guardrails). It
    is additive: no state-machine, payload, hashing, or canister change.
- **Interim (Phase 1, no protected-file edit):** `runArtifact.ts` writes the publication
  receipt with the existing in-union `artifact_created` type. That is truthful (an artifact
  was created) but is **not** in `ANCHORABLE_ACTION_TYPES`, so it stays `local`. Swapping to
  `artifact_published` (once added) is the single line that turns anchoring on.
- **For the migrated registry events** (see below), map each `ReceiptEventType` to an
  `ActivityActionType`. Most need **new** action types (e.g.
  `registry_asset_published`, `registry_trust_assigned`, `registry_review_decided`); adding
  each to `ANCHORABLE_ACTION_TYPES` is the same one-permitted-edit pattern, one type at a
  time. **This vocabulary mapping needs operator sign-off** — it decides which registry
  events become tamper-evident constitutional memory.

---

## Exact call sites that change (in dependency order, each independently verifiable)

Every site below currently calls `emitReceipt` / `emitReceiptSilent`. The migration order
is **adapter first, then callers are unchanged** (they inherit the projection behaviour), so
the "call-site change" is really "verify each site's receipt now also lands in
`activity_receipts` with the right action type + a committed actor." Order is chosen so each
step is observable before the next.

**Step 0 — adapter + action-type vocabulary (one change, gated on operator sign-off)**
- `services/dvn/activityReceiptDvnPipeline.ts` — add `artifact_published` (+ the mapped
  `registry_*` types) to `ANCHORABLE_ACTION_TYPES`. *(the one permitted DVN edit)*
- `services/receipts/activityReceiptService.ts` — add the same types to `ActivityActionType`.
- `services/registry/receiptEmitter.ts` — the adapter: write `activity_receipts` (unified)
  + keep the `registry_receipts` projection. Commit the `actorId` (no raw T0 write).

**Step 1 — the ingestion pipeline services (internal, lowest UI blast radius)**
Each verifiable by running one intake through the pipeline and confirming a matching
`activity_receipts` row appears with the mapped action type:
1. `services/registry/intakeService.ts:57` (`intake.created`)
2. `services/registry/fetcherService.ts:76` (`source.fetched`)
3. `services/registry/classifierService.ts:52` (`source.classified`)
4. `services/registry/packagerService.ts:140` (`asset.packaged`)
5. `services/registry/validatorService.ts:71,112` (`validation.started` / `.completed`)
6. `services/registry/trustScorerService.ts:100` (`trust.assigned`)
7. `services/registry/publisherService.ts:88,125` (`asset.published`, `asset.version.deprecated`)
8. `services/registry/invocationGateway.ts:115` (`asset.invoked`)

**Step 2 — the registry API routes (operator-visible receipt trails)**
9. `app/api/registry/receipts/route.ts:270` (manual receipt emit)
10. `app/api/registry/assets/[assetId]/reviews/route.ts:72,81` (`review.approved` / `.rejected`)

**Step 3 — cross-cartridge emit sites (each its own consequence surface)**
11. `services/rewards/rewardService.ts:372` (`reward.granted`, via `emitReceiptSilent`) —
    **operator sign-off:** reward receipts moving on-chain is a money-adjacent decision.
12. `app/api/marketa/activation/candidates/[id]/registry/route.ts:171` (candidate → AigentQube)
13. `app/api/codex/qriptopian/signal/route.ts:181` (Qriptopian signal)

**Explicitly OUT of scope (not the same concern — do NOT fold in):**
- `clawhack-group-agents/**` `emitReceipt` — a *different* `DVNReceipt` type in a separate
  subsystem (bridge adapters). Not the registry ReceiptQube. Leave untouched.
- `services/aa-api/**` `createReceipt` — the browser session-aggregate receipt; unrelated.

---

## What needs operator sign-off (flagged)

1. **The `ReceiptEventType → ActivityActionType` vocabulary map** — decides which registry
   events become DVN-anchored constitutional memory (Step 0). *Constitutional-memory scope
   decision, not a refactor.*
2. **Each `ANCHORABLE_ACTION_TYPES` addition** — additive and permitted, but each new type
   is a deliberate "this event is now tamper-evident" call.
3. **`reward.granted` anchoring** (Step 3.11) — money-adjacent; explicit approval.
4. **Retiring the `registry_receipts` projection write** — the eventual end state (drop the
   double-write once all reads move to `activity_receipts`) is a separate, later
   ratification. Phase 1 keeps the projection.

## Verification per step

- **Step 0:** unit — the adapter writes both rows; `activity_receipts.action_type` is the
  mapped type; `actor_id`/actor is a commitment, never a raw persona id. Canary mirrors
  `tests/registry-authority.test.ts` (which already asserts a source has no raw
  `emitReceipt(` — extend to assert the adapter path).
- **Steps 1–3:** integration — exercise each producing flow once, assert a paired
  `activity_receipts` row with the correct action type and a `dvn_pending`/`local` status
  consistent with whether its type is anchorable.
