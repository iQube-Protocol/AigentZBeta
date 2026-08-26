/**
 * ContactGraph reconciliation — projects existing `persona_contacts` rows
 * (the pre-existing, multi-source, deduped, FTS-indexed address-book
 * substrate) into the richer ContactGraph ontology.
 *
 * `persona_contacts` itself is left physically untouched by this module — no
 * row is moved or deleted. This is purely additive: existing rows keep
 * working exactly as before for every existing caller (resolveRecipient.ts,
 * draftEmail.ts, searchContacts.ts) while ContactGraph becomes a richer
 * layer ABOVE it (per the reuse-audit matrix: "existing address-book/import
 * substrate -> ContactGraph normalization/projection").
 *
 * Conservative backfill discipline (refinement 3 of the operator's
 * approval — never violated):
 *   - The multiple handles WITHIN one persona_contacts row are always
 *     associated to the SAME new ContactPerson (they were already asserted
 *     together by whoever saved that row).
 *   - An EXACT normalized-endpoint match against something ContactGraph
 *     already knows for this owner is deterministic, unambiguous evidence —
 *     the row is associated to that EXISTING ContactPerson rather than
 *     creating a duplicate.
 *   - Anything else (e.g. two persona_contacts rows with similar display
 *     names but no shared endpoint) is NEVER merged automatically — they
 *     become two separate ContactPersons, left for later
 *     user/aigentMe-assisted merge (NC2).
 *   - Only `promotion_state = 'confirmed'` rows are eligible (NC3: an
 *     observed/candidate row is never silently promoted by this projector).
 *
 * Idempotent: `persona_contacts.promoted_contact_person_id` records the
 * result of a prior projection; re-running is a no-op that returns the same
 * ContactPerson.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { PeerResult } from '@/services/qubetalk/peerChannel';
import type { ContactEndpointConfidence, ContactEndpointPlatform, ContactEndpointSource } from '@/types/contactGraph';
import { createContactPerson, getContactPerson } from '@/services/contactGraph/contactPersons';
import { getOrCreateContactPersonaByLabel } from '@/services/contactGraph/contactPersonas';
import { addContactEndpoint, resolveEndpointForOwner } from '@/services/contactGraph/contactEndpoints';

const PERSONA_CONTACTS = 'persona_contacts';
const DEFAULT_CONTEXT_LABEL = 'General';

interface PersonaContactRow {
  id: string;
  persona_id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  email_2: string | null;
  email_3: string | null;
  phone: string | null;
  phone_2: string | null;
  source: string;
  promotion_state: string;
  promoted_contact_person_id: string | null;
}

function candidateEndpoints(row: PersonaContactRow): Array<{ platform: ContactEndpointPlatform; identifier: string }> {
  const out: Array<{ platform: ContactEndpointPlatform; identifier: string }> = [];
  for (const email of [row.email, row.email_2, row.email_3]) {
    if (email) out.push({ platform: 'email', identifier: email });
  }
  for (const phone of [row.phone, row.phone_2]) {
    // A bare imported phone number has no known platform — 'sms' is the
    // platform-neutral "reachable at this number" designation; the owner
    // can reassign/relabel once they know it's actually WhatsApp/Signal/etc.
    if (phone) out.push({ platform: 'sms', identifier: phone });
  }
  return out;
}

/** Imported/saved sources map straight through to the matching
 *  contact_endpoints.source value (same vocabulary, extended). A deliberate
 *  'manual' save is user_confirmed-strength evidence; an import is
 *  high_confidence (a real external system asserted it, but the owner
 *  hasn't personally confirmed it inside ContactGraph). */
function sourceAndConfidence(personaContactSource: string): { source: ContactEndpointSource; confidence: ContactEndpointConfidence } {
  if (personaContactSource === 'manual') return { source: 'manual', confidence: 'user_confirmed' };
  const known: ContactEndpointSource[] = ['google_contacts', 'vcard', 'icloud', 'linkedin', 'outlook', 'csv'];
  const source = (known as string[]).includes(personaContactSource)
    ? (personaContactSource as ContactEndpointSource)
    : 'manual';
  return { source, confidence: 'high_confidence' };
}

