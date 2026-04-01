/**
 * GET /api/pipeline/runs/:runId/receipt
 * Returns the ExecutionReceiptQube for a completed pipeline run.
 */

import { NextRequest, NextResponse } from "next/server";
import { getExecutionReceiptByRunId } from "@/services/workflows/executionReceiptStore";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ runId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { runId } = await params;
    const receipt = await getExecutionReceiptByRunId(runId);
    if (!receipt) {
      return NextResponse.json({ ok: false, error: "No receipt found for this pipeline run" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, receipt });
  } catch (err: any) {
    console.error("GET /api/pipeline/runs/[runId]/receipt error:", err);
    return NextResponse.json({ ok: false, error: err.message ?? "Internal error" }, { status: 500 });
  }
}
