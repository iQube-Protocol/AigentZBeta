/**
 * QubeTalk Communications Membrane — RelationshipQube (§4).
 *
 * A 1:1 projected-state companion over an existing relationship ANCHOR —
 * either an existing passport_peer_channels row (the personhood-bound peer
 * channel, the original and still-default anchor) or, since P0.5, an
 * existing qubetalk_offplatform_relationships row (the sibling anchor for a
 * ContactGraph contact with no linked platform persona yet). Never a new
 * relationship id of its own (P1/N2). Every field here is derived and
 * traceable back to the messages it came from (P5/N15) — this module never
 * overwrites raw message history, and `updateMemorySummary` REQUIRES the
 * caller to name the source messages the summary was built from.
 *
 * ONE service model, TWO anchor kinds (operator ruling, P0.5) — every
 * exported function takes a `RelationshipAnchor` descriptor and picks which
 * column to query/insert against; there is no second,
 * getOrCreateRelationshipState-shaped function for the offplatform case.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { QubeTalkRelationshipState, QubeTalkRelationshipNote, QubeTalkRelationshipAnchorKind } from '@/types/qubetalk';
import type { PeerResult } from '@/services/qubetalk/peerChannel';

const STATE = 'qubetalk_relationship_state';

/**
 * Which relationship this call is about — exactly one of the two anchor
 * kinds, matching the DB's own `qubetalk_relationship_state_exactly_one_anchor`
 * CHECK constraint (20260930100000 migration).
 */
export type RelationshipAnchor =
  | { kind: 'platform_peer_channel'; channelId: string }
  | { kind: 'offplatform_contact'; offplatformRelationshipId: string };

/** The DB column + value pair for a given anchor — the ONE branch point
 *  every function below funnels through, so the "two anchors, one service"
 *  discipline is a single decision, not duplicated per function. */
function anchorColumn(anchor: RelationshipAnchor): { column: 'channel_id' | 'offplatform_relationship_id'; value: string } {
  return anchor.kind === 'platform_peer_channel'
    ? { column: 'channel_id', value: anchor.channelId }
    : { column: 'offplatform_relationship_id', value: anchor.offplatformRelationshipId };
}

function rowToState(row: Record<string, unknown>): QubeTalkRelationshipState {
  const channelId = (row.channel_id as string | null) ?? null;
  const offplatformRelationshipId = (row.offplatform_relationship_id as string | null) ?? null;
  const anchorKind: QubeTalkRelationshipAnchorKind = channelId != null ? 'platform_peer_channel' : 'offplatform_contact';
  return {
    id: String(row.id),
    anchorKind,
    channelId,
    offplatformRelationshipId,
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
 *  it's asked for — this is idempotent and safe to call on every read.
 *  Works identically for either anchor kind — same table, same function,
 *  the only difference is which column is queried/inserted (P0.5). */
export async function getOrCreateRelationshipState(anchor: RelationshipAnchor): Promise<PeerResult<QubeTalkRelationshipState>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { column, value } = anchorColumn(anchor);

  const { data: existing, error: readError } = await admin.from(STATE).select('*').eq(column, value).maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (existing) return { ok: true, value: rowToState(existing as Record<string, unknown>) };

  const { data, error } = await admin.from(STATE).insert({ [column]: value }).select('*').single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToState(data as Record<string, unknown>) };
}

export async function recordInteraction(anchor: RelationshipAnchor, at: string = new Date().toISOString()): Promise<PeerResult<void>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  await getOrCreateRelationshipState(anchor);
  const { column, value } = anchorColumn(anchor);
  const { error } = await admin
    .from(STATE)
    .update({ last_interaction_at: at, updated_at: new Date().toISOString() })
    .eq(column, value);
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: undefined };
}

export async function addOpenLoop(
  anchor: RelationshipAnchor,
  note: { text: string; sourceMessageIds: string[] },
): Promise<PeerResult<QubeTalkRelationshipState>> {
  const current = await getOrCreateRelationshipState(anchor);
  if (!current.ok) return current;
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { column, value } = anchorColumn(anchor);

  const newNote: QubeTalkRelationshipNote = {
    id: crypto.randomUUID(),
    text: note.text,
    sourceMessageIds: note.sourceMessageIds,
    createdAt: new Date().toISOString(),
  };
  const openLoops = [...current.value.openLoops, newNote];
  const { data, error } = await admin.from(STATE).update({ open_loops: openLoops, updated_at: new Date().toISOString() }).eq(column, value).select('*').single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToState(data as Record<string, unknown>) };
}

export async function resolveOpenLoop(anchor: RelationshipAnchor, loopId: string): Promise<PeerResult<QubeTalkRelationshipState>> {
  const current = await getOrCreateRelationshipState(anchor);
  if (!current.ok) return current;
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { column, value } = anchorColumn(anchor);

  const openLoops = current.value.openLoops.map((l) => (l.id === loopId ? { ...l, resolvedAt: new Date().toISOString() } : l));
  const { data, error } = await admin.from(STATE).update({ open_loops: openLoops, updated_at: new Date().toISOString() }).eq(column, value).select('*').single();
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
  anchor: RelationshipAnchor,
  summary: string,
  sourceMessageIds: string[],
): Promise<PeerResult<QubeTalkRelationshipState>> {
  if (sourceMessageIds.length === 0) {
    return { ok: false, error: 'memory summary must name at least one source message (N15)', code: 'no_provenance' };
  }
  await getOrCreateRelationshipState(anchor);
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { column, value } = anchorColumn(anchor);
  const { data, error } = await admin
    .from(STATE)
    .update({
      memory_summary: summary,
      memory_summary_updated_at: new Date().toISOString(),
      memory_source_message_ids: sourceMessageIds,
      updated_at: new Date().toISOString(),
    })
    .eq(column, value)
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToState(data as Record<string, unknown>) };
}
