/**
 * PATCH /api/registry/assets/[assetId]/revoke
 *
 * Revokes the active publication for an asset. Sets publication status
 * to 'revoked' and resets the asset's publicationStatus to 'draft'.
 * Emits an asset.published receipt with revoked=true for the audit trail.
 *
 * Body: { revokedBy: string, reason: string }
 *
 * Phase 4 — Registry Governance
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { revokePublication } from "@/services/registry/publisherService";
import { getAsset } from "@/services/registry/persistence";

type Params = { params: { assetId: string } };

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { assetId } = params;
    const body = await req.json();
    const { revokedBy, reason } = body;

    if (!revokedBy || !reason) {
      return NextResponse.json(
        { ok: false, error: "revokedBy and reason are required" },
        { status: 400 }
      );
    }

    // Confirm asset exists
    const asset = await getAsset(assetId);
    if (!asset) {
      return NextResponse.json({ ok: false, error: "Asset not found" }, { status: 404 });
    }

    // Find active (published) publication for this asset
    const db = getDb();
    const { data: publication, error: pubErr } = await db
      .from("registry_publications")
      .select("id, status")
      .eq("asset_id", assetId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pubErr) {
      throw new Error(pubErr.message);
    }

    if (!publication) {
      return NextResponse.json(
        { ok: false, error: "No active publication found for this asset" },
        { status: 422 }
      );
    }

    const result = await revokePublication(publication.id, revokedBy, reason, assetId);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        assetId,
        publicationId: publication.id,
        revokedBy,
        reason,
        revokedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[registry/assets/revoke] PATCH error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
