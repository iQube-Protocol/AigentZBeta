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
 *
 * P0.5 widening (2026-08-26) also adds:
 *   - owner-scoped reads (getOffplatformRelationship now REQUIRES the
 *     caller's ownerAuthProfileId — no more UUID-only lookup);
 *   - a transactional-equivalent, fully-verified promotion
 *     (promoteOffplatformRelationship);
 *   - the actual off-platform MessageQube send/read path
 *     (postOffplatformMessage / listOffplatformMessages), gated by
 *     transport-honesty (resolveReachableOffplatformTransport) — a send never
 *     silently succeeds or fails; an unreachable contact returns a clear
 *     'no_reachable_transport' code instead.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { personaPublicRef } from '@/services/identity/personaReferences';
import { resolveOwnerAuthProfileId } from '@/services/contactGraph/ownerResolution';
import type { QubeTalkOffplatformRelationship } from '@/types/qubetalk';
import type { PeerResult } from '@/services/qubetalk/peerChannel';
import { validateHumanMessage } from '@/services/qubetalk/peerChannel';
import { transportHasCapability } from '@/services/qubetalk/transportRegistry';
import { resolveDiscordChannelReference, sendDiscordContent } from '@/services/qubetalk/transports/discordTransport';

const OFFPLATFORM = 'qubetalk_offplatform_relationships';
const MESSAGES = 'passport_peer_messages';
const CONTACT_PERSONAS = 'contact_personas';
const CONTACT_ENDPOINTS = 'contact_endpoints';
const CHANNELS = 'passport_peer_channels';
const CONTACT_PERSONS = 'contact_persons';

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

  // Verify the contact genuinely belongs to this owner BEFORE creating an
  // anchor that claims it does — the service-layer mirror of the composite
  // FK's intent (qubetalk_offplatform_relationships_owner_contact_fkey, the
  // DB-level backstop for the SAME invariant). A caller that supplies an
  // ownerAuthProfileId not matching the contact's real owner gets a clean
  // 'not_found' here, never a row that silently claims someone else's
  // ContactGraph contact.
  const { data: personRow, error: personErr } = await admin
    .from(CONTACT_PERSONS)
    .select('id')
    .eq('id', contactPersonId)
    .eq('owner_auth_profile_id', ownerAuthProfileId)
    .maybeSingle();
  if (personErr) return { ok: false, error: personErr.message };
  if (!personRow) return { ok: false, error: 'contact person not found for this owner', code: 'not_found' };

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

/**
 * Owner-scoped read — REQUIRES `ownerAuthProfileId` and filters on it
 * DB-side (never a UUID-only lookup). This is the "real gap" fix (P0.5
 * widening): before this, any caller who knew or guessed another owner's
 * `qubetalk_offplatform_relationships.id` could read that owner's
 * relationship. Mirrors `getContactPerson(ownerAuthProfileId, contactPersonId)`'s
 * exact signature convention.
 */
export async function getOffplatformRelationship(
  ownerAuthProfileId: string,
  offplatformRelationshipId: string,
): Promise<PeerResult<QubeTalkOffplatformRelationship>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin
    .from(OFFPLATFORM)
    .select('*')
    .eq('id', offplatformRelationshipId)
    .eq('owner_auth_profile_id', ownerAuthProfileId)
    .maybeSingle();
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
 * Fully verified + a compare-and-swap write (P0.5 widening, 2026-08-26):
 *   (a) the relationship belongs to the caller's auth profile;
 *   (b) the ContactPerson's CONFIRMED linked_personhood_ref is one of the two
 *       principals of the target channel;
 *   (c) the caller's own personaPublicRef is the OTHER principal;
 *   (d) no incompatible pre-existing lineage is silently merged — refuses if
 *       already promoted to a DIFFERENT channel, or if another off-platform
 *       relationship for this SAME owner already claims this SAME channel.
 *
 * Mechanism: verify-then-conditionally-update, guarded by
 * `.is('promoted_to_channel_id', null)` on the final write — the SAME
 * "verify, then compare-and-swap update guarded by current DB state" idiom
 * services/qubetalk/peerChannel.ts already uses in `markArtifactOpened` /
 * `copyToLocker` (`.eq(...).is('opened_at', null)` /
 * `.is('copied_to_locker_at', null)`), not a fresh invention. A genuine
 * Postgres-level transaction (a plpgsql RPC with row locking) was considered
 * and rejected as disproportionate here: promotion is a low-frequency,
 * per-relationship, one-time event (a contact links a persona once), the
 * real cross-relationship race this guards against is independently closed
 * by the DB-level partial unique index
 * (`qubetalk_offplatform_relationships_owner_promoted_uidx`, owner-scoped —
 * see the migration), and the guarded update's WHERE clause makes a lost
 * update to the SAME row detectable (an empty result means someone else won
 * the write) rather than silently overwritten.
 */
export async function promoteOffplatformRelationship(
  callerPersonaId: string,
  offplatformRelationshipId: string,
  channelId: string,
): Promise<PeerResult<QubeTalkOffplatformRelationship>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const owner = await resolveOwnerAuthProfileId(callerPersonaId);
  if (!owner.ok) return owner;

  // (a) relationship belongs to the caller's auth profile.
  const rel = await getOffplatformRelationship(owner.value, offplatformRelationshipId);
  if (!rel.ok) return rel;

  // Idempotent no-op if already promoted to this exact channel.
  if (rel.value.promotedToChannelId === channelId) return { ok: true, value: rel.value };
  // (d) refuse a silent merge onto a DIFFERENT prior lineage.
  if (rel.value.promotedToChannelId && rel.value.promotedToChannelId !== channelId) {
    return { ok: false, error: 'this off-platform relationship is already promoted to a different channel', code: 'already_promoted' };
  }

  // (b) the ContactPerson's CONFIRMED linked_personhood_ref.
  const { data: personRow, error: personErr } = await admin
    .from(CONTACT_PERSONS)
    .select('*')
    .eq('id', rel.value.contactPersonId)
    .eq('owner_auth_profile_id', owner.value)
    .maybeSingle();
  if (personErr) return { ok: false, error: personErr.message };
  if (!personRow) return { ok: false, error: 'contact person not found', code: 'not_found' };
  const linkedRef = ((personRow as Record<string, unknown>).linked_personhood_ref as string | null) ?? null;
  if (!linkedRef) {
    return { ok: false, error: 'this contact has no confirmed linked platform persona yet', code: 'not_linked' };
  }

  // (b)/(c) the target channel is genuinely between the caller and this
  // exact contact — both principal refs must match, order-independent.
  const { data: channelRow, error: channelErr } = await admin.from(CHANNELS).select('*').eq('id', channelId).maybeSingle();
  if (channelErr) return { ok: false, error: channelErr.message };
  if (!channelRow) return { ok: false, error: 'target channel not found', code: 'not_found' };
  const myRef = personaPublicRef(callerPersonaId);
  const principals = new Set([
    String((channelRow as Record<string, unknown>).principal_a_ref),
    String((channelRow as Record<string, unknown>).principal_b_ref),
  ]);
  if (!principals.has(myRef)) {
    return { ok: false, error: 'caller is not a principal of the target channel', code: 'not_a_principal' };
  }
  if (!principals.has(linkedRef)) {
    return { ok: false, error: 'the target channel is not between the caller and this contact', code: 'counterparty_mismatch' };
  }

  // (d) no OTHER off-platform relationship for this owner already claims
  // this same channel (the partial unique index is the DB-level backstop;
  // this is the friendly, pre-write check).
  const { data: conflictRow, error: conflictErr } = await admin
    .from(OFFPLATFORM)
    .select('id')
    .eq('owner_auth_profile_id', owner.value)
    .eq('promoted_to_channel_id', channelId)
    .maybeSingle();
  if (conflictErr) return { ok: false, error: conflictErr.message };
  if (conflictRow && String((conflictRow as Record<string, unknown>).id) !== rel.value.id) {
    return { ok: false, error: 'another off-platform relationship for this owner is already promoted to this channel', code: 'channel_already_claimed' };
  }

  // Compare-and-swap write — succeeds only if promoted_to_channel_id was
  // STILL null at write time (the guard clause below), same idiom as
  // peerChannel.ts's markArtifactOpened/copyToLocker.
  const { data: updated, error: updateErr } = await admin
    .from(OFFPLATFORM)
    .update({ promoted_to_channel_id: channelId })
    .eq('id', offplatformRelationshipId)
    .eq('owner_auth_profile_id', owner.value)
    .is('promoted_to_channel_id', null)
    .select('*')
    .maybeSingle();
  if (updateErr) return { ok: false, error: updateErr.message };
  if (!updated) {
    return { ok: false, error: 'promotion lost a race — this relationship was promoted concurrently', code: 'concurrent_promotion' };
  }
  return { ok: true, value: rowToOffplatformRelationship(updated as Record<string, unknown>) };
}

