/**
 * ContactGraph substrate — mandatory acceptance scenarios (QubeTalk
 * Fast-Follow: ContactGraph + aigentMe First Deployment, §19).
 *
 * Covers Scenario A (person/persona/handle organization + reassignment
 * preserving history), Scenario C (ambiguous identity — no silent merge),
 * the reconciliation projector's conservative-backfill discipline
 * (refinement 3), the QubeTalk bridge (C9: reference, don't fork), and the
 * contained-capability projection contract (C13, reusing the shared
 * capability-projection seam).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFakeSupabase, type FakeTables } from './_lib/fakeSupabase';

let fake: ReturnType<typeof createFakeSupabase>;

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => fake.admin,
}));

// personaId -> auth_profile_id, controlled per test.
const personaOwnerMap = new Map<string, string>();
vi.mock('@/services/wallet/personaRepo', () => ({
  PersonaRepo: class {
    async getById(id: string) {
      const authProfileId = personaOwnerMap.get(id);
      if (!authProfileId) return null;
      return { id, auth_profile_id: authProfileId };
    }
  },
}));

// agentPolicy is exercised by QubeTalk's own test suite; ContactGraph's
// projection contract only needs "no acting agent" paths for these
// scenarios, so no additional mock is required beyond the Supabase fake.

import { createContactPerson, listContactPersons } from '@/services/contactGraph/contactPersons';
import { createContactPersona, listContactPersonas } from '@/services/contactGraph/contactPersonas';
import {
  addContactEndpoint,
  listContactEndpoints,
  reassignContactEndpoint,
  confirmContactEndpoint,
  rejectContactEndpoint,
  resolveEndpointForOwner,
  setPreferredContactEndpoint,
} from '@/services/contactGraph/contactEndpoints';
import {
  projectPersonaContact,
  reconcileConfirmedPersonaContacts,
} from '@/services/contactGraph/reconciliation';
import {
  resolveContactPersonForInboundEndpoint,
  listParticipantsLinkedToContactPerson,
  linkParticipantToContactPerson,
} from '@/services/contactGraph/qubetalkBridge';
import { requestContactGraphProjection } from '@/services/contactGraph/projection';

const OWNER = 'owner-auth-profile-1';
const OWNER_PERSONA = 'owner-persona-1';

beforeEach(() => {
  fake = createFakeSupabase();
  personaOwnerMap.clear();
  personaOwnerMap.set(OWNER_PERSONA, OWNER);
});

describe('Scenario A — person/persona/handle organization', () => {
  it('models one ContactPerson, two personas, four endpoints, and preserves history across reassignment', async () => {
    const person = await createContactPerson(OWNER, { displayName: 'John Doe' });
    expect(person.ok).toBe(true);
    if (!person.ok) return;

    const professional = await createContactPersona(OWNER, person.value.id, { label: 'Professional' });
    const personal = await createContactPersona(OWNER, person.value.id, { label: 'Personal' });
    expect(professional.ok && personal.ok).toBe(true);
    if (!professional.ok || !personal.ok) return;

    const email = await addContactEndpoint(OWNER, professional.value.id, { platform: 'email', identifier: 'john@acme.com' });
    const linkedin = await addContactEndpoint(OWNER, professional.value.id, { platform: 'linkedin', identifier: '/in/johndoe' });
    const whatsapp = await addContactEndpoint(OWNER, personal.value.id, { platform: 'whatsapp', identifier: '+441234567890' });
    const telegram = await addContactEndpoint(OWNER, professional.value.id, { platform: 'telegram', identifier: '@john_acme' });
    expect([email, linkedin, whatsapp, telegram].every((r) => r.ok)).toBe(true);

    const personas = await listContactPersonas(OWNER, person.value.id);
    expect(personas.ok && personas.value.length).toBe(2);

    const proEndpoints = await listContactEndpoints(OWNER, professional.value.id);
    expect(proEndpoints.ok && proEndpoints.value.length).toBe(3); // email, linkedin, telegram
    const personalEndpoints = await listContactEndpoints(OWNER, personal.value.id);
    expect(personalEndpoints.ok && personalEndpoints.value.length).toBe(1); // whatsapp

    // Move Telegram from Professional to Personal without losing history.
    if (!telegram.ok) return;
    const firstObservedBefore = telegram.value.firstObservedAt;
    const reassigned = await reassignContactEndpoint(OWNER, telegram.value.id, personal.value.id, OWNER_PERSONA, 'operator moved context');
    expect(reassigned.ok).toBe(true);
    if (!reassigned.ok) return;
    expect(reassigned.value.contactPersonaId).toBe(personal.value.id);
    expect(reassigned.value.id).toBe(telegram.value.id); // same row, not delete+recreate
    expect(reassigned.value.firstObservedAt).toBe(firstObservedBefore); // history preserved
    expect(reassigned.value.linkHistory.some((e) => e.action === 'reassigned')).toBe(true);
    expect(reassigned.value.linkHistory.some((e) => e.action === 'proposed')).toBe(true); // original event kept

    const proAfter = await listContactEndpoints(OWNER, professional.value.id);
    expect(proAfter.ok && proAfter.value.length).toBe(2); // telegram moved out
    const personalAfter = await listContactEndpoints(OWNER, personal.value.id);
    expect(personalAfter.ok && personalAfter.value.length).toBe(2); // whatsapp + telegram
  });
});

describe('Scenario C — ambiguous identity, no silent merge', () => {
  it('never auto-merges an observed handle onto an existing ContactPerson by name alone; confirm/reject are explicit acts', async () => {
    const john = await createContactPerson(OWNER, { displayName: 'John Doe' });
    expect(john.ok).toBe(true);
    if (!john.ok) return;
    const johnPersona = await createContactPersona(OWNER, john.value.id, { label: 'Professional' });
    expect(johnPersona.ok).toBe(true);
    if (!johnPersona.ok) return;
    await addContactEndpoint(OWNER, johnPersona.value.id, { platform: 'telegram', identifier: '@john_real' });

    // A DIFFERENT Telegram handle with a similar display name is observed —
    // this must become its own unresolved ContactPerson, never merged onto
    // "John Doe" just because a caller might label it similarly.
    const observed = await createContactPerson(OWNER, { displayName: 'Telegram: John D' });
    expect(observed.ok).toBe(true);
    if (!observed.ok) return;
    expect(observed.value.id).not.toBe(john.value.id);

    const observedPersona = await createContactPersona(OWNER, observed.value.id, { label: 'General' });
    expect(observedPersona.ok).toBe(true);
    if (!observedPersona.ok) return;
    const endpoint = await addContactEndpoint(OWNER, observedPersona.value.id, {
      platform: 'telegram',
      identifier: '@john_d_unknown',
      source: 'qubetalk_observed',
    });
    expect(endpoint.ok).toBe(true);
    if (!endpoint.ok) return;
    expect(endpoint.value.confidence).toBe('unresolved'); // no evidence claimed beyond the bare observation

    // Operator confirms — an explicit, deliberate act.
    const confirmed = await confirmContactEndpoint(OWNER, endpoint.value.id, OWNER_PERSONA);
    expect(confirmed.ok).toBe(true);
    if (confirmed.ok) {
      expect(confirmed.value.confidence).toBe('user_confirmed');
      expect(confirmed.value.linkHistory.some((e) => e.action === 'confirmed')).toBe(true);
    }

    // Operator can also reject instead — the row is preserved (never
    // deleted), just marked rejected.
    const rejectable = await addContactEndpoint(OWNER, observedPersona.value.id, { platform: 'x', identifier: '@maybejohn' });
    expect(rejectable.ok).toBe(true);
    if (!rejectable.ok) return;
    const rejected = await rejectContactEndpoint(OWNER, rejectable.value.id, OWNER_PERSONA, 'not actually John');
    expect(rejected.ok).toBe(true);
    if (rejected.ok) {
      expect(rejected.value.state).toBe('rejected');
      expect(rejected.value.linkHistory.some((e) => e.action === 'rejected')).toBe(true);
    }

    // The two ContactPersons remain genuinely separate.
    const all = await listContactPersons(OWNER);
    expect(all.ok && all.value.length).toBe(2);
  });
});

describe('Reconciliation — conservative backfill (refinement 3)', () => {
  function seedPersonaContact(overrides: Partial<Record<string, unknown>> = {}) {
    const tables = fake.tables as FakeTables;
    tables.persona_contacts ??= [];
    const row = {
      id: `pc-${tables.persona_contacts.length + 1}`,
      persona_id: OWNER_PERSONA,
      display_name: 'Sarah Chen',
      first_name: null,
      last_name: null,
      email: 'sarah@example.com',
      email_2: null,
      email_3: null,
      phone: null,
      phone_2: null,
      source: 'google_contacts',
      promotion_state: 'confirmed',
      promoted_contact_person_id: null,
      ...overrides,
    };
    tables.persona_contacts.push(row);
    return row;
  }

  it('projects one confirmed row into one ContactPerson + one context + its endpoints, idempotently', async () => {
    const row = seedPersonaContact();
    const first = await projectPersonaContact(OWNER, row.id);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.created).toBe(true);

    const second = await projectPersonaContact(OWNER, row.id);
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.contactPersonId).toBe(first.value.contactPersonId);
      expect(second.value.created).toBe(false); // idempotent — no duplicate
    }

    const all = await listContactPersons(OWNER);
    expect(all.ok && all.value.length).toBe(1);
  });

  it('refuses to project a candidate (unpromoted) row', async () => {
    const row = seedPersonaContact({ source: 'gmail_correspondence', promotion_state: 'candidate' });
    const result = await projectPersonaContact(OWNER, row.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('not_confirmed');
    const all = await listContactPersons(OWNER);
    expect(all.ok && all.value.length).toBe(0); // nothing silently created
  });

  it('associates two different persona_contacts rows sharing an exact endpoint into ONE ContactPerson (unambiguous evidence)', async () => {
    const rowA = seedPersonaContact({ id: 'pc-a', display_name: 'Sarah Chen', email: 'sarah@example.com' });
    const rowB = seedPersonaContact({ id: 'pc-b', display_name: 'S. Chen (work)', email: 'sarah@example.com', source: 'csv' });

    const resultA = await projectPersonaContact(OWNER, rowA.id);
    const resultB = await projectPersonaContact(OWNER, rowB.id);
    expect(resultA.ok && resultB.ok).toBe(true);
    if (!resultA.ok || !resultB.ok) return;
    expect(resultB.value.contactPersonId).toBe(resultA.value.contactPersonId); // same exact email -> same person
    expect(resultB.value.created).toBe(false);

    const all = await listContactPersons(OWNER);
    expect(all.ok && all.value.length).toBe(1); // never a duplicate on unambiguous exact-endpoint evidence
  });

  it('NEVER merges two rows on similar display name alone when they share no endpoint', async () => {
    const rowA = seedPersonaContact({ id: 'pc-a', display_name: 'John Doe', email: 'john@acme.com' });
    const rowB = seedPersonaContact({ id: 'pc-b', display_name: 'John Doe', email: 'jdoe@personal.example' });

    const resultA = await projectPersonaContact(OWNER, rowA.id);
    const resultB = await projectPersonaContact(OWNER, rowB.id);
    expect(resultA.ok && resultB.ok).toBe(true);
    if (!resultA.ok || !resultB.ok) return;
    expect(resultB.value.contactPersonId).not.toBe(resultA.value.contactPersonId); // NOT merged despite identical name

    const all = await listContactPersons(OWNER);
    expect(all.ok && all.value.length).toBe(2);
  });

  it('batch-reconciles only confirmed, not-yet-projected rows for a persona', async () => {
    seedPersonaContact({ id: 'pc-1', email: 'a@example.com' });
    seedPersonaContact({ id: 'pc-2', email: 'b@example.com' });
    seedPersonaContact({ id: 'pc-3', email: 'c@example.com', promotion_state: 'candidate', source: 'gmail_correspondence' });

    const result = await reconcileConfirmedPersonaContacts(OWNER, OWNER_PERSONA);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.projected).toBe(2); // pc-1, pc-2 only
      expect(result.value.skipped).toBe(0);
    }
    const all = await listContactPersons(OWNER);
    expect(all.ok && all.value.length).toBe(2);
  });
});

describe('QubeTalk bridge — reference, never a competing directory (C9/NC10)', () => {
  it('resolves an inbound endpoint against ContactGraph when known, and reports null (never a guess) when unknown', async () => {
    const person = await createContactPerson(OWNER, { displayName: 'Jane Roe' });
    expect(person.ok).toBe(true);
    if (!person.ok) return;
    const persona = await createContactPersona(OWNER, person.value.id, { label: 'General' });
    expect(persona.ok).toBe(true);
    if (!persona.ok) return;
    await addContactEndpoint(OWNER, persona.value.id, { platform: 'email', identifier: 'jane@roe.example' });

    const known = await resolveContactPersonForInboundEndpoint(OWNER, 'email', 'jane@roe.example');
    expect(known.ok).toBe(true);
    if (known.ok) {
      expect(known.value?.contactPersonId).toBe(person.value.id);
      expect(known.value?.displayName).toBe('Jane Roe');
    }

    const unknown = await resolveContactPersonForInboundEndpoint(OWNER, 'email', 'nobody@nowhere.example');
    expect(unknown.ok).toBe(true);
    if (unknown.ok) expect(unknown.value).toBeNull();
  });

  it('resolveEndpointForOwner is exact-match only — a different platform never matches', async () => {
    const person = await createContactPerson(OWNER, { displayName: 'Jane Roe' });
    if (!person.ok) return;
    const persona = await createContactPersona(OWNER, person.value.id, { label: 'General' });
    if (!persona.ok) return;
    await addContactEndpoint(OWNER, persona.value.id, { platform: 'telegram', identifier: '@janeroe' });

    const wrongPlatform = await resolveEndpointForOwner(OWNER, 'signal', '@janeroe');
    expect(wrongPlatform.ok && wrongPlatform.value).toBeNull();
  });
});

describe('Contained capability projection — reuses the shared seam (C13)', () => {
  it("refuses scope:'all' for a contextual profile — a cartridge can never ask for the full address book", async () => {
    const person = await createContactPerson(OWNER, { displayName: 'John Doe' });
    if (!person.ok) return;

    const result = await requestContactGraphProjection(OWNER_PERSONA, {
      capability: 'contacts',
      projection: 'contextual',
      scope: { contactPersonIds: 'all' },
      requestingSurface: 'cartridge:horizon',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.people).toHaveLength(0);
    expect(result.value.denied.some((d) => d.reason === 'not_permitted_for_contextual_profile')).toBe(true);
  });

  it("grants 'full' scope:'all' to the owning principal and returns bounded summaries only", async () => {
    const person = await createContactPerson(OWNER, { displayName: 'John Doe' });
    expect(person.ok).toBe(true);
    if (!person.ok) return;
    const persona = await createContactPersona(OWNER, person.value.id, { label: 'Professional' });
    if (!persona.ok) return;
    await addContactEndpoint(OWNER, persona.value.id, { platform: 'email', identifier: 'john@acme.com' });

    const result = await requestContactGraphProjection(OWNER_PERSONA, {
      capability: 'contacts',
      projection: 'full',
      scope: { contactPersonIds: 'all' },
      requestingSurface: 'aigentme',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.people).toHaveLength(1);
    expect(result.value.people[0].contactPersonId).toBe(person.value.id);
    expect(result.value.people[0].endpointCount).toBe(1);
    expect(result.value.people[0].personaLabels).toEqual(['Professional']);
    // Disclosure boundary: summary only — no raw endpoint identifier leaks.
    expect(JSON.stringify(result.value)).not.toContain('john@acme.com');
  });

  it('denies a contactPersonId the caller does not own — never silently drops it', async () => {
    const other = await requestContactGraphProjection(OWNER_PERSONA, {
      capability: 'contacts',
      projection: 'full',
      scope: { contactPersonIds: ['not-owned-id'] },
      requestingSurface: 'aigentme',
    });
    expect(other.ok).toBe(true);
    if (!other.ok) return;
    expect(other.value.people).toHaveLength(0);
    expect(other.value.denied.some((d) => d.reason === 'not_owned' && d.contactPersonIds.includes('not-owned-id'))).toBe(true);
  });
});

describe('Preferred endpoint — scoped per persona/context', () => {
  it('marking one endpoint preferred clears any other preferred endpoint under the SAME context only', async () => {
    const person = await createContactPerson(OWNER, { displayName: 'John Doe' });
    if (!person.ok) return;
    const professional = await createContactPersona(OWNER, person.value.id, { label: 'Professional' });
    const personal = await createContactPersona(OWNER, person.value.id, { label: 'Personal' });
    if (!professional.ok || !personal.ok) return;

    const email = await addContactEndpoint(OWNER, professional.value.id, { platform: 'email', identifier: 'john@acme.com' });
    const linkedin = await addContactEndpoint(OWNER, professional.value.id, { platform: 'linkedin', identifier: '/in/johndoe' });
    const whatsapp = await addContactEndpoint(OWNER, personal.value.id, { platform: 'whatsapp', identifier: '+441234567890' });
    if (!email.ok || !linkedin.ok || !whatsapp.ok) return;

    const preferredEmail = await setPreferredContactEndpoint(OWNER, email.value.id);
    expect(preferredEmail.ok).toBe(true);
    if (preferredEmail.ok) expect(preferredEmail.value.isPreferred).toBe(true);

    // Marking LinkedIn preferred within the SAME context clears email.
    const preferredLinkedin = await setPreferredContactEndpoint(OWNER, linkedin.value.id);
    expect(preferredLinkedin.ok).toBe(true);
    if (preferredLinkedin.ok) expect(preferredLinkedin.value.isPreferred).toBe(true);
    const proEndpoints = await listContactEndpoints(OWNER, professional.value.id);
    expect(proEndpoints.ok && proEndpoints.value.find((e) => e.id === email.value.id)?.isPreferred).toBe(false);

    // The Personal context's WhatsApp is untouched by the Professional
    // context's preferred-handle changes — scoped per persona, not global.
    const preferredWhatsapp = await setPreferredContactEndpoint(OWNER, whatsapp.value.id);
    expect(preferredWhatsapp.ok).toBe(true);
    if (preferredWhatsapp.ok) expect(preferredWhatsapp.value.isPreferred).toBe(true);
    const proAfter = await listContactEndpoints(OWNER, professional.value.id);
    expect(proAfter.ok && proAfter.value.find((e) => e.id === linkedin.value.id)?.isPreferred).toBe(true); // untouched
  });
});

describe('QubeTalk bridge — Person-view cross-reference (aigentMe §12)', () => {
  function seedParticipant(overrides: Partial<Record<string, unknown>> = {}) {
    const tables = fake.tables as FakeTables;
    tables.qubetalk_participants ??= [];
    const row = {
      id: `participant-${tables.qubetalk_participants.length + 1}`,
      owner_persona_id: OWNER_PERSONA,
      principal_ref: null,
      display_name: 'John (Telegram)',
      contact_person_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
    tables.qubetalk_participants.push(row);
    return row;
  }

  it('lists only the owner\'s own QubeTalk participants linked to a given ContactPerson', async () => {
    const person = await createContactPerson(OWNER, { displayName: 'John Doe' });
    if (!person.ok) return;
    const other = await createContactPerson(OWNER, { displayName: 'Someone Else' });
    if (!other.ok) return;

    seedParticipant({ id: 'p-linked', contact_person_id: person.value.id });
    seedParticipant({ id: 'p-unlinked', contact_person_id: other.value.id });
    seedParticipant({ id: 'p-other-owner', owner_persona_id: 'a-different-persona', contact_person_id: person.value.id });

    const linked = await listParticipantsLinkedToContactPerson(OWNER_PERSONA, person.value.id);
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    expect(linked.value.map((p) => p.id)).toEqual(['p-linked']); // not the other person's, not the other owner's
  });

  it('linkParticipantToContactPerson only links a participant the caller actually owns', async () => {
    const person = await createContactPerson(OWNER, { displayName: 'John Doe' });
    if (!person.ok) return;
    const participant = seedParticipant();

    const linked = await linkParticipantToContactPerson(OWNER_PERSONA, OWNER, participant.id, person.value.id);
    expect(linked.ok).toBe(true);
    if (linked.ok) expect(linked.value.contactPersonId).toBe(person.value.id);

    const notOwned = await linkParticipantToContactPerson('a-different-persona', OWNER, participant.id, person.value.id);
    expect(notOwned.ok).toBe(false);
  });
});

describe('aigentMe <-> Runtime surface continuity (Runtime fan-out)', () => {
  it('a mutation made via the "runtime" requesting surface is immediately visible to the "aigentme" requesting surface, and vice versa — no sync layer, because there is one ContactGraph', async () => {
    const person = await createContactPerson(OWNER, { displayName: 'Sarah Chen' });
    if (!person.ok) return;
    const professional = await createContactPersona(OWNER, person.value.id, { label: 'Professional' });
    if (!professional.ok) return;
    const telegram = await addContactEndpoint(OWNER, professional.value.id, { platform: 'telegram', identifier: '@sarahc' });
    if (!telegram.ok) return;

    // aigentMe's PeopleLayout requests a projection.
    const aigentmeView = await requestContactGraphProjection(OWNER_PERSONA, {
      capability: 'contacts',
      projection: 'full',
      scope: { contactPersonIds: 'all' },
      requestingSurface: 'aigentme',
    });
    expect(aigentmeView.ok).toBe(true);
    if (!aigentmeView.ok) return;
    expect(aigentmeView.value.people).toHaveLength(1);
    expect(aigentmeView.value.people[0].contactPersonId).toBe(person.value.id);
    expect(aigentmeView.value.people[0].endpointCount).toBe(1);

    // metaMe Runtime's RuntimeQubeTalkDrawer requests the SAME data — same
    // contactPersonId, same endpointCount, no separate Runtime-side store.
    const runtimeView = await requestContactGraphProjection(OWNER_PERSONA, {
      capability: 'contacts',
      projection: 'full',
      scope: { contactPersonIds: 'all' },
      requestingSurface: 'metame-runtime',
    });
    expect(runtimeView.ok).toBe(true);
    if (!runtimeView.ok) return;
    expect(runtimeView.value.people).toEqual(aigentmeView.value.people); // byte-identical

    // A handle added FROM Runtime (a second endpoint under the same persona)...
    const addedFromRuntime = await addContactEndpoint(OWNER, professional.value.id, { platform: 'linkedin', identifier: '/in/sarahchen' });
    expect(addedFromRuntime.ok).toBe(true);

    // ...is visible from aigentMe's own next read, with no synchronization
    // step of any kind — both surfaces called the same service function
    // against the same tables.
    const aigentmeAfter = await requestContactGraphProjection(OWNER_PERSONA, {
      capability: 'contacts',
      projection: 'full',
      scope: { contactPersonIds: 'all' },
      requestingSurface: 'aigentme',
    });
    expect(aigentmeAfter.ok).toBe(true);
    if (!aigentmeAfter.ok) return;
    expect(aigentmeAfter.value.people[0].endpointCount).toBe(2);

    // No duplicate ContactPerson was created by switching surfaces.
    const all = await listContactPersons(OWNER);
    expect(all.ok && all.value.length).toBe(1);
  });

  it('reassigning an endpoint via one surface is reflected identically when read via the other', async () => {
    const person = await createContactPerson(OWNER, { displayName: 'John Doe' });
    if (!person.ok) return;
    const professional = await createContactPersona(OWNER, person.value.id, { label: 'Professional' });
    const personal = await createContactPersona(OWNER, person.value.id, { label: 'Personal' });
    if (!professional.ok || !personal.ok) return;
    const handle = await addContactEndpoint(OWNER, professional.value.id, { platform: 'telegram', identifier: '@johnd' });
    if (!handle.ok) return;

    // Reassign as if from the Runtime workbench (richer UI, same service call).
    const reassigned = await reassignContactEndpoint(OWNER, handle.value.id, personal.value.id, OWNER_PERSONA, 'moved from Runtime');
    expect(reassigned.ok).toBe(true);

    // aigentMe's compact view reads the SAME endpoint, in its new context,
    // with history preserved — proving Runtime never forked a second
    // endpoint/participant record.
    const proEndpoints = await listContactEndpoints(OWNER, professional.value.id);
    expect(proEndpoints.ok && proEndpoints.value).toHaveLength(0);
    const personalEndpoints = await listContactEndpoints(OWNER, personal.value.id);
    expect(personalEndpoints.ok && personalEndpoints.value).toHaveLength(1);
    if (personalEndpoints.ok) {
      expect(personalEndpoints.value[0].id).toBe(handle.value.id); // same row
      expect(personalEndpoints.value[0].linkHistory.some((e) => e.reason === 'moved from Runtime')).toBe(true);
    }
  });
});
