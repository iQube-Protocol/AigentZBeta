import { NextRequest, NextResponse } from "next/server";
import { submitIntake } from "@/services/registry/intakeService";
import type { CreateIntakeRequest } from "@/types/registryIngestion";

/** POST /api/registry/intake — submit a new ingestion intake */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<CreateIntakeRequest>;

    if (!body.tenantId || !body.submittedBy || !body.sourceType) {
      return NextResponse.json(
        { ok: false, error: "tenantId, submittedBy, and sourceType are required" },
        { status: 400 }
      );
    }

    const result = await submitIntake({
      tenantId: body.tenantId,
      submittedBy: body.submittedBy,
      sourceType: body.sourceType,
      sourceUri: body.sourceUri,
      sourcePayload: body.sourcePayload ?? {},
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
    }

    return NextResponse.json({ ok: true, data: result.intake }, { status: 201 });
  } catch (err) {
    console.error("[registry/intake] POST error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

/** GET /api/registry/intake — list intakes for a tenant */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenantId");
    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "tenantId required" }, { status: 400 });
    }
    const { listIntakes } = await import("@/services/registry/persistence");
    const intakes = await listIntakes(tenantId);
    return NextResponse.json({ ok: true, data: intakes });
  } catch (err) {
    console.error("[registry/intake] GET error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