// ═══════════════════════════════════════════════════════════════════════
// Off-platform MessageQube — transport-honest send/read (P0.5 widening).
// ═══════════════════════════════════════════════════════════════════════

export interface OffplatformMessage {
  id: string;
  offplatformRelationshipId: string;
  senderRef: string;
  type: string;
  body: string;
  transport: string;
  deliveryState: 'pending' | 'delivered' | 'failed';
  externalMessageId: string | null;
  createdAt: string;
  /** True when the caller sent this message. */
  mine: boolean;
  /** Populated only when deliveryState === 'failed' — the real send error,
   *  never a fabricated one (mirrors OutboundSendResult.error in egress.ts). */
  error?: string;
}

/**
 * Resolve whether this ContactPerson has ANY known reachable endpoint with a
 * transport the capability registry (transportRegistry.ts) marks as actually
 * usable ('supported' or 'restricted' for a send capability — never
 * 'unsupported'). This is the transport-honesty gate (P0.5 §8): creating a
 * relationship never implies delivery is possible, and this is the ONE place
 * that question is actually answered before a send is attempted.
 */
async function resolveReachableOffplatformTransport(
  admin: NonNullable<ReturnType<typeof getSupabaseServer>>,
  contactPersonId: string,
): Promise<{ platform: string; identifier: string } | null> {
  const { data: personas } = await admin.from(CONTACT_PERSONAS).select('id').eq('contact_person_id', contactPersonId);
  const personaIds = ((personas ?? []) as Record<string, unknown>[]).map((p) => String(p.id));
  if (personaIds.length === 0) return null;

  const { data: endpoints } = await admin
    .from(CONTACT_ENDPOINTS)
    .select('*')
    .in('contact_persona_id', personaIds)
    .eq('state', 'active');
  for (const row of (endpoints ?? []) as Record<string, unknown>[]) {
    const platform = String(row.platform);
    const sendable =
      transportHasCapability(platform, 'dm.send') !== 'unsupported' ||
      transportHasCapability(platform, 'group.send') !== 'unsupported';
    if (sendable) {
      return { platform, identifier: String(row.normalized_identifier ?? row.identifier) };
    }
  }
  return null;
}

