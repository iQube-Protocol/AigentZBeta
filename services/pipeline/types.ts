export interface PipelineIdentityEnvelope {
  tenantId: string;
  userId?: string;
  personaId: string;
  /** The agent driving this pipeline run, e.g. "aigent-z", "aigent-c", "marketa" */
  agentId?: string;
  sourceOfTruth: "wallet-active" | "persona-service" | "fallback" | "explicit";
  resolvedAt: string;
  resolutionStatus: "resolved" | "partial" | "failed";
  /** Reference to a QubeTalk policy evaluation result, if one was performed */
  policyContextRef?: string;
}

export type PipelineStage =
  | "intent.accepted"
  | "identity.resolving"
  | "identity.resolved"
  | "policy.checking"
  | "policy.blocked"
  | "template.selected"
  | "workflow.selected"
  | "session.created"
  | "bundle.generated"
  | "preview.ready"
  | "deploy.runtime.started"
  | "deploy.runtime.completed"
  | "deploy.distribution.started"
  | "deploy.distribution.completed"
  | "receipt.recorded"
  | "pipeline.completed"
  | "pipeline.failed";

export type PipelineStatus = "running" | "completed" | "failed" | "blocked";

export interface PipelineStageEvent {
  stage: PipelineStage;
  enteredAt: string;
  exitedAt?: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface PipelineRun {
  pipelineRunId: string;
  tenantId: string;
  initiatedBy: string;  // personaId
  initiatedVia: "studio-composer" | "marketa" | "api" | "qubetalk" | "system";
  currentStage: PipelineStage;
  stageHistory: PipelineStageEvent[];
  identityEnvelope: PipelineIdentityEnvelope;
  templateRef?: string;
  workflowRef?: string;
  status: PipelineStatus;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  failureReason?: string;
  receiptRefs: string[];
}

export interface PipelineRunEvent {
  id: string;
  runId: string;
  eventType: string;
  stage?: string;
  data?: unknown;
  ts: string;
}
