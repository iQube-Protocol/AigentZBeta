/**
 * POST /api/cartridge/[slug]/request-catalogue
 *
 * The owner of a personal cartridge submits a request to have it listed
 * in the metaMe activations catalogue. metaMe admins review pending
 * requests via /api/admin/cartridge-catalogue/requests and approve or
 * reject.
 *
 * Gate: cartridgeManageGuard with requireWrite=true — only the owner /
 * cartridge-admin grant holder / uber-admin can submit. T0 fields are
 * never echoed.
 *
 * GET on this same route returns the latest request for the cartridge by
 * the calling persona — surfaced in MyCartridgeTab so the operator sees
 * the status of their pending application.
 */

import { NextRequest, NextResponse } from "next/server";
import { cartridgeManageGuard } from "@/services/cartridge/manageGuard";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import { getCallerIdentityContext } from "@/services/wallet/personaRepo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

function shapeRequest(row: {
  id: string;
  status: string;
  message: string | null;
  requested_at: string;
  decided_at: string | null;
  decision_reason: string | null;
}) {
  return {
    id: row.id,
    status: row.status,
    message: row.message,
    requestedAt: row.requested_at,
    decidedAt: row.decided_at,
    decisionReason: row.decision_reason,
  };
}

export async function POST(req: NextRequest, ctx: RouteParams): Promise<NextResponse> {
  const guard = await cartridgeManageGuard(req, (await ctx.params).slug, { requireWrite: true });
  if (guard instanceof NextResponse) return guard;

  let message: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.message === "string") {
      message = body.message.trim().slice(0, 2000) || null;
    }
  } catch {
    // empty body — message stays null
  }

  const db = getSupabaseServer();
  if (!db) {
    return NextResponse.json(
      { ok: false, error: "db-unavailable" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Pull cartridge title for inline display in the admin reviewer surface.
  const { data: cfg, error: cfgErr } = await db
    .from("codex_configs")
    .select("name")
    .eq("slug", (await ctx.params).slug)
    .maybeSingle();
  if (cfgErr || !cfg) {
    return NextResponse.json(
      { ok: false, error: "cartridge-not-found", detail: cfgErr?.message },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const caller = await getCallerIdentityContext(req);
  const requesterEmail = caller?.email ?? null;
  let displayLabel: string | null = null;
  try {
    const { data: personaRow } = await db
      .from("personas")
      .select("display_label")
      .eq("id", guard.persona.personaId)
      .maybeSingle();
    displayLabel = (personaRow as { display_label?: string | null } | null)?.display_label ?? null;
  } catch {
    displayLabel = null;
  }
  if (!displayLabel && requesterEmail) {
    displayLabel = requesterEmail.split("@")[0] ?? null;
  }

  const { data: inserted, error: insErr } = await db
    .from("cartridge_catalogue_requests")
    .insert({
      cartridge_slug: (await ctx.params).slug,
      cartridge_title: (cfg as { name: string }).name,
      persona_id: guard.persona.personaId,
      auth_profile_id: guard.persona.authProfileId,
      requester_display_label: displayLabel,
      requester_email: requesterEmail,
      message,
      status: "pending",
    })
    .select("id, status, message, requested_at, decided_at, decision_reason")
    .single();

  if (insErr) {
    if (insErr.code === "23505") {
      return NextResponse.json(
        {
          ok: false,
          error: "duplicate-pending",
          detail: "A pending catalogue request already exists for this cartridge.",
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { ok: false, error: "insert-failed", detail: insErr.message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { ok: true, request: shapeRequest(inserted as Parameters<typeof shapeRequest>[0]) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(req: NextRequest, ctx: RouteParams): Promise<NextResponse> {
  const guard = await cartridgeManageGuard(req, (await ctx.params).slug, { requireWrite: false });
  if (guard instanceof NextResponse) return guard;

  const db = getSupabaseServer();
  if (!db) {
    return NextResponse.json(
      { ok: true, request: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data, error } = await db
    .from("cartridge_catalogue_requests")
    .select("id, status, message, requested_at, decided_at, decision_reason")
    .eq("cartridge_slug", (await ctx.params).slug)
    .eq("persona_id", guard.persona.personaId)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { ok: true, request: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { ok: true, request: shapeRequest(data as Parameters<typeof shapeRequest>[0]) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
