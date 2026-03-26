import { NextRequest, NextResponse } from "next/server";
import { getWorkflow, updateWorkflow, deleteWorkflow } from "@/services/workflows/store";
import { assertEnvelope, assertAuthority } from "@/services/workflows/identityEnvelope";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workflow = await getWorkflow(params.id);
    if (!workflow) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, workflow });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    console.error("[workflows/:id] GET error:", err);
    return NextResponse.json(
      { ok: false, error: err.message ?? "Internal server error" },
      { status: err.status ?? 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const envelope = assertEnvelope(body);
    assertAuthority(envelope);

    const existing = await getWorkflow(params.id);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    if (existing.tenantId !== envelope.tenantId) {
      return NextResponse.json({ ok: false, error: "Tenant mismatch" }, { status: 403 });
    }

    const { name, description, adapter, config, status } = body;
    const workflow = await updateWorkflow(params.id, {
      ...(typeof name === "string" ? { name } : {}),
      ...(typeof description === "string" ? { description } : {}),
      ...(typeof adapter === "string" ? { adapter } : {}),
      ...(config && typeof config === "object" ? { config: config as Record<string, unknown> } : {}),
      ...(typeof status === "string" ? { status: status as "draft" | "active" | "archived" } : {}),
    });

    return NextResponse.json({ ok: true, workflow });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    console.error("[workflows/:id] PUT error:", err);
    return NextResponse.json(
      { ok: false, error: err.message ?? "Internal server error" },
      { status: err.status ?? 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const envelope = assertEnvelope(body);
    assertAuthority(envelope);

    const existing = await getWorkflow(params.id);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    if (existing.tenantId !== envelope.tenantId) {
      return NextResponse.json({ ok: false, error: "Tenant mismatch" }, { status: 403 });
    }

    await deleteWorkflow(params.id);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    console.error("[workflows/:id] DELETE error:", err);
    return NextResponse.json(
      { ok: false, error: err.message ?? "Internal server error" },
      { status: err.status ?? 500 }
    );
  }
}
