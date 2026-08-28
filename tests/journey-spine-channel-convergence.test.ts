/**
 * Journey Spine channel convergence (2026-08-28) — proving, not merely
 * asserting, the operator's own acceptance criterion:
 *
 *   "There is only one constitutional state machine. Copilot, the bridge,
 *    IRL OS and future interfaces are projections and actuation channels
 *    around it."
 *
 * Concretely: if Ian freezes via Copilot/MCP, and THEN reads through the
 * bridge's own read path, it must show frozen — no re-doing, no stale read.
 * If he signs via MCP, the SAME reader IRL OS uses must see it crossed. If
 * he delegates via MCP, Ian's own Journey Spine resolver (ianJourneyState.ts)
 * must reflect it immediately. And the reverse: an act performed via the
 * native-path service call (what the bridge's own routes call) must be
 * immediately visible through the MCP read tools.
 *
 * This file deliberately uses REAL (unmocked)
 * services/research/reciprocalExchange.ts, services/threshold/
 * mcpConstitutionalActs.ts, services/identity/personaReferences.ts
 * (resolvePersonaIdByPublicRef + personaPublicRef), and
 * services/delegation/delegationGrantStore.ts — proof-by-execution, not by
 * asserting mocked call shapes. The ONLY things mocked are the two
 * I/O boundaries every write/read function resolves independently of the
 * `admin` argument callers pass explicitly:
 *   - services/receipts/activityReceiptService.ts (createActivityReceipt /
 *     listActivityReceiptsForPersona) — captured so the three-identities
 *     assertions (principal / delegated agent / channel) have something real
 *     to inspect.
 *   - app/api/_lib/supabaseServer.ts's getSupabaseServer — returns the SAME
 *     fake admin/db instance the tests pass explicitly elsewhere, so
 *     services/delegation/delegationGrantStore.ts and
 *     services/journey/ianJourneyState.ts observe the identical underlying
 *     table state as every explicit-admin call in this file. This IS the
 *     convergence proof: one fake table, reached two different ways,
 *     because that is exactly what the real Supabase table is in production.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { readSource, importAuthority } from './_lib/sourceAuthority';

// ─── Mocks — I/O boundaries only, never the modules under test ────────────

const { mockCreateActivityReceipt, mockListActivityReceiptsForPersona, receiptCalls } = vi.hoisted(() => ({
  mockCreateActivityReceipt: vi.fn(),
  mockListActivityReceiptsForPersona: vi.fn(async () => [] as unknown[]),
  receiptCalls: [] as Record<string, unknown>[],
}));

vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: mockCreateActivityReceipt,
  listActivityReceiptsForPersona: mockListActivityReceiptsForPersona,
}));

let sharedDb: FakeDb;

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  // getSupabaseServer() (called internally by delegationGrantStore.ts and
  // ianJourneyState.ts, WITHOUT an admin argument) resolves to the SAME
  // fake db instance every explicit-admin call in a given test also uses —
  // see beforeEach below. This is the mechanism that makes "one shared
  // table, two access paths" real inside this test file.
  getSupabaseServer: () => fakeAdmin(sharedDb),
}));

import {
  createExchange,
  inviteCounterparty,
  joinExchange,
  depositArtifact,
  declareFreeze,
  signInstrument,
  getExchangeView,
  listMyExchanges,
  registerArtifactOperatorAssisted,
} from '@/services/research/reciprocalExchange';
import {
  depositExchangeArtifactViaMcp,
  declareArtifactFreezeViaMcp,
  signExchangeInstrumentViaMcp,
  establishDelegationViaMcp,
  confirmOperatorAssistedArtifactViaMcp,
  getExchangeStateForMcp,
} from '@/services/threshold/mcpConstitutionalActs';
import { fetchIanAuthoritativePlatformState } from '@/services/journey/ianJourneyState';
import type { ScopedSession } from '@/services/threshold/gatewaySession';

// ─── A tiny in-memory Postgrest-shaped fake — same shape as
//     tests/reciprocal-exchange.test.ts's own harness (not exported there,
//     so reproduced here rather than reaching across test files). ─────────

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
  exchange_artifacts: {
    confidentiality_class: 'confidential-bilateral',
    origin_channel: 'native-ui',
    registering_operator_persona_id: null,
    authority_basis: null,
    pending_principal_attestation: false,
  },
  exchange_attestations: { actor_type: 'principal', receipt_id: null, artifact_version: null, origin_channel: 'native-ui' },
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
  in(col: string, vals: unknown[]) {
    this.filters.push((r) => vals.includes(r[col]));
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

// ─── Fixture identities ─────────────────────────────────────────────────

const PARTY_A = 'persona-a-11111111-1111-1111-1111-111111111111';
const PARTY_B = 'persona-b-22222222-2222-2222-2222-222222222222';
const OPERATOR = 'persona-op-33333333-3333-3333-3333-333333333333';
const REF_A = 'aaaaaaaa11111111'; // 16 lowercase hex — resolvePersonaIdByPublicRef's own format
const REF_B = 'bbbbbbbb22222222';

function seedPersonas(db: FakeDb) {
  db.tables.personas = [
    { id: PARTY_A, public_ref: REF_A },
    { id: PARTY_B, public_ref: REF_B },
  ];
}

function sessionFor(publicRef: string, agentAlias: string, overrides: Partial<ScopedSession> = {}): ScopedSession {
  return {
    id: `session-${publicRef}`,
    principalPublicRef: publicRef,
    agentAlias,
    agreementId: 'agreement-1',
    scope: ['research.read', 'research.exchange.write', 'delegation.grant'],
    initiatingService: 'ocsga',
    expiresAt: null,
    serviceAgreements: {},
    ...overrides,
  };
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

/** A_DEPOSITED -> B_JOINED, both parties bound, neither deposited yet
 *  (freeze-eligibility left to each test). */
