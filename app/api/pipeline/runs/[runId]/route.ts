import { NextRequest, NextResponse } from "next/server";
import { getPipelineRun, listPipelineRunEvents } from "@/services/pipeline/persistence";

export async function GET(
  _req: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const [run, events] = await Promise.all([
      getPipelineRun(params.runId),
      listPipelineRunEvents(params.runId),
    ]);

    if (!run) {
      return NextResponse.json({ ok: false, error: "Pipeline run not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, run, events });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    console.error("[pipeline/runs/:runId] GET error:", err);
    return NextResponse.json(
      { ok: false, error: err.message ?? "Internal server error" },
      { status: err.status ?? 500 }
    );
  }
}
