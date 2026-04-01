import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import { WorkflowRun, WorkflowRunEvent } from "./types";

const RUNS_TABLE = "workflow_runs";
const EVENTS_TABLE = "workflow_run_events";

type RunRow = {
  id: string; workflow_id: string; tenant_id: string; triggered_by: string;
  status: string; input: unknown; output: unknown; error: string | null;
  started_at: string | null; completed_at: string | null; created_at: string;
  execution_id: string | null;
};
type EventRow = { id: string; run_id: string; event_type: string; step_name: string | null; data: unknown; ts: string };

function runRowToModel(row: RunRow): WorkflowRun & { executionId?: string } {
  return {
    id: row.id, workflowId: row.workflow_id, tenantId: row.tenant_id,
    triggeredBy: row.triggered_by,
    status: row.status as WorkflowRun["status"],
    input: row.input ?? undefined, output: row.output ?? undefined,
    error: row.error ?? undefined,
    startedAt: row.started_at ?? undefined, completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
    executionId: (row as any).execution_id ?? undefined,
  };
}

function eventRowToModel(row: EventRow): WorkflowRunEvent {
  return {
    id: row.id, runId: row.run_id,
    eventType: row.event_type as WorkflowRunEvent["eventType"],
    stepName: row.step_name ?? undefined, data: row.data, ts: row.ts,
  };
}

function requireSupabase() {
  const client = getSupabaseServer();
  if (!client) throw new Error("Supabase unavailable — cannot access workflow_runs");
  return client;
}

export async function createWorkflowRun(
  params: Pick<WorkflowRun, "workflowId" | "tenantId" | "triggeredBy"> & { input?: unknown }
): Promise<WorkflowRun> {
  const sb = requireSupabase();
  const now = new Date().toISOString();
  const { data, error } = await sb.from(RUNS_TABLE).insert({
    workflow_id: params.workflowId, tenant_id: params.tenantId,
    triggered_by: params.triggeredBy,
    status: "running", input: params.input ?? null,
    started_at: now, created_at: now,
  }).select().single();
  if (error) throw new Error(`createWorkflowRun failed: ${error.message}`);
  return runRowToModel(data as RunRow);
}

export async function updateWorkflowRun(
  id: string,
  patch: Partial<Pick<WorkflowRun, "status" | "output" | "error" | "completedAt">> & { executionId?: string }
): Promise<WorkflowRun> {
  const sb = requireSupabase();
  const updates: Record<string, unknown> = {};
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.output !== undefined) updates.output = patch.output;
  if (patch.error !== undefined) updates.error = patch.error;
  if (patch.completedAt !== undefined) updates.completed_at = patch.completedAt;
  if (patch.executionId !== undefined) updates.execution_id = patch.executionId;

  const { data, error } = await sb.from(RUNS_TABLE).update(updates).eq("id", id).select().single();
  if (error) throw new Error(`updateWorkflowRun failed: ${error.message}`);
  return runRowToModel(data as RunRow);
}

export async function getWorkflowRun(id: string): Promise<(WorkflowRun & { executionId?: string }) | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.from(RUNS_TABLE).select("*").eq("id", id).single();
  if (error) return null;
  return runRowToModel(data as RunRow);
}

export async function listWorkflowRuns(workflowId: string, limit = 20): Promise<WorkflowRun[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from(RUNS_TABLE).select("*")
    .eq("workflow_id", workflowId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listWorkflowRuns failed: ${error.message}`);
  return (data ?? []).map((r) => runRowToModel(r as RunRow));
}

export async function appendRunEvent(
  runId: string,
  eventType: WorkflowRunEvent["eventType"],
  stepName?: string,
  data?: unknown
): Promise<void> {
  const sb = requireSupabase();
  await sb.from(EVENTS_TABLE).insert({
    run_id: runId, event_type: eventType,
    step_name: stepName ?? null, data: data ?? null,
    ts: new Date().toISOString(),
  });
}

export async function listRunEvents(runId: string): Promise<WorkflowRunEvent[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from(EVENTS_TABLE).select("*")
    .eq("run_id", runId).order("ts", { ascending: true });
  if (error) return [];
  return (data ?? []).map((r) => eventRowToModel(r as EventRow));
}
