import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import { ChannelQube } from "./channelQubeTypes";
import { qubetalkPersistence } from "@/services/qubetalk/qubetalkPersistence";

const TABLE = "workflow_channel_qubes";

type Row = {
  id: string; workflow_id: string; tenant_id: string;
  channel_name: string; thread: string; participating_agents: string[];
  policy_ref: string | null; active: boolean; created_by: string;
  created_at: string; updated_at: string;
};

function rowToModel(row: Row): ChannelQube {
  return {
    id: row.id, workflowId: row.workflow_id, tenantId: row.tenant_id,
    channelName: row.channel_name, thread: row.thread,
    participatingAgents: row.participating_agents ?? [],
    policyRef: row.policy_ref ?? undefined,
    active: row.active, createdBy: row.created_by,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function requireSupabase() {
  const client = getSupabaseServer();
  if (!client) throw new Error("Supabase client unavailable — cannot access workflow_channel_qubes");
  return client;
}

export async function getChannelQube(workflowId: string): Promise<ChannelQube | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.from(TABLE).select("*").eq("workflow_id", workflowId).single();
  if (error) return null;
  return rowToModel(data as Row);
}

export async function upsertChannelQube(
  params: Pick<ChannelQube, "workflowId" | "tenantId" | "channelName" | "thread" | "participatingAgents" | "createdBy"> & { policyRef?: string; active?: boolean }
): Promise<ChannelQube> {
  const sb = requireSupabase();
  const now = new Date().toISOString();

  const existing = await getChannelQube(params.workflowId);
  if (existing) {
    const { data, error } = await sb.from(TABLE).update({
      channel_name: params.channelName, thread: params.thread,
      participating_agents: params.participatingAgents,
      policy_ref: params.policyRef ?? null,
      active: params.active ?? true, updated_at: now,
    }).eq("workflow_id", params.workflowId).select().single();
    if (error) throw new Error(`upsertChannelQube update failed: ${error.message}`);
    return rowToModel(data as Row);
  }

  const { data, error } = await sb.from(TABLE).insert({
    workflow_id: params.workflowId, tenant_id: params.tenantId,
    channel_name: params.channelName, thread: params.thread,
    participating_agents: params.participatingAgents,
    policy_ref: params.policyRef ?? null,
    active: params.active ?? true, created_by: params.createdBy,
    created_at: now, updated_at: now,
  }).select().single();
  if (error) throw new Error(`upsertChannelQube insert failed: ${error.message}`);
  return rowToModel(data as Row);
}

/**
 * Post a workflow invocation event to the bound QubeTalk channel.
 * Non-blocking — caller should fire-and-forget with .catch(() => {}).
 */
export async function postWorkflowInvocationEvent(
  channel: ChannelQube,
  event: { workflowId: string; executionId?: string; status: "started" | "failed"; input?: unknown }
): Promise<void> {
  const messageId = `wf_invoke_${event.workflowId}_${Date.now()}`;
  await qubetalkPersistence.createMessage({
    message_id: messageId,
    channel_id: channel.channelName,
    from_agent: { id: "aigent-z", role: "system", name: "Aigent Z" },
    type: "system",
    content: JSON.stringify({
      action: "WORKFLOW_INVOCATION",
      thread: channel.thread,
      workflowId: event.workflowId,
      executionId: event.executionId ?? null,
      status: event.status,
      participatingAgents: channel.participatingAgents,
      timestamp: new Date().toISOString(),
    }),
    metadata: { thread: channel.thread, workflowId: event.workflowId },
  });
}
