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
 * exported function takes a `QubeTalkRelationshipAnchor` descriptor
 * (types/qubetalk.ts) and picks which column to query/insert against; there
 * is no second, getOrCreateRelationshipState-shaped function for the
 * off-platform case.
 *
 * Owner-scoped resolution (P0.5 widening, 2026-08-26): resolving an
 * `'off-platform'` anchor requires the caller's resolved `ownerAuthProfileId`
 * — every function below that can take an off-platform anchor takes this as
 * an explicit second parameter and verifies, via a DB-scoped query against
 * `qubetalk_offplatform_relationships` (never an application-level `if`
 * after an unscoped fetch), that the anchor actually belongs to that owner
 * BEFORE reading or writing anything. A `'peer-channel'` anchor needs no such
 * check here — channel membership is enforced by personaPublicRef comparison
 * at the caller (peerChannel.ts's loadOwnedChannel / listChannelsForCaller),
 * which every existing caller of this module already goes through before
 * reaching it.
 *
 * Post-promotion continuity (P0.5 widening): a 'peer-channel' anchor whose
 * `channelId` is the PROMOTION TARGET of an existing off-platform
 * relationship (`qubetalk_offplatform_relationships.promoted_to_channel_id`)
 * resolves to THAT relationship's existing state row instead of minting a
 * fresh `channel_id`-keyed one — see `resolveEffectiveAnchor` below.
 * Promotion itself (offplatformRelationships.ts) never migrates the row (its
 * own header comment says so explicitly), so this redirect is what actually
 * makes "the relationship keeps its history after promotion" true for a
 * caller resolving it by the now-real channel id, not just a documentation
 * claim.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { QubeTalkRelationshipState, QubeTalkRelationshipNote, QubeTalkRelationshipAnchorKind, QubeTalkRelationshipAnchor } from '@/types/qubetalk';
import type { PeerResult } from '@/services/qubetalk/peerChannel';
import { anchorValue } from '@/services/qubetalk/relationshipAnchor';

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseServer>>;

const STATE = 'qubetalk_relationship_state';
const OFFPLATFORM = 'qubetalk_offplatform_relationships';

export type { QubeTalkRelationshipAnchor as RelationshipAnchor };

/** The DB column + value pair for a given anchor — the ONE branch point
 *  every function below funnels through, so the "two anchors, one service"
 *  discipline is a single decision, not duplicated per function. Built on
 *  relationshipAnchor.ts's shared `anchorValue` so the kind/value branch
 *  itself is decided in exactly one place across relationships.ts AND
 *  conversations.ts (each maps it to its own table's column names). */
export function anchorColumn(anchor: QubeTalkRelationshipAnchor): { column: 'channel_id' | 'offplatform_relationship_id'; value: string } {
  const { kind, value } = anchorValue(anchor);
  return { column: kind === 'peer-channel' ? 'channel_id' : 'offplatform_relationship_id', value };
}

/**
 * DB-scoped ownership verification for an off-platform anchor — a real
 * `.eq('owner_auth_profile_id', ownerAuthProfileId)` filter against
 * `qubetalk_offplatform_relationships`, not an application-level `if` after
 * an unscoped read. A caller who knows/guesses another owner's
 * `qubetalk_offplatform_relationships.id` gets `false` here, never a peek at
 * that owner's relationship state.
 */
async function ownsOffplatformAnchor(
  admin: SupabaseAdmin,
  offplatformRelationshipId: string,
  ownerAuthProfileId: string,
): Promise<boolean> {
  const { data } = await admin
    .from(OFFPLATFORM)
    .select('id')
    .eq('id', offplatformRelationshipId)
    .eq('owner_auth_profile_id', ownerAuthProfileId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * The ONE place both the ownership check AND the post-promotion redirect
 * happen — every exported function below calls this exactly once, then
 * reuses the SAME resolved anchor for every read/write it does, so a
 * function's own follow-up `.update()` never targets a different anchor
 * than the one its own `getOrCreate` step just resolved (the bug this
 * function exists to prevent: resolving to an off-platform row on read but
 * still writing against the original, empty channel_id on update).
 */
async function resolveEffectiveAnchor(
  admin: SupabaseAdmin,
  anchor: QubeTalkRelationshipAnchor,
  ownerAuthProfileId: string | undefined,
): Promise<PeerResult<QubeTalkRelationshipAnchor>> {
  if (anchor.kind === 'off-platform') {
    if (!ownerAuthProfileId) {
      return { ok: false, error: 'ownerAuthProfileId is required to resolve an off-platform relationship anchor', code: 'owner_required' };
    }
    const owns = await ownsOffplatformAnchor(admin, anchor.relationshipId, ownerAuthProfileId);
    if (!owns) return { ok: false, error: 'off-platform relationship not found for this owner', code: 'not_found' };
    return { ok: true, value: anchor };
  }

  // 'peer-channel' — already membership-checked by the caller (no ownership
  // gate needed here). Check whether this exact channel is the PROMOTION
  // TARGET of an off-platform relationship; if so, redirect to that
  // relationship's existing state row rather than minting a fresh one.
  const { data } = await admin
    .from(OFFPLATFORM)
    .select('id')
    .eq('promoted_to_channel_id', anchor.channelId)
    .limit(1)
    .maybeSingle();
  if (data) {
    return { ok: true, value: { kind: 'off-platform', relationshipId: String((data as Record<string, unknown>).id) } };
  }
  return { ok: true, value: anchor };
}

function rowToState(row: Record<string, unknown>): QubeTalkRelationshipState {
  const channelId = (row.channel_id as string | null) ?? null;
  const offplatformRelationshipId = (row.offplatform_relationship_id as string | null) ?? null;
  const anchorKind: QubeTalkRelationshipAnchorKind = channelId != null ? 'peer-channel' : 'off-platform';
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

/** The actual select-or-insert against qubetalk_relationship_state for an
 *  ALREADY-RESOLVED, already-ownership-checked anchor — internal, so
 *  callers that resolve the anchor once (recordInteraction et al.) don't
 *  re-verify ownership a second time on their own follow-up write. */
async function getOrCreateStateRow(admin: SupabaseAdmin, resolvedAnchor: QubeTalkRelationshipAnchor): Promise<PeerResult<QubeTalkRelationshipState>> {
  const { column, value } = anchorColumn(resolvedAnchor);
  const { data: existing, error: readError } = await admin.from(STATE).select('*').eq(column, value).maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (existing) return { ok: true, value: rowToState(existing as Record<string, unknown>) };

  const { data, error } = await admin.from(STATE).insert({ [column]: value }).select('*').single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToState(data as Record<string, unknown>) };
}

/** Fetch relationship state, creating an empty projection row the first time
 *  it's asked for — this is idempotent and safe to call on every read.
 *  Works identically for either anchor kind — same table, same function,
 *  the only difference is which column is queried/inserted (P0.5).
 *  `ownerAuthProfileId` is REQUIRED for an 'off-platform' anchor (verified
 *  DB-side against qubetalk_offplatform_relationships before any read/write
 *  below); ignored for a 'peer-channel' anchor. */
export async function getOrCreateRelationshipState(
  anchor: QubeTalkRelationshipAnchor,
  ownerAuthProfileId?: string,
): Promise<PeerResult<QubeTalkRelationshipState>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const resolved = await resolveEffectiveAnchor(admin, anchor, ownerAuthProfileId);
  if (!resolved.ok) return resolved;
  return getOrCreateStateRow(admin, resolved.value);
}

export async function recordInteraction(
  anchor: QubeTalkRelationshipAnchor,
  at: string = new Date().toISOString(),
  ownerAuthProfileId?: string,
): Promise<PeerResult<void>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const resolved = await resolveEffectiveAnchor(admin, anchor, ownerAuthProfileId);
  if (!resolved.ok) return resolved;
  const created = await getOrCreateStateRow(admin, resolved.value);
  if (!created.ok) return created;
  const { column, value } = anchorColumn(resolved.value);
  const { error } = await admin
    .from(STATE)
    .update({ last_interaction_at: at, updated_at: new Date().toISOString() })
    .eq(column, value);
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: undefined };
}