async function findExistingContactPersonId(
  ownerAuthProfileId: string,
  endpoints: Array<{ platform: ContactEndpointPlatform; identifier: string }>,
): Promise<PeerResult<string | null>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  for (const endpoint of endpoints) {
    const resolved = await resolveEndpointForOwner(ownerAuthProfileId, endpoint.platform, endpoint.identifier);
    if (!resolved.ok) return resolved;
    if (resolved.value) {
      const { data, error } = await admin
        .from('contact_personas')
        .select('contact_person_id')
        .eq('id', resolved.value.contactPersonaId)
        .maybeSingle();
      if (error) return { ok: false, error: error.message };
      if (data?.contact_person_id) return { ok: true, value: String(data.contact_person_id) };
    }
  }
  return { ok: true, value: null };
}

/**
 * Project one `persona_contacts` row into ContactGraph. Only
 * `promotion_state = 'confirmed'` rows are eligible — a candidate must be
 * explicitly promoted first (see promotePersonaContactCandidate below).
 */
export async function projectPersonaContact(
  ownerAuthProfileId: string,
  personaContactId: string,
): Promise<PeerResult<{ contactPersonId: string; created: boolean }>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const { data: rowData, error: readError } = await admin
    .from(PERSONA_CONTACTS)
    .select('*')
    .eq('id', personaContactId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!rowData) return { ok: false, error: 'persona contact not found', code: 'not_found' };
  const row = rowData as PersonaContactRow;

  if (row.promoted_contact_person_id) {
    return { ok: true, value: { contactPersonId: row.promoted_contact_person_id, created: false } };
  }
  if (row.promotion_state !== 'confirmed') {
    return { ok: false, error: 'persona contact is not confirmed (candidate rows require explicit promotion)', code: 'not_confirmed' };
  }

  const endpoints = candidateEndpoints(row);
  const existingId = await findExistingContactPersonId(ownerAuthProfileId, endpoints);
  if (!existingId.ok) return existingId;

  let contactPersonId: string;
  let created = false;
  if (existingId.value) {
    contactPersonId = existingId.value;
  } else {
    const displayName =
      row.display_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unknown contact';
    const createdPerson = await createContactPerson(ownerAuthProfileId, { displayName });
    if (!createdPerson.ok) return createdPerson;
    contactPersonId = createdPerson.value.id;
    created = true;
  }

  const owned = await getContactPerson(ownerAuthProfileId, contactPersonId);
  if (!owned.ok) return owned;

  const persona = await getOrCreateContactPersonaByLabel(ownerAuthProfileId, contactPersonId, DEFAULT_CONTEXT_LABEL);
  if (!persona.ok) return persona;

  const { source, confidence } = sourceAndConfidence(row.source);
  for (const endpoint of endpoints) {
    const already = await resolveEndpointForOwner(ownerAuthProfileId, endpoint.platform, endpoint.identifier);
    if (!already.ok) return already;
    if (already.value) continue; // exact match already present — never a duplicate row
    const added = await addContactEndpoint(ownerAuthProfileId, persona.value.id, {
      platform: endpoint.platform,
      identifier: endpoint.identifier,
      confidence,
      source,
    });
    if (!added.ok) return added;
  }

  const { error: updateError } = await admin
    .from(PERSONA_CONTACTS)
    .update({ promoted_contact_person_id: contactPersonId })
    .eq('id', personaContactId);
  if (updateError) return { ok: false, error: updateError.message };

  return { ok: true, value: { contactPersonId, created } };
}

/**
 * Batch-project every confirmed, not-yet-projected `persona_contacts` row
 * for one persona. Used as a one-time/on-demand backfill — never run
 * automatically against a candidate row (NC3).
 */
