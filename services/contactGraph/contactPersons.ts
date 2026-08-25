/**
 * ContactGraph — ContactPerson.
 *
 * The enduring human/contact, independent of context. NEVER a new
 * identity/personhood authority (mirrors QubeTalk's own P6/N3 discipline):
 * `linkedPersonhoodRef`, when set, is a real FK to `personas.public_ref` —
 * this module cannot mint an identity, only record that a Polity
 * Passport/persona reference has been independently confirmed. Identities
 * are NEVER merged off a display-name match alone (NC2).
 *
 * Owned by `ownerAuthProfileId` (the real owner across ALL of that owner's
 * own personas), not `ownerPersonaId` — see the migration header
 * (20260930050000_contactgraph_substrate.sql) for why: scoping per active
 * persona would duplicate the same contact every time the owner switches
 * their own active persona.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { ContactPerson, ContactPersonState } from '@/types/contactGraph';
import type { PeerResult } from '@/services/qubetalk/peerChannel';

const CONTACT_PERSONS = 'contact_persons';

function rowToContactPerson(row: Record<string, unknown>): ContactPerson {
  return {
    id: String(row.id),
    ownerAuthProfileId: String(row.owner_auth_profile_id),
    displayName: String(row.display_name),
    linkedPersonhoodRef: (row.linked_personhood_ref as string | null) ?? null,
    state: row.state as ContactPersonState,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/**
 * Create a new ContactPerson. `linkedPersonhoodRef` is accepted but never
 * inferred by this function — the caller supplies it explicitly only when
 * independently confirmed (e.g. two Passport holders connect), or leaves it
 * null for an ordinary off-platform contact (C4).
 */
export async function createContactPerson(
  ownerAuthProfileId: string,
  input: { displayName: string; linkedPersonhoodRef?: string | null },
): Promise<PeerResult<ContactPerson>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const { data, error } = await admin
    .from(CONTACT_PERSONS)
    .insert({
      owner_auth_profile_id: ownerAuthProfileId,
      display_name: input.displayName,
      linked_personhood_ref: input.linkedPersonhoodRef ?? null,
    })
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToContactPerson(data as Record<string, unknown>) };
}

export async function listContactPersons(ownerAuthProfileId: string): Promise<PeerResult<ContactPerson[]>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin
    .from(CONTACT_PERSONS)
    .select('*')
    .eq('owner_auth_profile_id', ownerAuthProfileId)
    .order('display_name', { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: (data ?? []).map((r) => rowToContactPerson(r as Record<string, unknown>)) };
}

export async function getContactPerson(
  ownerAuthProfileId: string,
  contactPersonId: string,
): Promise<PeerResult<ContactPerson>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin
    .from(CONTACT_PERSONS)
    .select('*')
    .eq('id', contactPersonId)
    .eq('owner_auth_profile_id', ownerAuthProfileId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'contact person not found', code: 'not_found' };
  return { ok: true, value: rowToContactPerson(data as Record<string, unknown>) };
}

/**
 * Resolve a ContactPerson by an ALREADY-KNOWN Polity Public Reference — the
 * one case identity resolution is safe to do automatically, because the ref
 * itself is the platform's own authoritative identity signal, not a guess.
 * Mirrors participants.ts's resolveOrCreateParticipantByPrincipalRef exactly.
 */
export async function resolveOrCreateContactPersonByPersonhoodRef(
  ownerAuthProfileId: string,
  personhoodRef: string,
  displayName: string,
): Promise<PeerResult<ContactPerson>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const { data: existing, error: readError } = await admin
    .from(CONTACT_PERSONS)
    .select('*')
    .eq('owner_auth_profile_id', ownerAuthProfileId)
    .eq('linked_personhood_ref', personhoodRef)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (existing) return { ok: true, value: rowToContactPerson(existing as Record<string, unknown>) };

  return createContactPerson(ownerAuthProfileId, { displayName, linkedPersonhoodRef: personhoodRef });
}

export async function archiveContactPerson(
  ownerAuthProfileId: string,
  contactPersonId: string,
): Promise<PeerResult<ContactPerson>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const owned = await getContactPerson(ownerAuthProfileId, contactPersonId);
  if (!owned.ok) return owned;
  const { data, error } = await admin
    .from(CONTACT_PERSONS)
    .update({ state: 'archived' })
    .eq('id', contactPersonId)
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToContactPerson(data as Record<string, unknown>) };
}
