import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import { InputManifest, OutputManifest, ManifestField } from "./manifestTypes";

function requireSupabase() {
  const client = getSupabaseServer();
  if (!client) throw new Error("Supabase client unavailable — cannot access workflow manifests");
  return client;
}

// ── Input Manifest ──────────────────────────────────────────────────────────

type InputRow = {
  id: string; workflow_id: string; tenant_id: string; version: number;
  fields: ManifestField[]; is_active: boolean; created_by: string;
  created_at: string; updated_at: string;
};
type OutputRow = InputRow & { success_criteria: Record<string, unknown> };

function inputRowToModel(row: InputRow): InputManifest {
  return {
    id: row.id, workflowId: row.workflow_id, tenantId: row.tenant_id,
    version: row.version, fields: row.fields ?? [],
    isActive: row.is_active, createdBy: row.created_by,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function outputRowToModel(row: OutputRow): OutputManifest {
  return {
    id: row.id, workflowId: row.workflow_id, tenantId: row.tenant_id,
    version: row.version, fields: row.fields ?? [],
    successCriteria: row.success_criteria ?? {},
    isActive: row.is_active, createdBy: row.created_by,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export async function getActiveInputManifest(workflowId: string): Promise<InputManifest | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("workflow_input_manifests")
    .select("*")
    .eq("workflow_id", workflowId)
    .eq("is_active", true)
    .single();
  if (error) return null;
  return inputRowToModel(data as InputRow);
}

export async function upsertInputManifest(
  params: Pick<InputManifest, "workflowId" | "tenantId" | "fields" | "createdBy"> & { version?: number }
): Promise<InputManifest> {
  const sb = requireSupabase();
  const now = new Date().toISOString();

  // Deactivate existing active manifest
  await sb.from("workflow_input_manifests")
    .update({ is_active: false, updated_at: now })
    .eq("workflow_id", params.workflowId)
    .eq("is_active", true);

  // Get next version number
  const { count } = await sb.from("workflow_input_manifests")
    .select("*", { count: "exact", head: true })
    .eq("workflow_id", params.workflowId);
  const version = (count ?? 0) + 1;

  const { data, error } = await sb.from("workflow_input_manifests").insert({
    workflow_id: params.workflowId, tenant_id: params.tenantId,
    version, fields: params.fields, is_active: true,
    created_by: params.createdBy, created_at: now, updated_at: now,
  }).select().single();
  if (error) throw new Error(`upsertInputManifest failed: ${error.message}`);
  return inputRowToModel(data as InputRow);
}

// ── Output Manifest ─────────────────────────────────────────────────────────

export async function getActiveOutputManifest(workflowId: string): Promise<OutputManifest | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("workflow_output_manifests")
    .select("*")
    .eq("workflow_id", workflowId)
    .eq("is_active", true)
    .single();
  if (error) return null;
  return outputRowToModel(data as OutputRow);
}

export async function upsertOutputManifest(
  params: Pick<OutputManifest, "workflowId" | "tenantId" | "fields" | "successCriteria" | "createdBy"> & { version?: number }
): Promise<OutputManifest> {
  const sb = requireSupabase();
  const now = new Date().toISOString();

  await sb.from("workflow_output_manifests")
    .update({ is_active: false, updated_at: now })
    .eq("workflow_id", params.workflowId)
    .eq("is_active", true);

  const { count } = await sb.from("workflow_output_manifests")
    .select("*", { count: "exact", head: true })
    .eq("workflow_id", params.workflowId);
  const version = (count ?? 0) + 1;

  const { data, error } = await sb.from("workflow_output_manifests").insert({
    workflow_id: params.workflowId, tenant_id: params.tenantId,
    version, fields: params.fields,
    success_criteria: params.successCriteria ?? {},
    is_active: true, created_by: params.createdBy,
    created_at: now, updated_at: now,
  }).select().single();
  if (error) throw new Error(`upsertOutputManifest failed: ${error.message}`);
  return outputRowToModel(data as OutputRow);
}
