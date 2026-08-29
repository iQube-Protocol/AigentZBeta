/**
 * OCSGA Bridge projection fix (2026-08-29) — end-to-end proof against the
 * REAL fetchIanAuthoritativePlatformState + resolveJourneyState, reproducing
 * Ian's live defect: /bridge/ocsga rendered the generic BoundedDelegationTab
 * shell instead of his Reciprocal Artifact Exchange workspace, because (1)
 * `freeze-attestation-ready`'s evidence treated "an artifact exists"
 * (yourDeposited) as equivalent to "ready for freeze attestation" with no
 * regard for `pendingPrincipalAttestation`, and (2) the journey resolver's
 * final currentStageId fallback picked the first ARRAY-ORDER incomplete
 * stage rather than the first genuinely-blocking one, landing on the skipped
 * optional delegation-establish stage instead.
 *
 * This file proves the FULL chain: registerArtifactOperatorAssisted (the
 * exact operator-assisted registration Ian's v1.3 artifact went through) ->
 * fetchIanAuthoritativePlatformState (the bridge's own evidence assembly) ->
 * resolveJourneyState (the shared Journey Spine resolver) -> the surface the
 * bridge actually mounts for the resolved currentStageId.
 *
 * Harness: the same in-memory Postgrest-shaped FakeDb/fakeAdmin +
 * joinedExchange fixture as tests/journey-spine-channel-convergence.test.ts
 * (reproduced here rather than reaching across test files — same
 * not-exported convention that file itself documents).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Mocks — I/O boundaries only, never the modules under test ────────────

const { mockCreateActivityReceipt, mockListActivityReceiptsForPersona } = vi.hoisted(() => ({
  mockCreateActivityReceipt: vi.fn(),
  mockListActivityReceiptsForPersona: vi.fn(async () => [] as unknown[]),
}));

vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: mockCreateActivityReceipt,
  listActivityReceiptsForPersona: mockListActivityReceiptsForPersona,
}));

let sharedDb: FakeDb;

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => fakeAdmin(sharedDb),
}));

import {
  createExchange,
  inviteCounterparty,
  joinExchange,
  depositArtifact,
  registerArtifactOperatorAssisted,
  confirmOperatorAssistedArtifact,
} from '@/services/research/reciprocalExchange';
import { fetchIanAuthoritativePlatformState } from '@/services/journey/ianJourneyState';
import { resolveJourneyState } from '@/services/journey/resolveJourneyState';
import { IAN_BOUNDARY_RESEARCH_JOURNEY } from '@/services/journey/ianBoundaryResearchJourney';
import { JOURNEY_SURFACES } from '@/services/journey/journeySurfaceRegistry';
import { readSource, importAuthority, stripComments } from './_lib/sourceAuthority';

// ─── Tiny in-memory Postgrest-shaped fake (reproduced, not shared — see header) ───

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

const IAN = 'persona-ian-99999999-9999-9999-9999-999999999999';
const PARTY_A = 'persona-a-11111111-1111-1111-1111-111111111111';
const OPERATOR = 'persona-op-33333333-3333-3333-3333-333333333333';

async function joinedExchangeForIan(admin: SupabaseClient) {
  const created = await createExchange(admin, {
    initiatorPersonaId: PARTY_A,
    title: 'OCSGA Boundary Research',
    purpose: 'Prove bridge projection fix',
    permittedPurpose: 'automated test',
  });
  if (!created.ok) throw new Error('fixture: createExchange failed');
  const deposited = await depositArtifact(admin, {
    exchangeId: created.exchange.id,
    personaId: PARTY_A,
    title: 'Party A artifact',
    artifactClass: 'architecture-map',
    sourceType: 'upload',
    sourceReference: 'party-a-upload.docx',
    contentHash: 'a'.repeat(64),
    ownershipDeclaration: 'Party A retains ownership',
    rightsForExchange: 'reciprocal comparison only',
  });
  if (!deposited.ok) throw new Error('fixture: Party A deposit failed');
  const invited = await inviteCounterparty(admin, { exchangeId: created.exchange.id, personaId: PARTY_A });
  if (!invited.ok) throw new Error('fixture: invite failed');
  const joined = await joinExchange(admin, { exchangeId: created.exchange.id, rawCode: invited.rawCode, personaId: IAN });
  if (!joined.ok) throw new Error('fixture: join failed');
  return created.exchange.id;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateActivityReceipt.mockResolvedValue({ id: 'receipt-1' });
  mockListActivityReceiptsForPersona.mockResolvedValue([]);
  sharedDb = new FakeDb();
});

describe('freeze-attestation-ready evidence no longer conflates "deposited" with "ready" (root cause #2)', () => {
  it('an operator-assisted, unconfirmed artifact reads attestation_ready_acknowledged=false even though the artifact exists', async () => {
    const admin = fakeAdmin(sharedDb);
    const exchangeId = await joinedExchangeForIan(admin);
    const registered = await registerArtifactOperatorAssisted(admin, {
      exchangeId,
      boundPrincipalPersonaId: IAN,
      registeringOperatorPersonaId: OPERATOR,
      authorityBasis: "Ian's explicit authorization, out-of-band",
      title: 'OCSGA Constitutional Master Authoring Template v1.3',
      artifactClass: 'architecture-map',
      sourceType: 'immutable-reference',
      sourceReference: 'operator-assisted-registration:ocsga-v1.3.docx',
      contentHash: '9f33939112351d811337475c3ed4ebcb78bb993d066232ab06d187098f7c1331',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ownershipDeclaration: 'Ian retains ownership',
      rightsForExchange: 'reciprocal comparison only',
    });
    expect(registered.ok).toBe(true);
    if (registered.ok) expect(registered.artifact.pendingPrincipalAttestation).toBe(true);

    const { state } = await fetchIanAuthoritativePlatformState(IAN, null);
    expect(state.stages['create-deposit']?.iqube_created).toBe(true);
    // THE FIX: deposited but still pending confirmation must NOT read ready.
    expect(state.stages['freeze-attestation-ready']?.attestation_ready_acknowledged).toBe(false);
  });

  it('confirming the operator-assisted artifact flips attestation_ready_acknowledged to true, hash unchanged', async () => {
    const admin = fakeAdmin(sharedDb);
    const exchangeId = await joinedExchangeForIan(admin);
    await registerArtifactOperatorAssisted(admin, {
      exchangeId,
      boundPrincipalPersonaId: IAN,
      registeringOperatorPersonaId: OPERATOR,
      authorityBasis: "Ian's explicit authorization, out-of-band",
      title: 'OCSGA Constitutional Master Authoring Template v1.3',
      artifactClass: 'architecture-map',
      sourceType: 'immutable-reference',
      sourceReference: 'operator-assisted-registration:ocsga-v1.3.docx',
      contentHash: '9f33939112351d811337475c3ed4ebcb78bb993d066232ab06d187098f7c1331',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ownershipDeclaration: 'Ian retains ownership',
      rightsForExchange: 'reciprocal comparison only',
    });

    const confirmed = await confirmOperatorAssistedArtifact(admin, { exchangeId, personaId: IAN });
    expect(confirmed.ok).toBe(true);
    if (confirmed.ok) {
      expect(confirmed.artifact.pendingPrincipalAttestation).toBe(false);
      expect(confirmed.artifact.contentHash).toBe(
        '9f33939112351d811337475c3ed4ebcb78bb993d066232ab06d187098f7c1331',
      );
    }

    const { state } = await fetchIanAuthoritativePlatformState(IAN, null);
    expect(state.stages['freeze-attestation-ready']?.attestation_ready_acknowledged).toBe(true);
  });

  it('an ORDINARY (non-operator-assisted) self-deposit is unaffected — attestation_ready_acknowledged is true immediately, same as before this fix', async () => {
    const admin = fakeAdmin(sharedDb);
    const exchangeId = await joinedExchangeForIan(admin);
    // depositArtifact (the ordinary native-UI path) never sets
    // pending_principal_attestation — the FakeDb TABLE_DEFAULTS above
    // default it to false, exactly like the real schema's column default.
    const deposited = await depositArtifact(admin, {
      exchangeId,
      personaId: IAN,
      title: 'Self-deposited artifact',
      artifactClass: 'architecture-map',
      sourceType: 'upload',
      sourceReference: 'self-upload.docx',
      contentHash: 'a'.repeat(64),
      ownershipDeclaration: 'Ian retains ownership',
      rightsForExchange: 'reciprocal comparison only',
    });
    expect(deposited.ok).toBe(true);

    const { state } = await fetchIanAuthoritativePlatformState(IAN, null);
    expect(state.stages['freeze-attestation-ready']?.attestation_ready_acknowledged).toBe(true);
  });
});

describe('end-to-end: the resolved currentStageId and its rendered surface (root causes #1 + #2 together)', () => {
  it('while pending confirmation, currentStageId is freeze-attestation-ready (focus=review) — never delegation-establish, never freeze-attestation', async () => {
    const admin = fakeAdmin(sharedDb);
    const exchangeId = await joinedExchangeForIan(admin);
    await registerArtifactOperatorAssisted(admin, {
      exchangeId,
      boundPrincipalPersonaId: IAN,
      registeringOperatorPersonaId: OPERATOR,
      authorityBasis: "Ian's explicit authorization, out-of-band",
      title: 'OCSGA Constitutional Master Authoring Template v1.3',
      artifactClass: 'architecture-map',
      sourceType: 'immutable-reference',
      sourceReference: 'operator-assisted-registration:ocsga-v1.3.docx',
      contentHash: '9f33939112351d811337475c3ed4ebcb78bb993d066232ab06d187098f7c1331',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ownershipDeclaration: 'Ian retains ownership',
      rightsForExchange: 'reciprocal comparison only',
    });

    // orient/passport are asserted true here — a real caller would have
    // real orientation_ritual_completed/passport_issued receipts; this test
    // is scoped to the exchange-projection chain, not sign-in.
    const { state: authState } = await fetchIanAuthoritativePlatformState(IAN, null);
    authState.stages.orient = { orientation_ritual_completed: true };
    authState.stages.passport = { passport_issued: true };

    const runtimeState = resolveJourneyState(IAN_BOUNDARY_RESEARCH_JOURNEY, authState);
    expect(runtimeState.currentStageId).toBe('freeze-attestation-ready');
    expect(runtimeState.currentStageId).not.toBe('delegation-establish');
    expect(runtimeState.currentStageId).not.toBe('freeze-attestation');

    const stage = IAN_BOUNDARY_RESEARCH_JOURNEY.stages.find((s) => s.id === runtimeState.currentStageId)!;
    const surfaceRef = stage.surfaces.find((s) => s.ref === 'irl-exchange-workspace')!;
    expect(surfaceRef, 'the resolved stage must mount the real exchange workspace, never the delegation shell').toBeTruthy();
    expect((surfaceRef.props as { focus?: string } | undefined)?.focus).toBe('review');
    // Never the generic delegation shell's own registry surface.
    expect(JOURNEY_SURFACES['irl-exchange-workspace'].kind).toBe('embed');
  });

  it('once Ian confirms, currentStageId advances to freeze-attestation (focus=freeze)', async () => {
    const admin = fakeAdmin(sharedDb);
    const exchangeId = await joinedExchangeForIan(admin);
    await registerArtifactOperatorAssisted(admin, {
      exchangeId,
      boundPrincipalPersonaId: IAN,
      registeringOperatorPersonaId: OPERATOR,
      authorityBasis: "Ian's explicit authorization, out-of-band",
      title: 'OCSGA Constitutional Master Authoring Template v1.3',
      artifactClass: 'architecture-map',
      sourceType: 'immutable-reference',
      sourceReference: 'operator-assisted-registration:ocsga-v1.3.docx',
      contentHash: '9f33939112351d811337475c3ed4ebcb78bb993d066232ab06d187098f7c1331',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ownershipDeclaration: 'Ian retains ownership',
      rightsForExchange: 'reciprocal comparison only',
    });
    await confirmOperatorAssistedArtifact(admin, { exchangeId, personaId: IAN });

    const { state: authState } = await fetchIanAuthoritativePlatformState(IAN, null);
    authState.stages.orient = { orientation_ritual_completed: true };
    authState.stages.passport = { passport_issued: true };

    const runtimeState = resolveJourneyState(IAN_BOUNDARY_RESEARCH_JOURNEY, authState);
    expect(runtimeState.currentStageId).toBe('freeze-attestation');
    const stage = IAN_BOUNDARY_RESEARCH_JOURNEY.stages.find((s) => s.id === 'freeze-attestation')!;
    const surfaceRef = stage.surfaces.find((s) => s.ref === 'irl-exchange-workspace')!;
    expect((surfaceRef.props as { focus?: string } | undefined)?.focus).toBe('freeze');
  });
});

describe('gap #3 — the confirm action route wires the canonical service, never a reimplementation', () => {
  it('the actions route imports confirmOperatorAssistedArtifact from the canonical reciprocalExchange service', () => {
    const src = readSource('app/api/research/exchanges/[exchangeId]/actions/route.ts');
    const graph = importAuthority(src);
    const record = graph.records.find((r) => r.specifier === '@/services/research/reciprocalExchange');
    expect(record?.names).toContain('confirmOperatorAssistedArtifact');
  });

  it("the route's switch statement dispatches a 'confirm' case to that function", () => {
    const src = readSource('app/api/research/exchanges/[exchangeId]/actions/route.ts');
    expect(src).toMatch(/case 'confirm':/);
    expect(src).toMatch(/confirmOperatorAssistedArtifact\(admin,/);
  });
});

describe('gap #3 — IRLExchangeTab surfaces pendingPrincipalAttestation and never leaks the registering operator', () => {
  const src = readSource('app/triad/components/codex/tabs/IRLExchangeTab.tsx');

  it('the ArtifactView type carries pendingPrincipalAttestation', () => {
    expect(src).toMatch(/pendingPrincipalAttestation:\s*boolean/);
  });

  it('a Confirm control dispatches the new "confirm" action', () => {
    expect(src).toMatch(/act\("confirm"\)/);
  });

  it('the Freeze button is gated behind pendingPrincipalAttestation — rendered only in the non-pending branch', () => {
    // The pending branch renders "Confirm this artifact" and does NOT render
    // the freeze button; the freeze button appears only in the sibling
    // non-pending branch keyed off `!yourArtifact?.pendingPrincipalAttestation`.
    expect(src).toMatch(/yourArtifact\?\.pendingPrincipalAttestation \? \(/);
    expect(src).toMatch(/Confirm this artifact/);
  });

  it('never serialises registeringOperatorPersonaId (T0 identifier) to this client surface — the CODE, not the doc comment explaining why it is absent', () => {
    expect(stripComments(src)).not.toContain('registeringOperatorPersonaId');
  });
});
