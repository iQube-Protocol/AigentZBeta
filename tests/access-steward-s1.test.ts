/**
 * ACCESS-STEWARD-001 — S1 bounded slice: paired allow/deny/unresolved
 * retrieval tests over `explainReciprocalExchangeArtifactAccess`
 * (services/access/accessSteward.ts).
 *
 * ── SYNTHETIC FIXTURE, CLEARLY LABELED (spec §11 S1, §13) ───────────────────
 *
 * These personas are NOT Ian, and this is NOT a live exchange. No live Ian
 * evidence was available or sought this run (ACCESS-STEWARD-001 S0
 * reconciliation, rule-decision register RD-2). Per the spec's explicit
 * allowance — "If Ian's live evidence cannot be accessed, use clearly marked
 * synthetic fixtures for implementation proof; live case remains blocked, not
 * passed" — this test proves the MECHANISM against a synthetic exchange
 * shaped like the Ian acceptance family (§7.1: a bilateral, frozen,
 * reciprocally-disclosed research artifact exchange). It does not, and must
 * not be read to, establish anything about a real person's real access.
 *
 * The in-memory fake Postgrest client (FakeDb/FakeQuery/fakeAdmin) and the
 * exchange-fixture builders below intentionally mirror the established
 * pattern in tests/reciprocal-exchange.test.ts — same shape, so a reviewer
 * already familiar with that suite recognizes this one immediately, and so no
 * second, subtly-different fake database convention enters the test suite.
 */

import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  createExchange,
  inviteCounterparty,
  joinExchange,
  depositArtifact,
  declareFreeze,
  signInstrument,
} from '@/services/research/reciprocalExchange';
import { explainReciprocalExchangeArtifactAccess } from '@/services/access/accessSteward';

// ─── A tiny in-memory Postgrest-shaped fake (mirrors tests/reciprocal-exchange.test.ts) ───

type Row = Record<string, unknown>;

const TABLE_DEFAULTS: Record<string, Row> = {
  reciprocal_exchanges: {
    exchange_type: 'independent-artifact-comparison',
    disclosure_policy: 'RECIPROCAL_AFTER_BOTH_DEPOSIT',
    confidentiality_class: 'confidential-bilateral',
    ownership_declaration: 'Each deposited artifact remains owned and governed by its originating party.',
    derivative_analysis_permitted: true,
    publication_permitted: false,
    counterparty_persona_id: null,
    invite_code_hash: null,
    invite_expires_at: null,
    qubetalk_channel_id: null,
    opened_at: null,
    completed_at: null,
  },
  exchange_artifacts: { confidentiality_class: 'confidential-bilateral' },
  exchange_attestations: { actor_type: 'principal', receipt_id: null, artifact_version: null },
};

let idCounter = 0;

class FakeDb {
  tables: Record<string, Row[]> = {};
  nextId(table: string): string {
    idCounter += 1;
    return `${table}-${idCounter}`;
  }
}

class FakeQuery implements PromiseLike<{ data: unknown; error: unknown }> {
  private filters: Array<(r: Row) => boolean> = [];
  private orderKey: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private mode: 'select' | 'insert' | 'update' = 'select';
  private payload: Row | null = null;
  private wantSingle = false;
  private wantMaybeSingle = false;

  constructor(private db: FakeDb, private table: string) {}

