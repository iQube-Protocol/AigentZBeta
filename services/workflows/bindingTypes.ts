export type WorkflowEngine = "make" | "n8n" | "inline" | "openClaw" | "aci";
export type DeploymentMode = "auto" | "manual" | "scheduled";
export type HealthState = "healthy" | "degraded" | "unreachable" | "unknown";
export type ValidationStatus = "pending" | "valid" | "invalid" | "stale";

export interface WorkflowEngineBinding {
  id: string;
  workflowId: string;
  tenantId: string;
  engine: WorkflowEngine;
  deploymentMode: DeploymentMode;
  /** Engine-specific identifier map, e.g. { scenarioId: "123" } for Make */
  backendIds: Record<string, string>;
  compiledArtifactRef?: string;
  credentialPolicy: Record<string, unknown>;
  healthState: HealthState;
  validationStatus: ValidationStatus;
  lastHealthCheckedAt?: string;
  lastValidatedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ── Adapter contract ────────────────────────────────────────────────────────

export interface AdapterInvokeResult {
  ok: boolean;
  executionId?: string;
  output?: unknown;
  error?: string;
}

export interface AdapterValidateResult {
  valid: boolean;
  errors?: string[];
}

export interface AdapterHealthResult {
  state: HealthState;
  latencyMs?: number;
  detail?: string;
}

/**
 * Contract that every engine adapter must implement.
 * Each method is optional so adapters can declare partial capability.
 */
export interface WorkflowEngineAdapter {
  readonly engine: WorkflowEngine;

  /** Validate that the binding config is coherent and engine-reachable */
  validate?(binding: WorkflowEngineBinding): Promise<AdapterValidateResult>;

  /** Deploy (or redeploy) the workflow to the engine */
  deploy?(binding: WorkflowEngineBinding, definition: Record<string, unknown>): Promise<{ ok: boolean; backendIds?: Record<string, string>; error?: string }>;

  /** Invoke a deployed workflow run */
  invoke(binding: WorkflowEngineBinding, input?: unknown): Promise<AdapterInvokeResult>;

  /** Cancel a running execution */
  cancel?(binding: WorkflowEngineBinding, executionId: string): Promise<{ ok: boolean; error?: string }>;

  /** Poll the status of an execution */
  getStatus?(binding: WorkflowEngineBinding, executionId: string): Promise<{ status: string; output?: unknown; error?: string }>;

  /** Fetch evidence / audit trail for a completed execution */
  fetchEvidence?(binding: WorkflowEngineBinding, executionId: string): Promise<unknown>;

  /** Normalize engine-specific output to a canonical shape */
  normalizeOutput?(raw: unknown): unknown;

  /** Probe engine reachability */
  healthCheck?(binding: WorkflowEngineBinding): Promise<AdapterHealthResult>;
}
