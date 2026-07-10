/**
 * ReceiptEmitter — emits immutable ReceiptQube records for all factory state transitions.
 *
 * Every critical event in the ingestion pipeline emits a receipt. This is the
 * AgentiQ-native equivalent of DVN / PoState evidence anchoring.
 *
 * ── CFS-025 receipt-system reconciliation (the ADAPTER, ratified 2026-07-10) ──
 * Historically this writer (System B, `registry_receipts`) had NO anchoring and
 * wrote a RAW actorId (a T0-exposure risk). The reconciliation makes every
 * ReceiptQube ALSO a projection of the unified, DVN-eligible trail (System A,
 * `activity_receipts` via `createActivityReceipt`) — a best-effort DOUBLE-WRITE:
 *
 *   1. ReceiptQube keeps writing its `registry_receipts` row EXACTLY as before —
 *      the ~15 emit call sites are UNCHANGED and the registry-ingestion UI that
 *      reads `registry_receipts` keeps working.
 *   2. In addition, a mapped `activity_receipts` row is written so the event
 *      joins the unified trail. The actorId is COMMITTED (one-way hash) into the
 *      unified `persona_id`, never written raw.
 *
 * The raw actorId is ALSO committed on the `registry_receipts` write itself (not
 * only the projection) — some call sites pass a raw personaId (T0), and no
 * consumer matches or displays `actor_id`, so committing it fully closes System
 * B's raw-actor exposure with zero read-side breakage.
 *
 * CRITICAL SAFETY — money-adjacent events stay OFF-CHAIN. The event→action map
 * routes `reward.granted` / `participation.metered` to a NON-anchorable action
 * type, and the ONLY event mapped to the anchorable `artifact_published` is the
 * genuine constitutional publication (`asset.published`). Everything else maps
 * to a non-anchorable type, so the double-write never silently anchors money or
 * high-volume pipeline noise. See services/artifact/receiptReconciliation.md.
 *
 * The unified write is FAILURE-ISOLATED: it is fire-and-forget and wrapped in
 * try/catch so a throw in the projection can NEVER break the ReceiptQube emit.
 * The call-site migration (dropping the raw-actor projection, moving reads to
 * the unified table) is a separate, later, operator-ratified step — NOT this pass.
 */

import { createHash } from "crypto";
import { createReceipt } from "./persistence";
import { ReceiptEventType, ReceiptQube } from "@/types/registryIngestion";
import { createActivityReceipt, type ActivityActionType } from "@/services/receipts/activityReceiptService";

/**
 * The documented ReceiptEventType → ActivityActionType map (CFS-025).
 *
 * ANCHORABILITY (cross-check `ANCHORABLE_ACTION_TYPES` in
 * services/dvn/activityReceiptDvnPipeline.ts):
 *   - `artifact_published` is ANCHORABLE — used for the ONE genuine
 *     constitutional publication event, `asset.published`.
 *   - `artifact_created` and `knowledge_curated` are NON-anchorable — every
 *     other event (incl. the money-adjacent ones) maps here so the projection
 *     stays local / off-chain.
 *
 * MONEY-ADJACENT (MUST be non-anchorable — flagged for operator audit):
 *   - `reward.granted`        → `knowledge_curated`  (non-anchorable) ✔
 *   - `participation.metered` → `knowledge_curated`  (non-anchorable) ✔
 * These are deliberately NOT mapped to any anchorable type; anchoring money
 * events is a separate, explicitly-gated decision (receiptReconciliation.md §3).
 *
 * Where no exact ActivityActionType exists (most ingestion-pipeline events), the
 * closest NON-anchorable existing type is used (`artifact_created` for
 * create/produce/lifecycle events; `knowledge_curated` for judgement/metering
 * events) rather than inventing an anchorable type — adding new anchorable types
 * needs its own operator sign-off (one type at a time).
 */
