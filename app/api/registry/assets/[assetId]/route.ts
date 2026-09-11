import { NextRequest, NextResponse } from "next/server";
import { getAsset } from "@/services/registry/persistence";

type Params = { params: Promise<{ assetId: string }> };

/** GET /api/registry/assets/[assetId] */
export async function GET(_req: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const asset = await getAsset(params.assetId);
    if (!asset) {
      return NextResponse.json({ ok: false, error: "Asset not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: asset });
  } catch (err) {
    console.error("[registry/assets/id] GET error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
