/**
 * ReceiptEmitter — emits immutable ReceiptQube records for all factory state transitions.
 *
 * Every critical event in the ingestion pipeline emits a receipt. This is the
 * AgentiQ-native equivalent of DVN / PoState evidence anchoring.
 */

import { createHash } from "crypto";
import { createReceipt } from "./persistence";
import { ReceiptEventType, ReceiptQube } from "@/types/registryIngestion";

function generateId(): string {
  return `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function hashPayload(payload: Record<string, unknown>): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
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

export async function emitReceipt(params: EmitReceiptParams): Promise<ReceiptQube> {
  const receiptId = generateId();
  const contentHash = hashPayload(params.payload);

  return createReceipt({
    receiptId,
    eventType: params.eventType,
    actorId: params.actorId,
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
