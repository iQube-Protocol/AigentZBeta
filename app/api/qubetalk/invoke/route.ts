/**
 * QubeTalk-Native Workflow Invocation Lane
 *
 * POST /api/qubetalk/invoke
 *
 * Accepts a delegation-style message from QubeTalk, resolves the target
 * workflow, initiates a PipelineRun with initiatedVia: "qubetalk", invokes
 * the adapter, and posts the result back to the source channel.
 *
 * Body:
 *   {
 *     envelope: { tenantId: string; personaId: string };
 *     channelId: string;     // QubeTalk channel to post result back to
 *     thread?: string;
 *     workflowId: string;
 *     input?: unknown;
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getWorkflow } from "@/services/workflows/store";
import { listBindings } from "@/services/workflows/bindingStore";
import { assertEnvelope } from "@/services/workflows/identityEnvelope";
import { getAdapter } from "@/services/workflows/adapters";
import { getPipelineOrchestrator } from "@/services/pipeline/orchestrator";
import { createWorkflowRun, updateWorkflowRun, appendRunEvent } from "@/services/workflows/workflowRunStore";
import { qubetalkPersistence } from "@/services/qubetalk/qubetalkPersistence";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      envelope?: { tenantId?: string; personaId?: string };
      channelId?: string;
      thread?: string;
      workflowId?: string;
      input?: unknown;
    };

    // Validate envelope
    const envelope = assertEnvelope(body.envelope);

    if (!body.channelId || typeof body.channelId !== "string") {
      return NextResponse.json({ error: "channelId is required" }, { status: 400 });
    }
    if (!body.workflowId || typeof body.workflowId !== "string") {
      return NextResponse.json({ error: "workflowId is required" }, { status: 400 });
    }

    // Resolve workflow
    const workflow = await getWorkflow(body.workflowId);
    if (!workflow) {
      return NextResponse.json({ error: "workflow not found" }, { status: 404 });
    }
    if (workflow.tenantId !== envelope.tenantId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Start pipeline run with initiatedVia: "qubetalk"
    const orchestrator = getPipelineOrchestrator();
    const pipelineRun = await orchestrator.initiate({
      tenantId: envelope.tenantId,
      personaId: envelope.personaId,
      initiatedVia: "qubetalk",
      templateRef: workflow.id,
    });

    // Resolve adapter
    const bindings = await listBindings(workflow.id);
    const activeBinding = bindings[0];
    if (!activeBinding) {
      await orchestrator.fail(pipelineRun.pipelineRunId, "no active binding");
      return NextResponse.json({ error: "no active binding for workflow" }, { status: 422 });
    }

    const adapter = getAdapter(activeBinding.engine);
    if (!adapter) {
      await orchestrator.fail(pipelineRun.pipelineRunId, "unknown engine");
      return NextResponse.json({ error: `unsupported engine: ${activeBinding.engine}` }, { status: 422 });
    }

    // Create workflow run record
    const workflowRun = await createWorkflowRun({
      workflowId: workflow.id,
      tenantId: envelope.tenantId,
      triggeredBy: envelope.personaId,
      input: typeof body.input === "object" && body.input !== null ? body.input : {},
    });

    await appendRunEvent(workflowRun.id, "step_start", "invoke", { initiatedVia: "qubetalk", channelId: body.channelId });

    // Invoke adapter
    let invokeResult: Awaited<ReturnType<typeof adapter.invoke>>;
    try {
      invokeResult = await adapter.invoke(activeBinding, body.input);
    } catch (err) {
      await updateWorkflowRun(workflowRun.id, { status: "failed", completedAt: new Date().toISOString() });
      await appendRunEvent(workflowRun.id, "error", "invoke", { error: String(err) });
      await orchestrator.fail(pipelineRun.pipelineRunId, String(err));

      // Post failure back to channel
      await qubetalkPersistence.createMessage({
        message_id: randomUUID(),
        channel_id: body.channelId,
        from_agent: { id: "claude-code", role: "system" },
        type: "system",
        content: `Workflow "${workflow.name}" invocation failed: ${String(err)}`,
        metadata: { thread: body.thread, workflowId: workflow.id, runId: workflowRun.id, status: "failed" },
      });

      return NextResponse.json({ ok: false, error: String(err), runId: workflowRun.id }, { status: 500 });
    }

    // Update run with result
    const executionId = invokeResult.executionId;

    await updateWorkflowRun(workflowRun.id, {
      status: "completed",
      output: invokeResult as unknown as Record<string, unknown>,
      executionId: executionId ?? pipelineRun.pipelineRunId,
      completedAt: new Date().toISOString(),
    });
    await appendRunEvent(workflowRun.id, "step_end", "invoke");

    // Advance pipeline
    await orchestrator.complete(pipelineRun.pipelineRunId);

    // Post result back to QubeTalk channel
    await qubetalkPersistence.createMessage({
      message_id: randomUUID(),
      channel_id: body.channelId,
      from_agent: { id: "claude-code", role: "system" },
      type: "response",
      content: `Workflow "${workflow.name}" completed successfully.`,
      metadata: {
        thread: body.thread,
        workflowId: workflow.id,
        runId: workflowRun.id,
        executionId: executionId ?? pipelineRun.pipelineRunId,
        status: "completed",
      },
    });

    return NextResponse.json({
      ok: true,
      runId: workflowRun.id,
      executionId: executionId ?? pipelineRun.pipelineRunId,
      pipelineRunId: pipelineRun.pipelineRunId,
      output: invokeResult,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
