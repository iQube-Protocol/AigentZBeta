import { NextRequest, NextResponse } from "next/server";
import { getAsset } from "@/services/registry/persistence";

type Params = { params: { id: string } };

/**
 * GET /api/agent-qube/[id]
 *
 * Thin wrapper over /api/registry/assets/[assetId] that validates the
 * returned asset is an AigentQube before returning it.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const asset = await getAsset(params.id);
    if (!asset) {
      return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 404 });
    }
    if (asset.assetClass !== "AigentQube") {
      return NextResponse.json({ ok: false, error: "Asset is not an AigentQube" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, data: asset });
  } catch (err) {
    console.error("[agent-qube/id] GET error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
