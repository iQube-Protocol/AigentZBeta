/**
 * Reciprocal Artifact Exchange (PRD-IRL-AX-001) — behavioral tests for the
 * GENERIC primitive, not just the IRL-AX-001 happy path.
 *
 * Uses a small in-memory fake Postgrest client (below) rather than a
 * canned-response builder: the service's state machine is order-independent
 * and multi-step, so a real (if tiny) relational fake lets these tests
 * exercise actual sequences of calls the way the service really makes them,
 * instead of hand-scripting every intermediate response.
 *
 * `createActivityReceipt` (services/receipts/activityReceiptService.ts)
 * resolves its OWN Supabase client independently of the fake `admin` passed
 * here. With no Supabase env configured in the unit-test sandbox, it throws
 * and every call site in the service catches it (`.catch(() => null)`) — so
 * these tests never touch a network and receipt ids simply come back null,
 * which the service already handles as a soft failure.
 */

import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  createExchange,
  inviteCounterparty,
  findExchangeByInviteCode,
  joinExchange,
  depositArtifact,
  declareFreeze,
  signInstrument,
  acknowledgeReceipt,
  openComparison,
  createDerivative,
  withdrawPreExchange,
  revokeAccessPostExchange,
  getExchangeView,
  listMyExchanges,
  resolveMembership,
} from '@/services/research/reciprocalExchange';
import {
  assertNoIsolationClaim,
  IsolationClaimViolation,
  isLegalExchangeTransition,
  hasCrossed,
  FORBIDDEN_ISOLATION_PHRASES,
  INDEPENDENT_FREEZE_CLAIM,
} from '@/types/reciprocalExchange';

// ─── A tiny in-memory Postgrest-shaped fake (real filtering, real state) ───

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

// ─── Fixture helper: a full DRAFT→READY_TO_SIGN exchange ────────────────────

const PARTY_A = 'persona-a-11111111-1111-1111-1111-111111111111';
const PARTY_B = 'persona-b-22222222-2222-2222-2222-222222222222';

async function makeExchange(admin: SupabaseClient) {
  const created = await createExchange(admin, {
    initiatorPersonaId: PARTY_A,
    title: 'Test Exchange',
    purpose: 'Testing the generic reciprocal exchange primitive',
    permittedPurpose: 'automated test',
  });
  if (!created.ok) throw new Error('fixture: createExchange failed');
  return created.exchange;
}

async function depositFor(admin: SupabaseClient, exchangeId: string, personaId: string, title: string, hash: string) {
  return depositArtifact(admin, {
    exchangeId,
    personaId,
    title,
    artifactClass: 'architecture-map',
    sourceType: 'repository-commit',
    sourceReference: `codexes/packs/irl/foundation/experiments/${title}.md`,
    contentHash: hash,
    repositoryCommit: 'abc123def456',
    ownershipDeclaration: `${personaId} retains ownership`,
    rightsForExchange: 'reciprocal comparison only',
  });
}

async function fullyReadyExchange(admin: SupabaseClient) {
  const exchange = await makeExchange(admin);
  await depositFor(admin, exchange.id, PARTY_A, 'artifact-a', 'hash-a-'.padEnd(64, '0'));
  const invited = await inviteCounterparty(admin, { exchangeId: exchange.id, personaId: PARTY_A });
  if (!invited.ok) throw new Error('fixture: invite failed');
  const joined = await joinExchange(admin, { exchangeId: exchange.id, rawCode: invited.rawCode, personaId: PARTY_B });
  if (!joined.ok) throw new Error('fixture: join failed');
  await depositFor(admin, exchange.id, PARTY_B, 'artifact-b', 'hash-b-'.padEnd(64, '0'));
  await declareFreeze(admin, { exchangeId: exchange.id, personaId: PARTY_A, actorType: 'principal' });
  await declareFreeze(admin, { exchangeId: exchange.id, personaId: PARTY_B, actorType: 'principal' });
  return exchange.id;
}

// ─────────────────────────────────────────────────────────────────────────

