/**
 * QubeTalk Communications Membrane — GroupQube (§5).
 *
 * First-class multi-party context, genuinely new (nothing in the existing
 * schema models more than two principals — passport_peer_channels is
 * hard-pinned to a pair). Membership is TEMPORAL: `qubetalk_group_memberships`
 * tracks the current/live roster with `joined_at`/`left_at`, but the
 * AUTHORITATIVE audience for any given message is the frozen
 * `audience_snapshot` written onto that message at send time
 * (services/qubetalk/ingestion.ts) — this module's `snapshotGroupAudience`
 * is what produces that frozen copy. A later membership change can never
 * rewrite who could see an earlier message (P4).
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { QubeTalkGroup, QubeTalkGroupEndpoint, QubeTalkGroupMembership, QubeTalkGroupPlatform, QubeTalkAudienceSnapshot } from '@/types/qubetalk';
import type { PeerResult } from '@/services/qubetalk/peerChannel';

const GROUPS = 'qubetalk_groups';
const GROUP_ENDPOINTS = 'qubetalk_group_endpoints';
const MEMBERSHIPS = 'qubetalk_group_memberships';

function rowToGroup(row: Record<string, unknown>): QubeTalkGroup {
  return {
    id: String(row.id),
    createdByRef: String(row.created_by_ref),
    name: String(row.name),
    description: (row.description as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

function rowToMembership(row: Record<string, unknown>): QubeTalkGroupMembership {
  return {
    id: String(row.id),
    groupId: String(row.group_id),
    participantId: String(row.participant_id),
    joinedAt: String(row.joined_at),
    leftAt: (row.left_at as string | null) ?? null,
  };
}

export async function createGroup(
  createdByRef: string,
  input: { name: string; description?: string | null },
): Promise<PeerResult<QubeTalkGroup>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin
    .from(GROUPS)
    .insert({ created_by_ref: createdByRef, name: input.name, description: input.description ?? null })
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToGroup(data as Record<string, unknown>) };
}

/** Used by the projection contract (services/qubetalk/projection.ts) to
 *  determine which groups a principal "owns" for scope purposes — this
 *  build's deliberately simple visibility rule: groups that principal
 *  created. (Full membership-based visibility — a group someone else
 *  created but I'm a member of — is real future work, not attempted here;
 *  see the projection contract's own scope-resolution comment.) */
export async function listGroupsCreatedBy(creatorRef: string): Promise<PeerResult<QubeTalkGroup[]>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin.from(GROUPS).select('*').eq('created_by_ref', creatorRef);
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: (data ?? []).map((r) => rowToGroup(r as Record<string, unknown>)) };
}

export async function getGroup(groupId: string): Promise<PeerResult<QubeTalkGroup>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin.from(GROUPS).select('*').eq('id', groupId).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'group not found', code: 'not_found' };
  return { ok: true, value: rowToGroup(data as Record<string, unknown>) };
}

/**
 * Connect a platform endpoint to a group — the "one logical group spans
 * several platform endpoints" requirement (§5). Idempotent: connecting the
 * same (platform, externalGroupRef) twice is a no-op (unique index).
 */
export async function connectGroupEndpoint(
  groupId: string,
  platform: QubeTalkGroupPlatform,
  externalGroupRef: string,
): Promise<PeerResult<QubeTalkGroupEndpoint>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin
    .from(GROUP_ENDPOINTS)
    .upsert(
      { group_id: groupId, platform, external_group_ref: externalGroupRef },
      { onConflict: 'group_id,platform,external_group_ref', ignoreDuplicates: false },
    )
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  const row = data as Record<string, unknown>;
  return {
    ok: true,
    value: {
      id: String(row.id),
      groupId: String(row.group_id),
      platform: row.platform as QubeTalkGroupPlatform,
      externalGroupRef: String(row.external_group_ref),
      connectedAt: String(row.connected_at),
    },
  };
}

/** Add a member if they don't already have an OPEN membership (idempotent —
 *  re-adding a current member is a no-op, never a duplicate row). */
export async function addGroupMember(groupId: string, participantId: string): Promise<PeerResult<QubeTalkGroupMembership>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const { data: open, error: openError } = await admin
    .from(MEMBERSHIPS)
    .select('*')
    .eq('group_id', groupId)
    .eq('participant_id', participantId)
    .is('left_at', null)
    .maybeSingle();
  if (openError) return { ok: false, error: openError.message };
  if (open) return { ok: true, value: rowToMembership(open as Record<string, unknown>) };

  const { data, error } = await admin
    .from(MEMBERSHIPS)
    .insert({ group_id: groupId, participant_id: participantId })
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToMembership(data as Record<string, unknown>) };
}

/** Close the current open membership (temporal — history is preserved, the
 *  row is never deleted). No-op if already not a current member. */
export async function removeGroupMember(groupId: string, participantId: string): Promise<PeerResult<void>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { error } = await admin
    .from(MEMBERSHIPS)
    .update({ left_at: new Date().toISOString() })
    .eq('group_id', groupId)
    .eq('participant_id', participantId)
    .is('left_at', null);
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: undefined };
}

export async function listCurrentGroupMembers(groupId: string): Promise<PeerResult<string[]>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin
    .from(MEMBERSHIPS)
    .select('participant_id')
    .eq('group_id', groupId)
    .is('left_at', null);
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: (data ?? []).map((r) => String((r as Record<string, unknown>).participant_id)) };
}

/**
 * Freeze the CURRENT roster into an audience snapshot (§5/P4) — call this at
 * the moment a group message is sent/ingested, then persist the RESULT onto
 * that one message row. Never recomputed retroactively for an old message.
 */
export async function snapshotGroupAudience(groupId: string): Promise<PeerResult<QubeTalkAudienceSnapshot>> {
  const members = await listCurrentGroupMembers(groupId);
  if (!members.ok) return members;
  return {
    ok: true,
    value: { groupId, participantIds: members.value, capturedAt: new Date().toISOString() },
  };
}
