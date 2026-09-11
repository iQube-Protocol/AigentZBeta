/**
 * RoomQube — governed, private, shareable sub-Locker surfaces (spec §5.5,
 * §7.2/§7.3, §11, §16.3/§16.4).
 *
 * ONE primitive for every room type (data-room, research-room, partner-room,
 * board-room, briefing-room, cohort-room, custom) — spec §11.1/acceptance
 * #16. Never a bespoke per-type table.
 *
 * QubeTalk integration (spec §9.1, §11.5 — a HARD requirement, "no separate
 * messaging system for rooms"): `openRoomConversation` provisions a real
 * qubetalk_groups row (membership) + a qubetalk_conversations row
 * (topology='group', group_id -> that group) — the SAME GroupQube/
 * ConversationQube tables the QubeTalk Communications Membrane introduced.
 * Membership rows target qubetalk_group_memberships.participant_id (a real
 * FK to qubetalk_participants), resolved/created via the EXISTING
 * services/qubetalk/participants.ts resolveOrCreateParticipantByPrincipalRef
 * — never a second membership representation. Posting an actual message
 * into the conversation (postRoomMessage / postSharePackToRoom, spec §16.4)
 * is real, available work now (services/qubetalk/egress.ts's
 * sendMessageThroughTransport + the group/topology='group' conversation
 * already provisioned here) but was NOT built in this integration pass —
 * see the Phase 1 closeout's "Known limitations" section. RoomQube CAN
 * reference its conversation; it does not yet post into it.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { resolveOrCreateParticipantByPrincipalRef } from '@/services/qubetalk/participants';
import { personaPublicRef } from '@/services/identity/personaReferences';
import type {
  RoomQube, RoomQubePlacement, RoomQubeMember, RoomType, RoomQubeStatus,
  RoomMemberRole, RoomMemberSubjectType, PeerResult,
} from '@/types/locker';

function admin() {
  const client = getSupabaseServer();
  if (!client) throw new Error('Supabase configuration missing for RoomQube service');
  return client;
}

// ─────────────────────────────────────────────────────────────────────────
// Row <-> domain mapping.
// ─────────────────────────────────────────────────────────────────────────

interface RoomRow {
  id: string;
  title: string;
  purpose: string;
  room_type: RoomType;
  venture_id: string | null;
  owner_persona_id: string;
  intended_audience: string | null;
  default_access_policy: Record<string, unknown> | null;
  qubetalk_group_id: string | null;
  qubetalk_conversation_id: string | null;
  qubetalk_mode: 'room-thread' | 'topic-channel';
  notifications_enabled: boolean;
  status: RoomQubeStatus;
  created_at: string;
  updated_at: string;
}

function rowToRoom(row: RoomRow): RoomQube {
  return {
    id: row.id,
    title: row.title,
    purpose: row.purpose,
    roomType: row.room_type,
    ventureId: row.venture_id,
    ownerPersonaId: row.owner_persona_id,
    intendedAudience: row.intended_audience,
    defaultAccessPolicy: row.default_access_policy ?? {},
    qubeTalkContext: {
      groupId: row.qubetalk_group_id,
      conversationId: row.qubetalk_conversation_id,
      mode: row.qubetalk_mode,
      notificationsEnabled: row.notifications_enabled,
    },
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface PlacementRow {
  id: string;
  roomqube_id: string;
  asset_id: string;
  label_override: string | null;
  description_override: string | null;
  preferred_rendition_id: string | null;
  version_policy_mode: 'follow-current' | 'pinned';
  pinned_version_asset_id: string | null;
  section: string | null;
  display_order: number;
  added_by_persona_id: string;
  added_at: string;
}

function rowToPlacement(row: PlacementRow): RoomQubePlacement {
  return {
    id: row.id,
    roomQubeId: row.roomqube_id,
    assetId: row.asset_id,
    labelOverride: row.label_override,
    descriptionOverride: row.description_override,
    preferredRenditionId: row.preferred_rendition_id,
    versionPolicy: row.version_policy_mode === 'pinned'
      ? { mode: 'pinned', versionAssetId: row.pinned_version_asset_id as string }
      : { mode: 'follow-current' },
    section: row.section,
    order: row.display_order,
    addedByPersonaId: row.added_by_persona_id,
    addedAt: row.added_at,
  };
}

interface MemberRow {
  id: string;
  roomqube_id: string;
  subject_type: RoomMemberSubjectType;
  subject_persona_id: string | null;
  subject_group_ref: string | null;
  role: RoomMemberRole;
  invited_by_persona_id: string;
  joined_at: string | null;
  expires_at: string | null;
  removed_at: string | null;
}

function rowToMember(row: MemberRow): RoomQubeMember {
  return {
    id: row.id,
    roomQubeId: row.roomqube_id,
    subjectType: row.subject_type,
    subjectPersonaId: row.subject_persona_id,
    subjectGroupRef: row.subject_group_ref,
    role: row.role,
    invitedByPersonaId: row.invited_by_persona_id,
    joinedAt: row.joined_at,
    expiresAt: row.expires_at,
    removedAt: row.removed_at,
  };
}

async function assertOwnsRoom(
  db: ReturnType<typeof getSupabaseServer>,
  roomQubeId: string,
  callerPersonaId: string,
): Promise<PeerResult<RoomRow>> {
  if (!db) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await db.from('roomqubes').select('*').eq('id', roomQubeId).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'room not found', code: 'not_found' };
  const row = data as RoomRow;
  if (row.owner_persona_id !== callerPersonaId) {
    return { ok: false, error: 'caller does not own this room', code: 'forbidden' };
  }
  return { ok: true, value: row };
}

// ─────────────────────────────────────────────────────────────────────────
// CRUD.
// ─────────────────────────────────────────────────────────────────────────

export interface CreateRoomQubeInput {
  ownerPersonaId: string;
  title: string;
  purpose?: string;
  roomType: RoomType;
  ventureId?: string;
  intendedAudience?: string;
  defaultAccessPolicy?: Record<string, unknown>;
}

export async function createRoomQube(input: CreateRoomQubeInput): Promise<PeerResult<RoomQube>> {
  if (!input.ownerPersonaId) return { ok: false, error: 'ownerPersonaId required' };
  if (!input.title.trim()) return { ok: false, error: 'title required' };
  const db = admin();
  const { data, error } = await db
    .from('roomqubes')
    .insert({
      title: input.title.trim(),
      purpose: input.purpose ?? '',
      room_type: input.roomType,
      venture_id: input.ventureId ?? null,
      owner_persona_id: input.ownerPersonaId,
      intended_audience: input.intendedAudience ?? null,
      default_access_policy: input.defaultAccessPolicy ?? {},
      status: 'draft',
    })
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'insert failed' };
  const room = rowToRoom(data as RoomRow);

  // Owner is always the first member (role: owner, joined immediately).
  await db.from('roomqube_members').insert({
    roomqube_id: room.id,
    subject_type: 'person',
    subject_persona_id: input.ownerPersonaId,
    role: 'owner',
    invited_by_persona_id: input.ownerPersonaId,
    joined_at: new Date().toISOString(),
  });

  await createActivityReceipt({
    personaId: input.ownerPersonaId,
    activeCartridge: 'locker',
    actionType: 'locker_roomqube_created',
    summary: `Created ${input.roomType} RoomQube "${room.title}"`,
    artifactsCreated: [room.id],
  }).catch((err) => console.warn('[Locker] createRoomQube receipt failed (non-fatal):', err instanceof Error ? err.message : err));

  return { ok: true, value: room };
}

export interface ResolvedRoomQube {
  room: RoomQube;
  placements: RoomQubePlacement[];
  members: RoomQubeMember[];
}

export async function resolveRoomQube(roomQubeId: string, callerPersonaId: string): Promise<PeerResult<ResolvedRoomQube>> {
  const db = admin();
  const owned = await assertOwnsRoom(db, roomQubeId, callerPersonaId);
  if (!owned.ok) return owned;

  const [{ data: placementRows }, { data: memberRows }] = await Promise.all([
    db.from('roomqube_placements').select('*').eq('roomqube_id', roomQubeId).order('display_order', { ascending: true }),
    db.from('roomqube_members').select('*').eq('roomqube_id', roomQubeId).is('removed_at', null),
  ]);

  return {
    ok: true,
    value: {
      room: rowToRoom(owned.value),
      placements: ((placementRows as PlacementRow[] | null) ?? []).map(rowToPlacement),
      members: ((memberRows as MemberRow[] | null) ?? []).map(rowToMember),
    },
  };
}

export async function listRoomQubes(ownerPersonaId: string): Promise<PeerResult<RoomQube[]>> {
  if (!ownerPersonaId) return { ok: false, error: 'ownerPersonaId required' };
  const db = admin();
  const { data, error } = await db
    .from('roomqubes')
    .select('*')
    .eq('owner_persona_id', ownerPersonaId)
    .order('updated_at', { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: ((data as RoomRow[] | null) ?? []).map(rowToRoom) };
}

export async function archiveRoomQube(roomQubeId: string, callerPersonaId: string): Promise<PeerResult<void>> {
  const db = admin();
  const owned = await assertOwnsRoom(db, roomQubeId, callerPersonaId);
  if (!owned.ok) return owned;
  const { error } = await db.from('roomqubes').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', roomQubeId);
  if (error) return { ok: false, error: error.message };
  // Archiving never deletes placements/assets/members (spec §11.4/§11.6).
  return { ok: true, value: undefined };
}

// ─────────────────────────────────────────────────────────────────────────
// Placements — a reference, never a copy (spec §4.3, acceptance #12/#14).
// ─────────────────────────────────────────────────────────────────────────

export interface AddAssetToRoomQubeInput {
  roomQubeId: string;
  assetId: string;
  callerPersonaId: string;
  labelOverride?: string;
  section?: string;
  order?: number;
  versionPolicy?: { mode: 'follow-current' } | { mode: 'pinned'; versionAssetId: string };
}

export async function addAssetToRoomQube(input: AddAssetToRoomQubeInput): Promise<PeerResult<RoomQubePlacement>> {
  const db = admin();
  const owned = await assertOwnsRoom(db, input.roomQubeId, input.callerPersonaId);
  if (!owned.ok) return owned;

  const versionPolicy = input.versionPolicy ?? { mode: 'follow-current' as const };
  const { data, error } = await db
    .from('roomqube_placements')
    .insert({
      roomqube_id: input.roomQubeId,
      asset_id: input.assetId,
      label_override: input.labelOverride ?? null,
      section: input.section ?? null,
      display_order: input.order ?? 0,
      version_policy_mode: versionPolicy.mode,
      pinned_version_asset_id: versionPolicy.mode === 'pinned' ? versionPolicy.versionAssetId : null,
      added_by_persona_id: input.callerPersonaId,
    })
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'insert failed' };

  await createActivityReceipt({
    personaId: input.callerPersonaId,
    activeCartridge: 'locker',
    actionType: 'locker_roomqube_asset_added',
    summary: `Placed an asset into RoomQube ${input.roomQubeId}`,
    artifactsCreated: [input.assetId],
  }).catch((err) => console.warn('[Locker] addAssetToRoomQube receipt failed (non-fatal):', err instanceof Error ? err.message : err));

  return { ok: true, value: rowToPlacement(data as PlacementRow) };
}

export async function removeRoomQubePlacement(placementId: string, callerPersonaId: string): Promise<PeerResult<void>> {
  const db = admin();
  const { data, error } = await db.from('roomqube_placements').select('roomqube_id').eq('id', placementId).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'placement not found', code: 'not_found' };
  const owned = await assertOwnsRoom(db, (data as { roomqube_id: string }).roomqube_id, callerPersonaId);
  if (!owned.ok) return owned;
  const { error: delErr } = await db.from('roomqube_placements').delete().eq('id', placementId);
  if (delErr) return { ok: false, error: delErr.message };
  // Deleting a PLACEMENT never deletes the underlying asset_records row
  // (spec §4.3/acceptance #14).
  return { ok: true, value: undefined };
}

// ─────────────────────────────────────────────────────────────────────────
// Membership (spec §11.4). Personhood-anchored: subjectPersonaId is
// resolved server-side by the caller (route layer) from a T1 handle before
// this is invoked — mirrors app/api/mycanvas/entries/[id]/invite/route.ts.
// Full ContactGraph-backed resolution is Phase 2 (see closeout).
// ─────────────────────────────────────────────────────────────────────────

/**
 * qubetalk_group_memberships.participant_id is a real FK to
 * qubetalk_participants — the room owner's OWN per-owner directory entry
 * for this member, exactly as every other GroupQube membership in this
 * codebase resolves it. Never write a raw persona ref into that column.
 */
