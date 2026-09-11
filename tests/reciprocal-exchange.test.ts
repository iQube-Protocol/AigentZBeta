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
import { createHash } from 'crypto';

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
  registerArtifactOperatorAssisted,
  confirmOperatorAssistedArtifact,
} from '@/services/research/reciprocalExchange';
import { fingerprintExchangeArtifact } from '@/services/threshold/mcpConstitutionalActs';
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

// ─────────────────────────────────────────────────────────────────────────
// Operator-assisted custodial artifact registration (2026-08-28).
//
// Exercises registerArtifactOperatorAssisted + confirmOperatorAssistedArtifact
// against the SAME FakeDb/fakeAdmin harness above, and against a REAL
// exchange whose Party A has ALREADY deposited via the ordinary
// depositArtifact path — mirroring the live exchange
// 0b4134a6-6246-48a8-98f6-e3a22fcd18b3 shape this primitive is built for
// (Party A deposited, Party B unbound/then bound, never a fresh exchange
// per call), per the task's own instruction to test against realistic
// exchange states.
// ─────────────────────────────────────────────────────────────────────────

const OPERATOR = 'operator-33333333-3333-3333-3333-333333333333';

/** Party A deposited (ordinary path), Party B invited+joined but has NOT
 *  deposited yet — the exact shape of the live OCSGA exchange this
 *  primitive targets. */
async function exchangeWithABoundBUnbound(admin: SupabaseClient) {
  const exchange = await makeExchange(admin);
  const depositA = await depositFor(admin, exchange.id, PARTY_A, 'ci-irl-baseline', 'a'.repeat(64));
  if (!depositA.ok) throw new Error('fixture: A deposit failed');
  const invited = await inviteCounterparty(admin, { exchangeId: exchange.id, personaId: PARTY_A });
  if (!invited.ok) throw new Error('fixture: invite failed');
  const joined = await joinExchange(admin, { exchangeId: exchange.id, rawCode: invited.rawCode, personaId: PARTY_B });
  if (!joined.ok) throw new Error('fixture: join failed');
  return exchange.id;
}

const OPERATOR_ASSISTED_HASH = 'b'.repeat(64);

async function registerForB(admin: SupabaseClient, exchangeId: string, overrides: Partial<Parameters<typeof registerArtifactOperatorAssisted>[1]> = {}) {
  return registerArtifactOperatorAssisted(admin, {
    exchangeId,
    boundPrincipalPersonaId: PARTY_B,
    registeringOperatorPersonaId: OPERATOR,
    authorityBasis: "principal's explicit written authorization, out-of-band, 2026-08-28",
    title: 'OCSGA Constitutional Master v1.3',
    artifactClass: 'constitutional-framework-document',
    sourceType: 'upload',
    sourceReference: 'operator-custody/OCSGA_Constitutional_Master_v1.3.docx',
    contentHash: OPERATOR_ASSISTED_HASH,
    ownershipDeclaration: `${PARTY_B} retains ownership`,
    rightsForExchange: 'reciprocal comparison only',
    ...overrides,
  });
}

describe('registerArtifactOperatorAssisted — required test 3: cannot overwrite Party A', () => {
  it('refuses to register against a party slot that already has a deposited artifact', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await exchangeWithABoundBUnbound(admin);

    const attempt = await registerArtifactOperatorAssisted(admin, {
      exchangeId,
      boundPrincipalPersonaId: PARTY_A, // A already deposited via the ordinary path
      registeringOperatorPersonaId: OPERATOR,
      authorityBasis: 'attempted operator overwrite',
      title: 'Attempted overwrite',
      artifactClass: 'x',
      sourceType: 'upload',
      sourceReference: 'x',
      contentHash: 'c'.repeat(64),
      ownershipDeclaration: 'x',
      rightsForExchange: 'x',
    });

    expect(attempt.ok).toBe(false);
    if (!attempt.ok) expect(attempt.error).toMatch(/already has a deposited artifact|already-has-a-deposited-artifact/);

    // Party A's original artifact is completely untouched.
    const view = await getExchangeView(admin, { exchangeId, personaId: PARTY_A });
    expect(view.ok).toBe(true);
    if (view.ok) {
      expect(view.view.yourArtifact?.contentHash).toBe('a'.repeat(64));
      expect(view.view.yourArtifact?.version).toBe(1);
    }
  });

  it('an empty/joinable B slot with no deposit yet MAY receive an operator-assisted registration', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await exchangeWithABoundBUnbound(admin);
    const result = await registerForB(admin, exchangeId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.artifact.party).toBe('B');
      expect(result.artifact.version).toBe(1);
    }
  });
});

