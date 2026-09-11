/**
 * CFS-024 multi-agent bounded delegation model — canaries (2026-08-23 repair
 * pass, "MULTI-AGENT BOUNDED DELEGATION — complete the CFS-024 model
 * end-to-end").
 *
 * Canonical model (operator ruling, verbatim): a persona may have many
 * structurally assigned agents, exactly one designated `aigentMe`, and many
 * SIMULTANEOUSLY ACTIVE bounded delegation grants — one independently
 * bounded grant PER AGENT. `aigentMe` is a role/designation, never an
 * exclusivity constraint on runtime authority.
 *
 * These tests drive `delegationGrantStore.ts`'s real functions
 * (persistDelegationGrant/readActiveGrants/readActiveGrantForAgent/
 * revokeGrantForAgent/revokeAllActiveGrants) against a minimal in-memory
 * fake Postgrest builder standing in for `delegation_grants` — not a
 * hand-mocked call-count assertion — so the proof is behavioral: query the
 * real store after a real sequence of writes and see what comes back.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const PERSONA_ID = 'persona-p';
const NAKAMOTO_DID = 'did:agent:root:aigent-nakamoto';
const KNOW1_DID = 'did:agent:root:aigent-kn0w1';
const MONEYPENNY_DID = 'did:agent:root:aigent-moneypenny';

interface FakeRow {
  grant_id: string;
  persona_id: string;
  agent_root_did: string;
  status: 'active' | 'revoked' | 'expired';
  allowed_actions: string[];
  allowed_surfaces: string[];
  max_actions: number;
  actions_taken: number;
  created_at: string;
  updated_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
  [key: string]: unknown;
}

let rows: FakeRow[] = [];
let seq = 0;
function nowIso(offsetMs = 0): string {
  // Deterministic, monotonically increasing timestamps — Date.now()/new Date()
  // are unavailable in this harness's real runtime constraints elsewhere, but
  // plain arithmetic over a fixed epoch is fine inside a test file.
  seq += 1;
  return new Date(1700000000000 + seq * 1000 + offsetMs).toISOString();
}

function matchesFilters(row: FakeRow, filters: Array<[string, unknown]>): boolean {
  return filters.every(([col, val]) => (row as Record<string, unknown>)[col] === val);
}

/** A minimal fake Postgrest query builder — just enough surface for delegationGrantStore.ts's real queries. */
function makeQueryBuilder() {
  const filters: Array<[string, unknown]> = [];
  let orderCol: string | null = null;
  let orderAsc = true;
  let limitN: number | null = null;
  let mode: 'select' | 'update' | 'insert' = 'select';
  let updatePayload: Record<string, unknown> | null = null;
  let insertPayload: Record<string, unknown> | null = null;

  function apply(): FakeRow[] {
    let matched = rows.filter((r) => matchesFilters(r, filters));
    if (orderCol) {
      matched = matched.slice().sort((a, b) => {
        const av = String((a as Record<string, unknown>)[orderCol as string]);
        const bv = String((b as Record<string, unknown>)[orderCol as string]);
        return orderAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    if (limitN != null) matched = matched.slice(0, limitN);
    return matched;
  }

  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      filters.push([col, val]);
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
    maybeSingle: async () => {
      const matched = apply();
      return { data: matched[0] ?? null, error: null };
    },
    update: (payload: Record<string, unknown>) => {
      mode = 'update';
      updatePayload = payload;
      return builder;
    },
    insert: async (payload: Record<string, unknown>) => {
      mode = 'insert';
      insertPayload = payload;
      rows.push({ ...(payload as FakeRow) });
      return { error: null };
    },
    then: (resolve: (v: { data?: FakeRow[]; error: null }) => void) => {
      if (mode === 'update' && updatePayload) {
        const matched = apply();
        for (const row of matched) Object.assign(row, updatePayload);
        resolve({ error: null });
      } else {
        resolve({ data: apply(), error: null });
      }
    },
  };
  return builder;
}

const fakeAdmin = {
  from: (table: string) => {
    expect(table).toBe('delegation_grants');
    return makeQueryBuilder();
  },
};

vi.mock('@/app/api/_lib/supabaseServer', () => ({ getSupabaseServer: () => fakeAdmin }));

const {
  persistDelegationGrant,
  readActiveGrants,
  readActiveGrantForAgent,
  revokeGrantForAgent,
  revokeAllActiveGrants,
} = await import('@/services/delegation/delegationGrantStore');

function grantInput(agentRootDid: string, grantId: string) {
  return {
    grantId,
    personaId: PERSONA_ID,
    agentRootDid,
    tenantId: 'default',
    trustBand: 'L1_EXPERIMENTAL',
    allowedActions: ['knowledge_retrieval'],
    allowedSurfaces: ['metame'],
    forbiddenActions: [],
    disclosureClass: 'tenant',
    maxActions: 20,
    handoff: { handoff_id: grantId } as any,
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  };
}

beforeEach(() => {
  rows = [];
  seq = 0;
});

describe('CFS-024 multi-agent bounded delegation — canonical model canaries', () => {
  it('1. Persona P can have active grants simultaneously for Nakamoto + Kn0w1 + MoneyPenny', async () => {
    await persistDelegationGrant(grantInput(NAKAMOTO_DID, 'grant-nakamoto-1'));
    await persistDelegationGrant(grantInput(KNOW1_DID, 'grant-know1-1'));
    await persistDelegationGrant(grantInput(MONEYPENNY_DID, 'grant-moneypenny-1'));

    const active = await readActiveGrants(PERSONA_ID);
    const dids = active.map((g) => g.agent_root_did).sort();
    expect(dids).toEqual([KNOW1_DID, MONEYPENNY_DID, NAKAMOTO_DID].sort());
    expect(active).toHaveLength(3);
  });

  it('2. Granting MoneyPenny does not revoke Nakamoto', async () => {
    await persistDelegationGrant(grantInput(NAKAMOTO_DID, 'grant-nakamoto-1'));
    await persistDelegationGrant(grantInput(MONEYPENNY_DID, 'grant-moneypenny-1'));

    const nakamotoGrant = await readActiveGrantForAgent(PERSONA_ID, NAKAMOTO_DID);
    expect(nakamotoGrant?.grant_id).toBe('grant-nakamoto-1');
    expect(nakamotoGrant?.status ?? 'active').not.toBe('revoked');
  });

  it('3. Revoking Kn0w1 leaves Nakamoto and MoneyPenny active', async () => {
    await persistDelegationGrant(grantInput(NAKAMOTO_DID, 'grant-nakamoto-1'));
    await persistDelegationGrant(grantInput(KNOW1_DID, 'grant-know1-1'));
    await persistDelegationGrant(grantInput(MONEYPENNY_DID, 'grant-moneypenny-1'));

    await revokeGrantForAgent(PERSONA_ID, KNOW1_DID, 'test revoke');

    expect(await readActiveGrantForAgent(PERSONA_ID, KNOW1_DID)).toBeNull();
    expect((await readActiveGrantForAgent(PERSONA_ID, NAKAMOTO_DID))?.grant_id).toBe('grant-nakamoto-1');
    expect((await readActiveGrantForAgent(PERSONA_ID, MONEYPENNY_DID))?.grant_id).toBe('grant-moneypenny-1');

    const active = await readActiveGrants(PERSONA_ID);
    expect(active.map((g) => g.agent_root_did).sort()).toEqual([MONEYPENNY_DID, NAKAMOTO_DID].sort());
  });

  it('4. Re-granting Nakamoto supersedes/replaces only Nakamoto\'s prior active grant, not the other agents\'', async () => {
    await persistDelegationGrant(grantInput(NAKAMOTO_DID, 'grant-nakamoto-1'));
    await persistDelegationGrant(grantInput(KNOW1_DID, 'grant-know1-1'));
    await persistDelegationGrant(grantInput(MONEYPENNY_DID, 'grant-moneypenny-1'));

    await persistDelegationGrant(grantInput(NAKAMOTO_DID, 'grant-nakamoto-2'));

    const nakamotoGrant = await readActiveGrantForAgent(PERSONA_ID, NAKAMOTO_DID);
    expect(nakamotoGrant?.grant_id).toBe('grant-nakamoto-2');

    // The old Nakamoto grant is now historical (revoked), never mutated away —
    // still present as a row, just no longer active.
    const oldRow = rows.find((r) => r.grant_id === 'grant-nakamoto-1');
    expect(oldRow?.status).toBe('revoked');

    // Kn0w1 and MoneyPenny's own grants are completely untouched.
    expect((await readActiveGrantForAgent(PERSONA_ID, KNOW1_DID))?.grant_id).toBe('grant-know1-1');
    expect((await readActiveGrantForAgent(PERSONA_ID, MONEYPENNY_DID))?.grant_id).toBe('grant-moneypenny-1');
  });

  it('5. readActiveGrantForAgent(P, Nakamoto) never returns Kn0w1 or MoneyPenny', async () => {
    await persistDelegationGrant(grantInput(KNOW1_DID, 'grant-know1-1'));
    await persistDelegationGrant(grantInput(MONEYPENNY_DID, 'grant-moneypenny-1'));
    // Nakamoto has NO grant at all.

    const nakamotoGrant = await readActiveGrantForAgent(PERSONA_ID, NAKAMOTO_DID);
    expect(nakamotoGrant).toBeNull();
  });

  it('revokeAllActiveGrants revokes every agent\'s grant — the ONLY explicit "return all authority" path', async () => {
    await persistDelegationGrant(grantInput(NAKAMOTO_DID, 'grant-nakamoto-1'));
    await persistDelegationGrant(grantInput(KNOW1_DID, 'grant-know1-1'));
    await persistDelegationGrant(grantInput(MONEYPENNY_DID, 'grant-moneypenny-1'));

    await revokeAllActiveGrants(PERSONA_ID, 'emergency');

    expect(await readActiveGrants(PERSONA_ID)).toHaveLength(0);
  });

  it('6. the single-aigentMe designation lives in a completely separate mechanism (persona_agent_assignments) the delegation route never touches — one aigentMe is enforced independently of how many agents are delegated', () => {
    // aigentMe uniqueness is enforced in personaAssignmentStore.ts (demotes
    // the persona's prior aigentMe on a new aigentMe assignment) — a
    // structural fact about ROLE, never about how many delegation_grants
    // rows exist. Proven here at the source level: the delegation route
    // that creates/revokes grants has zero import coupling to the
    // assignment store, so granting N independent delegations can never
    // perturb the single-aigentMe invariant, and vice versa.
    const routeSrc = stripComments(readSource('app/api/codex/chat/agentiq-os/delegation/route.ts'));
    expect(routeSrc).not.toMatch(/personaAssignmentStore/);
    expect(routeSrc).not.toMatch(/persona_agent_assignments/);

    const assignmentSrc = stripComments(readSource('services/identity/personaAssignmentStore.ts'));
    expect(assignmentSrc).not.toMatch(/delegationGrantStore/);
    expect(assignmentSrc).not.toMatch(/delegation_grants/);
  });
});

describe('7. batch grant emits independent receipts/grant IDs for every agent', () => {
  const mockGetActivePersona = vi.fn();
  const mockCreateActivityReceipt = vi.fn();
  const mockEnqueueReceiptAnchor = vi.fn();
  const mockEmitOrchestrationEvent = vi.fn(async () => undefined);
  const mockResolveDelegateAgentIdByDid = vi.fn(async () => null);
  const mockReadDelegateStanding = vi.fn(async () => null);

  vi.doMock('@/services/identity/getActivePersona', () => ({
    getActivePersona: (...args: unknown[]) => mockGetActivePersona(...args),
  }));
  vi.doMock('@/services/receipts/activityReceiptService', () => ({
    createActivityReceipt: (...args: unknown[]) => mockCreateActivityReceipt(...args),
  }));
  vi.doMock('@/services/dvn/activityReceiptDvnPipeline', () => ({
    enqueueActivityReceiptAnchor: (...args: unknown[]) => mockEnqueueReceiptAnchor(...args),
  }));
  vi.doMock('@/services/orchestration/orchestrationEvents', () => ({
    emitOrchestrationEvent: (...args: unknown[]) => mockEmitOrchestrationEvent(...args),
  }));
  vi.doMock('@/services/homecoming/delegateStanding', () => ({
    resolveDelegateAgentIdByDid: (...args: unknown[]) => mockResolveDelegateAgentIdByDid(...args),
    readDelegateStanding: (...args: unknown[]) => mockReadDelegateStanding(...args),
    delegateStandingAllowsBand: () => true,
  }));

  it('POSTing agent_root_dids for Nakamoto + Kn0w1 + MoneyPenny creates 3 independently sealed grants with distinct grant ids and 3 separate receipts', async () => {
    rows = [];
    seq = 0;
    mockGetActivePersona.mockResolvedValue({ personaId: PERSONA_ID, authProfileId: 'auth-1' });
    mockCreateActivityReceipt.mockImplementation(async (input: { summary: string }) => ({ id: `receipt-${mockCreateActivityReceipt.mock.calls.length}`, summary: input.summary }));

    vi.resetModules();
    const { POST } = await import('@/app/api/codex/chat/agentiq-os/delegation/route');

    const req = {
      json: async () => ({
        persona_id: PERSONA_ID,
        agent_root_dids: [NAKAMOTO_DID, KNOW1_DID, MONEYPENNY_DID],
        trust_band: 'L1_EXPERIMENTAL', // BAND_MIN_SCORE 0 — no reputation_score needed
      }),
    } as unknown as Parameters<typeof POST>[0];
    const res = await POST(req);
    const data = await res.json();

    expect(data.ok).toBe(true);
    expect(data.grants).toHaveLength(3);
    const grantIds = data.grants.map((g: { handoff_id: string }) => g.handoff_id);
    expect(new Set(grantIds).size).toBe(3); // every grant id distinct
    const grantedDids = data.grants.map((g: { agent_root_did: string }) => g.agent_root_did).sort();
    expect(grantedDids).toEqual([KNOW1_DID, MONEYPENNY_DID, NAKAMOTO_DID].sort());

    // One independent receipt call PER agent — never a single shared batch receipt.
    expect(mockCreateActivityReceipt).toHaveBeenCalledTimes(3);
    const receiptAgents = mockCreateActivityReceipt.mock.calls.map((c) => (c[0] as { agentsInvoked: string[] }).agentsInvoked[0]).sort();
    expect(receiptAgents).toEqual([KNOW1_DID, MONEYPENNY_DID, NAKAMOTO_DID].sort());

    vi.doUnmock('@/services/identity/getActivePersona');
    vi.doUnmock('@/services/receipts/activityReceiptService');
    vi.doUnmock('@/services/dvn/activityReceiptDvnPipeline');
    vi.doUnmock('@/services/orchestration/orchestrationEvents');
    vi.doUnmock('@/services/homecoming/delegateStanding');
  });
});
