/**
 * A minimal in-memory double for the exact subset of the Supabase JS-client
 * query-builder surface services/factor/*, services/aegis/* and
 * services/moneypenny/admissionAuthority.ts use: .from(table).select(cols)
 * .eq().is().in().order().limit().maybeSingle()/.single(),
 * .insert(payload).select().single(), and .update(payload).eq()...
 * select().maybeSingle().
 *
 * This environment has no live Supabase credentials available to this test
 * run — this fixture is what CLAUDE.md's "implement and test against
 * fixtures/mocks; report live verification as outstanding" instruction
 * calls for. It is intentionally narrow: it implements only what the
 * Factor/Aegis services actually call, not a general Postgres emulator.
 */

type Row = Record<string, unknown>;

interface UniqueConstraint {
  columns: string[];
  /** Only enforced when this predicate on the candidate row is true — used
   *  for partial unique indexes (e.g. WHERE idempotency_key IS NOT NULL /
   *  WHERE superseded_by IS NULL). */
  when?: (row: Row) => boolean;
}

const UNIQUE_CONSTRAINTS: Record<string, UniqueConstraint[]> = {
  factor_cases: [
    { columns: ['tenant_id', 'candidate_identity_key'] },
    { columns: ['tenant_id', 'idempotency_key'], when: (r) => r.idempotency_key != null },
  ],
  factor_case_events: [{ columns: ['case_id', 'idempotency_key'], when: (r) => r.idempotency_key != null }],
  aegis_assessments: [{ columns: ['subject_type', 'subject_ref'], when: (r) => r.superseded_by == null }],
};

function matchesEq(row: Row, col: string, val: unknown): boolean {
  return row[col] === val;
}

class FakeBuilder {
  private filters: Array<['eq' | 'is' | 'in', string, unknown]> = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;

  constructor(
    private store: FakeSupabase,
    private table: string,
    private op: 'select' | 'insert' | 'update',
    private payload?: Row | Row[],
  ) {}

  select(_cols?: string) {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push(['eq', col, val]);
    return this;
  }
  is(col: string, val: unknown) {
    this.filters.push(['is', col, val]);
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push(['in', col, vals]);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }

  private applyFilters(rows: Row[]): Row[] {
    return rows.filter((row) =>
      this.filters.every(([kind, col, val]) => {
        if (kind === 'eq') return matchesEq(row, col, val);
        if (kind === 'is') return row[col] === val;
        if (kind === 'in') return Array.isArray(val) && val.includes(row[col]);
        return true;
      }),
    );
  }

  private matchedRows(): Row[] {
    const all = this.store.table(this.table);
    let rows = this.applyFilters(all);
    if (this.orderCol) {
      const col = this.orderCol;
      rows = [...rows].sort((a, b) => {
        const av = a[col] as any;
        const bv = b[col] as any;
        if (av === bv) return 0;
        const cmp = av < bv ? -1 : 1;
        return this.orderAsc ? cmp : -cmp;
      });
    }
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    return rows;
  }

  private execSelect(): { data: Row[]; error: null } {
    return { data: this.matchedRows(), error: null };
  }

  private execInsert(): { data: Row[] | null; error: { message: string; code?: string } | null } {
    const incoming = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
    const inserted: Row[] = [];
    for (const raw of incoming) {
      const row = this.store.applyDefaults(this.table, raw);
      const conflict = this.store.checkUnique(this.table, row);
      if (conflict) {
        return { data: null, error: { message: `duplicate key value violates unique constraint (${conflict})`, code: '23505' } };
      }
      this.store.table(this.table).push(row);
      inserted.push(row);
    }
    return { data: inserted, error: null };
  }

  private execUpdate(): { data: Row[]; error: null } {
    const matched = this.matchedRows();
    const patch = this.payload as Row;
    for (const row of matched) Object.assign(row, patch);
    return { data: matched, error: null };
  }

  private exec() {
    if (this.op === 'select') return this.execSelect();
    if (this.op === 'insert') return this.execInsert();
    return this.execUpdate();
  }

  async maybeSingle() {
    const { data, error } = this.exec();
    if (error) return { data: null, error };
    const rows = data ?? [];
    return { data: rows[0] ?? null, error: null };
  }

