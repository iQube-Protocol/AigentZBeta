/**
 * GET /api/workflows/:id/bindings/:bindingId/health  — probe adapter reachability
 */
import { NextRequest, NextResponse } from "next/server";
import { getBinding, updateBinding } from "@/services/workflows/bindingStore";
import { getAdapter } from "@/services/workflows/adapters";

export const runtime = "nodejs";
interface RouteParams { params: Promise<{ id: string; bindingId: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id, bindingId } = await params;
    const binding = await getBinding(bindingId);
    if (!binding) return NextResponse.json({ ok: false, error: "Binding not found" }, { status: 404 });
    if (binding.workflowId !== id) return NextResponse.json({ ok: false, error: "Binding does not belong to this workflow" }, { status: 400 });

    const adapter = getAdapter(binding.engine);
    if (!adapter?.healthCheck) {
      return NextResponse.json({ ok: true, state: "unknown", detail: "Engine has no health check" });
    }

    const result = await adapter.healthCheck(binding);
    const now = new Date().toISOString();

    // Persist health state (non-blocking)
    updateBinding(bindingId, {
      healthState: result.state,
      lastHealthCheckedAt: now,
    }).catch(() => {});

    return NextResponse.json({ ok: true, ...result, checkedAt: now });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message ?? "Internal error" }, { status: 500 });
  }
}