async function resolveMemberParticipantId(
  db: ReturnType<typeof getSupabaseServer>,
  roomOwnerPersonaId: string,
  subjectPersonaId: string,
): Promise<string | null> {
  if (!db) return null;
  const { data: personaRow } = await db.from('personas').select('display_name').eq('id', subjectPersonaId).maybeSingle();
  const displayName = (personaRow as { display_name?: string } | null)?.display_name ?? 'Room member';
  const resolved = await resolveOrCreateParticipantByPrincipalRef(roomOwnerPersonaId, personaPublicRef(subjectPersonaId), displayName);
  return resolved.ok ? resolved.value.id : null;
}

export interface InviteRoomQubeMemberInput {
  roomQubeId: string;
  callerPersonaId: string;
  subjectType: RoomMemberSubjectType;
  subjectPersonaId?: string;
  subjectGroupRef?: string;
  role: RoomMemberRole;
  expiresAt?: string;
}

export async function inviteRoomQubeMember(input: InviteRoomQubeMemberInput): Promise<PeerResult<RoomQubeMember>> {
  const db = admin();
  const owned = await assertOwnsRoom(db, input.roomQubeId, input.callerPersonaId);
  if (!owned.ok) return owned;

  if (input.subjectType === 'person' && !input.subjectPersonaId) {
    return { ok: false, error: 'subjectPersonaId required for subjectType=person' };
  }
  if (input.subjectType !== 'person' && !input.subjectGroupRef) {
    return { ok: false, error: 'subjectGroupRef required for subjectType=group|agent' };
  }

  const { data, error } = await db
    .from('roomqube_members')
    .insert({
      roomqube_id: input.roomQubeId,
      subject_type: input.subjectType,
      subject_persona_id: input.subjectType === 'person' ? input.subjectPersonaId : null,
      subject_group_ref: input.subjectType === 'person' ? null : input.subjectGroupRef,
      role: input.role,
      invited_by_persona_id: input.callerPersonaId,
      expires_at: input.expiresAt ?? null,
    })
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'insert failed' };

  await createActivityReceipt({
    personaId: input.callerPersonaId,
    activeCartridge: 'locker',
    actionType: 'locker_roomqube_member_invited',
    summary: `Invited a ${input.subjectType} as ${input.role} to RoomQube ${input.roomQubeId}`,
  }).catch((err) => console.warn('[Locker] inviteRoomQubeMember receipt failed (non-fatal):', err instanceof Error ? err.message : err));

  // Keep the QubeTalk group roster (if already opened) synchronized —
  // spec §11.5 "automatic synchronization of RoomQube membership into
  // permitted conversation participation". Best-effort; a failure here
  // never blocks the membership grant itself.
  if (owned.value.qubetalk_group_id && input.subjectType === 'person' && input.subjectPersonaId) {
    const participantId = await resolveMemberParticipantId(db, input.callerPersonaId, input.subjectPersonaId);
    if (participantId) {
      await db.from('qubetalk_group_memberships').insert({
        group_id: owned.value.qubetalk_group_id,
        participant_id: participantId,
      }).then(undefined, () => undefined);
    }
  }

  return { ok: true, value: rowToMember(data as MemberRow) };
}

