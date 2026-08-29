/**
 * ContactGraph People 504 fix (2026-08-27).
 *
 * ROOT CAUSE: services/contactGraph/projection.ts's requestContactGraphProjection
 * looped over EVERY granted ContactPerson id and, per id, called
 * getContactPerson (1 ownership-check + fetch query) + listContactPersonas
 * (1 ownership-check query + 1 list query), then looped over EVERY persona
 * returned and called listContactEndpoints (1 ownership-check query + 1 list
 * query) again. For a persona with a large address book (the route's own
 * header cites 1,200+ rows observed live), a single GET
 * /api/contactgraph/people fanned out into thousands of SEQUENTIAL Supabase
 * round trips — the exact shape of a live 504 ("request failed (504)" —
 * components/metame/contactgraph/useContactGraphPeople.ts's own error
 * message format).
 *
 * This is NOT a missing migration — supabase/migrations/20260930050000_
 * contactgraph_substrate.sql already creates contact_persons/contact_personas/
 * contact_endpoints with owner-scoped indexes (contact_persons_owner_idx,
 * contact_personas_person_idx, contact_personas_owner_idx,
 * contact_endpoints_persona_idx). The tables and indexes are correct; the
 * QUERY SHAPE fanned out per row instead of batching.
 *
 * FIX: two new batched read functions (listContactPersonasForOwner,
 * listContactEndpointsForPersonas) each do ONE indexed `.in(...)` query for
 * the WHOLE page instead of one query per row, and projection.ts groups the
 * results in memory. Total query count for a full projection: 3 (listContactPersons
 * + listContactPersonasForOwner + listContactEndpointsForPersonas), regardless
 * of how many ContactPersons/ContactPersonas the owner has — no dependency on
 * address-book size.
 *
 * AMENDMENT (2026-08-29): the batched-into-ONE-query fix above traded the 504
 * for a NEW failure — PostgREST builds `.in()` into a query-string filter, and
 * a single unbounded `.in()` over an owner's full 1,200+-row address book
 * produces a filter long enough to exceed the upstream URL-length limit,
 * surfacing as a bare "Bad Request". Both functions now CHUNK their `.in()`
 * calls (IN_FILTER_CHUNK_SIZE ids per request) and merge-sort the results —
 * still O(ids / chunkSize) round trips, not O(ids), and never a single
 * request whose filter can grow unboundedly with address-book size. This is
 * a bounded PAGE loop, not a reintroduction of the per-ROW loop the fix above
 * removed — the assertions below were updated to tell the two apart rather
 * than treating "any `for` loop" as the anti-pattern.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const PROJECTION = 'services/contactGraph/projection.ts';
const CONTACT_PERSONAS = 'services/contactGraph/contactPersonas.ts';
const CONTACT_ENDPOINTS = 'services/contactGraph/contactEndpoints.ts';
const PEOPLE_ROUTE = 'app/api/contactgraph/people/route.ts';
const MIGRATION = 'supabase/migrations/20260930050000_contactgraph_substrate.sql';
const PEOPLE_HOOK = 'components/metame/contactgraph/useContactGraphPeople.ts';

describe('People 504 fix — the N+1 loop is gone, replaced by batched reads', () => {
  it('requestContactGraphProjection no longer loops calling getContactPerson/listContactPersonas/listContactEndpoints per id', () => {
    const code = stripComments(readSource(PROJECTION));
    // The old per-id calls are gone from the projection loop entirely —
    // neither the old imports nor the old call sites remain.
    expect(code).not.toContain('await getContactPerson(owner.value, contactPersonId)');
    expect(code).not.toContain('await listContactPersonas(owner.value, contactPersonId)');
    expect(code).not.toContain('await listContactEndpoints(owner.value, persona.id)');
    expect(code).not.toMatch(/import\s*{\s*listContactPersons,\s*getContactPerson\s*}/);
  });

  it('the loop over grantedIds now only reads from IN-MEMORY maps — no `await` inside the people-building loop', () => {
    const code = stripComments(readSource(PROJECTION));
    // `for (const contactPersonId of grantedIds)` also appears earlier, inside
    // filterByAgentDelegation's unrelated denial loop — anchor on the
    // people-building loop specifically via its preceding declaration.
    const peopleDeclAt = code.indexOf('const people: ContactGraphProjectionPersonSummary[] = [];');
    expect(peopleDeclAt).toBeGreaterThan(-1);
    const loopAt = code.indexOf('for (const contactPersonId of grantedIds) {', peopleDeclAt);
    expect(loopAt).toBeGreaterThan(-1);
    const loopEnd = code.indexOf('\n  }', code.indexOf('people.push({', loopAt));
    const loopBody = code.slice(loopAt, loopEnd);
    expect(loopBody).not.toMatch(/await\s/);
  });

  it('requestContactGraphProjection fetches personas and endpoints in exactly ONE batched call for the whole page', () => {
    // Scoped to THIS function's own body — requestContactGraphPeoplePage
    // (added 2026-08-29 for the paginated People-list read) legitimately
    // calls the SAME batched helpers once each for its own page, which is a
    // second real call site, not a reintroduced per-id loop. See that
    // function's own describe block below for its equivalent assertion.
    const code = stripComments(readSource(PROJECTION));
    const fnAt = code.indexOf('export async function requestContactGraphProjection(');
    expect(fnAt).toBeGreaterThan(-1);
    const nextFnAt = code.indexOf('\nexport ', fnAt + 10);
    const fnBody = code.slice(fnAt, nextFnAt > -1 ? nextFnAt : fnAt + 4000);
    expect(fnBody).toContain('const personasResult = await listContactPersonasForOwner(owner.value, grantedIds);');
    expect(fnBody).toContain('const endpointsResult = await listContactEndpointsForPersonas(owner.value, allPersonaIds);');
    // Only ONE call site for each WITHIN this function — not still present
    // in a per-id loop too.
    expect((fnBody.match(/listContactPersonasForOwner\(/g) ?? []).length).toBe(1);
    expect((fnBody.match(/listContactEndpointsForPersonas\(/g) ?? []).length).toBe(1);
  });

  it('listContactPersonasForOwner does bounded `.in(...)` chunk queries + an owner filter — never a per-id ownership check', () => {
    const code = stripComments(readSource(CONTACT_PERSONAS));
    const fnAt = code.indexOf('export async function listContactPersonasForOwner(');
    expect(fnAt).toBeGreaterThan(-1);
    const nextFnAt = code.indexOf('\nexport async function', fnAt + 10);
    const fnBody = code.slice(fnAt, nextFnAt > -1 ? nextFnAt : fnAt + 2000);
    // The filter operates on a CHUNK of ids, never the raw unbounded array
    // directly — that's what keeps each request's URL length bounded
    // regardless of address-book size (see the 2026-08-29 amendment above).
    expect(fnBody).toContain(".in('contact_person_id', idsChunk)");
    expect(fnBody).not.toContain(".in('contact_person_id', contactPersonIds)");
    expect(fnBody).toContain(".eq('owner_auth_profile_id', ownerAuthProfileId)");
    // The only loop present iterates CHUNKS (a bounded page count), never
    // one iteration per row — that distinction, not "any for loop", is what
    // separates this from the per-row anti-pattern the 504 fix removed.
    expect(fnBody).toMatch(/for \(const idsChunk of chunkIds\(contactPersonIds\)\) \{/);
    // No nested getContactPerson/ownership-check call inside — the query
    // itself enforces ownership via the eq() filter.
    expect(fnBody).not.toMatch(/getContactPerson\(/);
  });

  it('listContactEndpointsForPersonas does bounded `.in(...)` chunk queries + the SAME ownership-join pattern ownsContactPersona uses — never a per-id loop', () => {
    const code = stripComments(readSource(CONTACT_ENDPOINTS));
    const fnAt = code.indexOf('export async function listContactEndpointsForPersonas(');
    expect(fnAt).toBeGreaterThan(-1);
    const nextFnAt = code.indexOf('\nexport async function', fnAt + 10);
    const fnBody = code.slice(fnAt, nextFnAt > -1 ? nextFnAt : fnAt + 2000);
    expect(fnBody).toContain(".in('contact_persona_id', idsChunk)");
    expect(fnBody).not.toContain(".in('contact_persona_id', contactPersonaIds)");
    expect(fnBody).toContain("contact_personas!inner(owner_auth_profile_id)");
    expect(fnBody).toContain(".eq('contact_personas.owner_auth_profile_id', ownerAuthProfileId)");
    expect(fnBody).toMatch(/for \(const idsChunk of chunkIds\(contactPersonaIds\)\) \{/);
  });

  it('both chunk helpers bound each request to a small, fixed page size — never unbounded, never per-row (size 1)', () => {
    const personasCode = stripComments(readSource(CONTACT_PERSONAS));
    const endpointsCode = stripComments(readSource(CONTACT_ENDPOINTS));
    for (const code of [personasCode, endpointsCode]) {
      const match = code.match(/IN_FILTER_CHUNK_SIZE = (\d+);/);
      expect(match).not.toBeNull();
      const size = Number(match?.[1]);
      expect(size).toBeGreaterThan(1); // never degrades back to a per-row loop
      expect(size).toBeLessThanOrEqual(500); // stays comfortably inside any realistic URL-length limit
    }
  });

  it('an empty id list short-circuits to a zero-query result rather than an empty/invalid `.in()` call', () => {
    const personasCode = stripComments(readSource(CONTACT_PERSONAS));
    const endpointsCode = stripComments(readSource(CONTACT_ENDPOINTS));
    expect(personasCode).toContain('if (contactPersonIds.length === 0) return { ok: true, value: [] };');
    expect(endpointsCode).toContain('if (contactPersonaIds.length === 0) return { ok: true, value: [] };');
  });
});

describe('the 504 was a query-shape defect, NOT a missing migration — verified before any code change was applied', () => {
  it('contact_persons/contact_personas/contact_endpoints all exist with owner-scoped indexes in the substrate migration', () => {
    const migration = readSource(MIGRATION);
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.contact_persons');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.contact_personas');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.contact_endpoints');
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS contact_persons_owner_idx ON public.contact_persons (owner_auth_profile_id);');
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS contact_personas_person_idx ON public.contact_personas (contact_person_id);');
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS contact_endpoints_persona_idx ON public.contact_endpoints (contact_persona_id);');
  });
});

describe('the People read stays a bounded, side-effect-free PROJECTION — reconciliation is a separate, already-bounded concern, not silently expanded by this fix', () => {
  it('the route still bounds its own lazy-reconcile call to a fixed page size — this fix does not touch or widen that call', () => {
    const code = stripComments(readSource(PEOPLE_ROUTE));
    expect(code).toContain('reconcileConfirmedPersonaContacts(owner.value, persona.personaId, { limit: 200 });');
  });

  it('the route requests exactly one page per GET — no duplicate/parallel read added by this fix', () => {
    // 2026-08-29: the route now calls the paginated requestContactGraphPeoplePage
    // (see the "1,000-person ceiling" describe block below) rather than the
    // full unbounded requestContactGraphProjection — this asserts the NEW
    // call site is singular, the same guarantee the old assertion made.
    const code = stripComments(readSource(PEOPLE_ROUTE));
    expect((code.match(/requestContactGraphPeoplePage\(/g) ?? []).length).toBe(1);
    expect(code).not.toMatch(/requestContactGraphProjection\(/);
  });
});

describe('the client-visible symptom this fix closes', () => {
  it('useContactGraphPeople surfaces a bare "request failed (<status>)" string on a non-ok response — matches the observed "request failed (504)"', () => {
    const code = stripComments(readSource(PEOPLE_HOOK));
    expect(code).toContain('`request failed (${res.status})`');
  });
});
