/**
 * GET  /api/workflows/:id/manifest/output  — return active OutputManifest
 * PUT  /api/workflows/:id/manifest/output  — upsert (deactivates current, creates new version)
 */

import { NextRequest, NextResponse } from "next/server";
import { getActiveOutputManifest, upsertOutputManifest } from "@/services/workflows/manifestStore";
import { getWorkflow } from "@/services/workflows/store";
import { assertEnvelope } from "@/services/workflows/identityEnvelope";

export const runtime = "nodejs";

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const manifest = await getActiveOutputManifest(id);
    if (!manifest) return NextResponse.json({ ok: false, error: "No active output manifest for this workflow" }, { status: 404 });
    return NextResponse.json({ ok: true, manifest });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message ?? "Internal error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const envelope = assertEnvelope(body.envelope);

    const workflow = await getWorkflow(id);
    if (!workflow) return NextResponse.json({ ok: false, error: "Workflow not found" }, { status: 404 });
    if (workflow.tenantId !== envelope.tenantId) return NextResponse.json({ ok: false, error: "Tenant mismatch" }, { status: 403 });

    if (!Array.isArray(body.fields)) return NextResponse.json({ ok: false, error: "fields must be an array" }, { status: 400 });

    const manifest = await upsertOutputManifest({
      workflowId: id,
      tenantId: envelope.tenantId,
      fields: body.fields,
      successCriteria: body.successCriteria ?? {},
      createdBy: envelope.personaId,
    });
    return NextResponse.json({ ok: true, manifest });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message ?? "Internal error" }, { status: err.status ?? 500 });
  }
}