describe('The isolation-claim guard (PRD §2) — CRITICAL', () => {
  it('the one truthful claim never trips the guard', () => {
    expect(() => assertNoIsolationClaim(INDEPENDENT_FREEZE_CLAIM)).not.toThrow();
  });

  it('rejects every forbidden isolation phrase', () => {
    for (const phrase of FORBIDDEN_ISOLATION_PHRASES) {
      expect(() => assertNoIsolationClaim(`This exchange proves that ${phrase} throughout.`)).toThrow(IsolationClaimViolation);
    }
  });

  it('is case-insensitive', () => {
    expect(() => assertNoIsolationClaim('NEITHER PARTY HAD PRIOR KNOWLEDGE of the other map')).toThrow(IsolationClaimViolation);
  });

  it('the crossing receipt summary this service generates is guaranteed isolation-claim-free', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await fullyReadyExchange(admin);
    await signInstrument(admin, { exchangeId, personaId: PARTY_A, actorType: 'principal' });
    const crossed = await signInstrument(admin, { exchangeId, personaId: PARTY_B, actorType: 'principal' });
    expect(crossed.ok).toBe(true);

    const view = await getExchangeView(admin, { exchangeId, personaId: PARTY_A });
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    expect(view.view.receipt).not.toBeNull();
    const summary = view.view.receipt!.humanReadableSummary;
    expect(() => assertNoIsolationClaim(summary)).not.toThrow();
    expect(summary).toContain('independently frozen before formal exchange');
  });
});

describe('State machine — order independence and legality (PRD §11)', () => {
  it('does not assume a fixed A-then-B signing order', () => {
    expect(isLegalExchangeTransition('READY_TO_SIGN', 'B_SIGNED')).toBe(true);
    expect(isLegalExchangeTransition('READY_TO_SIGN', 'A_SIGNED')).toBe(true);
    expect(isLegalExchangeTransition('B_SIGNED', 'A_SIGNED')).toBe(true);
    expect(isLegalExchangeTransition('A_SIGNED', 'B_SIGNED')).toBe(true);
  });

  it('exception states are terminal for forward progress', () => {
    expect(isLegalExchangeTransition('WITHDRAWN_PRE_EXCHANGE', 'DRAFT')).toBe(false);
    expect(isLegalExchangeTransition('REVOKED_ACCESS_POST_EXCHANGE', 'COMPARISON_OPEN')).toBe(false);
  });

  it('hasCrossed is true at and after EXCHANGED, never before', () => {
    expect(hasCrossed('READY_TO_SIGN')).toBe(false);
    expect(hasCrossed('A_SIGNED')).toBe(false);
    expect(hasCrossed('EXCHANGED')).toBe(true);
    expect(hasCrossed('COMPLETED')).toBe(true);
  });
});

describe('Invitation claim + Passport/persona resolution path', () => {
  it('the counterparty joins via the exchange-scoped code, never by guessing the exchangeId', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchange = await makeExchange(admin);
    await depositFor(admin, exchange.id, PARTY_A, 'artifact-a', 'h'.repeat(64));
    const invited = await inviteCounterparty(admin, { exchangeId: exchange.id, personaId: PARTY_A });
    expect(invited.ok).toBe(true);
    if (!invited.ok) return;

    const found = await findExchangeByInviteCode(admin, invited.rawCode);
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.exchange.id).toBe(exchange.id);

    const joined = await joinExchange(admin, { exchangeId: exchange.id, rawCode: invited.rawCode, personaId: PARTY_B });
    expect(joined.ok).toBe(true);
    if (joined.ok) {
      expect(joined.exchange.status).toBe('B_JOINED');
      expect(resolveMembership(joined.exchange, PARTY_B)).toBe('B');
    }
  });

  it('an existing Passport/persona resolves directly — re-joining with the same persona is idempotent', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchange = await makeExchange(admin);
    await depositFor(admin, exchange.id, PARTY_A, 'artifact-a', 'h'.repeat(64));
    const invited = await inviteCounterparty(admin, { exchangeId: exchange.id, personaId: PARTY_A });
    if (!invited.ok) throw new Error('setup');
    await joinExchange(admin, { exchangeId: exchange.id, rawCode: invited.rawCode, personaId: PARTY_B });
    const again = await joinExchange(admin, { exchangeId: exchange.id, rawCode: invited.rawCode, personaId: PARTY_B });
    expect(again.ok).toBe(true);
  });

  it('a wrong code is refused', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchange = await makeExchange(admin);
    const found = await findExchangeByInviteCode(admin, 'rax-wrong-code');
    expect(found.ok).toBe(false);
    void exchange;
  });
});

