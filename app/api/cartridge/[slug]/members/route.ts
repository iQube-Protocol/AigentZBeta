/**
 * POST /api/cartridge/[slug]/members
 *
 * Invite a persona to the cartridge by adding a `cartridge_memberships`
 * row. Phase 7 of the myCartridge PRD §14 — operator manager surface.
 *
 * Phase 7 MVP: invite by personaId (T0 id, sourced from the operator's
 * own persona graph). Phase 7b will add invite-by-fioHandle or
 * invite-by-displayLabel that resolves to a personaId server-side.
 *
 * Gated write (owner / admin-role / uber).
 *
 * On conflict (persona already has a row for this cartridge): updates
 * the role in place — effectively a "change role" operation. This
 * collapses what would otherwise be two separate routes (invite +
 * change-role) into one ergonomic POST.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import { cartridgeManageGuard } from "@/services/cartridge/manageGuard";
import { cartridgeRoleEnum } from "@/services/iqube/ventureQubeSchema";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  personaId: z.string().min(1),
  role: cartridgeRoleEnum.refine((r) => r !== "owner", {
    // The cartridge has a single owner — written by the wizard at
    // creation and transferred via a separate "transfer ownership" path
    // (Phase 7b). The invite/change-role flow cannot grant 'owner'.
    message: "the 'owner' role cannot be granted via invite; use the transfer-ownership flow (Phase 7b)",
  }),
});

interface RouteParams {
  params: { slug: string };
}

export async function POST(req: NextRequest, ctx: RouteParams): Promise<NextResponse> {
  const guard = await cartridgeManageGuard(req, ctx.params.slug, { requireWrite: true });
  if (guard instanceof NextResponse) return guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path?.length ? first.path.join(".") : "(root)";
    return NextResponse.json(
      {
        ok: false,
        error: "schema-validation-failed",
        detail: `${path}: ${first?.message ?? "validation failed"}`,
      },
      { status: 400 },
    );
  }

  const db = getSupabaseServer();
  if (!db) {
    return NextResponse.json({ ok: false, error: "supabase-unavailable" }, { status: 500 });
  }

  const nowIso = new Date().toISOString();
  const { error: upsertErr } = await db.from("cartridge_memberships").upsert(
    {
      cartridge_slug: ctx.params.slug,
      persona_id: parsed.data.personaId,
      role: parsed.data.role,
      granted_at: nowIso,
      granted_by: guard.persona.personaId,
      metadata: { source: "operator-manager-invite" },
    },
    { onConflict: "cartridge_slug,persona_id" },
  );
  if (upsertErr) {
    return NextResponse.json(
      { ok: false, error: "membership-upsert-failed", detail: upsertErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      cartridgeSlug: ctx.params.slug,
      role: parsed.data.role,
      // T0 personaId echoed only for debugging; the operator already
      // knows the id they passed in. Phase 7b will swap to a display
      // token to keep the response surface fully T1-safe.
      personaIdEcho: parsed.data.personaId,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
