/**
 * GET /api/workflows/:id/runs/:runId  — get run details + trace events
 */
import { NextRequest, NextResponse } from "next/server";
import { getWorkflowRun, listRunEvents } from "@/services/workflows/workflowRunStore";

export const runtime = "nodejs";
interface RouteParams { params: Promise<{ id: string; runId: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { runId } = await params;
    const run = await getWorkflowRun(runId);
    if (!run) return NextResponse.json({ ok: false, error: "Run not found" }, { status: 404 });
    const events = await listRunEvents(runId);
    return NextResponse.json({ ok: true, run, events });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message ?? "Internal error" }, { status: 500 });
  }
}