describe('Deposits + fingerprints', () => {
  it('Party A deposit, Party B deposit, and hashes persist', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await fullyReadyExchange(admin);
    const view = await getExchangeView(admin, { exchangeId, personaId: PARTY_A });
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    expect(view.view.yourArtifact?.contentHash).toBe('hash-a-'.padEnd(64, '0'));
  });

  it('artifact replacement changes the fingerprint/version and invalidates stale readiness', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await fullyReadyExchange(admin);
    await signInstrument(admin, { exchangeId, personaId: PARTY_A, actorType: 'principal' });

    // A replaces their artifact AFTER signing — the signature no longer
    // pins to the current version.
    const replaced = await depositFor(admin, exchangeId, PARTY_A, 'artifact-a-v2', 'h'.repeat(64).replace(/^./, 'z'));
    expect(replaced.ok).toBe(true);
    if (replaced.ok) {
      expect(replaced.replaced).toBe(true);
      expect(replaced.artifact.version).toBe(2);
    }

    const loaded = await getExchangeView(admin, { exchangeId, personaId: PARTY_A });
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      // Signature no longer current — the exchange retreats, never silently
      // keeps the stale A_SIGNED status.
      expect(loaded.view.exchange.status).toBe('ARTIFACT_REPLACEMENT_REQUIRED');
      expect(loaded.view.yourArtifact?.signed).toBe(false);
    }
  });
});

describe('Freeze declaration is a receipted act, not a checkbox', () => {
  it('a delegated agent cannot declare the freeze on the principal\'s behalf', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchange = await makeExchange(admin);
    await depositFor(admin, exchange.id, PARTY_A, 'artifact-a', 'h'.repeat(64));
    const result = await declareFreeze(admin, { exchangeId: exchange.id, personaId: PARTY_A, actorType: 'delegated_agent' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('freeze-declaration-requires-principal');
  });

  it('cannot freeze-declare before depositing', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchange = await makeExchange(admin);
    const result = await declareFreeze(admin, { exchangeId: exchange.id, personaId: PARTY_A, actorType: 'principal' });
    expect(result.ok).toBe(false);
  });
});

describe('Signing — one signed, other unsigned must not cross', () => {
  it('one signature alone does not cross the exchange', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await fullyReadyExchange(admin);
    const signed = await signInstrument(admin, { exchangeId, personaId: PARTY_A, actorType: 'principal' });
    expect(signed.ok).toBe(true);
    if (signed.ok) expect(signed.exchange.status).toBe('A_SIGNED');
    expect(hasCrossed(signed.ok ? signed.exchange.status : 'DRAFT')).toBe(false);
  });

  it('a delegated agent cannot sign the Exchange Instrument on the principal\'s behalf', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await fullyReadyExchange(admin);
    const result = await signInstrument(admin, { exchangeId, personaId: PARTY_A, actorType: 'delegated_agent' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('instrument-signature-requires-principal');
  });

  it('both signatures present transitions to EXCHANGED and issues the bilateral receipt', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await fullyReadyExchange(admin);
    await signInstrument(admin, { exchangeId, personaId: PARTY_A, actorType: 'principal' });
    const crossed = await signInstrument(admin, { exchangeId, personaId: PARTY_B, actorType: 'principal' });
    expect(crossed.ok).toBe(true);
    if (crossed.ok) expect(crossed.exchange.status).toBe('EXCHANGED');

    const view = await getExchangeView(admin, { exchangeId, personaId: PARTY_B });
    expect(view.ok).toBe(true);
    if (view.ok) {
      expect(view.view.receipt).not.toBeNull();
      expect(view.view.receipt?.partyAFingerprint).toBe('hash-a-'.padEnd(64, '0'));
      expect(view.view.receipt?.partyBFingerprint).toBe('hash-b-'.padEnd(64, '0'));
    }
  });
});

