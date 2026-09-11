/**
 * The canonical (principal + selectedWorkspaceId) resolver (2026-09-08,
 * operator instruction: "Introduce or consolidate a server-side resolver...
 * Every Workspace tab must consume this same resolved object"). Covers
 * `services/research/selectedWorkspaceState.ts` and the route it powers,
 * `GET /api/participation/workspace-state`.
 *
 * A generic in-memory Postgrest-shaped mock backs every table the resolver's
 * composed services touch (access_grants, research_objects, experiment_results,
 * reviewer_agreement_authorizations, experiment_workspace_items,
 * reciprocal_exchanges) — one chain implementation, reused across tables,
 * rather than five bespoke ones. `.or()` is a deliberate no-op (matching the
 * precedent in tests/workspace-capabilities-authorization-2026-09-08.test.ts):
 * each test sets the relevant fixture array to exactly what a real filtered
 * query would return for the persona under test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

vi.mock('@/app/api/agents/_lib/requestOrigin', () => ({
  resolveRequestOrigin: () => 'https://x.test',
}));

type Row = Record<string, unknown>;

/**
 * `filterMode: 'trust'` (the default, matching the established precedent in
 * tests/workspace-capabilities-authorization-2026-09-08.test.ts) treats
 * `.eq()` as a no-op — each test sets the table's fixture array to exactly
 * what a real filtered query would return for the scenario under test, so no
 * fixture row needs every real column populated. `'real'` actually applies
 * accumulated `.eq()` filters against the rows — used ONLY for
 * `research_objects`, where `getObserverRound`'s `.eq('object_kind',...)
 * .eq('object_id',...).maybeSingle()` must distinguish an artifact row from
 * an observer-round row inside the SAME fixture array rather than returning
 * whichever happens to be first.
 */
function makeChain(rows: Row[], filterMode: 'trust' | 'real' = 'trust') {
  const filters: Array<[string, unknown]> = [];
  const chain: Record<string, unknown> = {};
  chain.eq = (col: string, val: unknown) => {
    filters.push([col, val]);
    return chain;
  };
  chain.or = () => chain;
  chain.order = () => chain;
  chain.limit = () => chain;
  const applyFilters = () =>
    filterMode === 'real' ? rows.filter((r) => filters.every(([c, v]) => r[c] === v)) : rows;
  chain.maybeSingle = async () => ({ data: applyFilters()[0] ?? null, error: null });
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve({ data: applyFilters(), error: null }).then(resolve, reject);
  return chain;
}

let grantRows: Row[] = [];
let researchObjectRows: Row[] = [];
let experimentResultRows: Row[] = [];
let agreementRows: Row[] = [];
let workspaceItemRows: Row[] = [];
let exchangeRows: Row[] = [];

const TABLES: Record<string, () => Row[]> = {
  access_grants: () => grantRows,
  research_objects: () => researchObjectRows,
  experiment_results: () => experimentResultRows,
  reviewer_agreement_authorizations: () => agreementRows,
  experiment_workspace_items: () => workspaceItemRows,
  reciprocal_exchanges: () => exchangeRows,
};

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({
    from: (table: string) => {
      const getRows = TABLES[table];
      if (!getRows) throw new Error(`unexpected table ${table}`);
      return { select: () => makeChain(getRows(), table === 'research_objects' ? 'real' : 'trust') };
    },
  }),
}));

const mockCorpusReadPackFile = vi.fn(async (packId: string, relPath: string) => {
  if (packId !== 'irl') return null;
  if (relPath === 'collections.json') {
    return JSON.stringify({
      collections: [
        {
          id: 'col_experiments',
          items: [
            'foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md',
            'foundation/experiments/exp-p1-representation-runtime-gauntlet/STAGE-0_HANDOFF.md',
            'foundation/experiments/exp-011-structural-invariance/README.md',
          ],
        },
      ],
    });
  }
  return null;
});
vi.mock('@/services/knowledge/packCorpusStore', () => ({
  corpusReadPackFile: (...args: [string, string]) => mockCorpusReadPackFile(...args),
}));

import { GET as workspaceStateGET } from '@/app/api/participation/workspace-state/route';

const EXP_P1_WORKSPACE_ID = 'autonomi-review-exp-p1';
const EXP_P1_EXPERIMENT_ID = 'EXP-P1';
const OCSGA_WORKSPACE_ID = 'ocsga-boundary-research';

