/**
 * GET  /api/workflows/:id/channel  — return ChannelQube binding for a workflow
 * PUT  /api/workflows/:id/channel  — upsert channel binding (create or update)
 */

import { NextRequest, NextResponse } from "next/server";
import { getChannelQube, upsertChannelQube } from "@/services/workflows/channelQubeStore";
import { getWorkflow } from "@/services/workflows/store";
import { assertEnvelope } from "@/services/workflows/identityEnvelope";

export const runtime = "nodejs";

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const channel = await getChannelQube(id);
    if (!channel) return NextResponse.json({ ok: false, error: "No channel binding for this workflow" }, { status: 404 });
    return NextResponse.json({ ok: true, channel });
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

    if (!body.channelName || !body.thread) {
      return NextResponse.json({ ok: false, error: "channelName and thread are required" }, { status: 400 });
    }

    const channel = await upsertChannelQube({
      workflowId: id,
      tenantId: envelope.tenantId,
      channelName: body.channelName,
      thread: body.thread,
      participatingAgents: body.participatingAgents ?? [],
      policyRef: body.policyRef,
      active: body.active ?? true,
      createdBy: envelope.personaId,
    });
    return NextResponse.json({ ok: true, channel });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message ?? "Internal error" }, { status: err.status ?? 500 });
  }
}
