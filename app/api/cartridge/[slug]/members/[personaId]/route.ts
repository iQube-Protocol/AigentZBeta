/**
 * DELETE /api/cartridge/[slug]/members/[personaId]
 *
 * Revoke a persona's role on the cartridge by deleting their
 * `cartridge_memberships` row. Phase 7 of the myCartridge PRD §14.
 *
 * Refuses to revoke the cartridge's owner — Phase 7b's transfer-
 * ownership flow handles that case.
 *
 * Gated write (owner / admin-role / uber).
 */

import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import { cartridgeManageGuard } from "@/services/cartridge/manageGuard";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ slug: string; personaId: string }>;
}

export async function DELETE(req: NextRequest, ctx: RouteParams): Promise<NextResponse> {
  const guard = await cartridgeManageGuard(req, (await ctx.params).slug, { requireWrite: true });
  if (guard instanceof NextResponse) return guard;

  const db = getSupabaseServer();
  if (!db) {
    return NextResponse.json({ ok: false, error: "supabase-unavailable" }, { status: 500 });
  }

  // Refuse to revoke the owner — Phase 7b's transfer-ownership flow.
  const { data: existing, error: readErr } = await db
    .from("cartridge_memberships")
    .select("role")
    .eq("cartridge_slug", (await ctx.params).slug)
    .eq("persona_id", (await ctx.params).personaId)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json(
      { ok: false, error: "membership-read-failed", detail: readErr.message },
      { status: 500 },
    );
  }
  if (!existing) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  if ((existing as { role?: string }).role === "owner") {
    return NextResponse.json(
      {
        ok: false,
        error: "cannot-revoke-owner",
        detail: "Use the transfer-ownership flow (Phase 7b) to move ownership.",
      },
      { status: 409 },
    );
  }

  const { error: delErr } = await db
    .from("cartridge_memberships")
    .delete()
    .eq("cartridge_slug", (await ctx.params).slug)
    .eq("persona_id", (await ctx.params).personaId);
  if (delErr) {
    return NextResponse.json(
      { ok: false, error: "delete-failed", detail: delErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: true, cartridgeSlug: (await ctx.params).slug, revokedPersonaId: (await ctx.params).personaId },
    { headers: { "Cache-Control": "no-store" } },
  );
}