async function joinedExchange(admin: SupabaseClient) {
  const created = await createExchange(admin, {
    initiatorPersonaId: PARTY_A,
    title: 'Journey Spine Convergence Fixture',
    purpose: 'Prove channel convergence',
    permittedPurpose: 'automated test',
  });
  if (!created.ok) throw new Error('fixture: createExchange failed');
  await depositFor(admin, created.exchange.id, PARTY_A, 'artifact-a', 'a'.repeat(64));
  const invited = await inviteCounterparty(admin, { exchangeId: created.exchange.id, personaId: PARTY_A });
  if (!invited.ok) throw new Error('fixture: invite failed');
  const joined = await joinExchange(admin, { exchangeId: created.exchange.id, rawCode: invited.rawCode, personaId: PARTY_B });
  if (!joined.ok) throw new Error('fixture: join failed');
  return created.exchange.id;
}

beforeEach(() => {
  vi.clearAllMocks();
  receiptCalls.length = 0;
  mockCreateActivityReceipt.mockImplementation(async (input: Record<string, unknown>) => {
    receiptCalls.push(input);
    return { id: `receipt-${receiptCalls.length}` };
  });
  mockListActivityReceiptsForPersona.mockResolvedValue([]);
  sharedDb = new FakeDb();
  seedPersonas(sharedDb);
});

// ─────────────────────────────────────────────────────────────────────────
// 1. Freeze via MCP -> immediately visible through the shared read (getExchangeView)
//    — "if Ian freezes via Copilot, the bridge must show Freeze complete."
// ─────────────────────────────────────────────────────────────────────────

