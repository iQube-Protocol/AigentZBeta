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

/** Bounds for reconcileConfirmedPersonaContacts's page size — large enough
 *  that a single-persona backlog drains in a handful of calls, small enough
 *  that one GET never blocks on an unbounded scan (see the route header at
 *  app/api/contactgraph/people/route.ts for why an unbounded per-request
 *  scan stopped being safe past ~1,200 rows/persona). */
const DEFAULT_RECONCILE_PAGE_SIZE = 200;
const MAX_RECONCILE_PAGE_SIZE = 500;

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
  projection_state: string;
  promoted_contact_person_id: string | null;
}

/**
 * The outcome of projecting one `persona_contacts` row. `contactPersonId` is
 * present ONLY on the 'projected' branch — a caller cannot mistake an
 * ambiguous result for a resolved one by accident (no shared nullable field
 * that means two different things).
 */
export type ProjectPersonaContactOutcome =
  | { outcome: 'projected'; contactPersonId: string; created: boolean }
  | { outcome: 'ambiguous'; candidateContactPersonIds: string[] };

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

/**
 * Collects EVERY distinct existing ContactPerson that any of this row's
 * candidate endpoints exact-matches — never just the first hit. Two
 * candidate endpoints on the SAME row resolving to two DIFFERENT existing
 * ContactPersons is a genuine identity conflict (the live data found exactly
 * one such row) and must never be silently resolved by picking whichever
 * endpoint happened to be checked first.
 */
async function findExistingContactPersonId(
  ownerAuthProfileId: string,
  endpoints: Array<{ platform: ContactEndpointPlatform; identifier: string }>,
): Promise<PeerResult<string[]>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const distinct = new Set<string>();
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
      if (data?.contact_person_id) distinct.add(String(data.contact_person_id));
    }
  }
  return { ok: true, value: Array.from(distinct) };
}

/**
 * Project one `persona_contacts` row into ContactGraph. Only
 * `promotion_state = 'confirmed'` rows are eligible — a candidate must be
 * explicitly promoted first (see promotePersonaContactCandidate below).
 */
export async function projectPersonaContact(
  ownerAuthProfileId: string,
  personaContactId: string,
): Promise<PeerResult<ProjectPersonaContactOutcome>> {
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
    return { ok: true, value: { outcome: 'projected', contactPersonId: row.promoted_contact_person_id, created: false } };
  }
  if (row.promotion_state !== 'confirmed') {
    return { ok: false, error: 'persona contact is not confirmed (candidate rows require explicit promotion)', code: 'not_confirmed' };
  }

  const endpoints = candidateEndpoints(row);
  const existingIds = await findExistingContactPersonId(ownerAuthProfileId, endpoints);
  if (!existingIds.ok) return existingIds;

  if (existingIds.value.length > 1) {
    // Two-or-more candidate endpoints on this row resolve to DIFFERENT
    // existing ContactPersons — a genuine identity conflict. Never guess:
    // flag for explicit human/aigentMe-assisted review and stop, without
    // creating a new ContactPerson or picking one of the conflicting ones.
    const { error: ambiguousUpdateError } = await admin
      .from(PERSONA_CONTACTS)
      .update({ projection_state: 'ambiguous' })
      .eq('id', personaContactId);
    if (ambiguousUpdateError) return { ok: false, error: ambiguousUpdateError.message };
    return { ok: true, value: { outcome: 'ambiguous', candidateContactPersonIds: existingIds.value } };
  }

  let contactPersonId: string;
  let created = false;
  if (existingIds.value.length === 1) {
    contactPersonId = existingIds.value[0];
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

  // Same update as promoted_contact_person_id — projection_state is set to
  // 'projected' here, by the application layer, never by the trigger (see
  // the migration header).
  const { error: updateError } = await admin
    .from(PERSONA_CONTACTS)
    .update({ promoted_contact_person_id: contactPersonId, projection_state: 'projected' })
    .eq('id', personaContactId);
  if (updateError) return { ok: false, error: updateError.message };

  return { ok: true, value: { outcome: 'projected', contactPersonId, created } };
}

/**
 * Batch-project confirmed, not-yet-projected `persona_contacts` rows for one
 * persona — one bounded PAGE at a time (never run automatically against a
 * candidate row — NC3).
 *
 * Endpoint-aware: filters to `projection_state = 'pending'` (set by the
 * 20260930110000 migration's trigger/backfill), so 'ineligible' rows
 * (endpoint-less — 778 observed live) are never attempted, and 'ambiguous'
 * rows (candidate endpoints resolving to more than one existing
 * ContactPerson) are never silently retried by a batch job — both are
 * excluded by the query itself rather than discovered by a failed/ambiguous
 * `projectPersonaContact` call on every run.
 *
 * Resumable via keyset pagination on `id` (UUIDs sort deterministically,
 * even though not chronologically — the guarantee needed here is "every
 * pending row is visited exactly once across repeated calls", not temporal
 * order): pass the previous call's `nextCursor` to continue where it left
 * off. `nextCursor === null` means this page was the last one.
 */
export async function reconcileConfirmedPersonaContacts(
  ownerAuthProfileId: string,
  personaId: string,
  options?: { limit?: number; cursor?: string },
): Promise<PeerResult<{ projected: number; skipped: number; ambiguous: number; nextCursor: string | null }>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const limit = Math.min(Math.max(options?.limit ?? DEFAULT_RECONCILE_PAGE_SIZE, 1), MAX_RECONCILE_PAGE_SIZE);

  let query = admin
    .from(PERSONA_CONTACTS)
    .select('id')
    .eq('persona_id', personaId)
    .eq('promotion_state', 'confirmed')
    .eq('projection_state', 'pending');
  if (options?.cursor) {
    query = query.gt('id', options.cursor);
  }
  const { data, error } = await query.order('id', { ascending: true }).limit(limit);
  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []) as Array<{ id: string }>;

  let projected = 0;
  let skipped = 0;
  let ambiguous = 0;
  let lastId: string | null = null;
  for (const row of rows) {
    const id = String(row.id);
    lastId = id;
    const result = await projectPersonaContact(ownerAuthProfileId, id);
    if (result.ok && result.value.outcome === 'projected') projected += 1;
    else if (result.ok && result.value.outcome === 'ambiguous') ambiguous += 1;
    else skipped += 1;
  }

  // A full page might not be the last one — a follow-up call with lastId as
  // the cursor is needed to find out. A short page (fewer rows than asked
  // for) definitively is the last page.
  const nextCursor = rows.length === limit ? lastId : null;
  return { ok: true, value: { projected, skipped, ambiguous, nextCursor } };
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
): Promise<PeerResult<ProjectPersonaContactOutcome>> {
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
