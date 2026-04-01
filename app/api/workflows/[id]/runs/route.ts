/**
 * GET /api/workflows/:id/runs  — list runs for a workflow (most recent first)
 */
import { NextRequest, NextResponse } from "next/server";
import { listWorkflowRuns } from "@/services/workflows/workflowRunStore";
import { getWorkflow } from "@/services/workflows/store";

export const runtime = "nodejs";
interface RouteParams { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);

    const workflow = await getWorkflow(id);
    if (!workflow) return NextResponse.json({ ok: false, error: "Workflow not found" }, { status: 404 });

    const runs = await listWorkflowRuns(id, limit);
    return NextResponse.json({ ok: true, runs });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message ?? "Internal error" }, { status: 500 });
  }
}
