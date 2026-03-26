/**
 * Workflow Engine Bindings API
 *
 * GET  /api/workflows/:id/bindings         — List all engine bindings for a workflow
 * POST /api/workflows/:id/bindings         — Create a new engine binding
 */

import { NextRequest, NextResponse } from "next/server";
import { listBindings, createBinding } from "@/services/workflows/bindingStore";
import { getWorkflow } from "@/services/workflows/store";
import { assertEnvelope } from "@/services/workflows/identityEnvelope";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const workflow = await getWorkflow(id);
    if (!workflow) {
      return NextResponse.json({ ok: false, error: "Workflow not found" }, { status: 404 });
    }
    const bindings = await listBindings(id);
    return NextResponse.json({ ok: true, bindings });
  } catch (err: any) {
    console.error("GET /api/workflows/[id]/bindings error:", err);
    return NextResponse.json({ ok: false, error: err.message ?? "Internal error" }, { status: err.status ?? 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const envelope = assertEnvelope(body.envelope);

    const workflow = await getWorkflow(id);
    if (!workflow) {
      return NextResponse.json({ ok: false, error: "Workflow not found" }, { status: 404 });
    }
    if (workflow.tenantId !== envelope.tenantId) {
      return NextResponse.json({ ok: false, error: "Tenant mismatch" }, { status: 403 });
    }

    const { engine, deploymentMode, backendIds, credentialPolicy, compiledArtifactRef } = body;
    if (!engine) {
      return NextResponse.json({ ok: false, error: "engine is required" }, { status: 400 });
    }

    const binding = await createBinding({
      workflowId: id,
      tenantId: envelope.tenantId,
      engine,
      deploymentMode: deploymentMode ?? "manual",
      backendIds: backendIds ?? {},
      credentialPolicy: credentialPolicy ?? {},
      compiledArtifactRef,
      createdBy: envelope.personaId,
    });

    return NextResponse.json({ ok: true, binding }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/workflows/[id]/bindings error:", err);
    return NextResponse.json({ ok: false, error: err.message ?? "Internal error" }, { status: err.status ?? 500 });
  }
}