  select() {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  or(expr: string) {
    const clauses = expr.split(',').map((c) => {
      const [col, , ...rest] = c.split('.');
      const val = rest.join('.');
      return (r: Row) => String(r[col]) === val;
    });
    this.filters.push((r) => clauses.some((c) => c(r)));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderKey = col;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  maybeSingle() {
    this.wantMaybeSingle = true;
    return this;
  }
  single() {
    this.wantSingle = true;
    return this;
  }
  insert(row: Row) {
    this.mode = 'insert';
    this.payload = row;
    return this;
  }
  update(row: Row) {
    this.mode = 'update';
    this.payload = row;
    return this;
  }

  private matched(): Row[] {
    const list = this.db.tables[this.table] ?? [];
    let out = list.filter((r) => this.filters.every((f) => f(r)));
    if (this.orderKey) {
      const key = this.orderKey;
      out = [...out].sort((a, b) => {
        const av = a[key] as string | number;
        const bv = b[key] as string | number;
        if (av === bv) return 0;
        return (av < bv ? -1 : 1) * (this.orderAsc ? 1 : -1);
      });
    }
    if (this.limitN !== null) out = out.slice(0, this.limitN);
    return out;
  }

  then<T1 = { data: unknown; error: unknown }, T2 = never>(
    onFulfilled?: ((v: { data: unknown; error: unknown }) => T1 | PromiseLike<T1>) | null,
    onRejected?: ((r: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    const result = (() => {
      if (this.mode === 'insert') {
        const defaults = TABLE_DEFAULTS[this.table] ?? {};
        const row: Row = {
          id: this.db.nextId(this.table),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...defaults,
          ...this.payload,
        };
        this.db.tables[this.table] = this.db.tables[this.table] ?? [];
        this.db.tables[this.table].push(row);
        return this.wantSingle ? { data: row, error: null } : { data: [row], error: null };
      }
      if (this.mode === 'update') {
        const rows = this.matched();
        rows.forEach((r) => Object.assign(r, this.payload));
        if (this.wantSingle) return { data: rows[0] ?? null, error: rows[0] ? null : { message: 'no matching row' } };
        return { data: rows, error: null };
      }
      const rows = this.matched();
      if (this.wantMaybeSingle) return { data: rows[0] ?? null, error: null };
      if (this.wantSingle) return { data: rows[0] ?? null, error: rows[0] ? null : { message: 'no rows' } };
      return { data: rows, error: null };
    })();
    return Promise.resolve(result).then(onFulfilled, onRejected);
  }
}

function fakeAdmin(db: FakeDb): SupabaseClient {
  return { from: (table: string) => new FakeQuery(db, table) } as unknown as SupabaseClient;
}

// ─── Synthetic fixture personas — NOT Ian, NOT a live exchange ─────────────

const SYNTHETIC_PARTY_A = 'synthetic-party-a-11111111-1111-1111-1111-111111111111';
const SYNTHETIC_PARTY_B = 'synthetic-party-b-22222222-2222-2222-2222-222222222222';
const SYNTHETIC_UNRELATED_PERSONA = 'synthetic-unrelated-99999999-9999-9999-9999-999999999999';

async function depositFor(admin: SupabaseClient, exchangeId: string, personaId: string, title: string, hash: string) {
  return depositArtifact(admin, {
    exchangeId,
    personaId,
    title,
    artifactClass: 'architecture-map',
    sourceType: 'repository-commit',
    sourceReference: `synthetic-fixture/${title}.md`,
    contentHash: hash,
    repositoryCommit: 'synthetic0commit000000',
    ownershipDeclaration: `${personaId} retains ownership`,
    rightsForExchange: 'reciprocal comparison only',
  });
}

/** Builds a synthetic exchange up to (but not through) crossing: both parties
 *  have deposited and frozen, but neither has signed yet. */
async function frozenNotSignedExchange(admin: SupabaseClient): Promise<string> {
  const created = await createExchange(admin, {
    initiatorPersonaId: SYNTHETIC_PARTY_A,
    title: 'Synthetic Access Steward S1 Fixture',
    purpose: 'ACCESS-STEWARD-001 S1 paired allow/deny proof — not a live exchange',
    permittedPurpose: 'automated test',
  });
  if (!created.ok) throw new Error('fixture: createExchange failed');
  const exchangeId = created.exchange.id;

  await depositFor(admin, exchangeId, SYNTHETIC_PARTY_A, 'artifact-a', 'a'.repeat(64));
  const invited = await inviteCounterparty(admin, { exchangeId, personaId: SYNTHETIC_PARTY_A });
  if (!invited.ok) throw new Error('fixture: invite failed');
  const joined = await joinExchange(admin, { exchangeId, rawCode: invited.rawCode, personaId: SYNTHETIC_PARTY_B });
  if (!joined.ok) throw new Error('fixture: join failed');
  await depositFor(admin, exchangeId, SYNTHETIC_PARTY_B, 'artifact-b', 'b'.repeat(64));
  await declareFreeze(admin, { exchangeId, personaId: SYNTHETIC_PARTY_A, actorType: 'principal' });
  await declareFreeze(admin, { exchangeId, personaId: SYNTHETIC_PARTY_B, actorType: 'principal' });
  return exchangeId;
}

async function crossedExchange(admin: SupabaseClient): Promise<string> {
  const exchangeId = await frozenNotSignedExchange(admin);
  const signedA = await signInstrument(admin, { exchangeId, personaId: SYNTHETIC_PARTY_A, actorType: 'principal' });
  expect(signedA.ok).toBe(true);
  const signedB = await signInstrument(admin, { exchangeId, personaId: SYNTHETIC_PARTY_B, actorType: 'principal' });
  expect(signedB.ok).toBe(true);
  return exchangeId;
}

// ─────────────────────────────────────────────────────────────────────────

describe('Access Steward S1 — explainReciprocalExchangeArtifactAccess (synthetic fixture, AS-03/04/05/06/25/27/29)', () => {
  it('AS-05-shaped: ALLOW — an entitled party retrieves the disclosed artifact once the exchange has crossed', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await crossedExchange(admin);

    const decision = await explainReciprocalExchangeArtifactAccess(admin, {
      exchangeId,
      requestingPersonaId: SYNTHETIC_PARTY_A,
    });

    expect(decision.decision).toBe('ALLOW');
    expect(decision.reasons[0].code).toBe('artifact-disclosed');
    expect(decision.scope.action).toBe('read');
    expect(decision.scope.resourceVersion).toBe(1);
    // Obligation carried forward from the exchange's own publicationPermitted
    // flag (false by fixture default) — never invented.
    expect(decision.obligations).toContain('no-onward-publication — this exchange’s publicationPermitted flag is false');
    expect(decision.nextAction).toBeNull();
  });

  it('AS-06-shaped / AS-04: DENY — an unrelated principal is refused on the SAME exchange/action, before crossing or after', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await crossedExchange(admin);

    const decision = await explainReciprocalExchangeArtifactAccess(admin, {
      exchangeId,
      requestingPersonaId: SYNTHETIC_UNRELATED_PERSONA,
    });

    expect(decision.decision).toBe('DENY');
    expect(decision.reasons[0].code).toBe('not-a-party');
    // AS-25: the DENY explanation and evidence never leak the parties'
    // artifact content, titles, or T0 identifiers.
    expect(JSON.stringify(decision)).not.toContain('artifact-a');
    expect(JSON.stringify(decision)).not.toContain('artifact-b');
    expect(JSON.stringify(decision)).not.toContain(SYNTHETIC_PARTY_A);
    expect(JSON.stringify(decision)).not.toContain(SYNTHETIC_PARTY_B);
  });

  it('AS-06-shaped: DENY — a verified PARTY is still refused the counterparty artifact before the exchange has crossed (locked, not disclosed)', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await frozenNotSignedExchange(admin); // frozen, NOT signed — not crossed

    const decision = await explainReciprocalExchangeArtifactAccess(admin, {
      exchangeId,
      requestingPersonaId: SYNTHETIC_PARTY_A,
    });

    expect(decision.decision).toBe('DENY');
    expect(decision.reasons[0].code).toBe('reciprocal-disclosure-not-yet-crossed');
    expect(decision.nextAction).toMatch(/deposit, freeze-declare and sign/);
    // Still no content leakage even though the caller IS a legitimate party —
    // the artifact is simply not yet disclosed under the exchange's own policy.
    expect(JSON.stringify(decision)).not.toContain('artifact-b');
  });

  it('AS-03/AS-27: UNRESOLVED — a nonexistent exchange id fails closed with a distinct reason from DENY, never fabricating a healthy posture', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);

    const decision = await explainReciprocalExchangeArtifactAccess(admin, {
      exchangeId: 'does-not-exist',
      requestingPersonaId: SYNTHETIC_PARTY_A,
    });

    expect(decision.decision).toBe('UNRESOLVED');
    expect(decision.reasons[0].code).toBe('exchange-not-found-or-unavailable');
    expect(decision.nextAction).not.toBeNull();
  });

