import { randomUUID } from "crypto";
import {
  PipelineRun,
  PipelineStage,
  PipelineIdentityEnvelope,
} from "./types";
import {
  createPipelineRun,
  updatePipelineRun,
  getPipelineRun,
  appendPipelineEvent,
} from "./persistence";

// Stages that require Aigent Z / Agent Z authority.
// Studio and Marketa may initiate and advance up to preview.ready.
// Only the authoritative agent may commit state past that boundary.
const AUTHORITATIVE_STAGES: PipelineStage[] = [
  "deploy.runtime.started",
  "deploy.runtime.completed",
  "deploy.distribution.started",
  "deploy.distribution.completed",
  "receipt.recorded",
];

// Comma-separated agentIds from env, e.g. "aigent-z,agent-z"
const AUTHORITATIVE_AGENTS: string[] = process.env.PIPELINE_AUTHORITATIVE_AGENTS
  ? process.env.PIPELINE_AUTHORITATIVE_AGENTS.split(",").map((s) => s.trim()).filter(Boolean)
  : [];

function isAuthoritativeAgent(agentId?: string): boolean {
  if (!agentId) return false;
  if (AUTHORITATIVE_AGENTS.length > 0) return AUTHORITATIVE_AGENTS.includes(agentId);
  const lower = agentId.toLowerCase();
  return lower.includes("aigent-z") || lower.includes("agent-z");
}

class ExperiencePipelineOrchestrator {
  async initiate(params: {
    tenantId: string;
    userId?: string;
    personaId: string;
    agentId?: string;
    initiatedVia: PipelineRun["initiatedVia"];
    templateRef?: string;
    resolutionStatus?: PipelineIdentityEnvelope["resolutionStatus"];
    sourceOfTruth?: PipelineIdentityEnvelope["sourceOfTruth"];
  }): Promise<PipelineRun> {
    const pipelineRunId = `run_${Date.now()}_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const now = new Date().toISOString();

    const identityEnvelope: PipelineIdentityEnvelope = {
      tenantId: params.tenantId,
      userId: params.userId,
      personaId: params.personaId,
      agentId: params.agentId,
      sourceOfTruth: params.sourceOfTruth ?? "fallback",
      resolvedAt: now,
      resolutionStatus: params.resolutionStatus ?? "resolved",
    };

    const run = await createPipelineRun({
      pipelineRunId,
      tenantId: params.tenantId,
      initiatedBy: params.personaId,
      initiatedVia: params.initiatedVia,
      currentStage: "intent.accepted",
      stageHistory: [{ stage: "intent.accepted", enteredAt: now }],
      identityEnvelope,
      templateRef: params.templateRef,
      status: "running",
      receiptRefs: [],
    });

    await appendPipelineEvent(pipelineRunId, "pipeline.stage.changed", "intent.accepted");
    return run;
  }

  async transition(
    runId: string,
    toStage: PipelineStage,
    meta?: Record<string, unknown>
  ): Promise<PipelineRun> {
    const existing = await getPipelineRun(runId);
    if (!existing) throw { status: 404, message: `PipelineRun ${runId} not found` };
    if (existing.status !== "running") {
      throw { status: 409, message: `PipelineRun ${runId} is already in terminal state: ${existing.status}` };
    }

    // Authority check for deploy-and-beyond stages
    if (AUTHORITATIVE_STAGES.includes(toStage) && !isAuthoritativeAgent(existing.identityEnvelope.agentId)) {
      throw {
        status: 403,
        message: `Agent '${existing.identityEnvelope.agentId ?? "unknown"}' is not authorised to advance pipeline to stage '${toStage}'. Only Aigent Z / Agent Z may commit deploy-phase state.`,
      };
    }

    const now = new Date().toISOString();
    const updatedHistory = [
      ...existing.stageHistory.map((e) =>
        e.stage === existing.currentStage && !e.exitedAt ? { ...e, exitedAt: now } : e
      ),
      { stage: toStage, enteredAt: now, ...(meta ? { metadata: meta } : {}) },
    ];

    const updated = await updatePipelineRun(runId, {
      currentStage: toStage,
      stageHistory: updatedHistory,
    });

    await appendPipelineEvent(runId, "pipeline.stage.changed", toStage, meta);
    return updated;
  }

  async complete(runId: string, receiptRef?: string): Promise<PipelineRun> {
    const existing = await getPipelineRun(runId);
    if (!existing) throw { status: 404, message: `PipelineRun ${runId} not found` };

    const now = new Date().toISOString();
    const updatedHistory = [
      ...existing.stageHistory.map((e) =>
        e.stage === existing.currentStage && !e.exitedAt ? { ...e, exitedAt: now } : e
      ),
      { stage: "pipeline.completed" as PipelineStage, enteredAt: now },
    ];

    const receiptRefs = receiptRef
      ? [...existing.receiptRefs, receiptRef]
      : existing.receiptRefs;

    const updated = await updatePipelineRun(runId, {
      currentStage: "pipeline.completed",
      stageHistory: updatedHistory,
      status: "completed",
      completedAt: now,
      receiptRefs,
    });

    await appendPipelineEvent(runId, "pipeline.completed", "pipeline.completed");
    return updated;
  }

  async fail(runId: string, reason: string): Promise<PipelineRun> {
    const existing = await getPipelineRun(runId);
    if (!existing) throw { status: 404, message: `PipelineRun ${runId} not found` };

    const now = new Date().toISOString();
    const updatedHistory = [
      ...existing.stageHistory.map((e) =>
        e.stage === existing.currentStage && !e.exitedAt
          ? { ...e, exitedAt: now, error: reason }
          : e
      ),
      { stage: "pipeline.failed" as PipelineStage, enteredAt: now, error: reason },
    ];

    const updated = await updatePipelineRun(runId, {
      currentStage: "pipeline.failed",
      stageHistory: updatedHistory,
      status: "failed",
      completedAt: now,
      failureReason: reason,
    });

    await appendPipelineEvent(runId, "pipeline.failed", "pipeline.failed", { reason });
    return updated;
  }

  async block(runId: string, reason: string): Promise<PipelineRun> {
    const existing = await getPipelineRun(runId);
    if (!existing) throw { status: 404, message: `PipelineRun ${runId} not found` };

    const now = new Date().toISOString();
    const updatedHistory = [
      ...existing.stageHistory.map((e) =>
        e.stage === existing.currentStage && !e.exitedAt
          ? { ...e, exitedAt: now, error: reason }
          : e
      ),
      { stage: "policy.blocked" as PipelineStage, enteredAt: now, error: reason },
    ];

    const updated = await updatePipelineRun(runId, {
      currentStage: "policy.blocked",
      stageHistory: updatedHistory,
      status: "blocked",
      completedAt: now,
      failureReason: reason,
    });

    await appendPipelineEvent(runId, "policy.blocked", "policy.blocked", { reason });
    return updated;
  }

  async getRunById(runId: string): Promise<PipelineRun | null> {
    return getPipelineRun(runId);
  }
}

let instance: ExperiencePipelineOrchestrator | null = null;

export function getPipelineOrchestrator(): ExperiencePipelineOrchestrator {
  if (!instance) instance = new ExperiencePipelineOrchestrator();
  return instance;
}
