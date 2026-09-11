/**
 * ContactGraph People — the 1,000-person ceiling fix (2026-08-29).
 *
 * ROOT CAUSE: services/contactGraph/contactPersons.ts's listContactPersons
 * (used by requestContactGraphProjection to resolve "everything this owner
 * owns") issued a single unbounded `.select('*')` with no `.range()`/
 * `.limit()`. PostgREST's hosted default row cap (1,000) silently truncated
 * the result, and the route then used `result.people.length` — the count of
 * rows THIS response happened to carry — as the headline "graph people"
 * total. An owner with 1,200+ contacts saw an immovable "1,000 graph
 * people" and could never reach contact #1,001 through the UI.
 *
 * FIX: services/contactGraph/projection.ts's requestContactGraphPeoplePage
 * issues a real `count: 'exact', head: true` query for the total (bounded
 * to one indexed COUNT, never a full-table fetch) and pages the actual rows
 * via `.range()`. The route (app/api/contactgraph/people/route.ts) now
 * calls this instead of the full unbounded projection for the People-list
 * read; search runs as a server-side `.ilike()` against the SAME
 * owner-scoped query, so it reaches contacts beyond whatever page happens
 * to be loaded client-side.
 *
 * This suite uses a small in-memory fake Postgrest client — the SAME
 * `getSupabaseServer` entry point every ContactGraph service file imports,
 * so mocking it once here also exercises the REAL (unmodified)
 * listContactPersonasForOwner/listContactEndpointsForPersonas.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

type Row = Record<string, unknown>;

let tables: {
  contact_persons: Row[];
  contact_personas: Row[];
  contact_endpoints: Row[];
};

type Filter =
  | { type: 'eq'; col: string; val: unknown }
  | { type: 'ilike'; col: string; val: string }
  | { type: 'in'; col: string; val: unknown[] };

function matchesFilter(row: Row, table: string, f: Filter): boolean {
  // The one embedded-relation filter this code path actually issues:
  // contact_endpoints.eq('contact_personas.owner_auth_profile_id', X) — a
  // dotted reference into the joined contact_personas row via
  // contact_persona_id, not a column on contact_endpoints itself.
  if (table === 'contact_endpoints' && f.col === 'contact_personas.owner_auth_profile_id') {
    const persona = tables.contact_personas.find((p) => p.id === row.contact_persona_id);
    return f.type === 'eq' && persona?.owner_auth_profile_id === f.val;
  }
  if (f.type === 'eq') return row[f.col] === f.val;
  if (f.type === 'in') return (f.val as unknown[]).includes(row[f.col]);
  if (f.type === 'ilike') {
    const pattern = f.val.replace(/^%|%$/g, '').replace(/\\([%_])/g, '$1').toLowerCase();
    return String(row[f.col] ?? '').toLowerCase().includes(pattern);
  }
  return true;
}

function makeQueryBuilder(table: keyof typeof tables) {
  const filters: Filter[] = [];
  let countExact = false;
  let headOnly = false;
  let orderCol: string | null = null;
  let orderAsc = true;
  let rangeFrom: number | null = null;
  let rangeTo: number | null = null;

  const builder = {
    select(_cols: string, opts?: { count?: 'exact'; head?: boolean }) {
      countExact = opts?.count === 'exact';
      headOnly = Boolean(opts?.head);
      return builder;
    },
    eq(col: string, val: unknown) {
      filters.push({ type: 'eq', col, val });
      return builder;
    },
    ilike(col: string, val: string) {
      filters.push({ type: 'ilike', col, val });
      return builder;
    },
    in(col: string, val: unknown[]) {
      filters.push({ type: 'in', col, val });
      return builder;
    },
    order(col: string, opts?: { ascending?: boolean }) {
      orderCol = col;
      orderAsc = opts?.ascending ?? true;
      return builder;
    },
    range(from: number, to: number) {
      rangeFrom = from;
      rangeTo = to;
      return builder;
    },
    then(
      resolve: (v: { data: Row[] | null; error: null; count?: number }) => unknown,
      reject: (e: unknown) => unknown,
    ) {
      let rows = tables[table].filter((r) => filters.every((f) => matchesFilter(r, table, f)));
      const count = countExact ? rows.length : undefined;
      if (orderCol) {
        const col = orderCol;
        rows = [...rows].sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (orderAsc ? 1 : -1));
      }
      if (rangeFrom !== null && rangeTo !== null) rows = rows.slice(rangeFrom, rangeTo + 1);
      const data = headOnly ? null : rows;
      return Promise.resolve({ data, error: null, count }).then(resolve, reject);
    },
  };
  return builder;
}

const fakeClient = {
  from(table: string) {
    return makeQueryBuilder(table as keyof typeof tables);
  },
};

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => fakeClient,
}));

const { requestContactGraphPeoplePage } = await import('@/services/contactGraph/projection');

const OWNER = 'owner-1';

function seedContactPerson(id: string, displayName: string, owner = OWNER) {
  tables.contact_persons.push({ id, owner_auth_profile_id: owner, display_name: displayName });
}

beforeEach(() => {
  tables = { contact_persons: [], contact_personas: [], contact_endpoints: [] };
});

describe('requestContactGraphPeoplePage — the 1,000-person ceiling fix', () => {
  it('totalCount is an exact COUNT, never the number of rows returned in this page', async () => {
    for (let i = 0; i < 250; i++) seedContactPerson(`p${i}`, `Person ${String(i).padStart(3, '0')}`);
    const result = await requestContactGraphPeoplePage(OWNER, { limit: 100, offset: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalCount).toBe(250);
    expect(result.value.people.length).toBe(100);
    expect(result.value.totalCount).not.toBe(result.value.people.length);
  });

  it('reaches contact 1,001+ via offset — the old ceiling is gone', async () => {
    for (let i = 0; i < 1200; i++) seedContactPerson(`p${i}`, `Person ${String(i).padStart(4, '0')}`);
    const result = await requestContactGraphPeoplePage(OWNER, { limit: 100, offset: 1100 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalCount).toBe(1200);
    expect(result.value.people).toHaveLength(100);
    expect(result.value.people.map((p) => p.displayName)).toContain('Person 1199');
    expect(result.value.hasMore).toBe(false);
  });

  it('hasMore is true mid-list and false on the final page', async () => {
    for (let i = 0; i < 150; i++) seedContactPerson(`p${i}`, `Person ${String(i).padStart(3, '0')}`);
    const first = await requestContactGraphPeoplePage(OWNER, { limit: 100, offset: 0 });
    expect(first.ok && first.value.hasMore).toBe(true);
    const last = await requestContactGraphPeoplePage(OWNER, { limit: 100, offset: 100 });
    expect(last.ok && last.value.hasMore).toBe(false);
  });

  it('an empty address book returns totalCount 0 and no error — never treated as a failure', async () => {
    const result = await requestContactGraphPeoplePage(OWNER, { limit: 100, offset: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalCount).toBe(0);
    expect(result.value.people).toEqual([]);
    expect(result.value.hasMore).toBe(false);
  });

  it('search runs server-side against the FULL table, not just a loaded page', async () => {
    seedContactPerson('a', 'Alice Anderson');
    seedContactPerson('b', 'Bob Baker');
    seedContactPerson('c', 'Carol Clarke');
    const result = await requestContactGraphPeoplePage(OWNER, { limit: 100, offset: 0, search: 'alice' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalCount).toBe(1);
    expect(result.value.people.map((p) => p.displayName)).toEqual(['Alice Anderson']);
  });

  it('search is scoped to the SAME owner filter as the unfiltered browse — never leaks another owner into results', async () => {
    seedContactPerson('a', 'Alice Anderson', OWNER);
    seedContactPerson('x', 'Alice Anotherowner', 'a-different-owner');
    const result = await requestContactGraphPeoplePage(OWNER, { limit: 100, offset: 0, search: 'alice' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalCount).toBe(1);
    expect(result.value.people[0]?.contactPersonId).toBe('a');
  });

  it('never returns another owner_auth_profile_id\'s contacts or counts them into totalCount', async () => {
    seedContactPerson('x', 'Someone Else', 'a-different-owner');
    const result = await requestContactGraphPeoplePage(OWNER, { limit: 100, offset: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalCount).toBe(0);
    expect(result.value.people).toEqual([]);
  });

  it('reuses the existing batched listContactPersonasForOwner/listContactEndpointsForPersonas — personaLabels and endpointCount are populated', async () => {
    seedContactPerson('a', 'Alice Anderson');
    tables.contact_personas.push({
      id: 'pa1',
      contact_person_id: 'a',
      owner_auth_profile_id: OWNER,
      label: 'Professional',
      linked_platform_persona_ref: null,
      created_at: 't',
      updated_at: 't',
    });
    tables.contact_endpoints.push({
      id: 'e1',
      contact_persona_id: 'pa1',
      platform: 'email',
      identifier: 'alice@example.com',
      normalized_identifier: 'alice@example.com',
      external_account_ref: null,
      confidence: 'verified',
      source: 'manual',
      inbound_capable: true,
      outbound_capable: true,
      is_preferred: true,
      state: 'active',
      first_observed_at: 't',
      last_observed_at: 't',
      confirmed_by_persona_id: null,
      confirmed_at: null,
      link_history: [],
      created_at: 't',
      updated_at: 't',
    });
    const result = await requestContactGraphPeoplePage(OWNER, { limit: 10, offset: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.people[0]?.personaLabels).toEqual(['Professional']);
    expect(result.value.people[0]?.endpointCount).toBe(1);
    expect(result.value.people[0]?.preferredEndpointPlatform).toBe('email');
  });

  it('no duplicate ContactGraph identities are introduced by paginating — page 1 and page 2 never overlap', async () => {
    for (let i = 0; i < 200; i++) seedContactPerson(`p${i}`, `Person ${String(i).padStart(3, '0')}`);
    const page1 = await requestContactGraphPeoplePage(OWNER, { limit: 100, offset: 0 });
    const page2 = await requestContactGraphPeoplePage(OWNER, { limit: 100, offset: 100 });
    expect(page1.ok && page2.ok).toBe(true);
    if (!page1.ok || !page2.ok) return;
    const ids1 = new Set(page1.value.people.map((p) => p.contactPersonId));
    const ids2 = new Set(page2.value.people.map((p) => p.contactPersonId));
    expect([...ids1].some((id) => ids2.has(id))).toBe(false);
    expect(ids1.size + ids2.size).toBe(200);
  });
});
