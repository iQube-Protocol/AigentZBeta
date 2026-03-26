import { NextResponse } from "next/server";
import { countPipelineRows } from "@/services/pipeline/persistence";

export async function GET() {
  try {
    const counts = await countPipelineRows();
    return NextResponse.json({
      ok: true,
      mode: "supabase",
      counts,
      timestamp: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("[pipeline/health] error:", err);
    return NextResponse.json(
      { ok: false, mode: "supabase", error: err.message ?? "Internal server error", timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
