export interface IdentityEnvelope {
  tenantId: string;
  personaId: string;
  /** "authoritative" = only Agent Z / Aigent Z may commit pipeline state; "proposal" = any bound persona */
  authority?: "authoritative" | "proposal";
}

export interface WorkflowDefinition {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  adapter: string;
  config: Record<string, unknown>;
  status: "draft" | "active" | "archived";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowBinding {
  id: string;
  workflowId: string;
  tenantId: string;
  personaId: string;
  role: "owner" | "executor" | "observer";
  createdAt: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  tenantId: string;
  triggeredBy: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  input?: unknown;
  output?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface WorkflowRunEvent {
  id: string;
  runId: string;
  eventType: "step_start" | "step_end" | "adapter_call" | "error" | "log";
  stepName?: string;
  data?: unknown;
  ts: string;
}
