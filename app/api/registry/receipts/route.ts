import { NextRequest, NextResponse } from "next/server";
import { listReceiptsByIntake } from "@/services/registry/persistence";
import { emitReceipt } from "@/services/registry/receiptEmitter";
import type { ReceiptEventType } from "@/types/registryIngestion";

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

/** POST /api/registry/receipts — emit a receipt event (e.g. from Studio on save) */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      eventType: string;
      actorId: string;
      tenantId: string;
      assetId?: string;
      intakeId?: string;
      payload: Record<string, unknown>;
    };

    if (!body.eventType || !body.actorId || !body.tenantId || !body.payload) {
      return NextResponse.json(
        { ok: false, error: "eventType, actorId, tenantId, and payload are required" },
        { status: 400 }
      );
    }

    const receipt = await emitReceipt({
      eventType: body.eventType as ReceiptEventType,
      actorId: body.actorId,
      tenantId: body.tenantId,
      assetId: body.assetId,
      intakeId: body.intakeId,
      payload: body.payload,
    });

    return NextResponse.json({ ok: true, data: receipt }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("42P01") || msg.includes("does not exist") || msg.includes("relation")) {
      return NextResponse.json({ ok: true, _note: "table_pending" }, { status: 200 });
    }
    console.error("[registry/receipts] POST error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