export async function addOpenLoop(
  anchor: QubeTalkRelationshipAnchor,
  note: { text: string; sourceMessageIds: string[] },
  ownerAuthProfileId?: string,
): Promise<PeerResult<QubeTalkRelationshipState>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const resolved = await resolveEffectiveAnchor(admin, anchor, ownerAuthProfileId);
  if (!resolved.ok) return resolved;
  const current = await getOrCreateStateRow(admin, resolved.value);
  if (!current.ok) return current;
  const { column, value } = anchorColumn(resolved.value);

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

export async function resolveOpenLoop(
  anchor: QubeTalkRelationshipAnchor,
  loopId: string,
  ownerAuthProfileId?: string,
): Promise<PeerResult<QubeTalkRelationshipState>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const resolved = await resolveEffectiveAnchor(admin, anchor, ownerAuthProfileId);
  if (!resolved.ok) return resolved;
  const current = await getOrCreateStateRow(admin, resolved.value);
  if (!current.ok) return current;
  const { column, value } = anchorColumn(resolved.value);

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
  anchor: QubeTalkRelationshipAnchor,
  summary: string,
  sourceMessageIds: string[],
  ownerAuthProfileId?: string,
): Promise<PeerResult<QubeTalkRelationshipState>> {
  if (sourceMessageIds.length === 0) {
    return { ok: false, error: 'memory summary must name at least one source message (N15)', code: 'no_provenance' };
  }
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const resolved = await resolveEffectiveAnchor(admin, anchor, ownerAuthProfileId);
  if (!resolved.ok) return resolved;
  const created = await getOrCreateStateRow(admin, resolved.value);
  if (!created.ok) return created;
  const { column, value } = anchorColumn(resolved.value);
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