describe('MCP freeze -> shared read convergence', () => {
  it('declareArtifactFreezeViaMcp writes; getExchangeView (the SAME reader ianJourneyState.ts uses) reflects it with no re-check', async () => {
    const admin = fakeAdmin(sharedDb);
    const exchangeId = await joinedExchange(admin);
    await depositFor(admin, exchangeId, PARTY_B, 'artifact-b', 'b'.repeat(64));

    const result = await declareArtifactFreezeViaMcp(admin, sessionFor(REF_A, 'companion_ian'), { declarationConfirmed: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.attestation.originChannel).toBe('mcp');
      // Accepted through EVIDENCE, not merely "not rejected" — the actual
      // written row carries actorType:'principal'.
      expect(result.attestation.actorType).toBe('principal');
    }

    // A DIFFERENT path than the one that wrote it: plain getExchangeView,
    // the exact function services/journey/ianJourneyState.ts (the bridge's
    // own resolver) calls.
    const view = await getExchangeView(admin, { exchangeId, personaId: PARTY_A });
    expect(view.ok).toBe(true);
    if (view.ok) expect(view.view.yourArtifact?.frozen).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. Sign via MCP (both parties) -> exchange crosses -> visible via a
//    THIRD, independent read (listMyExchanges) and via the MCP read tool.
// ─────────────────────────────────────────────────────────────────────────

describe('MCP sign -> exchange crosses -> shared read convergence', () => {
  it('signExchangeInstrumentViaMcp for both parties crosses the exchange; listMyExchanges and getExchangeStateForMcp both observe it', async () => {
    const admin = fakeAdmin(sharedDb);
    const exchangeId = await joinedExchange(admin);
    await depositFor(admin, exchangeId, PARTY_B, 'artifact-b', 'b'.repeat(64));

    await declareArtifactFreezeViaMcp(admin, sessionFor(REF_A, 'companion_ian'), { declarationConfirmed: true });
    await declareArtifactFreezeViaMcp(admin, sessionFor(REF_B, 'companion_bob'), { declarationConfirmed: true });

    const signA = await signExchangeInstrumentViaMcp(admin, sessionFor(REF_A, 'companion_ian'), { declarationConfirmed: true });
    const signB = await signExchangeInstrumentViaMcp(admin, sessionFor(REF_B, 'companion_bob'), { declarationConfirmed: true });
    expect(signA.ok).toBe(true);
    expect(signB.ok).toBe(true);
    if (signB.ok) expect(signB.exchangeStatus).toBe('EXCHANGED');

    // Read #1 — a plain, independent listMyExchanges call (what
    // constitutionalNavigator.ts's own composition also calls).
    const mineA = await listMyExchanges(admin, PARTY_A);
    expect(mineA.ok).toBe(true);
    if (mineA.ok) expect(mineA.exchanges[0].status).toBe('EXCHANGED');

    // Read #2 — the MCP read tool itself, for the OTHER party, proving the
    // same fact converges regardless of which session reads it.
    const stateB = await getExchangeStateForMcp(admin, sessionFor(REF_B, 'companion_bob'));
    expect(stateB.ok).toBe(true);
    if (stateB.ok) {
      expect(stateB.view.exchange.status).toBe('EXCHANGED');
      // get_exchange_state also carries the canonical instrument clauses —
      // the gap this session closed (agents must be able to show the exact
      // text before asking for a signature, never invent/paraphrase it).
      expect(stateB.exchangeInstrumentClauses.length).toBeGreaterThan(0);
      expect(stateB.freezeDeclarationText.length).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 3. THE REVERSE — an act performed via the native-path service call (what
//    the bridge's own API routes call directly) is immediately visible
//    through the MCP read tools. Proves there is only ONE write path
//    underneath both surfaces, not two.
// ─────────────────────────────────────────────────────────────────────────

describe('Native-path write -> MCP read convergence (the reverse direction)', () => {
  it('declareFreeze/signInstrument called directly (as the native API route calls them, no originChannel) are read back as EXCHANGED via getExchangeStateForMcp', async () => {
    const admin = fakeAdmin(sharedDb);
    const exchangeId = await joinedExchange(admin);
    await depositFor(admin, exchangeId, PARTY_B, 'artifact-b', 'b'.repeat(64));

    // Native-UI shape exactly: app/api/research/exchanges/[exchangeId]/actions/route.ts
    // calls declareFreeze/signInstrument with no originChannel — defaults to 'native-ui'.
    const freezeA = await declareFreeze(admin, { exchangeId, personaId: PARTY_A, actorType: 'principal' });
    const freezeB = await declareFreeze(admin, { exchangeId, personaId: PARTY_B, actorType: 'principal' });
    expect(freezeA.ok && freezeB.ok).toBe(true);
    if (freezeA.ok) expect(freezeA.attestation.originChannel).toBe('native-ui');

    const signA = await signInstrument(admin, { exchangeId, personaId: PARTY_A, actorType: 'principal' });
    const signB = await signInstrument(admin, { exchangeId, personaId: PARTY_B, actorType: 'principal' });
    expect(signA.ok && signB.ok).toBe(true);

    // Copilot's own read tool must see this immediately — "an act performed
    // on the bridge must be immediately visible to Copilot."
    const stateA = await getExchangeStateForMcp(admin, sessionFor(REF_A, 'companion_ian'));
    expect(stateA.ok).toBe(true);
    if (stateA.ok) {
      expect(stateA.view.exchange.status).toBe('EXCHANGED');
      expect(stateA.view.yourArtifact?.signed).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 4. Delegation established via MCP -> Ian's own Journey Spine resolver
//    (ianJourneyState.ts) reflects it immediately, no separate re-check.
// ─────────────────────────────────────────────────────────────────────────

describe('MCP delegation -> Journey Spine resolver convergence', () => {
  it('establishDelegationViaMcp writes to delegation_grants; fetchIanAuthoritativePlatformState reflects delegation-establish=true on the very next call', async () => {
    const admin = fakeAdmin(sharedDb);
    const result = await establishDelegationViaMcp(admin, sessionFor(REF_A, 'companion_ian'), {
      declarationConfirmed: true,
      agentRootDid: 'did:example:ian-copilot',
      purpose: 'assist with Boundary Research artifact review',
    });
    expect(result.ok).toBe(true);

    // ianJourneyState.ts calls hasActiveDelegation(personaId), which calls
    // getSupabaseServer() internally (mocked above to the SAME sharedDb) —
    // no admin is threaded through explicitly on this path, which is
    // exactly the seam this test proves converges.
    const { state } = await fetchIanAuthoritativePlatformState(PARTY_A, null);
    expect(state.stages['delegation-establish']?.delegation_active).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 5. confirm_operator_assisted_artifact — the new MCP tool this session adds.
// ─────────────────────────────────────────────────────────────────────────

describe('confirm_operator_assisted_artifact — calls the UNMODIFIED canonical function', () => {
  it('structural: mcpConstitutionalActs.ts imports confirmOperatorAssistedArtifact from the canonical service, never a reimplementation', () => {
    const src = readSource('services/threshold/mcpConstitutionalActs.ts');
    const graph = importAuthority(src);
    const record = graph.records.find((r) => r.specifier === '@/services/research/reciprocalExchange');
    expect(record?.names).toContain('confirmOperatorAssistedArtifact');
  });

  it('behavioral: confirmOperatorAssistedArtifactViaMcp resolves the principal + active exchange and adopts a pending operator-assisted artifact', async () => {
    const admin = fakeAdmin(sharedDb);
    const exchangeId = await joinedExchange(admin);

    const registered = await registerArtifactOperatorAssisted(admin, {
      exchangeId,
      boundPrincipalPersonaId: PARTY_B,
      registeringOperatorPersonaId: OPERATOR,
      authorityBasis: "Ian's explicit written authorization, out-of-band, 2026-08-28 email",
      title: 'artifact-b-custodial',
      artifactClass: 'architecture-map',
      sourceType: 'repository-commit',
      sourceReference: 'codexes/packs/irl/foundation/experiments/artifact-b.md',
      contentHash: 'c'.repeat(64),
      repositoryCommit: 'def456abc123',
      ownershipDeclaration: `${PARTY_B} retains ownership`,
      rightsForExchange: 'reciprocal comparison only',
    });
    expect(registered.ok).toBe(true);
    if (registered.ok) expect(registered.artifact.pendingPrincipalAttestation).toBe(true);

    // Refuses without declarationConfirmed:true.
    const refused = await confirmOperatorAssistedArtifactViaMcp(admin, sessionFor(REF_B, 'companion_bob'), {
      declarationConfirmed: false,
    });
    expect(refused.ok).toBe(false);

    // The bound principal's own MCP-transmitted confirmation clears it.
    const confirmed = await confirmOperatorAssistedArtifactViaMcp(admin, sessionFor(REF_B, 'companion_bob'), {
      declarationConfirmed: true,
    });
    expect(confirmed.ok).toBe(true);
    if (confirmed.ok) {
      expect(confirmed.artifact.pendingPrincipalAttestation).toBe(false);
      // The hash is untouched end-to-end — same evidentiary content.
      expect(confirmed.artifact.contentHash).toBe('c'.repeat(64));
    }
  });

  it('a caller can only ever confirm their OWN slot — resolving to the wrong party never touches someone else\'s pending artifact', async () => {
    const admin = fakeAdmin(sharedDb);
    const exchangeId = await joinedExchange(admin);
    await registerArtifactOperatorAssisted(admin, {
      exchangeId,
      boundPrincipalPersonaId: PARTY_B,
      registeringOperatorPersonaId: OPERATOR,
      authorityBasis: 'out-of-band authorization',
      title: 'artifact-b-custodial',
      artifactClass: 'architecture-map',
      sourceType: 'repository-commit',
      sourceReference: 'x',
      contentHash: 'd'.repeat(64),
      repositoryCommit: 'abc',
      ownershipDeclaration: 'x',
      rightsForExchange: 'x',
    });

    // Party A confirming resolves to PARTY A's own (non-pending, in fact
    // non-existent-yet) artifact slot — an idempotent no-op, never B's.
    const asA = await confirmOperatorAssistedArtifactViaMcp(admin, sessionFor(REF_A, 'companion_ian'), {
      declarationConfirmed: true,
    });
    expect(asA.ok).toBe(true);

    const viewOfB = await getExchangeView(admin, { exchangeId, personaId: PARTY_B });
    expect(viewOfB.ok).toBe(true);
    if (viewOfB.ok) expect(viewOfB.view.yourArtifact?.pendingPrincipalAttestation).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 6. Pending-attestation blocks freeze/sign through the MCP layer too — not
//    just at the service layer (the base branch already proved that).
// ─────────────────────────────────────────────────────────────────────────

describe('Pending operator-assisted artifact blocks every MCP write path until confirmed', () => {
  it('declareArtifactFreezeViaMcp refuses a pending artifact for the bound principal, then succeeds once confirmed', async () => {
    const admin = fakeAdmin(sharedDb);
    const exchangeId = await joinedExchange(admin);
    await registerArtifactOperatorAssisted(admin, {
      exchangeId,
      boundPrincipalPersonaId: PARTY_B,
      registeringOperatorPersonaId: OPERATOR,
      authorityBasis: 'out-of-band authorization',
      title: 'artifact-b-custodial',
      artifactClass: 'architecture-map',
      sourceType: 'repository-commit',
      sourceReference: 'x',
      contentHash: 'e'.repeat(64),
      repositoryCommit: 'abc',
      ownershipDeclaration: 'x',
      rightsForExchange: 'x',
    });

    const refused = await declareArtifactFreezeViaMcp(admin, sessionFor(REF_B, 'companion_bob'), { declarationConfirmed: true });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toMatch(/pending-principal-attestation/);

    await confirmOperatorAssistedArtifactViaMcp(admin, sessionFor(REF_B, 'companion_bob'), { declarationConfirmed: true });

    const nowOk = await declareArtifactFreezeViaMcp(admin, sessionFor(REF_B, 'companion_bob'), { declarationConfirmed: true });
    expect(nowOk.ok).toBe(true);
  });

  it('signExchangeInstrumentViaMcp does not bypass the pending-attestation gate either (defense-in-depth, checked through the MCP wrapper itself)', async () => {
    // The ORDINARY state machine can never present signInstrument with a
    // READY_TO_SIGN exchange while an artifact is still pending — freeze
    // (tested above) is the reachable gate, because READY_TO_SIGN requires
    // both freezes on record and freeze itself already refuses a pending
    // artifact. To prove sign's OWN pending check is not silently bypassed
    // by the MCP wrapper (rather than merely unreachable), this forces the
    // hypothetical state directly on the fake table — a structural probe of
    // the wrapper + service's gate, not a claim this sequence occurs
    // naturally. See the closeout report for this reachability finding.
    const admin = fakeAdmin(sharedDb);
    const exchangeId = await joinedExchange(admin);
    await registerArtifactOperatorAssisted(admin, {
      exchangeId,
      boundPrincipalPersonaId: PARTY_B,
      registeringOperatorPersonaId: OPERATOR,
      authorityBasis: 'out-of-band authorization',
      title: 'artifact-b-custodial',
      artifactClass: 'architecture-map',
      sourceType: 'repository-commit',
      sourceReference: 'x',
      contentHash: 'f'.repeat(64),
      repositoryCommit: 'abc',
      ownershipDeclaration: 'x',
      rightsForExchange: 'x',
    });
    const exRow = sharedDb.tables.reciprocal_exchanges.find((r) => r.id === exchangeId)!;
    exRow.status = 'READY_TO_SIGN'; // forced hypothetical state — see comment above

    const result = await signExchangeInstrumentViaMcp(admin, sessionFor(REF_B, 'companion_bob'), { declarationConfirmed: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/pending-principal-attestation/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 7. Explicit consent — every constitutional-act MCP tool refuses cleanly
//    without declarationConfirmed:true, proven against the REAL functions
//    (no DB row is ever written).
// ─────────────────────────────────────────────────────────────────────────

describe('Explicit consent gate — every constitutional-act MCP write function, enumerated', () => {
  it('deposit, confirm, freeze, sign, and delegation-establish all refuse without declarationConfirmed:true, and write nothing', async () => {
    const admin = fakeAdmin(sharedDb);
    const exchangeId = await joinedExchange(admin);
    const before = JSON.stringify(sharedDb.tables);

    const results = await Promise.all([
      depositExchangeArtifactViaMcp(admin, sessionFor(REF_A, 'companion_ian'), {
        declarationConfirmed: false,
        title: 't',
        artifactClass: 'c',
        sourceType: 'upload',
        sourceReference: 's',
        contentHash: 'h',
        ownershipDeclaration: 'o',
        rightsForExchange: 'r',
      }),
      confirmOperatorAssistedArtifactViaMcp(admin, sessionFor(REF_A, 'companion_ian'), { declarationConfirmed: false }),
      declareArtifactFreezeViaMcp(admin, sessionFor(REF_A, 'companion_ian'), { declarationConfirmed: false }),
      signExchangeInstrumentViaMcp(admin, sessionFor(REF_A, 'companion_ian'), { declarationConfirmed: false }),
      establishDelegationViaMcp(admin, sessionFor(REF_A, 'companion_ian'), {
        declarationConfirmed: false,
        agentRootDid: 'did:example:x',
        purpose: 'x',
      }),
    ]);
    expect(results.every((r) => r.ok === false)).toBe(true);
    void exchangeId;
    expect(JSON.stringify(sharedDb.tables)).toBe(before);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 8. The three distinct identities — principal, delegated agent, channel —
//    on receipts produced by MCP-originated constitutional acts.
// ─────────────────────────────────────────────────────────────────────────

describe('Three distinct identities on MCP-originated receipts (principal / delegated agent / channel)', () => {
  it('freeze + sign receipts carry personaId=principal, agentsInvoked=[the delegated agent alias], distinct from each other; the attestation row separately carries origin_channel=mcp', async () => {
    const admin = fakeAdmin(sharedDb);
    const exchangeId = await joinedExchange(admin);
    await depositFor(admin, exchangeId, PARTY_B, 'artifact-b', 'b'.repeat(64));

    await declareArtifactFreezeViaMcp(admin, sessionFor(REF_A, 'companion_ian'), { declarationConfirmed: true });
    await declareArtifactFreezeViaMcp(admin, sessionFor(REF_B, 'companion_bob'), { declarationConfirmed: true });
    const sign = await signExchangeInstrumentViaMcp(admin, sessionFor(REF_A, 'companion_ian'), { declarationConfirmed: true });
    expect(sign.ok).toBe(true);

    const freezeReceipt = receiptCalls.find((c) => c.actionType === 'exchange_freeze_declared' && c.personaId === PARTY_A);
    expect(freezeReceipt).toBeTruthy();
    expect(freezeReceipt?.personaId).toBe(PARTY_A); // identity #1: the principal
    expect(freezeReceipt?.agentsInvoked).toEqual(['companion_ian']); // identity #2: the delegated agent
    expect(freezeReceipt?.personaId).not.toBe((freezeReceipt?.agentsInvoked as string[])[0]); // never conflated

    const signReceipt = receiptCalls.find((c) => c.actionType === 'exchange_instrument_signed' && c.personaId === PARTY_A);
    expect(signReceipt?.agentsInvoked).toEqual(['companion_ian']);

    // identity #3: the channel — recorded separately on the domain evidence
    // row (exchange_attestations.origin_channel), never conflated with
    // either identity above.
    if (sign.ok) expect(sign.attestation.originChannel).toBe('mcp');
  });

  it('a native-ui write carries NO agent identity (agentsInvoked empty) — agentRef is additive, never inferred for a caller that never supplied one', async () => {
    const admin = fakeAdmin(sharedDb);
    const exchangeId = await joinedExchange(admin);
    await depositFor(admin, exchangeId, PARTY_B, 'artifact-b', 'b'.repeat(64));
    await declareFreeze(admin, { exchangeId, personaId: PARTY_A, actorType: 'principal' });

    const nativeReceipt = receiptCalls.find((c) => c.actionType === 'exchange_freeze_declared' && c.personaId === PARTY_A);
    expect(nativeReceipt?.agentsInvoked).toEqual([]);
  });
});
