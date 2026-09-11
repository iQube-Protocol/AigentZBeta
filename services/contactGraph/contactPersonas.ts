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

// PostgREST builds `.in()` into a query-string filter — an owner with a
// large address book (1,200+ ContactPersons observed live) produces an IN
// list long enough to exceed the upstream URL-length limit, surfacing as a
// bare "Bad Request" (regression introduced by the 2026-08-27 "People 504
// fix" batching, which removed the old per-id loop but left the single
// batched .in() call unbounded). Chunking keeps each request small while
// still being O(ids / CHUNK_SIZE) round trips, not O(ids).
const IN_FILTER_CHUNK_SIZE = 100;

function chunkIds(ids: string[], size = IN_FILTER_CHUNK_SIZE): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
  return chunks;
}

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
 * BATCHED read for a whole projection page — the People 504 fix
 * (2026-08-27). `listContactPersonas` above does one ownership-check query
 * PLUS one list query PER ContactPerson; a projection over a persona's
 * entire address book (hundreds to 1,200+ ContactPersons observed live —
 * see app/api/contactgraph/people/route.ts's own header) turned that into
 * hundreds of sequential round trips and was the dominant contributor to a
 * live 504 on GET /api/contactgraph/people. `contact_personas` already
 * carries `owner_auth_profile_id` denormalized (this file's own header) so
 * ownership is enforced in the SAME single query — no separate per-id
 * ownership check needed, and no N+1. Returns ALL personas across every
 * requested ContactPerson in one round trip; callers group by
 * `contactPersonId` in memory. `contactPersonIds` is caller-supplied and
 * MUST already be ownership-filtered (e.g. via `listContactPersons`) —
 * this function does not re-derive which ids the owner owns, only enforces
 * that none of the returned rows belong to anyone else.
 */
export async function listContactPersonasForOwner(
  ownerAuthProfileId: string,
  contactPersonIds: string[],
): Promise<PeerResult<ContactPersona[]>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  if (contactPersonIds.length === 0) return { ok: true, value: [] };

  const rows: Record<string, unknown>[] = [];
  for (const idsChunk of chunkIds(contactPersonIds)) {
    const { data, error } = await admin
      .from(CONTACT_PERSONAS)
      .select('*')
      .in('contact_person_id', idsChunk)
      .eq('owner_auth_profile_id', ownerAuthProfileId)
      .order('label', { ascending: true });
    if (error) return { ok: false, error: error.message };
    rows.push(...(data ?? []));
  }
  // Each chunk is ordered independently — merge-sort by label so the
  // combined result still honours the documented "ordered by label"
  // contract, exactly as the single unchunked query did.
  rows.sort((a, b) => String(a.label).localeCompare(String(b.label)));
  return { ok: true, value: rows.map((r) => rowToContactPersona(r)) };
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