export async function updateRoomQubeMemberRole(
  memberId: string,
  callerPersonaId: string,
  role: RoomMemberRole,
): Promise<PeerResult<RoomQubeMember>> {
  const db = admin();
  const { data: memberRow, error: memberErr } = await db.from('roomqube_members').select('*').eq('id', memberId).maybeSingle();
  if (memberErr) return { ok: false, error: memberErr.message };
  if (!memberRow) return { ok: false, error: 'member not found', code: 'not_found' };
  const owned = await assertOwnsRoom(db, (memberRow as MemberRow).roomqube_id, callerPersonaId);
  if (!owned.ok) return owned;
  const { data, error } = await db.from('roomqube_members').update({ role }).eq('id', memberId).select('*').single();
  if (error || !data) return { ok: false, error: error?.message ?? 'update failed' };
  return { ok: true, value: rowToMember(data as MemberRow) };
}

/** Removing/expiring a member also revokes their QubeTalk room access —
 *  spec acceptance #19. Since actual QubeTalk participant ACL enforcement
 *  lives in the (unavailable-in-this-worktree) membrane services, this
 *  removes them from the local group-membership mirror synchronously; the
 *  real enforcement point at integration is qubetalk_group_memberships
 *  itself, which egress.ts's conversation resolution already consults. */
