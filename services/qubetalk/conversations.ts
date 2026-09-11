/**
 * QubeTalk Communications Membrane — ConversationQube resolution (§6).
 *
 * Deterministic evidence first (§6): an explicit conversation id always
 * wins; otherwise resolution falls back to the ONE default conversation for
 * a relationship channel or group, auto-created on first use. This build
 * does not yet have external transport-thread evidence to resolve against
 * (no adapter is wired to an external platform — see transportRegistry.ts),
 * so `transportThreadId`-based resolution is accepted as an input but simply
 * has no external adapter feeding it real values yet; the deterministic
 * rule itself never falls back to weak semantic/topic-similarity merging
 * (§6's explicit prohibition) — there is no inference step in this
 * function at all.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { QubeTalkConversation, QubeTalkConversationTopology, QubeTalkRelationshipAnchor } from '@/types/qubetalk';
import type { PeerResult } from '@/services/qubetalk/peerChannel';
import { anchorValue } from '@/services/qubetalk/relationshipAnchor';

const CONVERSATIONS = 'qubetalk_conversations';

/** Which qubetalk_conversations column an anchor maps to — built on the SAME
 *  shared anchorValue() branch relationships.ts's anchorColumn() uses; only
 *  the column NAMES differ between the two tables
 *  (relationship_channel_id here vs channel_id on qubetalk_relationship_state). */
function conversationAnchorColumn(anchor: QubeTalkRelationshipAnchor): { column: 'relationship_channel_id' | 'offplatform_relationship_id'; value: string } {
  const { kind, value } = anchorValue(anchor);
  return { column: kind === 'peer-channel' ? 'relationship_channel_id' : 'offplatform_relationship_id', value };
}

function rowToConversation(row: Record<string, unknown>): QubeTalkConversation {
  return {
    id: String(row.id),
    relationshipChannelId: (row.relationship_channel_id as string | null) ?? null,
    offplatformRelationshipId: (row.offplatform_relationship_id as string | null) ?? null,
    groupId: (row.group_id as string | null) ?? null,
    topology: row.topology as QubeTalkConversationTopology,
    title: (row.title as string | null) ?? null,
    originEngagementId: (row.origin_engagement_id as string | null) ?? null,
    createdAt: String(row.created_at),
    lastActivityAt: String(row.last_activity_at),
  };
}

export async function createConversation(input: {
  relationshipChannelId?: string | null;
  /** Anchor a conversation to a qubetalk_offplatform_relationships row
   *  instead (P0.5) — a conversation should set this OR
   *  relationshipChannelId, never both (service-layer discipline; no DB
   *  CHECK — see the 20260930100000 migration's own comment). */
  offplatformRelationshipId?: string | null;
  groupId?: string | null;
  topology: QubeTalkConversationTopology;
  title?: string | null;
  /** Set only when this conversation originated from converting a
   *  publication engagement (services/qubetalk/engagement.ts
   *  convertEngagementToConversation) — the reverse pointer to
   *  qubetalk_engagements.converted_conversation_id, for provenance display
   *  ("this conversation began as a comment on Publication Y"). */
  originEngagementId?: string | null;
}): Promise<PeerResult<QubeTalkConversation>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin
    .from(CONVERSATIONS)
    .insert({
      relationship_channel_id: input.relationshipChannelId ?? null,
      offplatform_relationship_id: input.offplatformRelationshipId ?? null,
      group_id: input.groupId ?? null,
      topology: input.topology,
      title: input.title ?? null,
      origin_engagement_id: input.originEngagementId ?? null,
    })
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToConversation(data as Record<string, unknown>) };
}

export async function getConversation(conversationId: string): Promise<PeerResult<QubeTalkConversation>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin.from(CONVERSATIONS).select('*').eq('id', conversationId).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'conversation not found', code: 'not_found' };
  return { ok: true, value: rowToConversation(data as Record<string, unknown>) };
}

/**
 * Deterministic-evidence resolution, in priority order (§6):
 *   1. explicitConversationId — an explicit user/caller assignment always wins.
 *   2. Fall back to the untitled "default" conversation for the given
 *      relationship channel or group, auto-created if none exists yet.
 * No semantic/topic inference — a caller that wants a NEW named topic must
 * call createConversation directly and pass its id back as
 * explicitConversationId on subsequent messages.
 */
export async function resolveConversation(input: {
  explicitConversationId?: string | null;
  /** Either anchor kind (P0.5 widening) — replaces the old
   *  `relationshipChannelId?` param. Omit entirely for a conversation with
   *  no relationship anchor at all (e.g. group/broadcast topologies). */
  anchor?: QubeTalkRelationshipAnchor | null;
  groupId?: string | null;
  topology: QubeTalkConversationTopology;
}): Promise<PeerResult<QubeTalkConversation>> {
  if (input.explicitConversationId) {
    return getConversation(input.explicitConversationId);
  }

  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  let query = admin.from(CONVERSATIONS).select('*').is('title', null);
  if (input.anchor) {
    const { column, value } = conversationAnchorColumn(input.anchor);
    const otherColumn = column === 'relationship_channel_id' ? 'offplatform_relationship_id' : 'relationship_channel_id';
    query = query.eq(column, value).is(otherColumn, null);
  } else {
    query = query.is('relationship_channel_id', null).is('offplatform_relationship_id', null);
  }
  query = input.groupId ? query.eq('group_id', input.groupId) : query.is('group_id', null);

  const { data: existing, error: readError } = await query.limit(1).maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (existing) return { ok: true, value: rowToConversation(existing as Record<string, unknown>) };

  return createConversation({
    relationshipChannelId: input.anchor?.kind === 'peer-channel' ? input.anchor.channelId : null,
    offplatformRelationshipId: input.anchor?.kind === 'off-platform' ? input.anchor.relationshipId : null,
    groupId: input.groupId ?? null,
    topology: input.topology,
    title: null,
  });
}

export async function touchConversationActivity(conversationId: string): Promise<PeerResult<void>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { error } = await admin
    .from(CONVERSATIONS)
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', conversationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: undefined };
}

/** Used by the projection contract (services/qubetalk/projection.ts) to
 *  build a relationship summary's conversationIds list — reads only, never
 *  resolves/creates (that stays resolveConversation's job). ONE call shape
 *  for EITHER anchor kind (P0.5 widening) — replaces the old
 *  `listConversationsForRelationship(channelId)`, which only ever queried
 *  `relationship_channel_id`. */
export async function listConversationsForAnchor(anchor: QubeTalkRelationshipAnchor): Promise<PeerResult<string[]>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { column, value } = conversationAnchorColumn(anchor);
  const { data, error } = await admin.from(CONVERSATIONS).select('id').eq(column, value);
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: (data ?? []).map((r) => String((r as Record<string, unknown>).id)) };
}

export async function listConversationsForGroup(groupId: string): Promise<PeerResult<string[]>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin.from(CONVERSATIONS).select('id').eq('group_id', groupId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: (data ?? []).map((r) => String((r as Record<string, unknown>).id)) };
}