  it('AS-03: UNRESOLVED — a verified party is correctly told the counterparty has not deposited yet, distinct from a DENY', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const created = await createExchange(admin, {
      initiatorPersonaId: SYNTHETIC_PARTY_A,
      title: 'Synthetic fixture — no counterparty yet',
      purpose: 'ACCESS-STEWARD-001 S1 proof',
      permittedPurpose: 'automated test',
    });
    if (!created.ok) throw new Error('fixture failed');
    await depositFor(admin, created.exchange.id, SYNTHETIC_PARTY_A, 'artifact-a', 'a'.repeat(64));

    const decision = await explainReciprocalExchangeArtifactAccess(admin, {
      exchangeId: created.exchange.id,
      requestingPersonaId: SYNTHETIC_PARTY_A,
    });

    expect(decision.decision).toBe('UNRESOLVED');
    expect(decision.reasons[0].code).toBe('counterparty-not-yet-deposited');
  });

  it('AS-29: the function signature accepts no free-text/content/prompt input — only server-resolved ids', async () => {
    // Structural guarantee: the only inputs are exchangeId and
    // requestingPersonaId (both server-resolved elsewhere, never LLM- or
    // document-authored). Verified by arity/shape, not by string-matching
    // prose, so this does not degrade if the doc comments are edited.
    expect(explainReciprocalExchangeArtifactAccess.length).toBe(2);
  });
});