export async function removeRoomQubeMember(memberId: string, callerPersonaId: string): Promise<PeerResult<void>> {
  const db = admin();
  const { data: memberRow, error: memberErr } = await db.from('roomqube_members').select('*').eq('id', memberId).maybeSingle();
  if (memberErr) return { ok: false, error: memberErr.message };
  if (!memberRow) return { ok: false, error: 'member not found', code: 'not_found' };
  const row = memberRow as MemberRow;
  const owned = await assertOwnsRoom(db, row.roomqube_id, callerPersonaId);
  if (!owned.ok) return owned;

  const { error } = await db.from('roomqube_members').update({ removed_at: new Date().toISOString() }).eq('id', memberId);
  if (error) return { ok: false, error: error.message };

  if (owned.value.qubetalk_group_id && row.subject_persona_id) {
    const participantId = await resolveMemberParticipantId(db, callerPersonaId, row.subject_persona_id);
    if (participantId) {
      await db
        .from('qubetalk_group_memberships')
        .update({ left_at: new Date().toISOString() })
        .eq('group_id', owned.value.qubetalk_group_id)
        .eq('participant_id', participantId)
        .is('left_at', null)
        .then(undefined, () => undefined);
    }
  }
  return { ok: true, value: undefined };
}

// ─────────────────────────────────────────────────────────────────────────
// QubeTalk conversation activation (spec §11.5, §16.4 openRoomConversation).
// Provisions a GroupQube (qubetalk_groups + memberships from CURRENT active
// room members) and a ConversationQube (topology='group') the FIRST time a
// room is activated. Idempotent — a second call returns the existing
// context rather than creating a duplicate.
// ─────────────────────────────────────────────────────────────────────────

