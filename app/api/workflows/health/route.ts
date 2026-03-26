import { NextResponse } from "next/server";
import { countWorkflowRows, getStoreMode } from "@/services/workflows/store";

export async function GET() {
  try {
    const counts = await countWorkflowRows();
    return NextResponse.json({
      ok: true,
      mode: getStoreMode(),
      counts,
      timestamp: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("[workflows/health] error:", err);
    return NextResponse.json(
      { ok: false, mode: getStoreMode(), error: err.message ?? "Internal server error", timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
