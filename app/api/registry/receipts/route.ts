import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { listReceiptsByIntake } from "@/services/registry/persistence";
import { emitReceipt } from "@/services/registry/receiptEmitter";
import type { ReceiptEventType } from "@/types/registryIngestion";

function unifiedClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/**
 * GET /api/registry/receipts
 *
 * Dual-mode handler:
 *   - Legacy: ?intakeId=<id> → ingestion-factory receipt list (unchanged
 *     since shipped). Returns { ok, data: ReceiptQube[] }.
 *   - Stage 6: any of the following query params triggers the unified
 *     cross-source receipt query (PRD v1.0 §8.1 + v1.1 §B.5):
 *       ?iqube_id=<uuid>
 *       ?cartridge=<slug>
 *       ?primitive_type=<type>
 *       ?actor_alias_commitment=<value>
 *       ?tx_hash=<hex>
 *       ?block=<block_id>
 *       ?source=orchestration_events|content_qube_dvn_receipts
 *       ?limit=<n>   (default 100, max 500)
 *       ?before=<iso-timestamp>
 *     Returns { receipts, total, sources: { orchestration, content_qube } }.
 *
 * Authority:
 *   - T0 fields (personaId, actor_persona_id) never selected.
 *   - Read-only; never writes or decides access.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const intakeId = url.searchParams.get("intakeId");

  // Legacy mode wins when intakeId is set (no overlap risk).
  if (intakeId) {
    try {
      const receipts = await listReceiptsByIntake(intakeId);
      return NextResponse.json({ ok: true, data: receipts });
    } catch (err) {
      console.error("[registry/receipts] legacy GET error:", err);
      return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
    }
  }

  const iqubeId = url.searchParams.get("iqube_id") ?? undefined;
  const cartridge = url.searchParams.get("cartridge") ?? undefined;
  const primitiveType = url.searchParams.get("primitive_type") ?? undefined;
  const actorAlias = url.searchParams.get("actor_alias_commitment") ?? undefined;
  const txHash = url.searchParams.get("tx_hash") ?? undefined;
  const blockId = url.searchParams.get("block") ?? undefined;
  const source = url.searchParams.get("source") as
    | "orchestration_events"
    | "content_qube_dvn_receipts"
    | null;
  const before = url.searchParams.get("before") ?? undefined;
  const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "100", 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 500 ? rawLimit : 100;

  const sb = unifiedClient();

  // Pre-resolve allowed iqube_ids when filtering by primitive_type
  let allowedIqubeIds: string[] | null = null;
  if (primitiveType) {
    const { data: mapRows } = await sb
      .from("iqube_id_map")
      .select("iqube_id")
      .eq("primitive_type", primitiveType)
      .limit(5000);
    allowedIqubeIds = (mapRows ?? []).map((r) => (r as { iqube_id: string }).iqube_id);
    if (allowedIqubeIds.length === 0) {
      return NextResponse.json({
        receipts: [],
        total: 0,
        sources: { orchestration: 0, content_qube: 0 },
      });
    }
  }

  // Pre-resolve block items when filtering by block_id
  let blockItemFilter: Array<{ receipt_source: string; receipt_id: string }> | null = null;
  let blockNumberById: Record<string, number> = {};
  if (blockId) {
    const { data: items } = await sb
      .from("dvn_receipt_block_items")
      .select("block_id, receipt_source, receipt_id")
      .eq("block_id", blockId);
    blockItemFilter = (items ?? []).map((r) => {
      const x = r as { receipt_source: string; receipt_id: string };
      return { receipt_source: x.receipt_source, receipt_id: x.receipt_id };
    });
    const { data: blockRow } = await sb
      .from("dvn_receipt_blocks")
      .select("block_id, block_number")
      .eq("block_id", blockId)
      .maybeSingle();
    if (blockRow) {
      const b = blockRow as { block_id: string; block_number: number };
      blockNumberById[b.block_id] = b.block_number;
    }
  }

  interface UnifiedReceipt {
    source: "orchestration_events" | "content_qube_dvn_receipts";
    receipt_id: string;
    iqube_id: string | null;
    cartridge_scope: string | null;
    actor_alias_commitment: string | null;
    cohort_id: string | null;
    receipt_mode: string | null;
    event_type: string | null;
    receipt_kind: string | null;
    created_at: string;
    block_id?: string | null;
    block_number?: number | null;
  }

  const receipts: UnifiedReceipt[] = [];
  let orchestrationCount = 0;
  let contentQubeCount = 0;

  // ── orchestration_events ────────────────────────────────────────────
  if (source !== "content_qube_dvn_receipts") {
    let q = sb
      .from("orchestration_events")
      .select(
        "event_id, event_type, iqube_id, active_cartridge, actor_alias_commitment, cohort_id, receipt_mode, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (iqubeId) q = q.eq("iqube_id", iqubeId);
    if (cartridge) q = q.eq("active_cartridge", cartridge);
    if (actorAlias) q = q.eq("actor_alias_commitment", actorAlias);
    if (txHash) q = q.like("metadata->>tx_hash", `%${txHash}%`);
    if (before) q = q.lt("created_at", before);
    if (allowedIqubeIds) q = q.in("iqube_id", allowedIqubeIds);
    if (blockItemFilter) {
      const ids = blockItemFilter
        .filter((p) => p.receipt_source === "orchestration_events")
        .map((p) => p.receipt_id);
      if (ids.length === 0) {
        q = q.eq("event_id", "__no_match__");
      } else {
        q = q.in("event_id", ids);
      }
    }
    const { data } = await q;
    for (const row of data ?? []) {
      const r = row as {
        event_id: string;
        event_type: string | null;
        iqube_id: string | null;
        active_cartridge: string | null;
        actor_alias_commitment: string | null;
        cohort_id: string | null;
        receipt_mode: string | null;
        created_at: string;
      };
      receipts.push({
        source: "orchestration_events",
        receipt_id: r.event_id,
        iqube_id: r.iqube_id,
        cartridge_scope: r.active_cartridge,
        actor_alias_commitment: r.actor_alias_commitment,
        cohort_id: r.cohort_id,
        receipt_mode: r.receipt_mode,
        event_type: r.event_type,
        receipt_kind: null,
        created_at: r.created_at,
      });
      orchestrationCount++;
    }
  }

  // ── content_qube_dvn_receipts ──────────────────────────────────────
  if (source !== "orchestration_events") {
    let q = sb
      .from("content_qube_dvn_receipts")
      .select(
        "id, content_qube_id, receipt_kind, t2_alias_commitment, cohort_id, receipt_mode, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (iqubeId) q = q.eq("content_qube_id", iqubeId);
    if (actorAlias) q = q.eq("t2_alias_commitment", actorAlias);
    if (before) q = q.lt("created_at", before);
    if (allowedIqubeIds) q = q.in("content_qube_id", allowedIqubeIds);
    if (blockItemFilter) {
      const ids = blockItemFilter
        .filter((p) => p.receipt_source === "content_qube_dvn_receipts")
        .map((p) => p.receipt_id);
      if (ids.length === 0) {
        q = q.eq("id", "__no_match__");
      } else {
        q = q.in("id", ids);
      }
    }
    const { data } = await q;
    for (const row of data ?? []) {
      const r = row as {
        id: string;
        content_qube_id: string | null;
        receipt_kind: string | null;
        t2_alias_commitment: string | null;
        cohort_id: string | null;
        receipt_mode: string | null;
        created_at: string;
      };
      receipts.push({
        source: "content_qube_dvn_receipts",
        receipt_id: r.id,
        iqube_id: r.content_qube_id,
        cartridge_scope: null,
        actor_alias_commitment: r.t2_alias_commitment,
        cohort_id: r.cohort_id,
        receipt_mode: r.receipt_mode,
        event_type: null,
        receipt_kind: r.receipt_kind,
        created_at: r.created_at,
      });
      contentQubeCount++;
    }
  }

  // Merge + sort desc + cap
  receipts.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const trimmed = receipts.slice(0, limit);

  if (blockId && blockItemFilter) {
    const bn = blockNumberById[blockId];
    for (const r of trimmed) {
      r.block_id = blockId;
      r.block_number = bn ?? null;
    }
  }

  return NextResponse.json({
    receipts: trimmed,
    total: trimmed.length,
    sources: { orchestration: orchestrationCount, content_qube: contentQubeCount },
  });
}

/** POST /api/registry/receipts — emit a receipt event (e.g. from Studio on save) */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      eventType: string;
      actorId: string;
      tenantId: string;
      assetId?: string;
      intakeId?: string;
      payload: Record<string, unknown>;
    };

    if (!body.eventType || !body.actorId || !body.tenantId || !body.payload) {
      return NextResponse.json(
        { ok: false, error: "eventType, actorId, tenantId, and payload are required" },
        { status: 400 }
      );
    }

    const receipt = await emitReceipt({
      eventType: body.eventType as ReceiptEventType,
      actorId: body.actorId,
      tenantId: body.tenantId,
      assetId: body.assetId,
      intakeId: body.intakeId,
      payload: body.payload,
    });

    return NextResponse.json({ ok: true, data: receipt }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("42P01") || msg.includes("does not exist") || msg.includes("relation")) {
      return NextResponse.json({ ok: true, _note: "table_pending" }, { status: 200 });
    }
    console.error("[registry/receipts] POST error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
