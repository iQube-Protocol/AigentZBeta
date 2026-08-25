/**
 * QubeTalk Communications Membrane — RelationshipQube (§4).
 *
 * A 1:1 projected-state companion over an EXISTING passport_peer_channels
 * row — the relationship anchor is that channel, never a new relationship
 * id (P1/N2). Every field here is derived and traceable back to the
 * messages it came from (P5/N15) — this module never overwrites raw
 * message history, and `updateMemorySummary` REQUIRES the caller to name
 * the source messages the summary was built from.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { QubeTalkRelationshipState, QubeTalkRelationshipNote } from '@/types/qubetalk';
import type { PeerResult } from '@/services/qubetalk/peerChannel';

const STATE = 'qubetalk_relationship_state';

function rowToState(row: Record<string, unknown>): QubeTalkRelationshipState {
  return {
    channelId: String(row.channel_id),
    openLoops: (row.open_loops as QubeTalkRelationshipNote[] | null) ?? [],
    commitments: (row.commitments as QubeTalkRelationshipNote[] | null) ?? [],
    memorySummary: (row.memory_summary as string | null) ?? null,
    memorySummaryUpdatedAt: (row.memory_summary_updated_at as string | null) ?? null,
    memorySourceMessageIds: (row.memory_source_message_ids as string[] | null) ?? [],
    lastInteractionAt: (row.last_interaction_at as string | null) ?? null,
    updatedAt: String(row.updated_at),
  };
}

/** Fetch relationship state, creating an empty projection row the first time
 *  it's asked for — this is idempotent and safe to call on every read. */
export async function getOrCreateRelationshipState(channelId: string): Promise<PeerResult<QubeTalkRelationshipState>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const { data: existing, error: readError } = await admin.from(STATE).select('*').eq('channel_id', channelId).maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (existing) return { ok: true, value: rowToState(existing as Record<string, unknown>) };

  const { data, error } = await admin.from(STATE).insert({ channel_id: channelId }).select('*').single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToState(data as Record<string, unknown>) };
}

export async function recordInteraction(channelId: string, at: string = new Date().toISOString()): Promise<PeerResult<void>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  await getOrCreateRelationshipState(channelId);
  const { error } = await admin
    .from(STATE)
    .update({ last_interaction_at: at, updated_at: new Date().toISOString() })
    .eq('channel_id', channelId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: undefined };
}

export async function addOpenLoop(
  channelId: string,
  note: { text: string; sourceMessageIds: string[] },
): Promise<PeerResult<QubeTalkRelationshipState>> {
  const current = await getOrCreateRelationshipState(channelId);
  if (!current.ok) return current;
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const newNote: QubeTalkRelationshipNote = {
    id: crypto.randomUUID(),
    text: note.text,
    sourceMessageIds: note.sourceMessageIds,
    createdAt: new Date().toISOString(),
  };
  const openLoops = [...current.value.openLoops, newNote];
  const { data, error } = await admin.from(STATE).update({ open_loops: openLoops, updated_at: new Date().toISOString() }).eq('channel_id', channelId).select('*').single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToState(data as Record<string, unknown>) };
}

export async function resolveOpenLoop(channelId: string, loopId: string): Promise<PeerResult<QubeTalkRelationshipState>> {
  const current = await getOrCreateRelationshipState(channelId);
  if (!current.ok) return current;
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const openLoops = current.value.openLoops.map((l) => (l.id === loopId ? { ...l, resolvedAt: new Date().toISOString() } : l));
  const { data, error } = await admin.from(STATE).update({ open_loops: openLoops, updated_at: new Date().toISOString() }).eq('channel_id', channelId).select('*').single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToState(data as Record<string, unknown>) };
}

/**
 * Update the derived relationship memory summary. `sourceMessageIds` is
 * REQUIRED and non-empty — a summary with no named source is exactly the
 * "hidden provenance" N15 forbids, so this function refuses to write one.
 * Never touches passport_peer_messages itself — raw history stays immutable.
 */
export async function updateMemorySummary(
  channelId: string,
  summary: string,
  sourceMessageIds: string[],
): Promise<PeerResult<QubeTalkRelationshipState>> {
  if (sourceMessageIds.length === 0) {
    return { ok: false, error: 'memory summary must name at least one source message (N15)', code: 'no_provenance' };
  }
  await getOrCreateRelationshipState(channelId);
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin
    .from(STATE)
    .update({
      memory_summary: summary,
      memory_summary_updated_at: new Date().toISOString(),
      memory_source_message_ids: sourceMessageIds,
      updated_at: new Date().toISOString(),
    })
    .eq('channel_id', channelId)
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToState(data as Record<string, unknown>) };
}
