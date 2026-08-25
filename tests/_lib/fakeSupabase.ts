/**
 * A minimal, generic, multi-table in-memory fake Postgrest client — the same
 * style as tests/delegation-multi-agent-model.test.ts's single-table fake
 * (Extend, Don't Duplicate: that fake is inlined per-file and not exported,
 * so a genuinely multi-table version lives here rather than being
 * re-invented per QubeTalk test file). Enough surface for the QubeTalk
 * service layer's real Supabase calls: from/select/insert/update/upsert/eq/
 * is/order/limit/single/maybeSingle, plus the one `!inner` embed shape
 * participants.ts uses (endpoint → owning participant).
 *
 * This is NOT a Postgrest reimplementation — it supports exactly the query
 * shapes the QubeTalk services actually issue, nothing more.
 */
import { expect } from 'vitest';

export type FakeRow = Record<string, unknown>;
export type FakeTables = Record<string, FakeRow[]>;

let seq = 0;
export function fakeNowIso(): string {
  // Deterministic, monotonically increasing — Date.now()/new Date() are
  // unavailable in the real runtime elsewhere in this repo, but plain
  // arithmetic over a fixed epoch is fine inside a test file (same
  // convention as tests/delegation-multi-agent-model.test.ts).
  seq += 1;
  return new Date(1700000000000 + seq * 1000).toISOString();
}

export function fakeUuid(): string {
  seq += 1;
  return `fake-${seq.toString(16).padStart(8, '0')}-0000-0000-0000-000000000000`;
}

interface Filter {
  col: string;
  op: 'eq' | 'is';
  val: unknown;
}

/** Parses `'*, qubetalk_participants!inner(owner_persona_id)'` /
 *  `'*, qubetalk_participants!inner(*)'` into the joined table name. */