/**
 * The off-platform send path — the coherent completion of the MessageQube
 * anchor gap (P0.5 §6): `passport_peer_messages` now accepts
 * `offplatform_relationship_id` in place of `channel_id` (the migration's
 * `passport_peer_messages_exactly_one_anchor` CHECK). Ownership-checked via
 * `getOffplatformRelationship` (owner-scoped, DB-side); gated by
 * transport-honesty BEFORE any adapter is touched — an unreachable contact
 * returns `no_reachable_transport` and never inserts a message row implying
 * a send was attempted. Native `metame`-platform delivery does not apply
 * here (there is no platform presence to deliver to natively) — the ONLY
 * transport this repo has real, wired dispatch code for is Discord
 * (services/qubetalk/transports/discordTransport.ts, the exact code
 * services/qubetalk/egress.ts already uses for the peer-channel case), so
 * that is the only branch that actually attempts delivery; any other
 * capability the registry reports reachable-at-the-endpoint-level but has no
 * wired adapter for is refused with `transport_not_wired` rather than a
 * silent success or silent failure.
 */
export async function postOffplatformMessage(
  callerPersonaId: string,
  offplatformRelationshipId: string,
  input: { type?: string; body: string },
): Promise<PeerResult<OffplatformMessage>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const validated = validateHumanMessage(input.type, input.body);
  if (!validated.ok) return validated;

  const owner = await resolveOwnerAuthProfileId(callerPersonaId);
  if (!owner.ok) return owner;

  const rel = await getOffplatformRelationship(owner.value, offplatformRelationshipId);
  if (!rel.ok) return rel;
  if (rel.value.status !== 'active') return { ok: false, error: 'relationship is revoked', code: 'revoked' };

  const reachable = await resolveReachableOffplatformTransport(admin, rel.value.contactPersonId);
  if (!reachable) {
    return { ok: false, error: 'no reachable transport is known for this contact yet', code: 'no_reachable_transport' };
  }

  const myRef = personaPublicRef(callerPersonaId);
  let deliveryState: 'delivered' | 'failed' = 'failed';
  let externalMessageId: string | null = null;
  let sendError: string | undefined;

  if (reachable.platform === 'discord') {
    const discordChannelId = await resolveDiscordChannelReference(reachable.identifier);
    if (!discordChannelId) {
      sendError = `could not resolve the Discord endpoint '${reachable.identifier}' to a real channel — it is neither a channel id nor a resolvable invite`;
    } else {
      const outcome = await sendDiscordContent(discordChannelId, validated.value.body);
      deliveryState = outcome.deliveryState;
      externalMessageId = outcome.externalMessageId;
      sendError = outcome.error;
    }
  } else {
    // Reachable at the endpoint/capability-registry level, but no adapter in
    // this repo actually dispatches to it yet — an honest refusal, never a
    // fabricated delivery attempt.
    return { ok: false, error: `transport '${reachable.platform}' is not wired for sending yet`, code: 'transport_not_wired' };
  }

  const insert = await admin
    .from(MESSAGES)
    .insert({
      offplatform_relationship_id: offplatformRelationshipId,
      sender_ref: myRef,
      type: validated.value.type,
      body: validated.value.body,
      transport: reachable.platform,
      direction: 'outbound',
      external_message_id: externalMessageId,
      delivery_state: deliveryState,
      consequence: 'consequential',
    })
    .select('*')
    .single();
  if (insert.error) return { ok: false, error: insert.error.message };
  const row = insert.data as Record<string, unknown>;
  const message: OffplatformMessage = {
    id: String(row.id),
    offplatformRelationshipId,
    senderRef: myRef,
    type: String(row.type),
    body: String(row.body),
    transport: String(row.transport),
    deliveryState: (row.delivery_state as OffplatformMessage['deliveryState']) ?? deliveryState,
    externalMessageId: (row.external_message_id as string | null) ?? null,
    createdAt: String(row.created_at),
    mine: true,
    ...(deliveryState === 'failed' && sendError ? { error: sendError } : {}),
  };
  // The send was ATTEMPTED and honestly recorded either way — a failed
  // Discord dispatch is still a successful "record what happened" act
  // (mirrors egress.ts's own Discord branch, which returns `ok: true` with
  // `deliveryState: 'failed'` rather than an error result).
  return { ok: true, value: message };
}

