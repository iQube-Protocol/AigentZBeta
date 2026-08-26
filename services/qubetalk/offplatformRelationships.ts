/**
 * QubeTalk P0.5 — off-platform relationship sibling anchor.
 *
 * The sibling relationship object for a ContactGraph ContactPerson with NO
 * linked platform persona (linked_personhood_ref IS NULL). passport_peer_
 * channels (services/qubetalk/peerChannel.ts) is personhood-bound by
 * construction — both principals are identified by a real Polity Public
 * Reference — so it structurally cannot represent this case. This module is
 * the smallest sibling anchor for that case (operator ruling: NOT a
 * discriminator weakening passport_peer_channels), exposed through the SAME
 * RelationshipQube service surface as the platform-peer-channel case
 * (services/qubetalk/relationships.ts's getOrCreateRelationshipState et al.
 * now accept EITHER anchor kind — one service, two anchors, never a
 * duplicated implementation).
 *
 * Mirrors services/contactGraph/contactPersons.ts's conventions exactly:
 * same PeerResult<T> pattern, same getSupabaseServer() usage, owned by
 * owner_auth_profile_id (the ContactPerson's own scoping — see
 * 20260930050000_contactgraph_substrate.sql's header for why ContactGraph is
 * auth-profile-scoped rather than persona-scoped).
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { QubeTalkOffplatformRelationship } from '@/types/qubetalk';
import type { PeerResult } from '@/services/qubetalk/peerChannel';

const OFFPLATFORM = 'qubetalk_offplatform_relationships';

function rowToOffplatformRelationship(row: Record<string, unknown>): QubeTalkOffplatformRelationship {
  return {
    id: String(row.id),
    ownerAuthProfileId: String(row.owner_auth_profile_id),
    contactPersonId: String(row.contact_person_id),
    status: (row.status as QubeTalkOffplatformRelationship['status']) ?? 'active',
    promotedToChannelId: (row.promoted_to_channel_id as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

/**
 * Idempotent create-or-get, mirroring createOrGetChannel's shape in
 * peerChannel.ts. One row per (owner, contact person) — enforced by the
 * migration's own unique index, so a concurrent create is resolved the same
 * way createOrGetChannel resolves a concurrent pair_key race (23505 → re-read).
 */
export async function resolveOrCreateOffplatformRelationship(
  ownerAuthProfileId: string,
  contactPersonId: string,
): Promise<PeerResult<QubeTalkOffplatformRelationship>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const existing = await admin
    .from(OFFPLATFORM)
    .select('*')
    .eq('owner_auth_profile_id', ownerAuthProfileId)
    .eq('contact_person_id', contactPersonId)
    .maybeSingle();
  if (existing.data) return { ok: true, value: rowToOffplatformRelationship(existing.data as Record<string, unknown>) };

  const insert = await admin
    .from(OFFPLATFORM)
    .insert({ owner_auth_profile_id: ownerAuthProfileId, contact_person_id: contactPersonId })
    .select('*')
    .single();
  if (insert.error) {
    // A concurrent create may have won the unique(owner, contact) race — re-read.
    if (insert.error.code === '23505') {
      const retry = await admin
        .from(OFFPLATFORM)
        .select('*')
        .eq('owner_auth_profile_id', ownerAuthProfileId)
        .eq('contact_person_id', contactPersonId)
        .maybeSingle();
      if (retry.data) return { ok: true, value: rowToOffplatformRelationship(retry.data as Record<string, unknown>) };
    }
    if (insert.error.message.includes(OFFPLATFORM)) {
      return { ok: false, code: 'migration_pending', error: 'offplatform relationship table not provisioned — apply 20260930100000.' };
    }
    return { ok: false, error: insert.error.message };
  }
  return { ok: true, value: rowToOffplatformRelationship(insert.data as Record<string, unknown>) };
}

export async function getOffplatformRelationship(
  offplatformRelationshipId: string,
): Promise<PeerResult<QubeTalkOffplatformRelationship>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin.from(OFFPLATFORM).select('*').eq('id', offplatformRelationshipId).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'offplatform relationship not found', code: 'not_found' };
  return { ok: true, value: rowToOffplatformRelationship(data as Record<string, unknown>) };
}

/**
 * Record that this off-platform relationship has since been linked to a
 * real, personhood-bound passport_peer_channels row (the ContactPerson
 * gained a linked persona and the two sides opened a real peer channel).
 *
 * This ONLY sets promoted_to_channel_id — it deliberately does NOT rewrite
 * or migrate any existing qubetalk_relationship_state / qubetalk_conversations
 * row that already anchors on this offplatform id; that history stays exactly
 * where it is (P0.5's "must be promotable later WITHOUT rewriting existing
 * conversation/message history" requirement).
 *
 * NOTE — deliberate, named gap: nothing currently CALLS this automatically
 * when a ContactPerson later gets linked_personhood_ref set. Wiring that
 * trigger (ContactGraph contact linking → automatic promotion) is out of
 * scope for this pass; this function is correct and tested in isolation,
 * ready for that caller to be added later.
 */
export async function promoteOffplatformRelationship(
  offplatformRelationshipId: string,
  channelId: string,
): Promise<PeerResult<QubeTalkOffplatformRelationship>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin
    .from(OFFPLATFORM)
    .update({ promoted_to_channel_id: channelId })
    .eq('id', offplatformRelationshipId)
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToOffplatformRelationship(data as Record<string, unknown>) };
}
