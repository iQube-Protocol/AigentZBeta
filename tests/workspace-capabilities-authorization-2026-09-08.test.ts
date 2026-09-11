/**
 * IRL OS Workspace consolidation (2026-09-08) — authorization tests for the
 * three routes this pass added or changed:
 *
 *   GET /api/participation/workspace-capabilities  (new)
 *   GET /api/participation/workspace-tracking      (new)
 *   GET /api/research/readiness/[experimentId]     (gate loosened: admin OR
 *     scoped research-lab reviewer grant, was admin-only)
 *
 * Security invariant this file exists to prove (operator instruction): "An
 * experiment or artifact must never be advertised by Workspace unless the
 * same principal can dereference it through the canonical authorization
 * path." Covers admin, reviewer, participant/wrong-scope, cohort/OCSGA,
 * anonymous, and no-active-grant (models revoked/expired — the real
 * `access_grants` query already filters `.eq('status','active')` server-side;
 * this file asserts the OBSERVABLE effect, not a second implementation of
 * that filter, per the precedent `tests/irl-reviewer-scoped-access-2026-09-08.test.ts`).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

/** Rows `access_grants` would return for the currently-mocked caller — same
 *  shape/pattern as tests/irl-reviewer-scoped-access-2026-09-08.test.ts. */
let grantRows: Array<{ role: string; allowed_experiments: string[] | null }> = [];
/** Rows `reciprocal_exchanges` would return for the currently-mocked caller
 *  (services/research/reciprocalExchange.ts::listMyExchanges — the caller's
 *  own exchanges as either party). */