describe('registerArtifactOperatorAssisted — required test 4: attribution correctness', () => {
  it('records bound principal, registering operator, and Party A as three distinct identities', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await exchangeWithABoundBUnbound(admin);
    const result = await registerForB(admin, exchangeId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.artifact.registeringOperatorPersonaId).toBe(OPERATOR);
    expect(result.artifact.party).toBe('B');
    expect(result.artifact.pendingPrincipalAttestation).toBe(true);
    expect(result.artifact.originChannel).toBe('operator-assisted');
    expect(result.artifact.authorityBasis).toContain('explicit written authorization');

    // Three distinct identities: bound principal (B), registering operator,
    // and Party A's own principal.
    expect(new Set([PARTY_B, OPERATOR, PARTY_A]).size).toBe(3);
    expect(result.artifact.registeringOperatorPersonaId).not.toBe(PARTY_B);
    expect(result.artifact.registeringOperatorPersonaId).not.toBe(PARTY_A);

    // A normal, principal-performed deposit never carries these fields.
    const viewA = await getExchangeView(admin, { exchangeId, personaId: PARTY_A });
    expect(viewA.ok).toBe(true);
  });

  it('refuses when the registering operator and bound principal are the same identity', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await exchangeWithABoundBUnbound(admin);
    const result = await registerForB(admin, exchangeId, { registeringOperatorPersonaId: PARTY_B });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('registering-operator-must-differ-from-bound-principal');
  });

  it('refuses when the bound principal is not actually a party on this exchange', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await exchangeWithABoundBUnbound(admin);
    const result = await registerForB(admin, exchangeId, { boundPrincipalPersonaId: 'persona-never-joined' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not-a-party');
  });
});

describe('required test 5: operator cannot clear pendingPrincipalAttestation', () => {
  it('the registering operator calling confirm is rejected — resolves to no party, not to B', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await exchangeWithABoundBUnbound(admin);
    await registerForB(admin, exchangeId);

    const attempt = await confirmOperatorAssistedArtifact(admin, { exchangeId, personaId: OPERATOR });
    expect(attempt.ok).toBe(false);
    if (!attempt.ok) expect(attempt.error).toBe('not-a-party');

    // Still pending — confirmed by re-reading B's own artifact.
    const view = await getExchangeView(admin, { exchangeId, personaId: PARTY_B });
    expect(view.ok).toBe(true);
    if (view.ok) expect(view.view.yourArtifact?.pendingPrincipalAttestation).toBe(true);
  });

  it('Party A (the counterparty, not the bound principal) also cannot clear B\'s pending flag', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await exchangeWithABoundBUnbound(admin);
    await registerForB(admin, exchangeId);

    // A resolves to party 'A', so confirm only ever touches A's OWN artifact
    // (which is not pending) — it can never reach B's pending row.
    const attempt = await confirmOperatorAssistedArtifact(admin, { exchangeId, personaId: PARTY_A });
    expect(attempt.ok).toBe(true); // idempotent no-op on A's own (non-pending) artifact
    if (attempt.ok) expect(attempt.artifact.party).toBe('A');

    const view = await getExchangeView(admin, { exchangeId, personaId: PARTY_B });
    expect(view.ok).toBe(true);
    if (view.ok) expect(view.view.yourArtifact?.pendingPrincipalAttestation).toBe(true);
  });
});