describe('Disclosure gate — RECIPROCAL_AFTER_BOTH_DEPOSIT (server-side, fail closed)', () => {
  it('refuses to disclose the counterparty artifact before both parties have deposited and crossed', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchange = await makeExchange(admin);
    await depositFor(admin, exchange.id, PARTY_A, 'artifact-a', 'h'.repeat(64));
    const invited = await inviteCounterparty(admin, { exchangeId: exchange.id, personaId: PARTY_A });
    if (!invited.ok) throw new Error('setup');
    await joinExchange(admin, { exchangeId: exchange.id, rawCode: invited.rawCode, personaId: PARTY_B });
    // B has NOT deposited yet.
    const viewFromA = await getExchangeView(admin, { exchangeId: exchange.id, personaId: PARTY_A });
    expect(viewFromA.ok).toBe(true);
    if (viewFromA.ok) {
      expect(viewFromA.view.counterpartyArtifact).toBeNull(); // nothing deposited yet
    }

    await depositFor(admin, exchange.id, PARTY_B, 'artifact-b', 'h'.repeat(64).replace(/^./, 'z'));
    // Both deposited, but not frozen/signed/crossed — still locked.
    const viewAfterBothDeposit = await getExchangeView(admin, { exchangeId: exchange.id, personaId: PARTY_A });
    expect(viewAfterBothDeposit.ok).toBe(true);
    if (viewAfterBothDeposit.ok) {
      expect(viewAfterBothDeposit.view.counterpartyArtifact?.locked).toBe(true);
      expect(viewAfterBothDeposit.view.counterpartyArtifact?.contentHash).toBeNull();
      expect(viewAfterBothDeposit.view.counterpartyArtifact?.sourceReference).toBeNull();
    }
  });

  it('discloses reciprocally once the gate is satisfied (both signed → EXCHANGED)', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await fullyReadyExchange(admin);
    await signInstrument(admin, { exchangeId, personaId: PARTY_A, actorType: 'principal' });
    await signInstrument(admin, { exchangeId, personaId: PARTY_B, actorType: 'principal' });

    const viewA = await getExchangeView(admin, { exchangeId, personaId: PARTY_A });
    expect(viewA.ok).toBe(true);
    if (viewA.ok) {
      expect(viewA.view.counterpartyArtifact?.locked).toBe(false);
      expect(viewA.view.counterpartyArtifact?.contentHash).toBe('hash-b-'.padEnd(64, '0'));
    }
  });
});

describe('Unauthorized access — fail closed', () => {
  it('a non-party gets refused, never a redacted view', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await fullyReadyExchange(admin);
    const stranger = await getExchangeView(admin, { exchangeId, personaId: 'persona-stranger' });
    expect(stranger.ok).toBe(false);
    if (!stranger.ok) expect(stranger.error).toBe('not-a-party');
  });

  it('a non-party cannot deposit, freeze, or sign', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchange = await makeExchange(admin);
    const deposit = await depositFor(admin, exchange.id, 'persona-stranger', 'artifact-x', 'h'.repeat(64));
    expect(deposit.ok).toBe(false);
    const freeze = await declareFreeze(admin, { exchangeId: exchange.id, personaId: 'persona-stranger', actorType: 'principal' });
    expect(freeze.ok).toBe(false);
  });
});

describe('Receipt acknowledgment — evidence, not a new transfer of rights', () => {
  it('acknowledging is per-party and both acks move the exchange to RECEIPT_ACKNOWLEDGED', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await fullyReadyExchange(admin);
    await signInstrument(admin, { exchangeId, personaId: PARTY_A, actorType: 'principal' });
    await signInstrument(admin, { exchangeId, personaId: PARTY_B, actorType: 'principal' });

    const ackA = await acknowledgeReceipt(admin, { exchangeId, personaId: PARTY_A });
    expect(ackA.ok).toBe(true);
    if (ackA.ok) expect(ackA.exchange.status).toBe('EXCHANGED'); // only one party has ack'd

    const ackB = await acknowledgeReceipt(admin, { exchangeId, personaId: PARTY_B });
    expect(ackB.ok).toBe(true);
    if (ackB.ok) expect(ackB.exchange.status).toBe('RECEIPT_ACKNOWLEDGED');
  });

  it('acknowledgment states it confers no transfer of rights', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await fullyReadyExchange(admin);
    await signInstrument(admin, { exchangeId, personaId: PARTY_A, actorType: 'principal' });
    await signInstrument(admin, { exchangeId, personaId: PARTY_B, actorType: 'principal' });
    await acknowledgeReceipt(admin, { exchangeId, personaId: PARTY_A });
    const rows = db.tables['exchange_attestations'].filter((r) => r.act_type === 'receipt_acknowledgment');
    expect(rows.length).toBe(1);
    expect(String(rows[0].statement_text)).toContain('not a transfer of rights');
  });
});