  async single() {
    const { data, error } = this.exec();
    if (error) return { data: null, error };
    const rows = data ?? [];
    if (rows.length === 0) return { data: null, error: { message: 'no rows returned', code: 'PGRST116' } };
    return { data: rows[0], error: null };
  }

  then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
    return Promise.resolve(this.exec()).then(onFulfilled, onRejected);
  }
}

let autoId = 0;
function genId(prefix: string): string {
  autoId += 1;
  return `${prefix}-${autoId}-${Math.random().toString(16).slice(2, 8)}`;
}

const ID_COLUMN: Record<string, string> = {
  factor_cases: 'case_id',
  factor_case_events: 'event_id',
  factor_evidence_items: 'evidence_item_id',
  aegis_assessments: 'assessment_id',
  aegis_findings: 'finding_id',
  factor_authority_chains: 'chain_id',
  factor_standing_proposals: 'proposal_id',
};

const TIMESTAMPED_TABLES = ['factor_cases', 'aegis_assessments', 'factor_authority_chains', 'factor_evidence_items', 'factor_standing_proposals'];

export class FakeSupabase {
  private tables: Record<string, Row[]> = {};

  table(name: string): Row[] {
    if (!this.tables[name]) this.tables[name] = [];
    return this.tables[name];
  }

  applyDefaults(table: string, raw: Row): Row {
    const row = { ...raw };
    const idCol = ID_COLUMN[table];
    if (idCol && row[idCol] == null) row[idCol] = genId(table);
    const now = new Date().toISOString();
    if (TIMESTAMPED_TABLES.includes(table)) {
      if (row.created_at == null) row.created_at = now;
      if (row.updated_at == null) row.updated_at = now;
    }
    if (table === 'factor_cases' && row.tenant_id == null) row.tenant_id = 'default';
    if (table === 'factor_authority_chains') {
      if (row.status == null) row.status = 'active';
      if (row.revoked_at === undefined) row.revoked_at = null;
    }
    if (table === 'factor_evidence_items') {
      if (row.status == null) row.status = 'missing';
      if (row.superseded_by === undefined) row.superseded_by = null;
    }
    if (table === 'aegis_assessments') {
      if (row.state == null) row.state = 'draft';
      if (row.conditions == null) row.conditions = [];
      if (row.decision === undefined) row.decision = null;
      if (row.assessment_hash === undefined) row.assessment_hash = null;
      if (row.ratified_at === undefined) row.ratified_at = null;
      if (row.supersedes_assessment_id === undefined) row.supersedes_assessment_id = null;
      if (row.superseded_by === undefined) row.superseded_by = null;
      if (row.receipt_ref === undefined) row.receipt_ref = null;
    }
    if (table === 'factor_standing_proposals' && row.status == null) row.status = 'proposed';
    return row;
  }

  checkUnique(table: string, candidate: Row): string | null {
    const constraints = UNIQUE_CONSTRAINTS[table] ?? [];
    for (const c of constraints) {
      // A partial unique index only constrains rows that themselves satisfy
      // the predicate — check `when` on BOTH the candidate and each existing
      // row (real Postgres semantics), not the candidate alone. Missing this
      // was a real fixture bug: it made "insert the new current row, then
      // retire the old one" look impossible even after fixing the write
      // order to retire-then-insert, because an already-retired row (whose
      // `superseded_by` is now non-null) was still being treated as if it
      // still satisfied `WHERE superseded_by IS NULL`.
      if (c.when && !c.when(candidate)) continue;
      const existing = this.table(table).find((row) => (!c.when || c.when(row)) && c.columns.every((col) => row[col] === candidate[col]));
      if (existing) return c.columns.join(',');
    }
    return null;
  }

  from(table: string) {
    return {
      select: (cols?: string) => new FakeBuilder(this, table, 'select').select(cols),
      insert: (payload: Row | Row[]) => new FakeBuilder(this, table, 'insert', payload),
      update: (payload: Row) => new FakeBuilder(this, table, 'update', payload),
    };
  }
}

export function makeFakeAdmin(): any {
  return new FakeSupabase();
}
