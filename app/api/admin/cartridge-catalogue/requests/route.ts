/**
 * GET /api/admin/cartridge-catalogue/requests
 *
 * metaMe admins list pending + recently-decided cartridge catalogue
 * publish requests. Gated by persona.cartridgeFlags.isAdmin via the
 * canonical spine resolver.
 *
 * Query params:
 *   ?status=pending|approved|rejected|cancelled  (default: pending)
 *   ?limit=N (1..200, default 50)
 */

import { NextRequest, NextResponse } from "next/server";
import { getActivePersona } from "@/services/identity/getActivePersona";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!persona.cartridgeFlags.isAdmin) {
    return NextResponse.json(
      { ok: false, error: "admin-only" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const db = getSupabaseServer();
  if (!db) {
    return NextResponse.json(
      { ok: false, error: "db-unavailable" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") ?? "pending";
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1),
    200,
  );

  let query = db
    .from("cartridge_catalogue_requests")
    .select(
      "id, cartridge_slug, cartridge_title, requester_display_label, requester_email, message, status, requested_at, decided_at, decision_reason",
    )
    .order("requested_at", { ascending: false })
    .limit(limit);

  if (["pending", "approved", "rejected", "cancelled"].includes(statusFilter)) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { ok: false, error: "list-failed", detail: error.message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  type Row = {
    id: string;
    cartridge_slug: string;
    cartridge_title: string;
    requester_display_label: string | null;
    requester_email: string | null;
    message: string | null;
    status: string;
    requested_at: string;
    decided_at: string | null;
    decision_reason: string | null;
  };

  const requests = (data ?? []).map((r) => {
    const row = r as Row;
    return {
      id: row.id,
      cartridgeSlug: row.cartridge_slug,
      cartridgeTitle: row.cartridge_title,
      requesterDisplayLabel: row.requester_display_label,
      requesterEmail: row.requester_email,
      message: row.message,
      status: row.status,
      requestedAt: row.requested_at,
      decidedAt: row.decided_at,
      decisionReason: row.decision_reason,
    };
  });

  return NextResponse.json(
    { ok: true, requests },
    { headers: { "Cache-Control": "no-store" } },
  );
}