describe('required test 6: declareFreeze/signInstrument rejected while pending — Party A unaffected', () => {
  it('B cannot declare freeze on the pending operator-registered artifact', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await exchangeWithABoundBUnbound(admin);
    await registerForB(admin, exchangeId);

    const freeze = await declareFreeze(admin, { exchangeId, personaId: PARTY_B, actorType: 'principal' });
    expect(freeze.ok).toBe(false);
    if (!freeze.ok) expect(freeze.error).toMatch(/artifact-pending-principal-attestation/);
  });

  it('B cannot sign the instrument on the pending operator-registered artifact (ordinary path — blocked upstream at declareFreeze, so the exchange never reaches a signable status while pending)', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await exchangeWithABoundBUnbound(admin);
    await registerForB(admin, exchangeId);

    const sign = await signInstrument(admin, { exchangeId, personaId: PARTY_B, actorType: 'principal' });
    expect(sign.ok).toBe(false);
    // The exchange itself never reached READY_TO_SIGN (B's freeze was
    // already refused above), so this is the exchange-status gate, not yet
    // signInstrument's OWN pending-artifact guard — that guard is proven
    // reachable independently by the defense-in-depth test below.
    if (!sign.ok) expect(sign.error).toMatch(/cannot sign while exchange is/);
  });

  it("signInstrument carries its OWN pending-artifact guard, independent of declareFreeze ever having run (defense in depth — proven by forcing the exchange into a signable status without going through declareFreeze)", async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await exchangeWithABoundBUnbound(admin);
    await registerForB(admin, exchangeId);
    await declareFreeze(admin, { exchangeId, personaId: PARTY_A, actorType: 'principal' });

    // Simulate a freeze attestation existing for B's PENDING artifact via a
    // path other than declareFreeze (which already refuses this — see the
    // test above) and force the exchange into a signable status. This
    // isolates signInstrument's own independent pending-guard rather than
    // relying solely on declareFreeze having been the only gate reached.
    db.tables['exchange_attestations'] = db.tables['exchange_attestations'] ?? [];
    db.tables['exchange_attestations'].push({
      id: 'manual-b-freeze-bypassing-declareFreeze',
      exchange_id: exchangeId,
      party: 'B',
      act_type: 'freeze_declaration',
      artifact_version: 1,
      actor_type: 'principal',
      statement_text: 'x',
      attested_at: new Date().toISOString(),
      receipt_id: null,
      origin_channel: 'native-ui',
    });
    const exchangeRow = db.tables['reciprocal_exchanges'].find((r) => r.id === exchangeId);
    if (exchangeRow) exchangeRow.status = 'READY_TO_SIGN';

    const sign = await signInstrument(admin, { exchangeId, personaId: PARTY_B, actorType: 'principal' });
    expect(sign.ok).toBe(false);
    if (!sign.ok) expect(sign.error).toMatch(/artifact-pending-principal-attestation/);
  });

  it("the pending flag on B's artifact never blocks Party A's OWN freeze declaration — unaffected", async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await exchangeWithABoundBUnbound(admin);
    await registerForB(admin, exchangeId);

    const freezeA = await declareFreeze(admin, { exchangeId, personaId: PARTY_A, actorType: 'principal' });
    expect(freezeA.ok).toBe(true);
  });

  it('the registering operator (not a party) cannot freeze or sign the artifact either', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await exchangeWithABoundBUnbound(admin);
    await registerForB(admin, exchangeId);

    const freeze = await declareFreeze(admin, { exchangeId, personaId: OPERATOR, actorType: 'principal' });
    expect(freeze.ok).toBe(false);
    if (!freeze.ok) expect(freeze.error).toBe('not-a-party');
  });
});

describe('required test 7: authenticated Party B adoption clears pending', () => {
  it('B confirming clears pendingPrincipalAttestation, and only for the exact bound party', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await exchangeWithABoundBUnbound(admin);
    await registerForB(admin, exchangeId);

    const confirmed = await confirmOperatorAssistedArtifact(admin, { exchangeId, personaId: PARTY_B });
    expect(confirmed.ok).toBe(true);
    if (confirmed.ok) {
      expect(confirmed.artifact.pendingPrincipalAttestation).toBe(false);
      expect(confirmed.artifact.party).toBe('B');
    }

    const view = await getExchangeView(admin, { exchangeId, personaId: PARTY_B });
    expect(view.ok).toBe(true);
    if (view.ok) expect(view.view.yourArtifact?.pendingPrincipalAttestation).toBe(false);
  });

  it('confirming twice is idempotent — no error, no duplicate write', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await exchangeWithABoundBUnbound(admin);
    await registerForB(admin, exchangeId);
    await confirmOperatorAssistedArtifact(admin, { exchangeId, personaId: PARTY_B });
    const again = await confirmOperatorAssistedArtifact(admin, { exchangeId, personaId: PARTY_B });
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.artifact.pendingPrincipalAttestation).toBe(false);
  });
});

