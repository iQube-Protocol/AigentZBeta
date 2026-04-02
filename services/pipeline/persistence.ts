import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import { PipelineRun, PipelineStageEvent, PipelineRunEvent, PipelineIdentityEnvelope } from "./types";

const RUNS_TABLE = "pipeline_runs";
const EVENTS_TABLE = "pipeline_run_events";

type RunRow = {
  pipeline_run_id: string;
  tenant_id: string;
  initiated_by: string;
  initiated_via: string;
  current_stage: string;
  stage_history: PipelineStageEvent[];
  identity_envelope: PipelineIdentityEnvelope;
  template_ref: string | null;
  workflow_ref: string | null;
  status: string;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  failure_reason: string | null;
  receipt_refs: string[];
};

function rowToModel(row: RunRow): PipelineRun {
  return {
    pipelineRunId: row.pipeline_run_id,
    tenantId: row.tenant_id,
    initiatedBy: row.initiated_by,
    initiatedVia: row.initiated_via as PipelineRun["initiatedVia"],
    currentStage: row.current_stage as PipelineRun["currentStage"],
    stageHistory: row.stage_history ?? [],
    identityEnvelope: row.identity_envelope,
    templateRef: row.template_ref ?? undefined,
    workflowRef: row.workflow_ref ?? undefined,
    status: row.status as PipelineRun["status"],
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
    failureReason: row.failure_reason ?? undefined,
    receiptRefs: row.receipt_refs ?? [],
  };
}

function requireSupabase() {
  const supabase = getSupabaseServer();
  if (!supabase) {
    throw new Error(
      "Pipeline persistence unavailable — Supabase client could not be initialised. " +
      "Check SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL environment variables."
    );
  }
  return supabase;
}

export async function createPipelineRun(
  fields: Omit<PipelineRun, "startedAt" | "updatedAt">
): Promise<PipelineRun> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(RUNS_TABLE)
    .insert({
      pipeline_run_id: fields.pipelineRunId,
      tenant_id: fields.tenantId,
      initiated_by: fields.initiatedBy,
      initiated_via: fields.initiatedVia,
      current_stage: fields.currentStage,
      stage_history: fields.stageHistory ?? [],
      identity_envelope: fields.identityEnvelope,
      template_ref: fields.templateRef ?? null,
      workflow_ref: fields.workflowRef ?? null,
      status: fields.status,
      failure_reason: fields.failureReason ?? null,
      receipt_refs: fields.receiptRefs ?? [],
    })
    .select("*")
    .single();

  if (error) throw new Error(`Pipeline run create failed: ${error.message}`);
  return rowToModel(data as RunRow);
}

export async function updatePipelineRun(
  runId: string,
  patch: Partial<Pick<PipelineRun, "currentStage" | "stageHistory" | "status" | "completedAt" | "failureReason" | "receiptRefs" | "workflowRef">>
): Promise<PipelineRun> {
  const supabase = requireSupabase();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.currentStage !== undefined) row.current_stage = patch.currentStage;
  if (patch.stageHistory !== undefined) row.stage_history = patch.stageHistory;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.completedAt !== undefined) row.completed_at = patch.completedAt;
  if (patch.failureReason !== undefined) row.failure_reason = patch.failureReason;
  if (patch.receiptRefs !== undefined) row.receipt_refs = patch.receiptRefs;
  if (patch.workflowRef !== undefined) row.workflow_ref = patch.workflowRef;

  const { data, error } = await supabase
    .from(RUNS_TABLE)
    .update(row)
    .eq("pipeline_run_id", runId)
    .select("*")
    .single();

  if (error) throw new Error(`Pipeline run update failed: ${error.message}`);
  return rowToModel(data as RunRow);
}

export async function getPipelineRun(runId: string): Promise<PipelineRun | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(RUNS_TABLE)
    .select("*")
    .eq("pipeline_run_id", runId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return rowToModel(data as RunRow);
}

export async function appendPipelineEvent(
  runId: string,
  eventType: string,
  stage?: string,
  data?: unknown
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from(EVENTS_TABLE).insert({
    run_id: runId,
    event_type: eventType,
    stage: stage ?? null,
    data: data ?? null,
  });
  if (error) console.error(`[pipeline] appendPipelineEvent error: ${error.message}`);
}

export async function listPipelineRunEvents(runId: string): Promise<PipelineRunEvent[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(EVENTS_TABLE)
    .select("*")
    .eq("run_id", runId)
    .order("ts", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    runId: r.run_id,
    eventType: r.event_type,
    stage: r.stage ?? undefined,
    data: r.data ?? undefined,
    ts: r.ts,
  }));
}

export async function listPipelineRuns(
  tenantId: string,
  limit = 10
): Promise<PipelineRun[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(RUNS_TABLE)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Pipeline run list failed: ${error.message}`);
  return (data ?? []).map((row) => rowToModel(row as RunRow));
}

export async function countPipelineRows(): Promise<{ runs: number; events: number }> {
  const supabase = getSupabaseServer();
  if (!supabase) return { runs: 0, events: 0 };

  const [runsResult, eventsResult] = await Promise.all([
    supabase.from(RUNS_TABLE).select("pipeline_run_id", { count: "exact", head: true }),
    supabase.from(EVENTS_TABLE).select("id", { count: "exact", head: true }),
  ]);

  return {
    runs: runsResult.count ?? 0,
    events: eventsResult.count ?? 0,
  };
}
