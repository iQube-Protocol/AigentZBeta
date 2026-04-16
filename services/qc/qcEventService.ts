/**
 * Qc Event Service — Venture Lab α
 *
 * Records every Qc-metered event to the qc_events ledger table.
 * All events are provisional by default; finalization occurs when the
 * associated DVN receipt is confirmed.
 *
 * Alpha note: all SkillQube invocations are priced at 0 Qc. Events are
 * still logged (direction='meter') so the lineage record is complete.
 */

import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";

// ─── Types ───────────────────────────────────────────────────────────────────

export type QcActionType =
  | "reward_granted"      // KNYT reward recognised; Qc cost = 0 in alpha
  | "skill_invoked"       // SkillQube called; Qc cost = pricing_qc from SkillQube record
  | "receipt_emitted"     // A participation receipt was written
  | "session_metered";    // Agent session metered (future use)

export type QcDirection =
  | "credit"  // Qc earned / accrued
  | "debit"   // Qc spent
  | "meter";  // Zero-cost but logged for lineage (alpha default)

export interface LogQcEventParams {
  personaId: string;
  actionType: QcActionType;
  amountQc?: number;      // defaults to 0 (alpha: all skills free)
  direction?: QcDirection; // defaults to 'meter'
  cartridgeId?: string;
  skillId?: string;       // registry_assets.asset_id
  receiptId?: string;     // registry_receipts.receipt_id
  rewardGrantId?: string; // reward_grants.id
  provisional?: boolean;  // defaults to true
  metadata?: Record<string, unknown>;
}

export interface QcEvent {
  eventId: string;
  personaId: string;
  actionType: QcActionType;
  amountQc: number;
  direction: QcDirection;
  cartridgeId?: string;
  skillId?: string;
  receiptId?: string;
  rewardGrantId?: string;
  provisional: boolean;
  finalizedAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Log a single Qc event to the ledger.
 * Fire-and-forget safe: call `logQcEventSilent` when you don't want to await.
 */
export async function logQcEvent(params: LogQcEventParams): Promise<QcEvent> {
  const supabase = getSupabaseServer();
  if (!supabase) throw new Error("[QcEventService] Supabase unavailable");

  const row = {
    persona_id:      params.personaId,
    action_type:     params.actionType,
    amount_qc:       params.amountQc ?? 0,
    direction:       params.direction ?? "meter",
    cartridge_id:    params.cartridgeId ?? null,
    skill_id:        params.skillId ?? null,
    receipt_id:      params.receiptId ?? null,
    reward_grant_id: params.rewardGrantId ?? null,
    provisional:     params.provisional ?? true,
    metadata:        params.metadata ?? {},
  };

  const { data, error } = await supabase
    .from("qc_events")
    .insert(row)
    .select("*")
    .single();

  if (error) throw new Error(`[QcEventService] logQcEvent failed: ${error.message}`);

  const r = data as Record<string, unknown>;
  return {
    eventId:       r.event_id as string,
    personaId:     r.persona_id as string,
    actionType:    r.action_type as QcActionType,
    amountQc:      Number(r.amount_qc),
    direction:     r.direction as QcDirection,
    cartridgeId:   (r.cartridge_id as string) ?? undefined,
    skillId:       (r.skill_id as string) ?? undefined,
    receiptId:     (r.receipt_id as string) ?? undefined,
    rewardGrantId: (r.reward_grant_id as string) ?? undefined,
    provisional:   r.provisional as boolean,
    finalizedAt:   (r.finalized_at as string) ?? undefined,
    metadata:      (r.metadata as Record<string, unknown>) ?? {},
    createdAt:     r.created_at as string,
  };
}

/** Fire-and-forget variant — logs errors but never throws */
export function logQcEventSilent(params: LogQcEventParams): void {
  logQcEvent(params).catch((err) => {
    console.error("[QcEventService] Failed to log Qc event:", err);
  });
}

/**
 * List Qc events for a persona (newest first).
 * Returns empty array gracefully if the table doesn't exist yet.
 */
export async function listQcEvents(
  personaId: string,
  opts: { limit?: number; cartridgeId?: string } = {}
): Promise<QcEvent[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];

  let q = supabase
    .from("qc_events")
    .select("*")
    .eq("persona_id", personaId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 50);

  if (opts.cartridgeId) {
    q = q.eq("cartridge_id", opts.cartridgeId);
  }

  const { data, error } = await q;

  if (error) {
    // Table may not exist in all environments yet — fail gracefully
    console.error("[QcEventService] listQcEvents error:", error.message);
    return [];
  }

  return (data ?? []).map((r: Record<string, unknown>) => ({
    eventId:       r.event_id as string,
    personaId:     r.persona_id as string,
    actionType:    r.action_type as QcActionType,
    amountQc:      Number(r.amount_qc),
    direction:     r.direction as QcDirection,
    cartridgeId:   (r.cartridge_id as string) ?? undefined,
    skillId:       (r.skill_id as string) ?? undefined,
    receiptId:     (r.receipt_id as string) ?? undefined,
    rewardGrantId: (r.reward_grant_id as string) ?? undefined,
    provisional:   r.provisional as boolean,
    finalizedAt:   (r.finalized_at as string) ?? undefined,
    metadata:      (r.metadata as Record<string, unknown>) ?? {},
    createdAt:     r.created_at as string,
  }));
}
