import { NextRequest, NextResponse } from "next/server";
import { getAsset } from "@/services/registry/persistence";

type Params = { params: { id: string } };

/**
 * GET /api/skill-qube/[id]
 *
 * Thin wrapper over /api/registry/assets/[assetId] that validates the
 * returned asset is a SkillQube before returning it.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const asset = await getAsset(params.id);
    if (!asset) {
      return NextResponse.json({ ok: false, error: "Skill not found" }, { status: 404 });
    }
    if (asset.assetClass !== "SkillQube") {
      return NextResponse.json({ ok: false, error: "Asset is not a SkillQube" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, data: asset });
  } catch (err) {
    console.error("[skill-qube/id] GET error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
