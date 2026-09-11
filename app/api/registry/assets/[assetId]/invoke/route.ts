import { NextRequest, NextResponse } from "next/server";
import { invokeAsset } from "@/services/registry/invocationGateway";

type Params = { params: Promise<{ assetId: string }> };

/** POST /api/registry/assets/[assetId]/invoke — governed asset invocation */
export async function POST(req: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const body = await req.json() as {
      invokedBy?: string;
      tenantId?: string;
      input?: Record<string, unknown>;
    };

    if (!body.invokedBy || !body.tenantId) {
      return NextResponse.json(
        { ok: false, error: "invokedBy and tenantId are required" },
        { status: 400 }
      );
    }

    const result = await invokeAsset({
      assetId: params.assetId,
      invokedBy: body.invokedBy,
      tenantId: body.tenantId,
      input: body.input ?? {},
    });

    const statusCode = result.status === "blocked_policy" || result.status === "blocked_approval"
      ? 403
      : result.status === "failed"
      ? 422
      : 200;

    return NextResponse.json({ ok: result.ok, data: result }, { status: statusCode });
  } catch (err) {
    console.error("[registry/assets/invoke] POST error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
