import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import { WorkflowEngineBinding, WorkflowEngine } from "./bindingTypes";

const TABLE = "workflow_engine_bindings";

type Row = {
  id: string;
  workflow_id: string;
  tenant_id: string;
  engine: string;
  deployment_mode: string;
  backend_ids: Record<string, string>;
  compiled_artifact_ref: string | null;
  credential_policy: Record<string, unknown>;
  health_state: string;
  validation_status: string;
  last_health_checked_at: string | null;
  last_validated_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

function rowToModel(row: Row): WorkflowEngineBinding {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    tenantId: row.tenant_id,
    engine: row.engine as WorkflowEngine,
    deploymentMode: row.deployment_mode as WorkflowEngineBinding["deploymentMode"],
    backendIds: row.backend_ids ?? {},
    compiledArtifactRef: row.compiled_artifact_ref ?? undefined,
    credentialPolicy: row.credential_policy ?? {},
    healthState: row.health_state as WorkflowEngineBinding["healthState"],
    validationStatus: row.validation_status as WorkflowEngineBinding["validationStatus"],
    lastHealthCheckedAt: row.last_health_checked_at ?? undefined,
    lastValidatedAt: row.last_validated_at ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requireSupabase() {
  const client = getSupabaseServer();
  if (!client) throw new Error("Supabase client unavailable — cannot access workflow_engine_bindings");
  return client;
}

export async function listBindings(workflowId: string): Promise<WorkflowEngineBinding[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from(TABLE)
    .select("*")
    .eq("workflow_id", workflowId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listBindings failed: ${error.message}`);
  return (data as Row[]).map(rowToModel);
}

export async function getBinding(id: string): Promise<WorkflowEngineBinding | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.from(TABLE).select("*").eq("id", id).single();
  if (error) return null;
  return rowToModel(data as Row);
}

export async function createBinding(
  params: Pick<WorkflowEngineBinding, "workflowId" | "tenantId" | "engine" | "deploymentMode" | "backendIds" | "credentialPolicy" | "createdBy"> & {
    compiledArtifactRef?: string;
  }
): Promise<WorkflowEngineBinding> {
  const sb = requireSupabase();
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from(TABLE)
    .insert({
      workflow_id: params.workflowId,
      tenant_id: params.tenantId,
      engine: params.engine,
      deployment_mode: params.deploymentMode,
      backend_ids: params.backendIds,
      compiled_artifact_ref: params.compiledArtifactRef ?? null,
      credential_policy: params.credentialPolicy,
      health_state: "unknown",
      validation_status: "pending",
      created_by: params.createdBy,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error) throw new Error(`createBinding failed: ${error.message}`);
  return rowToModel(data as Row);
}

export async function updateBinding(
  id: string,
  patch: Partial<Pick<WorkflowEngineBinding, "deploymentMode" | "backendIds" | "compiledArtifactRef" | "credentialPolicy" | "healthState" | "validationStatus" | "lastHealthCheckedAt" | "lastValidatedAt">>
): Promise<WorkflowEngineBinding> {
  const sb = requireSupabase();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.deploymentMode !== undefined) updates.deployment_mode = patch.deploymentMode;
  if (patch.backendIds !== undefined) updates.backend_ids = patch.backendIds;
  if (patch.compiledArtifactRef !== undefined) updates.compiled_artifact_ref = patch.compiledArtifactRef;
  if (patch.credentialPolicy !== undefined) updates.credential_policy = patch.credentialPolicy;
  if (patch.healthState !== undefined) updates.health_state = patch.healthState;
  if (patch.validationStatus !== undefined) updates.validation_status = patch.validationStatus;
  if (patch.lastHealthCheckedAt !== undefined) updates.last_health_checked_at = patch.lastHealthCheckedAt;
  if (patch.lastValidatedAt !== undefined) updates.last_validated_at = patch.lastValidatedAt;

  const { data, error } = await sb.from(TABLE).update(updates).eq("id", id).select().single();
  if (error) throw new Error(`updateBinding failed: ${error.message}`);
  return rowToModel(data as Row);
}

export async function deleteBinding(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(`deleteBinding failed: ${error.message}`);
}

export async function countBindingRows(): Promise<number> {
  const sb = requireSupabase();
  const { count, error } = await sb.from(TABLE).select("*", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}