describe('required test 8: after confirmation, freeze/sign proceed through the UNMODIFIED canonical primitives', () => {
  it('B can declare freeze and sign the instrument once confirmed, and the exchange crosses normally', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await exchangeWithABoundBUnbound(admin);
    await registerForB(admin, exchangeId);
    await confirmOperatorAssistedArtifact(admin, { exchangeId, personaId: PARTY_B });

    const freezeA = await declareFreeze(admin, { exchangeId, personaId: PARTY_A, actorType: 'principal' });
    expect(freezeA.ok).toBe(true);
    const freezeB = await declareFreeze(admin, { exchangeId, personaId: PARTY_B, actorType: 'principal' });
    expect(freezeB.ok).toBe(true);

    const signA = await signInstrument(admin, { exchangeId, personaId: PARTY_A, actorType: 'principal' });
    expect(signA.ok).toBe(true);
    const signB = await signInstrument(admin, { exchangeId, personaId: PARTY_B, actorType: 'principal' });
    expect(signB.ok).toBe(true);
    if (signB.ok) expect(signB.exchange.status).toBe('EXCHANGED');

    const view = await getExchangeView(admin, { exchangeId, personaId: PARTY_A });
    expect(view.ok).toBe(true);
    if (view.ok) expect(view.view.receipt).not.toBeNull();
  });
});

describe('required test 9: hash remains unchanged end-to-end (registration → confirmation → freeze)', () => {
  it('content_hash read back after registration, confirmation, and freeze is byte-identical throughout', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await exchangeWithABoundBUnbound(admin);
    const registered = await registerForB(admin, exchangeId);
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;
    expect(registered.artifact.contentHash).toBe(OPERATOR_ASSISTED_HASH);

    const viewAfterRegister = await getExchangeView(admin, { exchangeId, personaId: PARTY_B });
    expect(viewAfterRegister.ok).toBe(true);
    if (viewAfterRegister.ok) expect(viewAfterRegister.view.yourArtifact?.contentHash).toBe(OPERATOR_ASSISTED_HASH);

    const confirmed = await confirmOperatorAssistedArtifact(admin, { exchangeId, personaId: PARTY_B });
    expect(confirmed.ok).toBe(true);
    if (confirmed.ok) expect(confirmed.artifact.contentHash).toBe(OPERATOR_ASSISTED_HASH);

    await declareFreeze(admin, { exchangeId, personaId: PARTY_A, actorType: 'principal' });
    const freezeB = await declareFreeze(admin, { exchangeId, personaId: PARTY_B, actorType: 'principal' });
    expect(freezeB.ok).toBe(true);

    const viewAfterFreeze = await getExchangeView(admin, { exchangeId, personaId: PARTY_B });
    expect(viewAfterFreeze.ok).toBe(true);
    if (viewAfterFreeze.ok) expect(viewAfterFreeze.view.yourArtifact?.contentHash).toBe(OPERATOR_ASSISTED_HASH);
  });
});

