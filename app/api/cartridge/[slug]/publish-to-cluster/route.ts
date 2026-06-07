/**
 * POST /api/cartridge/[slug]/publish-to-cluster
 *
 * Toggle whether a personal cartridge appears as a dynamic sub-tab in
 * the owner's myCluster group within the metaMe cartridge.
 *
 * Body: { published: boolean }  (defaults to true when omitted)
 *
 * Gate: cartridgeManageGuard with requireWrite=true — only the owner,
 * a cartridge-admin-grant holder, or an uber-admin can publish.
 */

import { NextRequest, NextResponse } from "next/server";
import { cartridgeManageGuard } from "@/services/cartridge/manageGuard";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { slug: string };
}

export async function POST(req: NextRequest, ctx: RouteParams): Promise<NextResponse> {
  const guard = await cartridgeManageGuard(req, ctx.params.slug, { requireWrite: true });
  if (guard instanceof NextResponse) return guard;

  let published = true;
  try {
    const body = await req.json();
    if (typeof body.published === "boolean") published = body.published;
  } catch {
    // omitted body → default to publishing
  }

  const db = getSupabaseServer();
  if (!db) {
    return NextResponse.json(
      { ok: false, error: "db-unavailable" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { error } = await db
    .from("codex_configs")
    .update({ published_to_cluster: published, updated_at: new Date().toISOString() })
    .eq("slug", ctx.params.slug);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "update-failed", detail: error.message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { ok: true, slug: ctx.params.slug, published },
    { headers: { "Cache-Control": "no-store" } },
  );
}