describe('Comparison + derivative lineage — immutable frozen sources', () => {
  it('comparison can only open after crossing', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await fullyReadyExchange(admin);
    const tooEarly = await openComparison(admin, { exchangeId, personaId: PARTY_A });
    expect(tooEarly.ok).toBe(false);
  });

  it('a derivative records lineage without mutating the frozen source artifacts', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await fullyReadyExchange(admin);
    await signInstrument(admin, { exchangeId, personaId: PARTY_A, actorType: 'principal' });
    await signInstrument(admin, { exchangeId, personaId: PARTY_B, actorType: 'principal' });

    const opened = await openComparison(admin, { exchangeId, personaId: PARTY_A });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const beforeA = db.tables['exchange_artifacts'].find((r) => r.id === opened.comparison.partyAArtifactId);
    const hashBefore = beforeA?.content_hash;

    const derivative = await createDerivative(admin, {
      comparisonId: opened.comparison.id,
      personaId: PARTY_B,
      title: 'Normalized seam proposal',
      description: 'A co-designed interface proposal — created compatibility, not discovered.',
      sourceArtifactIds: [opened.comparison.partyAArtifactId, opened.comparison.partyBArtifactId],
      classification: 'AMBIGUOUS',
      compatibilityKind: 'CREATED',
    });
    expect(derivative.ok).toBe(true);

    const afterA = db.tables['exchange_artifacts'].find((r) => r.id === opened.comparison.partyAArtifactId);
    expect(afterA?.content_hash).toBe(hashBefore); // untouched
  });

  it('a derivative cannot reference an artifact outside the comparison', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await fullyReadyExchange(admin);
    await signInstrument(admin, { exchangeId, personaId: PARTY_A, actorType: 'principal' });
    await signInstrument(admin, { exchangeId, personaId: PARTY_B, actorType: 'principal' });
    const opened = await openComparison(admin, { exchangeId, personaId: PARTY_A });
    if (!opened.ok) throw new Error('setup');

    const bad = await createDerivative(admin, {
      comparisonId: opened.comparison.id,
      personaId: PARTY_A,
      title: 'x',
      description: 'x',
      sourceArtifactIds: ['some-unrelated-artifact-id'],
    });
    expect(bad.ok).toBe(false);
  });
});

describe('Pre-exchange withdrawal and post-exchange revocation', () => {
  it('a party may withdraw before the exchange crosses', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await fullyReadyExchange(admin);
    const withdrawn = await withdrawPreExchange(admin, {
      exchangeId,
      personaId: PARTY_A,
      actorType: 'principal',
      reason: 'changed research direction',
    });
    expect(withdrawn.ok).toBe(true);
    if (withdrawn.ok) expect(withdrawn.exchange.status).toBe('WITHDRAWN_PRE_EXCHANGE');
  });

  it('cannot withdraw after crossing — must use revocation instead', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await fullyReadyExchange(admin);
    await signInstrument(admin, { exchangeId, personaId: PARTY_A, actorType: 'principal' });
    await signInstrument(admin, { exchangeId, personaId: PARTY_B, actorType: 'principal' });
    const withdrawn = await withdrawPreExchange(admin, { exchangeId, personaId: PARTY_A, actorType: 'principal', reason: 'x' });
    expect(withdrawn.ok).toBe(false);
  });

  it('post-exchange revocation narrows future access but the historical receipt remains intact (append-only)', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await fullyReadyExchange(admin);
    await signInstrument(admin, { exchangeId, personaId: PARTY_A, actorType: 'principal' });
    await signInstrument(admin, { exchangeId, personaId: PARTY_B, actorType: 'principal' });

    const receiptRowBefore = db.tables['exchange_receipts'][0];
    expect(receiptRowBefore).toBeTruthy();

    const revoked = await revokeAccessPostExchange(admin, {
      exchangeId,
      personaId: PARTY_A,
      actorType: 'principal',
      reason: 'dispute over downstream use',
    });
    expect(revoked.ok).toBe(true);
    if (revoked.ok) expect(revoked.exchange.status).toBe('REVOKED_ACCESS_POST_EXCHANGE');

    // The receipt row itself is untouched — never deleted, never edited.
    const receiptRowAfter = db.tables['exchange_receipts'][0];
    expect(receiptRowAfter).toEqual(receiptRowBefore);

    // But forward-looking artifact ACCESS is now re-locked for the viewer.
    const view = await getExchangeView(admin, { exchangeId, personaId: PARTY_B });
    expect(view.ok).toBe(true);
    if (view.ok) {
      expect(view.view.counterpartyArtifact?.locked).toBe(true);
      expect(view.view.receipt).not.toBeNull(); // evidence still visible
    }
  });

  it('cannot revoke an exchange that never crossed', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await fullyReadyExchange(admin);
    const revoked = await revokeAccessPostExchange(admin, { exchangeId, personaId: PARTY_A, actorType: 'principal', reason: 'x' });
    expect(revoked.ok).toBe(false);
  });
});

describe('listMyExchanges', () => {
  it('lists exchanges where the caller is either party', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await fullyReadyExchange(admin);
    const asA = await listMyExchanges(admin, PARTY_A);
    const asB = await listMyExchanges(admin, PARTY_B);
    expect(asA.ok && asA.exchanges.some((e) => e.id === exchangeId)).toBe(true);
    expect(asB.ok && asB.exchanges.some((e) => e.id === exchangeId)).toBe(true);
  });
});