export async function reconcileConfirmedPersonaContacts(
  ownerAuthProfileId: string,
  personaId: string,
): Promise<PeerResult<{ projected: number; skipped: number }>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const { data, error } = await admin
    .from(PERSONA_CONTACTS)
    .select('id')
    .eq('persona_id', personaId)
    .eq('promotion_state', 'confirmed')
    .is('promoted_contact_person_id', null);
  if (error) return { ok: false, error: error.message };

  let projected = 0;
  let skipped = 0;
  for (const row of data ?? []) {
    const result = await projectPersonaContact(ownerAuthProfileId, String((row as { id: string }).id));
    if (result.ok) projected += 1;
    else skipped += 1;
  }
  return { ok: true, value: { projected, skipped } };
}

export interface PersonaContactImportSourceStats {
  source: string;
  importedRecords: number;
  confirmedRecords: number;
  projectedRecords: number;
}

export interface PersonaContactImportStats {
  importedRecords: number;
  confirmedRecords: number;
  projectedRecords: number;
  bySource: PersonaContactImportSourceStats[];
}

/**
 * Summarise the address-book substrate without confusing import rows with
 * canonical ContactGraph people. Pagination is deliberate: Supabase/PostgREST
 * may cap a response at 1,000 rows, while a real iCloud import can exceed it.
 * The service-role client is still persona-scoped by the explicit persona_id
 * filter; no cross-persona aggregate can leak into the People projection.
 */
export async function summarizePersonaContactImports(
  personaId: string,
): Promise<PeerResult<PersonaContactImportStats>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const pageSize = 1000;
  let offset = 0;
  const sourceMap = new Map<string, PersonaContactImportSourceStats>();

  while (true) {
    const { data, error } = await admin
      .from(PERSONA_CONTACTS)
      .select('source, promotion_state, promoted_contact_person_id')
      .eq('persona_id', personaId)
      .range(offset, offset + pageSize - 1);
    if (error) return { ok: false, error: error.message };

    const rows = data ?? [];
    for (const raw of rows) {
      const row = raw as {
        source: string | null;
        promotion_state: string | null;
        promoted_contact_person_id: string | null;
      };
      const source = row.source?.trim() || 'unknown';
      const current = sourceMap.get(source) ?? {
        source,
        importedRecords: 0,
        confirmedRecords: 0,
        projectedRecords: 0,
      };
      current.importedRecords += 1;
      if (row.promotion_state === 'confirmed') current.confirmedRecords += 1;
      if (row.promoted_contact_person_id) current.projectedRecords += 1;
      sourceMap.set(source, current);
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  const bySource = [...sourceMap.values()].sort(
    (a, b) => b.importedRecords - a.importedRecords || a.source.localeCompare(b.source),
  );
  return {
    ok: true,
    value: {
      importedRecords: bySource.reduce((sum, item) => sum + item.importedRecords, 0),
      confirmedRecords: bySource.reduce((sum, item) => sum + item.confirmedRecords, 0),
      projectedRecords: bySource.reduce((sum, item) => sum + item.projectedRecords, 0),
      bySource,
    },
  };
}

/**
 * Promote a Gmail-correspondence (or any other) candidate row to a saved
 * contact — the ONLY path that flips promotion_state to 'confirmed' and
 * triggers projection. Always an explicit, named act (never automatic
 * batch promotion) — matches the target UX: "You've exchanged 12 messages
 * with Sarah Chen. Add her to Contacts?" (NC3).
 */
export async function promotePersonaContactCandidate(
  ownerAuthProfileId: string,
  personaContactId: string,
): Promise<PeerResult<{ contactPersonId: string; created: boolean }>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { error } = await admin
    .from(PERSONA_CONTACTS)
    .update({ promotion_state: 'confirmed' })
    .eq('id', personaContactId)
    .eq('promotion_state', 'candidate');
  if (error) return { ok: false, error: error.message };
  return projectPersonaContact(ownerAuthProfileId, personaContactId);
}
