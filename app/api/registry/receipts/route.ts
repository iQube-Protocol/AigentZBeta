import { NextRequest, NextResponse } from "next/server";
import { listReceiptsByIntake } from "@/services/registry/persistence";

/** GET /api/registry/receipts?intakeId=<id> — receipts for a given intake */
export async function GET(req: NextRequest) {
  try {
    const intakeId = new URL(req.url).searchParams.get("intakeId");
    if (!intakeId) {
      return NextResponse.json({ ok: false, error: "intakeId is required" }, { status: 400 });
    }
    const receipts = await listReceiptsByIntake(intakeId);
    return NextResponse.json({ ok: true, data: receipts });
  } catch (err) {
    console.error("[registry/receipts] GET error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
