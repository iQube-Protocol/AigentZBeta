import { NextRequest, NextResponse } from "next/server";
import { listPipelineRuns } from "@/services/pipeline/persistence";

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get("tenant_id");
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "10", 10), 50);

    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "tenant_id required" }, { status: 400 });
    }

    const runs = await listPipelineRuns(tenantId, limit);
    return NextResponse.json({ ok: true, runs });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ ok: false, error: err.message ?? "Internal server error" }, { status: 500 });
  }
}