export const RECEIPT_EVENT_TO_ACTIVITY_ACTION: Record<ReceiptEventType, ActivityActionType> = {
  // ── Registry / ingestion factory events ──────────────────────────────────
  "intake.created": "artifact_created", // an intake record was created — non-anchorable
  "source.fetched": "artifact_created", // source content produced — non-anchorable
  "source.classified": "artifact_created", // classification produced — non-anchorable
  "asset.packaged": "artifact_created", // asset package produced — non-anchorable
  "validation.started": "artifact_created", // non-anchorable (do NOT auto-anchor validation)
  "validation.completed": "artifact_created", // non-anchorable (sign-off pending for anchoring)
  "trust.assigned": "knowledge_curated", // a trust judgement — non-anchorable
  "review.approved": "artifact_created", // reviews stay off-chain by default (sign-off pending)
  "review.rejected": "artifact_created", // non-anchorable
  // The genuine constitutional publication. Kept NON-anchorable BY DEFAULT: the
  // reconciliation unifies the trail, but turning on DVN anchoring for every
  // registry publication is a deliberate on-chain-volume decision (DVN is
  // protected infra). To opt in, flip this to `artifact_published` (already in
  // ANCHORABLE_ACTION_TYPES). The AR pilot's own constitutional publishes anchor
  // regardless — this only governs the registry double-write projection.
  "asset.published": "artifact_created",
  "asset.invoked": "artifact_created", // an invocation event — non-anchorable
  "asset.version.deprecated": "artifact_created", // version lifecycle — non-anchorable
  // ── Participation / cartridge events (DVN rebate extension) ───────────────
  "reward.granted": "knowledge_curated", // MONEY-ADJACENT — non-anchorable (MUST stay off-chain)
  "skill.invoked": "artifact_created", // invocation — non-anchorable
  "participation.metered": "knowledge_curated", // MONEY-ADJACENT (Qc metering) — non-anchorable
  "receipt.finalized": "artifact_created", // receipt lifecycle — non-anchorable
  "receipt.disputed": "artifact_created", // receipt lifecycle — non-anchorable
  "receipt.reversed": "artifact_created", // receipt lifecycle — non-anchorable
};

function generateId(): string {
  return `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function hashPayload(payload: Record<string, unknown>): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

/** Commit the raw actorId into a one-way, T2-safe reference for the unified
 *  `persona_id` — closes System B's raw-actor T0 exposure in the projection. */
function commitActor(actorId: string): string {
  return createHash("sha256").update(`registry:actor:${actorId}`).digest("hex").slice(0, 16);
}

export interface EmitReceiptParams {
  eventType: ReceiptEventType;
  actorId: string;
  tenantId: string;
  assetId?: string;
  intakeId?: string;
  invocationId?: string;
  payload: Record<string, unknown>;
}

/**
 * Best-effort projection of a ReceiptQube emit into the unified, DVN-eligible
 * `activity_receipts` trail (CFS-025 adapter). Fire-and-forget + fully
 * failure-isolated: any throw is caught + logged and NEVER propagates to the
 * ReceiptQube emit. Summary + contextShared are T1/T2-safe (event name + object
 * refs + a content-hash prefix only — never payload values).
 */
function writeUnifiedProjection(
  params: EmitReceiptParams,
  contentHash: string,
): void {
  try {
    const actionType = RECEIPT_EVENT_TO_ACTIVITY_ACTION[params.eventType] ?? "artifact_created";
    const objectRef = params.assetId
      ? ` · asset ${params.assetId}`
      : params.intakeId
      ? ` · intake ${params.intakeId}`
      : params.invocationId
      ? ` · invocation ${params.invocationId}`
      : "";
    void createActivityReceipt({
      personaId: commitActor(params.actorId), // committed — never the raw actorId
      activeCartridge: "registry",
      actionType,
      summary: `registry ${params.eventType}${objectRef} (${contentHash.slice(0, 12)})`,
      contextShared: ["registry-ingestion"],
      ...(params.assetId ? { artifactsCreated: [params.assetId] } : {}),
    }).catch((err) => {
      console.error(
        `[ReceiptEmitter] unified projection write failed (${params.eventType}) — ReceiptQube emit unaffected:`,
        err,
      );
    });
  } catch (err) {
    // Setup (map lookup / hash) threw — isolate; the ReceiptQube emit continues.
    console.error(
      `[ReceiptEmitter] unified projection setup failed (${params.eventType}) — ReceiptQube emit unaffected:`,
      err,
    );
  }
}

export async function emitReceipt(params: EmitReceiptParams): Promise<ReceiptQube> {
  const receiptId = generateId();
  const contentHash = hashPayload(params.payload);

  // CFS-025 adapter — also project into the unified DVN-eligible trail. Best-
  // effort + failure-isolated; runs BEFORE the ReceiptQube write but cannot
  // affect it (fire-and-forget, try/catch).
  writeUnifiedProjection(params, contentHash);

  return createReceipt({
    receiptId,
    eventType: params.eventType,
    // T0 CLOSURE (CFS-025): commit the actorId one-way before it is stored.
    // Some call sites pass a raw personaId (e.g. rewardService `actorId: personaId`)
    // — a T0 identifier that must NEVER be written raw to a receipt table
    // (CLAUDE.md, paramount). No consumer matches or displays actor_id, so the
    // commitment is a pure hardening with no read-side breakage.
    actorId: commitActor(params.actorId),
    tenantId: params.tenantId,
    assetId: params.assetId,
    intakeId: params.intakeId,
    invocationId: params.invocationId,
    payload: params.payload,
    contentHash,
  });
}

/** Fire-and-forget receipt emission — logs errors but never throws */
export function emitReceiptSilent(params: EmitReceiptParams): void {
  emitReceipt(params).catch((err) => {
    console.error(`[ReceiptEmitter] Failed to emit receipt (${params.eventType}):`, err);
  });
}