/** List messages for an off-platform relationship the caller owns, oldest
 *  first. Ownership-checked the same way postOffplatformMessage is. */
export async function listOffplatformMessages(
  callerPersonaId: string,
  offplatformRelationshipId: string,
  limit = 200,
): Promise<PeerResult<OffplatformMessage[]>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const owner = await resolveOwnerAuthProfileId(callerPersonaId);
  if (!owner.ok) return owner;

  const rel = await getOffplatformRelationship(owner.value, offplatformRelationshipId);
  if (!rel.ok) return rel;

  const myRef = personaPublicRef(callerPersonaId);
  const { data, error } = await admin
    .from(MESSAGES)
    .select('*')
    .eq('offplatform_relationship_id', offplatformRelationshipId)
    .order('created_at', { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 500));
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    value: (data ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      const senderRef = String(row.sender_ref);
      return {
        id: String(row.id),
        offplatformRelationshipId,
        senderRef,
        type: String(row.type),
        body: String(row.body),
        transport: String(row.transport ?? 'qubetalk-native'),
        deliveryState: (row.delivery_state as OffplatformMessage['deliveryState']) ?? 'delivered',
        externalMessageId: (row.external_message_id as string | null) ?? null,
        createdAt: String(row.created_at),
        mine: senderRef === myRef,
      };
    }),
  };
}
