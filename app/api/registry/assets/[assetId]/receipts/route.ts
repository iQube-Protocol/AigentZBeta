import { NextRequest, NextResponse } from "next/server";
import { listReceiptsForAsset } from "@/services/registry/persistence";

type Params = { params: { assetId: string } };

/** GET /api/registry/assets/[assetId]/receipts */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;
    const receipts = await listReceiptsForAsset(params.assetId, limit);
    return NextResponse.json({ ok: true, data: receipts });
  } catch (err) {
    console.error("[registry/assets/receipts] GET error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