function makeRequest(url: string): NextRequest {
  const parsed = new URL(url);
  return { nextUrl: parsed, headers: new Headers() } as unknown as NextRequest;
}

function persona(opts: { personaId: string | null; isAdmin?: boolean }) {
  return opts.personaId
    ? { personaId: opts.personaId, cartridgeFlags: { isAdmin: Boolean(opts.isAdmin) } }
    : null;
}

const FROZEN_CRYSTAL_ROW: Row = {
  object_kind: 'artifact',
  object_id: 'EXP-P1/crystal-vP2',
  payload: { kind: 'crystal-version', experimentId: 'EXP-P1', contentHash: 'a'.repeat(64), commitmentHash: 'b'.repeat(64), frozenAt: '2026-09-06T10:53:19.707Z' },
  lifecycle_state: 'frozen',
  receipt_id: 'receipt-1',
  created_at: '2026-09-06T10:53:19.707Z',
  updated_at: '2026-09-06T10:53:19.707Z',
};

beforeEach(() => {
  mockGetActivePersona.mockReset();
  grantRows = [];
  researchObjectRows = [];
  experimentResultRows = [];
  agreementRows = [];
  workspaceItemRows = [];
  exchangeRows = [];
});

describe('GET /api/participation/workspace-state', () => {
  it('401s an anonymous caller', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await workspaceStateGET(makeRequest(`https://x.test/api/participation/workspace-state?workspaceId=${EXP_P1_WORKSPACE_ID}`));
    expect(res.status).toBe(401);
  });

  it('400s a missing workspaceId', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'p1', isAdmin: true }));
    const res = await workspaceStateGET(makeRequest('https://x.test/api/participation/workspace-state'));
    expect(res.status).toBe(400);
  });

  it('404s an unknown workspaceId', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'p1', isAdmin: true }));
    const res = await workspaceStateGET(makeRequest('https://x.test/api/participation/workspace-state?workspaceId=not-a-real-workspace'));
    expect(res.status).toBe(404);
  });

  it('403s a caller scoped to a DIFFERENT experiment only — wrong scope', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'p2', isAdmin: false }));
    grantRows = [{ role: 'reviewer', allowed_experiments: ['EXP-011'] }];
    const res = await workspaceStateGET(makeRequest(`https://x.test/api/participation/workspace-state?workspaceId=${EXP_P1_WORKSPACE_ID}`));
    expect(res.status).toBe(403);
  });

  it('403s a caller with no active grant at all — models revoked/expired', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'p3', isAdmin: false }));
    grantRows = [];
    const res = await workspaceStateGET(makeRequest(`https://x.test/api/participation/workspace-state?workspaceId=${EXP_P1_WORKSPACE_ID}`));
    expect(res.status).toBe(403);
  });

  it('an admin resolves live EXP-P1 state: frozen crystal, awaiting-observer-assignment phase, Review stage, documents excluding Stage-0', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'p1', isAdmin: true }));
    researchObjectRows = [FROZEN_CRYSTAL_ROW];
    const res = await workspaceStateGET(makeRequest(`https://x.test/api/participation/workspace-state?workspaceId=${EXP_P1_WORKSPACE_ID}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    const { state } = body;
    expect(state.experimentId).toBe(EXP_P1_EXPERIMENT_ID);
    expect(state.role).toBe('admin-preview');
    expect(state.accessBasis).toBe('admin');
    expect(state.experimentLifecycle.isFrozen).toBe(true);
    expect(state.experimentLifecycle.phase).toBe('awaiting-observer-assignment');
    expect(state.currentPhase).toBe('awaiting-observer-assignment');
    expect(state.currentStage).toBe('Review');
    expect(state.documents.some((d: { path: string }) => d.path.includes('STAGE-0_HANDOFF'))).toBe(false);
    expect(state.documents.length).toBeGreaterThan(0);
    expect(Array.isArray(state.activity)).toBe(true);
    expect(state.activity[0].objectId).toBe('EXP-P1/crystal-vP2');
    expect(state.lockerScope.available).toBe(false);
  });

  it('a scoped EXP-P1 reviewer (non-admin) reaches the same live state, with their own role reported', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'reviewer-1', isAdmin: false }));
    grantRows = [{ role: 'reviewer', allowed_experiments: [EXP_P1_EXPERIMENT_ID] }];
    researchObjectRows = [FROZEN_CRYSTAL_ROW];
    const res = await workspaceStateGET(makeRequest(`https://x.test/api/participation/workspace-state?workspaceId=${EXP_P1_WORKSPACE_ID}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.state.role).toBe('reviewer');
    expect(body.state.accessBasis).toBe('membership');
    expect(body.state.currentStage).toBe('Review');
    expect(body.state.reviewState).not.toBeNull();
    expect(body.state.reviewState.agreement.authorizationStatus).toBe('not-authorized');
  });

  // PER-ARTIFACT AUTHORIZATION PARITY (2026-09-11, message 3 item 7 /
  // Progressive Surface acceptance requirement): "every artifact surfaced in
  // an experiment dossier/projection must be retrievable by the same
  // principal through its canonical authorization path" —
  // GET /api/codex/packs/[packId]/file, which gates the `irl` pack on admin
  // OR `resolveExperimentReviewGrant` (REVIEW_VIEW_READABLE_ROLES ONLY: never
  // a role-agnostic workspace-membership check). Without the resolver's own
  // matching gate, a workspace member holding a real research-lab grant in a
  // role OUTSIDE that list (e.g. 'research-participant' — the exact role the
  // OCSGA test above already uses for plain membership) would see `documents`
  // populated here and then 403 on every single one when actually opened.
  it('a workspace member with a NON-review-readable role sees documents as EMPTY — not populated-then-403', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'participant-1', isAdmin: false }));
    grantRows = [{ role: 'research-participant', allowed_experiments: [EXP_P1_EXPERIMENT_ID] }];
    researchObjectRows = [FROZEN_CRYSTAL_ROW];
    const res = await workspaceStateGET(makeRequest(`https://x.test/api/participation/workspace-state?workspaceId=${EXP_P1_WORKSPACE_ID}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    // The primary gate is role-agnostic — this caller DOES see the workspace.
    expect(body.state.accessBasis).toBe('membership');
    expect(body.state.role).toBe('research-participant');
    // But documents — every one of which requires resolveExperimentReviewGrant
    // to actually fetch — are empty, not silently offering unreachable links.
    expect(body.state.documents).toEqual([]);
  });

  it('a NOT-yet-frozen experiment resolves pre-freeze-review honestly (no fixture rows at all)', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'p1', isAdmin: true }));
    researchObjectRows = [];
    const res = await workspaceStateGET(makeRequest(`https://x.test/api/participation/workspace-state?workspaceId=${EXP_P1_WORKSPACE_ID}`));
    const body = await res.json();
    expect(body.state.experimentLifecycle.isFrozen).toBe(false);
    expect(body.state.experimentLifecycle.phase).toBe('pre-freeze-review');
    expect(body.state.currentStage).toBe('Review');
    expect(body.state.pendingHumanDecisions.length).toBeGreaterThan(0);
  });

  it('a cohort/programme workspace with no experimentId (OCSGA) resolves an honest null lifecycle, never a fabricated stage', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'p4', isAdmin: false }));
    grantRows = [{ role: 'research-participant', allowed_experiments: [OCSGA_WORKSPACE_ID] }];
    exchangeRows = [];
    const res = await workspaceStateGET(makeRequest(`https://x.test/api/participation/workspace-state?workspaceId=${OCSGA_WORKSPACE_ID}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    const { state } = body;
    expect(state.experimentId).toBeNull();
    expect(state.experimentLifecycle).toBeNull();
    expect(state.currentPhase).toBeNull();
    expect(state.currentStage).toBeNull();
    expect(state.documents).toEqual([]);
    expect(state.capabilities.exchangeAvailable).toBe(false);
    expect(state.activity.available).toBe(false);
  });

  it('OCSGA resolves the caller\'s own real Reciprocal Artifact Exchange (workspace-bound, no experimentId) — the generalization', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'ian-shaped', isAdmin: false }));
    grantRows = [{ role: 'reviewer', allowed_experiments: [OCSGA_WORKSPACE_ID] }];
    exchangeRows = [
      {
        id: 'exch-1',
        title: 'OCSGA Architecture Comparison',
        purpose: 'Compare architectures',
        initiator_persona_id: 'ian-shaped',
        counterparty_persona_id: 'counterparty-1',
        status: 'EXCHANGED',
        disclosure_policy: 'mutual',
        confidentiality_class: 'restricted',
        permitted_purpose: 'Compare architectures',
        ownership_declaration: 'each party owns their own artifact',
        parent_experiment_id: OCSGA_WORKSPACE_ID,
        created_at: '2026-08-01T00:00:00Z',
      },
      {
        id: 'exch-unrelated',
        title: 'Unrelated exchange',
        purpose: 'Unrelated',
        initiator_persona_id: 'ian-shaped',
        counterparty_persona_id: null,
        status: 'DRAFT',
        disclosure_policy: 'mutual',
        confidentiality_class: 'restricted',
        permitted_purpose: 'Unrelated',
        ownership_declaration: 'n/a',
        parent_experiment_id: 'some-other-workspace',
        created_at: '2026-08-01T00:00:00Z',
      },
    ];
    const res = await workspaceStateGET(makeRequest(`https://x.test/api/participation/workspace-state?workspaceId=${OCSGA_WORKSPACE_ID}`));
    const body = await res.json();
    expect(body.state.capabilities.exchangeAvailable).toBe(true);
    expect(body.state.exchangeIds).toEqual(['exch-1']);
  });

  // The full four-principal-shape acceptance matrix (admin / scoped-member /
  // wrong-scope / anonymous), repeated for OCSGA specifically — the resolver's
  // primary gate is one shared code path for both experiments (NO_HARDCODED
  // rule, this file's own header), but a shared code path is an argument for
  // why it SHOULD hold, not a substitute for asserting it does on the second
  // real instance too.
  it('401s an anonymous caller against OCSGA — same gate as EXP-P1', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await workspaceStateGET(makeRequest(`https://x.test/api/participation/workspace-state?workspaceId=${OCSGA_WORKSPACE_ID}`));
    expect(res.status).toBe(401);
  });

  it('403s a caller scoped to a DIFFERENT experiment only against OCSGA — wrong scope', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'p5', isAdmin: false }));
    grantRows = [{ role: 'reviewer', allowed_experiments: [EXP_P1_EXPERIMENT_ID] }];
    const res = await workspaceStateGET(makeRequest(`https://x.test/api/participation/workspace-state?workspaceId=${OCSGA_WORKSPACE_ID}`));
    expect(res.status).toBe(403);
  });

  it('an admin resolves OCSGA state — same admin bypass as EXP-P1, no experiment-specific branch', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'p1', isAdmin: true }));
    exchangeRows = [];
    const res = await workspaceStateGET(makeRequest(`https://x.test/api/participation/workspace-state?workspaceId=${OCSGA_WORKSPACE_ID}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.state.accessBasis).toBe('admin');
    expect(body.state.experimentId).toBeNull();
  });

  // CROSS-EXPERIMENT LEAKAGE: a grant scoped to ONE experiment must never
  // resolve the OTHER's state, in either direction — the symmetric case to
  // the two wrong-scope tests above (EXP-P1-scoped caller denied OCSGA), now
  // OCSGA-scoped caller denied EXP-P1.
  it('403s an OCSGA-scoped caller requesting EXP-P1 — no cross-experiment leakage in the other direction', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'p6', isAdmin: false }));
    grantRows = [{ role: 'reviewer', allowed_experiments: [OCSGA_WORKSPACE_ID] }];
    const res = await workspaceStateGET(makeRequest(`https://x.test/api/participation/workspace-state?workspaceId=${EXP_P1_WORKSPACE_ID}`));
    expect(res.status).toBe(403);
  });

  it('milestones/blockers project from the real experiment_workspace_items table, honestly empty when nothing was seeded', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'p1', isAdmin: true }));
    workspaceItemRows = [];
    const res = await workspaceStateGET(makeRequest(`https://x.test/api/participation/workspace-state?workspaceId=${EXP_P1_WORKSPACE_ID}`));
    const body = await res.json();
    expect(body.state.nextMilestone).toBeNull();
    expect(body.state.blockers).toEqual([]);
  });

  it('a seeded open milestone surfaces as nextMilestone', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'p1', isAdmin: true }));
    workspaceItemRows = [
      {
        id: 'm1',
        workspace_id: EXP_P1_WORKSPACE_ID,
        kind: 'milestone',
        title: 'Assign observer round',
        detail: null,
        status: 'open',
        layer: null,
        owner_agent_id: null,
        due_date: '2026-09-15',
        linked_intent_id: null,
        linked_agreement_id: null,
        created_at: '2026-09-08T00:00:00Z',
        updated_at: '2026-09-08T00:00:00Z',
      },
    ];
    const res = await workspaceStateGET(makeRequest(`https://x.test/api/participation/workspace-state?workspaceId=${EXP_P1_WORKSPACE_ID}`));
    const body = await res.json();
    expect(body.state.nextMilestone).toEqual({ title: 'Assign observer round', dueDate: '2026-09-15' });
  });
});
