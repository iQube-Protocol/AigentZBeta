import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import { ExecutionReceiptQube, ExecutionReceiptType, ExecutionReceiptStatus } from "./executionReceiptTypes";

const TABLE = "execution_receipts";

type Row = {
  id: string;
  pipeline_run_id: string | null;
  workflow_id: string | null;
  tenant_id: string;
  receipt_type: string;
  status: string;
  dvn_message_id: string | null;
  dvn_submitted_at: string | null;
  from_agent_id: string | null;
  to_agent_id: string | null;
  task_completed: string | null;
  policy_evaluation: Record<string, unknown>;
  result_data: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

function rowToModel(row: Row): ExecutionReceiptQube {
  return {
    id: row.id,
    pipelineRunId: row.pipeline_run_id ?? undefined,
    workflowId: row.workflow_id ?? undefined,
    tenantId: row.tenant_id,
    receiptType: row.receipt_type as ExecutionReceiptType,
    status: row.status as ExecutionReceiptStatus,
    dvnMessageId: row.dvn_message_id ?? undefined,
    dvnSubmittedAt: row.dvn_submitted_at ?? undefined,
    fromAgentId: row.from_agent_id ?? undefined,
    toAgentId: row.to_agent_id ?? undefined,
    taskCompleted: row.task_completed ?? undefined,
    policyEvaluation: row.policy_evaluation ?? {},
    resultData: row.result_data ?? {},
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requireSupabase() {
  const client = getSupabaseServer();
  if (!client) throw new Error("Supabase client unavailable — cannot access execution_receipts");
  return client;
}

export async function createExecutionReceipt(
  params: Pick<ExecutionReceiptQube, "tenantId" | "receiptType"> &
    Partial<Pick<ExecutionReceiptQube, "pipelineRunId" | "workflowId" | "fromAgentId" | "toAgentId" | "taskCompleted" | "dvnMessageId" | "dvnSubmittedAt" | "status" | "policyEvaluation" | "resultData" | "metadata">>
): Promise<ExecutionReceiptQube> {
  const sb = requireSupabase();
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from(TABLE)
    .insert({
      pipeline_run_id: params.pipelineRunId ?? null,
      workflow_id: params.workflowId ?? null,
      tenant_id: params.tenantId,
      receipt_type: params.receiptType,
      status: params.status ?? "pending",
      dvn_message_id: params.dvnMessageId ?? null,
      dvn_submitted_at: params.dvnSubmittedAt ?? null,
      from_agent_id: params.fromAgentId ?? null,
      to_agent_id: params.toAgentId ?? null,
      task_completed: params.taskCompleted ?? null,
      policy_evaluation: params.policyEvaluation ?? {},
      result_data: params.resultData ?? {},
      metadata: params.metadata ?? {},
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error) throw new Error(`createExecutionReceipt failed: ${error.message}`);
  return rowToModel(data as Row);
}

export async function getExecutionReceiptByRunId(pipelineRunId: string): Promise<ExecutionReceiptQube | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from(TABLE)
    .select("*")
    .eq("pipeline_run_id", pipelineRunId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return rowToModel(data as Row);
}

export async function updateExecutionReceipt(
  id: string,
  patch: Partial<Pick<ExecutionReceiptQube, "status" | "dvnMessageId" | "dvnSubmittedAt" | "metadata" | "resultData">>
): Promise<ExecutionReceiptQube> {
  const sb = requireSupabase();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.dvnMessageId !== undefined) updates.dvn_message_id = patch.dvnMessageId;
  if (patch.dvnSubmittedAt !== undefined) updates.dvn_submitted_at = patch.dvnSubmittedAt;
  if (patch.metadata !== undefined) updates.metadata = patch.metadata;
  if (patch.resultData !== undefined) updates.result_data = patch.resultData;

  const { data, error } = await sb.from(TABLE).update(updates).eq("id", id).select().single();
  if (error) throw new Error(`updateExecutionReceipt failed: ${error.message}`);
  return rowToModel(data as Row);
}
