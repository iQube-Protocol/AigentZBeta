/**
 * ContactGraph — ContactPersona.
 *
 * A role/context through which the owner knows/reaches a ContactPerson
 * ("Professional", "Personal", "Horizon"). Does NOT assume every persona
 * needs a formal Polity persona record (C4) — `linkedPlatformPersonaRef` is
 * opt-in, set only when the context genuinely IS an established platform
 * persona.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { ContactPersona } from '@/types/contactGraph';
import type { PeerResult } from '@/services/qubetalk/peerChannel';
import { getContactPerson } from '@/services/contactGraph/contactPersons';

const CONTACT_PERSONAS = 'contact_personas';

function rowToContactPersona(row: Record<string, unknown>): ContactPersona {
  return {
    id: String(row.id),
    contactPersonId: String(row.contact_person_id),
    ownerAuthProfileId: String(row.owner_auth_profile_id),
    label: String(row.label),
    linkedPlatformPersonaRef: (row.linked_platform_persona_ref as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function createContactPersona(
  ownerAuthProfileId: string,
  contactPersonId: string,
  input: { label: string; linkedPlatformPersonaRef?: string | null },
): Promise<PeerResult<ContactPersona>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const owned = await getContactPerson(ownerAuthProfileId, contactPersonId);
  if (!owned.ok) return owned;

  const { data, error } = await admin
    .from(CONTACT_PERSONAS)
    .insert({
      contact_person_id: contactPersonId,
      owner_auth_profile_id: ownerAuthProfileId,
      label: input.label,
      linked_platform_persona_ref: input.linkedPlatformPersonaRef ?? null,
    })
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToContactPersona(data as Record<string, unknown>) };
}

export async function listContactPersonas(
  ownerAuthProfileId: string,
  contactPersonId: string,
): Promise<PeerResult<ContactPersona[]>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const owned = await getContactPerson(ownerAuthProfileId, contactPersonId);
  if (!owned.ok) return owned;
  const { data, error } = await admin
    .from(CONTACT_PERSONAS)
    .select('*')
    .eq('contact_person_id', contactPersonId)
    .order('label', { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: (data ?? []).map((r) => rowToContactPersona(r as Record<string, unknown>)) };
}

/**
 * Get-or-create a ContactPersona by label under a ContactPerson — idempotent
 * so repeated resolution (e.g. from the reconciliation projector) never
 * creates duplicate contexts for the same person.
 */
export async function getOrCreateContactPersonaByLabel(
  ownerAuthProfileId: string,
  contactPersonId: string,
  label: string,
): Promise<PeerResult<ContactPersona>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const owned = await getContactPerson(ownerAuthProfileId, contactPersonId);
  if (!owned.ok) return owned;

  const { data: existing, error: readError } = await admin
    .from(CONTACT_PERSONAS)
    .select('*')
    .eq('contact_person_id', contactPersonId)
    .eq('label', label)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (existing) return { ok: true, value: rowToContactPersona(existing as Record<string, unknown>) };

  return createContactPersona(ownerAuthProfileId, contactPersonId, { label });
}
