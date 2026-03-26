import { NextResponse } from "next/server";
import { countWorkflowRows, getStoreMode } from "@/services/workflows/store";

const envVarFlags = () => ({
  MAKE_API_TOKEN: !!process.env.MAKE_API_TOKEN,
  N8N_BASE_URL: !!process.env.N8N_BASE_URL,
  ACI_BASE_URL: !!process.env.ACI_BASE_URL,
  ACI_API_KEY: !!process.env.ACI_API_KEY,
  WORKFLOW_AUTHORITATIVE_PERSONAS: !!process.env.WORKFLOW_AUTHORITATIVE_PERSONAS,
  PIPELINE_AUTHORITATIVE_AGENTS: !!process.env.PIPELINE_AUTHORITATIVE_AGENTS,
});

export async function GET() {
  try {
    const counts = await countWorkflowRows();
    return NextResponse.json({
      ok: true,
      mode: getStoreMode(),
      counts,
      envVars: envVarFlags(),
      timestamp: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("[workflows/health] error:", err);
    return NextResponse.json(
      { ok: false, mode: getStoreMode(), error: err.message ?? "Internal server error", envVars: envVarFlags(), timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
