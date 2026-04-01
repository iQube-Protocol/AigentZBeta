/**
 * POST /api/workflows/:id/runs/:runId/cancel  — cancel a running workflow execution
 */
import { NextRequest, NextResponse } from "next/server";
import { getWorkflowRun, updateWorkflowRun, appendRunEvent } from "@/services/workflows/workflowRunStore";
import { getBinding } from "@/services/workflows/bindingStore";
import { getAdapter } from "@/services/workflows/adapters";

export const runtime = "nodejs";
interface RouteParams { params: Promise<{ id: string; runId: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, runId } = await params;
    const body = await request.json().catch(() => ({}));

    const run = await getWorkflowRun(runId);
    if (!run) return NextResponse.json({ ok: false, error: "Run not found" }, { status: 404 });
    if (run.workflowId !== id) return NextResponse.json({ ok: false, error: "Run does not belong to this workflow" }, { status: 400 });
    if (run.status !== "running" && run.status !== "pending") {
      return NextResponse.json({ ok: false, error: `Run is already in terminal state: ${run.status}` }, { status: 409 });
    }

    // Attempt adapter-level cancel if we have an executionId and a bindingId
    let adapterCancelled = false;
    if (run.executionId && body.bindingId) {
      const binding = await getBinding(body.bindingId).catch(() => null);
      if (binding) {
        const adapter = getAdapter(binding.engine);
        if (adapter?.cancel) {
          const result = await adapter.cancel(binding, run.executionId).catch(() => ({ ok: false }));
          adapterCancelled = result.ok;
        }
      }
    }

    const now = new Date().toISOString();
    await updateWorkflowRun(runId, { status: "cancelled", completedAt: now });
    await appendRunEvent(runId, "log", "cancel", { adapterCancelled, requestedBy: body.requestedBy ?? "api" });

    return NextResponse.json({ ok: true, adapterCancelled });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message ?? "Internal error" }, { status: 500 });
  }
}
