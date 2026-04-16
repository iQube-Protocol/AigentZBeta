/**
 * GET /api/codex/knyt/ledger
 *
 * Returns the DVN receipt + Qc accounting ledger for the KNYT cartridge.
 * Powers the economic lifecycle panel in KnytAlphaTab.
 *
 * Query params:
 *   personaId?  — filter events/receipts to this persona (optional)
 *   limit?      — max recent entries per collection (default: 15)
 *
 * Response:
 *   receipts    — recent registry_receipts (provisional → finalized lifecycle)
 *   events      — recent qc_events for cartridge_id = 'knyt'
 *   summary     — { provisionalReceipts, finalizedReceipts, totalEvents, totalQc }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";

export const dynamic = "force-dynamic";

interface ReceiptRow {
  receiptId: string;
  eventType: string;
  provisional: boolean;
  finalizedAt: string | null;
  createdAt: string;
  actorId: string;
}

interface QcEventRow {
  eventId: string;
  actionType: string;
  direction: string;
  amountQc: number;
  provisional: boolean;
  createdAt: string;
  skillId: string | null;
  personaId: string;
}

export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: true, data: null, debug: "no_supabase" });
  }

  const { searchParams } = new URL(req.url);
  const personaId = searchParams.get("personaId") ?? undefined;
  const limit     = Math.min(parseInt(searchParams.get("limit") ?? "15", 10), 50);

  try {
    let receiptsQuery = supabase
      .from("registry_receipts")
      .select("receipt_id, event_type, provisional, finalized_at, created_at, actor_id")
      .order("created_at", { ascending: false })
      .limit(limit);

    let eventsQuery = supabase
      .from("qc_events")
      .select("event_id, action_type, direction, amount_qc, provisional, created_at, skill_id, persona_id")
      .eq("cartridge_id", "knyt")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (personaId) {
      receiptsQuery = receiptsQuery.eq("actor_id", personaId);
      eventsQuery   = eventsQuery.eq("persona_id", personaId);
    }

    const [receiptsRes, eventsRes] = await Promise.all([receiptsQuery, eventsQuery]);

    const rawReceipts = (receiptsRes.data ?? []) as Array<{
      receipt_id: string;
      event_type: string;
      provisional: boolean;
      finalized_at: string | null;
      created_at: string;
      actor_id: string;
    }>;

    const rawEvents = (eventsRes.data ?? []) as Array<{
      event_id: string;
      action_type: string;
      direction: string;
      amount_qc: number;
      provisional: boolean;
      created_at: string;
      skill_id: string | null;
      persona_id: string;
    }>;

    const receipts: ReceiptRow[] = rawReceipts.map((r) => ({
      receiptId:   r.receipt_id,
      eventType:   r.event_type,
      provisional: r.provisional,
      finalizedAt: r.finalized_at,
      createdAt:   r.created_at,
      actorId:     r.actor_id,
    }));

    const events: QcEventRow[] = rawEvents.map((e) => ({
      eventId:    e.event_id,
      actionType: e.action_type,
      direction:  e.direction,
      amountQc:   e.amount_qc,
      provisional: e.provisional,
      createdAt:  e.created_at,
      skillId:    e.skill_id,
      personaId:  e.persona_id,
    }));

    const summary = {
      provisionalReceipts: receipts.filter((r) => r.provisional).length,
      finalizedReceipts:   receipts.filter((r) => !r.provisional).length,
      totalEvents:         events.length,
      totalQc:             events.reduce((sum, e) => sum + (e.amountQc ?? 0), 0),
    };

    return NextResponse.json({ ok: true, data: { receipts, events, summary } });
  } catch (err) {
    console.error("[codex/knyt/ledger] unexpected error:", err);
    return NextResponse.json({ ok: true, data: null, debug: "caught_error" });
  }
}
