/**
 * POST /api/admin/cartridge-catalogue/requests/[id]/decision
 *
 * metaMe admin approves or rejects a pending catalogue publish request.
 *
 * Body: { decision: "approve" | "reject", reason?: string }
 *
 * On approve, the cartridge is left flagged so the activations catalogue
 * loader can include it. The actual catalogue surface read is driven by
 * `cartridge_catalogue_requests.status = 'approved'` joined into the
 * activations list — no separate publication step.
 */

import { NextRequest, NextResponse } from "next/server";
import { getActivePersona } from "@/services/identity/getActivePersona";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

export async function POST(req: NextRequest, ctx: RouteParams): Promise<NextResponse> {
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

  let body: { decision?: unknown; reason?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const decision = typeof body.decision === "string" ? body.decision.toLowerCase() : "";
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json(
      { ok: false, error: "invalid-decision", detail: "decision must be 'approve' or 'reject'" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 2000) : null;

  const db = getSupabaseServer();
  if (!db) {
    return NextResponse.json(
      { ok: false, error: "db-unavailable" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const nextStatus = decision === "approve" ? "approved" : "rejected";
  const { data, error } = await db
    .from("cartridge_catalogue_requests")
    .update({
      status: nextStatus,
      decided_at: new Date().toISOString(),
      decided_by_persona_id: persona.personaId,
      decision_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.params.id)
    .eq("status", "pending")
    .select("id, cartridge_slug, status")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "decision-failed", detail: error.message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!data) {
    return NextResponse.json(
      { ok: false, error: "not-pending", detail: "Request is not pending or does not exist." },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      id: (data as { id: string }).id,
      status: (data as { status: string }).status,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