export async function openRoomConversation(roomQubeId: string, callerPersonaId: string): Promise<PeerResult<RoomQube>> {
  const db = admin();
  const owned = await assertOwnsRoom(db, roomQubeId, callerPersonaId);
  if (!owned.ok) return owned;

  if (owned.value.qubetalk_conversation_id) {
    // Already open — spec §11.5 "created on activation or first message";
    // re-calling is idempotent, not an error.
    return { ok: true, value: rowToRoom(owned.value) };
  }

  const { data: memberRows } = await db
    .from('roomqube_members')
    .select('subject_persona_id')
    .eq('roomqube_id', roomQubeId)
    .eq('subject_type', 'person')
    .is('removed_at', null);
  const personaRefs = ((memberRows as { subject_persona_id: string | null }[] | null) ?? [])
    .map((m) => m.subject_persona_id)
    .filter((v): v is string => !!v);

  const { data: groupRow, error: groupErr } = await db
    .from('qubetalk_groups')
    .insert({ created_by_ref: callerPersonaId, name: owned.value.title, description: owned.value.purpose })
    .select('id')
    .single();
  if (groupErr || !groupRow) return { ok: false, error: groupErr?.message ?? 'group creation failed' };
  const groupId = (groupRow as { id: string }).id;

  if (personaRefs.length > 0) {
    const participantIds = (
      await Promise.all(personaRefs.map((ref) => resolveMemberParticipantId(db, callerPersonaId, ref)))
    ).filter((id): id is string => !!id);
    if (participantIds.length > 0) {
      await db.from('qubetalk_group_memberships').insert(
        participantIds.map((participantId) => ({ group_id: groupId, participant_id: participantId })),
      );
    }
  }

  const { data: convRow, error: convErr } = await db
    .from('qubetalk_conversations')
    .insert({ group_id: groupId, topology: 'group', title: owned.value.title })
    .select('id')
    .single();
  if (convErr || !convRow) return { ok: false, error: convErr?.message ?? 'conversation creation failed' };
  const conversationId = (convRow as { id: string }).id;

  const { data, error } = await db
    .from('roomqubes')
    .update({ qubetalk_group_id: groupId, qubetalk_conversation_id: conversationId, status: 'active', updated_at: new Date().toISOString() })
    .eq('id', roomQubeId)
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'room update failed' };

  await createActivityReceipt({
    personaId: callerPersonaId,
    activeCartridge: 'locker',
    actionType: 'locker_roomqube_conversation_opened',
    summary: `Opened the QubeTalk conversation for RoomQube "${owned.value.title}"`,
  }).catch((err) => console.warn('[Locker] openRoomConversation receipt failed (non-fatal):', err instanceof Error ? err.message : err));

  return { ok: true, value: rowToRoom(data as RoomRow) };
}
