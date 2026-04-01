import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import { WorkflowDefinition } from "./types";

const TABLE = "workflow_definitions";

type Row = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  adapter: string;
  config: Record<string, unknown>;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

function rowToModel(row: Row): WorkflowDefinition {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description ?? undefined,
    adapter: row.adapter,
    config: row.config ?? {},
    status: (row.status as WorkflowDefinition["status"]) ?? "draft",
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getStoreMode(): "supabase" {
  return "supabase";
}

export async function listWorkflows(
  tenantId: string,
  limit = 50,
  offset = 0
): Promise<WorkflowDefinition[]> {
  const supabase = getSupabaseServer();
  if (!supabase) throw new Error("Supabase unavailable");

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToModel(r as Row));
}

export async function getWorkflow(id: string): Promise<WorkflowDefinition | null> {
  const supabase = getSupabaseServer();
  if (!supabase) throw new Error("Supabase unavailable");

  const { data, error } = await supabase.from(TABLE).select("*").eq("id", id).single();
  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw new Error(error.message);
  }
  return rowToModel(data as Row);
}

export async function createWorkflow(
  fields: Omit<WorkflowDefinition, "id" | "createdAt" | "updatedAt">
): Promise<WorkflowDefinition> {
  const supabase = getSupabaseServer();
  if (!supabase) throw new Error("Supabase unavailable");

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      tenant_id: fields.tenantId,
      name: fields.name,
      description: fields.description ?? null,
      adapter: fields.adapter,
      config: fields.config ?? {},
      status: fields.status ?? "draft",
      created_by: fields.createdBy,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return rowToModel(data as Row);
}

export async function updateWorkflow(
  id: string,
  fields: Partial<Omit<WorkflowDefinition, "id" | "tenantId" | "createdAt" | "createdBy">>
): Promise<WorkflowDefinition> {
  const supabase = getSupabaseServer();
  if (!supabase) throw new Error("Supabase unavailable");

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.description !== undefined) patch.description = fields.description;
  if (fields.adapter !== undefined) patch.adapter = fields.adapter;
  if (fields.config !== undefined) patch.config = fields.config;
  if (fields.status !== undefined) patch.status = fields.status;

  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return rowToModel(data as Row);
}

export async function deleteWorkflow(id: string): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) throw new Error("Supabase unavailable");

  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function countWorkflowRows(): Promise<{ definitions: number; runs: number }> {
  const supabase = getSupabaseServer();
  if (!supabase) return { definitions: 0, runs: 0 };

  const [defResult, runResult] = await Promise.all([
    supabase.from("workflow_definitions").select("id", { count: "exact", head: true }),
    supabase.from("workflow_runs").select("id", { count: "exact", head: true }),
  ]);

  return {
    definitions: defResult.count ?? 0,
    runs: runResult.count ?? 0,
  };
}
