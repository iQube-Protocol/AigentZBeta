/**
 * Workflow Invoke API
 *
 * POST /api/workflows/:id/invoke
 *
 * Invokes a workflow via its engine binding. Selects the binding by engine
 * (from body.engine) or defaults to the first binding for the workflow.
 *
 * Body:
 *   { envelope: IdentityEnvelope, engine?: string, input?: unknown }
 */

import { NextRequest, NextResponse } from "next/server";
import { listBindings, updateBinding } from "@/services/workflows/bindingStore";
import { getWorkflow } from "@/services/workflows/store";
import { assertEnvelope } from "@/services/workflows/identityEnvelope";
import { makeAdapter } from "@/services/workflows/adapters/makeAdapter";
import type { WorkflowEngineAdapter } from "@/services/workflows/bindingTypes";
import { getActiveInputManifest, getActiveOutputManifest } from "@/services/workflows/manifestStore";
import { validateInput, normalizeAgainstManifest } from "@/services/workflows/manifestTypes";
import { getChannelQube, postWorkflowInvocationEvent } from "@/services/workflows/channelQubeStore";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function getAdapter(engine: string): WorkflowEngineAdapter | null {
  if (engine === "make") return makeAdapter;
  return null;
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

    const bindings = await listBindings(id);
    if (bindings.length === 0) {
      return NextResponse.json({ ok: false, error: "No engine bindings configured for this workflow" }, { status: 400 });
    }

    const targetEngine: string | undefined = body.engine;
    const binding = targetEngine
      ? bindings.find((b) => b.engine === targetEngine)
      : bindings[0];

    if (!binding) {
      return NextResponse.json({ ok: false, error: `No binding found for engine '${targetEngine}'` }, { status: 400 });
    }

    const adapter = getAdapter(binding.engine);
    if (!adapter) {
      return NextResponse.json({ ok: false, error: `Engine '${binding.engine}' has no registered adapter` }, { status: 400 });
    }

    // Validate inputs against InputManifest if one exists
    const inputManifest = await getActiveInputManifest(id).catch(() => null);
    if (inputManifest) {
      const missing = validateInput(body.input, inputManifest);
      if (missing.length > 0) {
        return NextResponse.json(
          { ok: false, error: `Missing required inputs: ${missing.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const result = await adapter.invoke(binding, body.input);

    // Normalize output against OutputManifest if one exists
    const outputManifest = await getActiveOutputManifest(id).catch(() => null);
    const normalizedOutput = (outputManifest && result.output != null)
      ? normalizeAgainstManifest(result.output, outputManifest)
      : result.output;

    // Update health state based on invocation outcome (non-blocking)
    updateBinding(binding.id, {
      healthState: result.ok ? "healthy" : "degraded",
      lastHealthCheckedAt: new Date().toISOString(),
    }).catch(() => {});

    // Post QubeTalk event to bound channel if configured (non-blocking)
    getChannelQube(id).then((channel) => {
      if (channel?.active) {
        return postWorkflowInvocationEvent(channel, {
          workflowId: id,
          executionId: result.executionId,
          status: result.ok ? "started" : "failed",
          input: body.input,
        });
      }
    }).catch(() => {});

    return NextResponse.json({
      ok: result.ok,
      executionId: result.executionId,
      output: normalizedOutput,
      error: result.error,
    });
  } catch (err: any) {
    console.error("POST /api/workflows/[id]/invoke error:", err);
    return NextResponse.json({ ok: false, error: err.message ?? "Internal error" }, { status: err.status ?? 500 });
  }
}
