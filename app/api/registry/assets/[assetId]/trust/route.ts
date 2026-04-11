import { NextRequest, NextResponse } from "next/server";
import { getLatestTrustScore } from "@/services/registry/persistence";

type Params = { params: { assetId: string } };

/** GET /api/registry/assets/[assetId]/trust — get the latest trust score */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const score = await getLatestTrustScore(params.assetId);
    if (!score) {
      return NextResponse.json(
        { ok: false, error: "No trust score found — run validation first" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, data: score });
  } catch (err) {
    console.error("[registry/assets/trust] GET error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