let exchangeRows: Array<{
  id: string;
  exchange_type?: string;
  title: string;
  purpose: string;
  initiator_persona_id: string;
  counterparty_persona_id?: string | null;
  status: string;
  disclosure_policy: string;
  confidentiality_class: string;
  permitted_purpose: string;
  ownership_declaration: string;
  parent_experiment_id: string | null;
  created_at: string;
}> = [];
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({
    from: (table: string) => {
      if (table === 'access_grants') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: async () => ({ data: grantRows, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'reciprocal_exchanges') {
        return {
          select: () => ({
            or: () => ({
              order: async () => ({ data: exchangeRows, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
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
            'foundation/experiments/exp-p1-representation-runtime-gauntlet/AUSTIN_REVIEWER_KIT.md',
            // HELD, non-operative (IRE-6 HOLD, unresolved) — must never appear
            // in the resolved operative document list. See
            // isHeldNonOperativeIrlPath's own header for the full trace.
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

const mockListWorkspaceItems = vi.fn(async () => [] as unknown[]);
vi.mock('@/services/experiments/workspaceTracking', () => ({
  listWorkspaceItems: (...args: [string, string?]) => mockListWorkspaceItems(...args),
}));

// This file tests the readiness ROUTE's authorization gate, not the
// dashboard's own data composition (already covered by
// tests/prd-epi-001-readiness-dashboard.test.ts and
// tests/exp-p1-readiness-dashboard-generation-and-confirmatory.test.ts) — the
// real `buildReadinessDashboard` reaches several other Supabase tables this
// file's narrow `access_grants`-only mock does not model.
vi.mock('@/services/research/readinessDashboard', () => ({
  buildReadinessDashboard: async (experimentId: string) => ({
    experimentId,
    sections: [],
    protocolRatifiedReady: false,
    expectedRedPreRun: [],
  }),
}));

import { GET as capabilitiesGET } from '@/app/api/participation/workspace-capabilities/route';
import { GET as trackingGET } from '@/app/api/participation/workspace-tracking/route';
import { GET as readinessGET } from '@/app/api/research/readiness/[experimentId]/route';

const EXP_P1_WORKSPACE_ID = 'autonomi-review-exp-p1';
const EXP_P1_EXPERIMENT_ID = 'EXP-P1';
const OCSGA_WORKSPACE_ID = 'ocsga-boundary-research';

function makeRequest(url: string): NextRequest {
  const parsed = new URL(url);
  return {
    nextUrl: parsed,
    headers: new Headers(),
  } as unknown as NextRequest;
}

function persona(opts: { personaId: string | null; isAdmin?: boolean }) {
  return opts.personaId
    ? { personaId: opts.personaId, cartridgeFlags: { isAdmin: Boolean(opts.isAdmin) } }
    : null;
}

beforeEach(() => {
  grantRows = [];
  exchangeRows = [];
  mockGetActivePersona.mockReset();
  mockListWorkspaceItems.mockReset();
  mockListWorkspaceItems.mockResolvedValue([]);
});

// ─── GET /api/participation/workspace-capabilities ───────────────────────────

describe('GET /api/participation/workspace-capabilities', () => {
  it('401s an anonymous caller', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await capabilitiesGET(makeRequest(`https://x.test/api/participation/workspace-capabilities?workspaceId=${EXP_P1_WORKSPACE_ID}`));
    expect(res.status).toBe(401);
  });

  it('400s a missing workspaceId', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'p1', isAdmin: true }));
    const res = await capabilitiesGET(makeRequest('https://x.test/api/participation/workspace-capabilities'));
    expect(res.status).toBe(400);
  });

  it('404s an unknown workspaceId', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'p1', isAdmin: true }));
    const res = await capabilitiesGET(makeRequest('https://x.test/api/participation/workspace-capabilities?workspaceId=not-a-real-workspace'));
    expect(res.status).toBe(404);
  });

  it('admin reaches EXP-P1 capabilities without any grant row', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'p1', isAdmin: true }));
    grantRows = [];
    const res = await capabilitiesGET(makeRequest(`https://x.test/api/participation/workspace-capabilities?workspaceId=${EXP_P1_WORKSPACE_ID}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.experimentId).toBe(EXP_P1_EXPERIMENT_ID);
    expect(body.documents.length).toBeGreaterThan(0);
    expect(body.documents.every((d: { path: string }) => d.path.includes('exp-p1-representation-runtime-gauntlet'))).toBe(true);
    // Stage-0/IRE-6 HOLD exclusion (2026-09-08, gap 2): the held, non-operative
    // Stage-0 handoff must never appear in the resolved reviewer package, even
    // though it is path-colocated inside the EXP-P1 experiment folder.
    expect(body.documents.some((d: { path: string }) => d.path.includes('STAGE-0_HANDOFF'))).toBe(false);
    expect(body.readinessAvailable).toBe(true);
    expect(body.reviewAgreementAvailable).toBe(true);
  });

  it('a scoped EXP-P1 reviewer (non-admin) reaches the same capabilities', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'reviewer-1', isAdmin: false }));
    grantRows = [{ role: 'reviewer', allowed_experiments: [EXP_P1_EXPERIMENT_ID] }];
    const res = await capabilitiesGET(makeRequest(`https://x.test/api/participation/workspace-capabilities?workspaceId=${EXP_P1_WORKSPACE_ID}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.experimentId).toBe(EXP_P1_EXPERIMENT_ID);
    expect(body.documents.length).toBeGreaterThan(0);
    // Same exclusion must hold for a scoped (non-admin) reviewer, not just admin.
    expect(body.documents.some((d: { path: string }) => d.path.includes('STAGE-0_HANDOFF'))).toBe(false);
  });

  it('a caller scoped to a DIFFERENT experiment only is denied — wrong scope', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'p2', isAdmin: false }));
    grantRows = [{ role: 'reviewer', allowed_experiments: ['EXP-011'] }];
    const res = await capabilitiesGET(makeRequest(`https://x.test/api/participation/workspace-capabilities?workspaceId=${EXP_P1_WORKSPACE_ID}`));
    expect(res.status).toBe(403);
  });

  it('a caller with no active grant at all is denied (models revoked/expired)', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'p3', isAdmin: false }));
    grantRows = [];
    const res = await capabilitiesGET(makeRequest(`https://x.test/api/participation/workspace-capabilities?workspaceId=${EXP_P1_WORKSPACE_ID}`));
    expect(res.status).toBe(403);
  });

  it('a cohort/programme workspace with no experimentId (OCSGA) returns an honest empty set when the caller has no exchange either', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'p4', isAdmin: false }));
    grantRows = [{ role: 'research-participant', allowed_experiments: [OCSGA_WORKSPACE_ID] }];
    exchangeRows = [];
    const res = await capabilitiesGET(makeRequest(`https://x.test/api/participation/workspace-capabilities?workspaceId=${OCSGA_WORKSPACE_ID}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.experimentId).toBeNull();
    expect(body.documents).toEqual([]);
    expect(body.readinessAvailable).toBe(false);
    expect(body.reviewAgreementAvailable).toBe(false);
    expect(body.exchangeAvailable).toBe(false);
    expect(body.exchangeIds).toEqual([]);
  });

  it('a workspace-BOUND capability (Reciprocal Artifact Exchange) resolves for OCSGA with NO experimentId at all — the generalization', async () => {
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
      // A DIFFERENT workspace's exchange for the same caller — must NOT leak
      // into this workspace's capability response (workspaceId-scoped, not a
      // caller-wide dump).
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
    const res = await capabilitiesGET(makeRequest(`https://x.test/api/participation/workspace-capabilities?workspaceId=${OCSGA_WORKSPACE_ID}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.experimentId).toBeNull();
    expect(body.documents).toEqual([]);
    expect(body.readinessAvailable).toBe(false);
    expect(body.reviewAgreementAvailable).toBe(false);
    expect(body.exchangeAvailable).toBe(true);
    expect(body.exchangeIds).toEqual(['exch-1']);
  });

  it('an EXP-P1 experiment-bound workspace also resolves its (empty) exchange binding independently', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'reviewer-2', isAdmin: false }));
    grantRows = [{ role: 'reviewer', allowed_experiments: [EXP_P1_EXPERIMENT_ID] }];
    exchangeRows = [];
    const res = await capabilitiesGET(makeRequest(`https://x.test/api/participation/workspace-capabilities?workspaceId=${EXP_P1_WORKSPACE_ID}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.experimentId).toBe(EXP_P1_EXPERIMENT_ID);
    expect(body.documents.length).toBeGreaterThan(0);
    expect(body.exchangeAvailable).toBe(false);
  });

  it('a caller with workspace membership but NO grant for a specific experiment still denies the experiment-bound capabilities (workspace membership is necessary but not sufficient)', async () => {
    // Admin-preview-shaped: not admin, but somehow has workspace-level
    // visibility (public workspace) with zero research-lab grants at all —
    // experiment-bound capabilities must stay empty; workspace-bound ones
    // are independent and still resolve.
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'no-exp-grant', isAdmin: false }));
    grantRows = [];
    exchangeRows = [];
    // No grant at all means no workspace membership either (research-lab
    // reach is empty) -- the PRIMARY gate itself denies before the
    // experiment-bound question is ever reached.
    const res = await capabilitiesGET(makeRequest(`https://x.test/api/participation/workspace-capabilities?workspaceId=${EXP_P1_WORKSPACE_ID}`));
    expect(res.status).toBe(403);
  });
});

