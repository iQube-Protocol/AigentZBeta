import { NextRequest, NextResponse } from "next/server";
import { listWorkflows, createWorkflow } from "@/services/workflows/store";
import { assertEnvelope, assertAuthority } from "@/services/workflows/identityEnvelope";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenant_id");
    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "tenant_id is required" }, { status: 400 });
    }
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const workflows = await listWorkflows(tenantId, limit, offset);
    return NextResponse.json({ ok: true, workflows, total: workflows.length });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    console.error("[workflows] GET error:", err);
    return NextResponse.json(
      { ok: false, error: err.message ?? "Internal server error" },
      { status: err.status ?? 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const envelope = assertEnvelope(body);

    const { name, description, adapter, config, status } = body;
    if (!name || typeof name !== "string") {
      return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
    }
    if (!adapter || typeof adapter !== "string") {
      return NextResponse.json({ ok: false, error: "adapter is required" }, { status: 400 });
    }

    // Only require authority check when promoting beyond draft
    const targetStatus = typeof status === "string" ? status : "draft";
    if (targetStatus !== "draft") {
      assertAuthority(envelope);
    }

    const workflow = await createWorkflow({
      tenantId: envelope.tenantId,
      name,
      description: typeof description === "string" ? description : undefined,
      adapter,
      config: config && typeof config === "object" ? (config as Record<string, unknown>) : {},
      status: (targetStatus as "draft" | "active" | "archived"),
      createdBy: envelope.personaId,
    });

    return NextResponse.json({ ok: true, workflow }, { status: 201 });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    console.error("[workflows] POST error:", err);
    return NextResponse.json(
      { ok: false, error: err.message ?? "Internal server error" },
      { status: err.status ?? 500 }
    );
  }
}