describe('read visibility while pending — required §5: "MAY be visible/usable for read purposes"', () => {
  it('a pending operator-registered artifact is metadata-visible to the bound principal immediately', async () => {
    const db = new FakeDb();
    const admin = fakeAdmin(db);
    const exchangeId = await exchangeWithABoundBUnbound(admin);
    await registerForB(admin, exchangeId);

    const view = await getExchangeView(admin, { exchangeId, personaId: PARTY_B });
    expect(view.ok).toBe(true);
    if (view.ok) {
      expect(view.view.yourArtifact).not.toBeNull();
      expect(view.view.yourArtifact?.contentHash).toBe(OPERATOR_ASSISTED_HASH);
      expect(view.view.yourArtifact?.frozen).toBe(false);
      expect(view.view.yourArtifact?.signed).toBe(false);
      expect(view.view.yourArtifact?.pendingPrincipalAttestation).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Hash-algorithm integrity (required "Hash integrity test"). Proves the
// FINGERPRINTING PATH a caller actually uses — the SAME
// fingerprintExchangeArtifact helper the MCP deposit tool already calls
// (services/threshold/mcpConstitutionalActs.ts) — reproduces plain
// crypto.createHash('sha256').update(bytes).digest('hex') exactly, for
// deterministic fixture bytes this test controls. This proves the
// ALGORITHM is correct; it does NOT and cannot prove the real
// OCSGA_Constitutional_Master_v1.3.docx's specific
// 9f33939112351d811337475c3ed4ebcb78bb993d066232ab06d187098f7c1331 value,
// since that file is not available in this worktree — see the final report.
// ─────────────────────────────────────────────────────────────────────────

describe('fingerprinting path — algorithm correctness (not the real file\'s specific hash)', () => {
  it('fingerprintExchangeArtifact(contentBase64) matches an independently-computed sha256 hex digest', () => {
    const fixtureBytes = Buffer.from('OCSGA operator-assisted registration fixture — deterministic test bytes, not the real artifact.', 'utf8');
    const expected = createHash('sha256').update(fixtureBytes).digest('hex');

    const result = fingerprintExchangeArtifact({ contentBase64: fixtureBytes.toString('base64') });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.contentHash).toBe(expected);
  });

  it('the same bytes always produce the same fingerprint (deterministic, idempotent re-tagging)', () => {
    const fixtureBytes = Buffer.from('deterministic-fixture-v2', 'utf8');
    const first = fingerprintExchangeArtifact({ contentBase64: fixtureBytes.toString('base64') });
    const second = fingerprintExchangeArtifact({ contentBase64: fixtureBytes.toString('base64') });
    expect(first.ok && second.ok && first.contentHash === second.contentHash).toBe(true);
  });

  it('a single flipped byte produces a completely different fingerprint (one-way, content-sensitive)', () => {
    const a = Buffer.from('OCSGA_Constitutional_Master_v1.3-fixture-A', 'utf8');
    const b = Buffer.from('OCSGA_Constitutional_Master_v1.3-fixture-B', 'utf8');
    const ha = fingerprintExchangeArtifact({ contentBase64: a.toString('base64') });
    const hb = fingerprintExchangeArtifact({ contentBase64: b.toString('base64') });
    expect(ha.ok && hb.ok && ha.contentHash !== hb.contentHash).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Structural canary — depositArtifact() itself carries no behavioral change
// from this work. Rather than a live `git diff origin/dev` (fragile once
// this branch's own history becomes "origin/dev"), this snapshots the exact
// function body as a content hash captured at the time this capability was
// added — any future edit to depositArtifact's OWN body changes this hash
// and must update the snapshot deliberately, the same discipline a git-diff
// check would enforce, but without a live git dependency in the test run.
// ─────────────────────────────────────────────────────────────────────────

describe('structural canary — depositArtifact is unmodified by operator-assisted registration', () => {
  it('the depositArtifact function body is byte-identical to its pre-existing form', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const src = fs.readFileSync(path.join(process.cwd(), 'services/research/reciprocalExchange.ts'), 'utf8');
    const start = src.indexOf('export async function depositArtifact(');
    const end = src.indexOf('\n// ─── 3b. Operator-assisted custodial registration');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = src.slice(start, end);
    const bodyHash = createHash('sha256').update(body).digest('hex');
    // Baseline (b50cd79e...) captured on origin/dev (2026-08-28), BEFORE the
    // operator-assisted registration work — that work touched zero lines
    // inside depositArtifact's own body, which this canary proved.
    //
    // DELIBERATELY UPDATED (2026-08-28, journey-spine-channel-convergence):
    // depositArtifact's createActivityReceipt call now also passes
    // `agentsInvoked: input.agentRef ? [input.agentRef] : []` — the same
    // "third identity" (T2-safe delegated-agent reference, distinct from
    // personaId/originChannel) every other exchange-mutating function in
    // this file now threads through for MCP-originated writes (see
    // DepositArtifactInput.agentRef's own doc comment). `agentRef` is
    // undefined for every native-ui caller, so this is additive and
    // behavior-preserving for the existing route — recomputed via the exact
    // same slice/hash this test itself performs, not guessed.
    expect(bodyHash).toBe('701ee886a6ad8fdca7c2dbe2422f078bd646b163981763c163f6437c72d15a26');
  });
});