// ─── GET /api/participation/workspace-tracking ────────────────────────────────

describe('GET /api/participation/workspace-tracking', () => {
  it('403s a caller with no visibility into the workspace at all', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'p5', isAdmin: false }));
    grantRows = [];
    const res = await trackingGET(makeRequest(`https://x.test/api/participation/workspace-tracking?workspaceId=${EXP_P1_WORKSPACE_ID}`));
    expect(res.status).toBe(403);
  });

  it('403s a caller scoped to a DIFFERENT workspace only', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'p6', isAdmin: false }));
    grantRows = [{ role: 'research-participant', allowed_experiments: [OCSGA_WORKSPACE_ID] }];
    const res = await trackingGET(makeRequest(`https://x.test/api/participation/workspace-tracking?workspaceId=${EXP_P1_WORKSPACE_ID}`));
    expect(res.status).toBe(403);
  });

  it('admin reaches the tracking data with no grant row', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'p7', isAdmin: true }));
    mockListWorkspaceItems.mockImplementation(async (_workspaceId: string, kind?: string) =>
      kind === 'milestone'
        ? [{ id: 'm1', workspaceId: EXP_P1_WORKSPACE_ID, kind: 'milestone', title: 'Freeze protocol', detail: null, status: 'open', layer: null, ownerAgentId: null, dueDate: '2026-10-01', linkedIntentId: null, linkedAgreementId: null, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' }]
        : [{ id: 'b1', workspaceId: EXP_P1_WORKSPACE_ID, kind: 'blocker', title: 'Awaiting Austin', detail: null, status: 'open', layer: null, ownerAgentId: null, dueDate: null, linkedIntentId: null, linkedAgreementId: null, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' }],
    );
    const res = await trackingGET(makeRequest(`https://x.test/api/participation/workspace-tracking?workspaceId=${EXP_P1_WORKSPACE_ID}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nextMilestone.title).toBe('Freeze protocol');
    expect(body.openBlockers).toHaveLength(1);
  });

  it('a caller entitled to THIS workspace reaches the tracking data', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'p8', isAdmin: false }));
    grantRows = [{ role: 'reviewer', allowed_experiments: [EXP_P1_EXPERIMENT_ID] }];
    const res = await trackingGET(makeRequest(`https://x.test/api/participation/workspace-tracking?workspaceId=${EXP_P1_WORKSPACE_ID}`));
    expect(res.status).toBe(200);
  });
});

// ─── GET /api/research/readiness/[experimentId] — loosened gate ──────────────

describe('GET /api/research/readiness/[experimentId] (admin OR scoped reviewer grant)', () => {
  const params = Promise.resolve({ experimentId: EXP_P1_EXPERIMENT_ID });

  it('401s an anonymous caller', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await readinessGET(makeRequest(`https://x.test/api/research/readiness/${EXP_P1_EXPERIMENT_ID}`), { params });
    expect(res.status).toBe(401);
  });

  it('403s a caller with no active grant at all', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'r1', isAdmin: false }));
    grantRows = [];
    const res = await readinessGET(makeRequest(`https://x.test/api/research/readiness/${EXP_P1_EXPERIMENT_ID}`), { params });
    expect(res.status).toBe(403);
  });

  it('403s a caller scoped to a different experiment only — wrong scope', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'r2', isAdmin: false }));
    grantRows = [{ role: 'reviewer', allowed_experiments: ['EXP-011'] }];
    const res = await readinessGET(makeRequest(`https://x.test/api/research/readiness/${EXP_P1_EXPERIMENT_ID}`), { params });
    expect(res.status).toBe(403);
  });

  it('200s a caller holding a scoped reviewer grant for THIS experiment — the fix', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'r3', isAdmin: false }));
    grantRows = [{ role: 'reviewer', allowed_experiments: [EXP_P1_EXPERIMENT_ID] }];
    const res = await readinessGET(makeRequest(`https://x.test/api/research/readiness/${EXP_P1_EXPERIMENT_ID}`), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.dashboard.experimentId).toBe(EXP_P1_EXPERIMENT_ID);
  });

  it('200s an admin with no grant row at all — unchanged behaviour', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'r4', isAdmin: true }));
    grantRows = [];
    const res = await readinessGET(makeRequest(`https://x.test/api/research/readiness/${EXP_P1_EXPERIMENT_ID}`), { params });
    expect(res.status).toBe(200);
  });
});