function parseEmbed(cols: string): string | null {
  const m = cols.match(/(\w+)!inner\(/);
  return m ? m[1] : null;
}

/** The FK column (on the SOURCE table) each embeddable table is joined on.
 *  Doesn't follow one universal naming rule across this repo's tables
 *  (`qubetalk_participants` joins via `participant_id`, not
 *  `qubetalk_participant_id`), so this is an explicit map rather than a
 *  derived convention — extend it when a new single-level `!inner` embed
 *  shape is exercised by a test. */
const EMBED_FK_COLUMN: Record<string, string> = {
  qubetalk_participants: 'participant_id',
  contact_personas: 'contact_persona_id',
  contact_persons: 'contact_person_id',
};

function makeBuilder(tables: FakeTables, table: string) {
  const filters: Filter[] = [];
  let orFilters: Filter[] | null = null;
  let embedTable: string | null = null;
  let orderCol: string | null = null;
  let orderAsc = true;
  let limitN: number | null = null;
  let mode: 'select' | 'insert' | 'update' | 'upsert' = 'select';
  let payload: FakeRow | FakeRow[] | null = null;
  let upsertOnConflict: string[] = [];

  function rows(): FakeRow[] {
    return (tables[table] ??= []);
  }

  function embedded(): FakeRow[] {
    if (!embedTable) return rows();
    const joined = tables[embedTable] ?? [];
    const fkColumn = EMBED_FK_COLUMN[embedTable];
    expect(fkColumn, `fakeSupabase embed: no FK column registered for "${embedTable}" in EMBED_FK_COLUMN`).toBeDefined();
    const out: FakeRow[] = [];
    for (const row of rows()) {
      const match = joined.find((j) => j.id === row[fkColumn]);
      if (!match) continue; // !inner — drop unmatched
      out.push({ ...row, [embedTable]: match });
    }
    return out;
  }

  function matchesFilter(row: FakeRow, f: Filter): boolean {
    let actual: unknown;
    if (f.col.includes('.')) {
      const [joinTable, field] = f.col.split('.');
      actual = (row[joinTable] as FakeRow | undefined)?.[field];
    } else {
      actual = row[f.col];
    }
    if (f.op === 'is') return actual === null || actual === undefined;
    return actual === f.val;
  }

  function matches(row: FakeRow): boolean {
    if (!filters.every((f) => matchesFilter(row, f))) return false;
    if (orFilters && orFilters.length > 0) return orFilters.some((f) => matchesFilter(row, f));
    return true;
  }

  function applySelect(): FakeRow[] {
    let matched = embedded().filter(matches);
    if (orderCol) {
      const col = orderCol;
      matched = matched.slice().sort((a, b) => {
        const av = String(a[col] ?? '');
        const bv = String(b[col] ?? '');
        return orderAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    if (limitN != null) matched = matched.slice(0, limitN);
    return matched;
  }

  function doInsert(): FakeRow[] {
    const list = Array.isArray(payload) ? payload : [payload as FakeRow];
    const inserted: FakeRow[] = [];
    for (const p of list) {
      const row: FakeRow = {
        id: fakeUuid(),
        created_at: fakeNowIso(),
        updated_at: fakeNowIso(),
        ...p,
      };
      rows().push(row);
      inserted.push(row);
    }
    return inserted;
  }

  function doUpdate(): FakeRow[] {
    const target = rows().filter(matches);
    for (const row of target) Object.assign(row, payload as FakeRow);
    return target;
  }

  function doUpsert(): FakeRow[] {
    const p = payload as FakeRow;
    const existing = rows().find((r) => upsertOnConflict.every((c) => r[c] === p[c]));
    if (existing) {
      Object.assign(existing, p);
      return [existing];
    }
    const row: FakeRow = { id: fakeUuid(), created_at: fakeNowIso(), updated_at: fakeNowIso(), ...p };
    rows().push(row);
    return [row];
  }

  function resultRows(): FakeRow[] {
    if (mode === 'insert') return doInsert();
    if (mode === 'update') return doUpdate();
    if (mode === 'upsert') return doUpsert();
    return applySelect();
  }

  const builder: Record<string, unknown> = {
    select: (cols?: string) => {
      if (cols) embedTable = parseEmbed(cols);
      return builder;
    },
    eq: (col: string, val: unknown) => {
      filters.push({ col, op: 'eq', val });
      return builder;
    },
    is: (col: string, val: unknown) => {
      expect(val, `fakeSupabase .is() only models IS NULL, got ${String(val)}`).toBeNull();
      filters.push({ col, op: 'is', val: null });
      return builder;
    },
    /** Models Postgrest's `.or("col1.eq.val1,col2.eq.val2")` — comma-separated
     *  `col.eq.val` clauses only (the one shape peerChannel.ts's
     *  listChannelsForCaller actually issues). ANDed with any `.eq()`/`.is()`
     *  filters already on the chain, ORed against each other. */
    or: (expr: string) => {
      orFilters = expr.split(',').map((clause) => {
        const [col, op, ...rest] = clause.split('.');
        expect(op, `fakeSupabase .or() only models "col.eq.val", got clause "${clause}"`).toBe('eq');
        return { col, op: 'eq' as const, val: rest.join('.') };
      });
      return builder;
    },
    order: (col: string, opts?: { ascending?: boolean }) => {
      orderCol = col;
      orderAsc = opts?.ascending ?? true;
      return builder;
    },
    limit: (n: number) => {
      limitN = n;
      return builder;
    },
    insert: (p: FakeRow | FakeRow[]) => {
      mode = 'insert';
      payload = p;
      return builder;
    },
    update: (p: FakeRow) => {
      mode = 'update';
      payload = p;
      return builder;
    },
    upsert: (p: FakeRow, opts?: { onConflict?: string }) => {
      mode = 'upsert';
      payload = p;
      upsertOnConflict = (opts?.onConflict ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      return builder;
    },
    single: async () => {
      const matched = resultRows();
      if (matched.length !== 1) return { data: null, error: { message: `expected exactly 1 row, got ${matched.length}` } };
      return { data: matched[0], error: null };
    },
    maybeSingle: async () => {
      const matched = resultRows();
      return { data: matched[0] ?? null, error: null };
    },
    then: (resolve: (v: { data?: FakeRow[]; error: null }) => void) => {
      const matched = resultRows();
      resolve({ data: matched, error: null });
    },
  };
  return builder;
}

/** Creates a fresh fake admin client + its backing tables for one test. */
export function createFakeSupabase(): { admin: { from: (table: string) => unknown }; tables: FakeTables } {
  const tables: FakeTables = {};
  const admin = { from: (table: string) => makeBuilder(tables, table) };
  return { admin, tables };
}
