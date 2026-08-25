/**
 * ContactGraph <-> QubeTalk bridge (C9/NC10: QubeTalk REFERENCES ContactGraph
 * resolution; it never maintains a competing address book).
 *
 * This module is the ONLY place QubeTalk's participant directory is linked
 * to ContactGraph. `participants.ts`/`ingestion.ts` are otherwise unchanged —
 * a caller that wants ContactGraph-aware resolution calls
 * `resolveParticipantViaContactGraph` in addition to (never instead of)
 * QubeTalk's own `resolveParticipantByEndpoint`, per the reuse-audit
 * decision to bridge rather than fork.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { PeerResult } from '@/services/qubetalk/peerChannel';
import type { QubeTalkParticipant, QubeTalkEndpointPlatform } from '@/types/qubetalk';
import type { ContactEndpointPlatform } from '@/types/contactGraph';
import { resolveEndpointForOwner } from '@/services/contactGraph/contactEndpoints';
import { getContactPerson } from '@/services/contactGraph/contactPersons';

const PARTICIPANTS = 'qubetalk_participants';
const ENDPOINTS = 'qubetalk_participant_endpoints';

/**
 * Given an inbound platform+handle, ask ContactGraph (scoped to the owner's
 * real identity, `ownerAuthProfileId`) whether it already knows who this is.
 * Exact-match only (delegates to resolveEndpointForOwner's own N4 discipline)
 * — returns `value: null` when ContactGraph has no match, in which case the
 * caller falls back to QubeTalk's own `resolveParticipantByEndpoint`/creates
 * a new unresolved participant exactly as before this bridge existed.
 */
export async function resolveContactPersonForInboundEndpoint(
  ownerAuthProfileId: string,
  platform: QubeTalkEndpointPlatform,
  endpointRef: string,
): Promise<PeerResult<{ contactPersonId: string; contactPersonaId: string; displayName: string } | null>> {
  const resolved = await resolveEndpointForOwner(
    ownerAuthProfileId,
    platform as ContactEndpointPlatform,
    endpointRef,
  );
  if (!resolved.ok) return resolved;
  if (!resolved.value) return { ok: true, value: null };

  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data: personaRow, error } = await admin
    .from('contact_personas')
    .select('*, contact_persons!inner(id, display_name)')
    .eq('id', resolved.value.contactPersonaId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const person = (personaRow as Record<string, unknown> | null)?.contact_persons as
    | { id?: string; display_name?: string }
    | undefined;
  if (!person?.id) return { ok: true, value: null };

  return {
    ok: true,
    value: {
      contactPersonId: person.id,
      contactPersonaId: resolved.value.contactPersonaId,
      displayName: person.display_name ?? '',
    },
  };
}

/** Link an already-resolved QubeTalk participant to its ContactGraph
 *  ContactPerson. Ownership-checked on both sides. */
export async function linkParticipantToContactPerson(
  ownerPersonaId: string,
  ownerAuthProfileId: string,
  participantId: string,
  contactPersonId: string,
): Promise<PeerResult<QubeTalkParticipant>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const owned = await getContactPerson(ownerAuthProfileId, contactPersonId);
  if (!owned.ok) return owned;

  const { data, error } = await admin
    .from(PARTICIPANTS)
    .update({ contact_person_id: contactPersonId })
    .eq('id', participantId)
    .eq('owner_persona_id', ownerPersonaId)
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'participant not found', code: 'not_found' };
  return {
    ok: true,
    value: {
      id: String(data.id),
      ownerPersonaId: String(data.owner_persona_id),
      principalRef: (data.principal_ref as string | null) ?? null,
      displayName: String(data.display_name),
      contactPersonId: (data.contact_person_id as string | null) ?? null,
      createdAt: String(data.created_at),
      updatedAt: String(data.updated_at),
    },
  };
}

/** Link a specific QubeTalk participant endpoint to the ContactGraph
 *  persona/context it belongs to (refinement 1: person-level continuity on
 *  the participant, persona/context-level on each endpoint). */
export async function linkParticipantEndpointToContactPersona(
  endpointId: string,
  contactPersonaId: string,
): Promise<PeerResult<{ id: string; contactPersonaId: string }>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin
    .from(ENDPOINTS)
    .update({ contact_persona_id: contactPersonaId })
    .eq('id', endpointId)
    .select('id, contact_persona_id')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: { id: String(data.id), contactPersonaId: String(data.contact_persona_id) } };
}

/** Read-only convenience lookup for aigentMe's Person view (§12): which of
 *  the owner's OWN QubeTalk participants (their communications-membrane
 *  directory entries) are already linked to this ContactPerson. A thin
 *  read, not a new capability — the actual relationship/conversation data
 *  those participants carry still flows through QubeTalk's own projection
 *  contract (services/qubetalk/projection.ts), never duplicated here. */
export async function listParticipantsLinkedToContactPerson(
  ownerPersonaId: string,
  contactPersonId: string,
): Promise<PeerResult<QubeTalkParticipant[]>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin
    .from(PARTICIPANTS)
    .select('*')
    .eq('owner_persona_id', ownerPersonaId)
    .eq('contact_person_id', contactPersonId);
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    value: (data ?? []).map((row) => ({
      id: String(row.id),
      ownerPersonaId: String(row.owner_persona_id),
      principalRef: (row.principal_ref as string | null) ?? null,
      displayName: String(row.display_name),
      contactPersonId: (row.contact_person_id as string | null) ?? null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    })),
  };
}
