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
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({
    from: (table: string) => {
      if (table !== 'access_grants') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: async () => ({ data: grantRows, error: null }),
            }),
          }),
        }),
      };
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

  it('a cohort/programme workspace with no experimentId (OCSGA) returns an honest empty set, never a fabricated one', async () => {
    mockGetActivePersona.mockResolvedValue(persona({ personaId: 'p4', isAdmin: false }));
    grantRows = [{ role: 'research-participant', allowed_experiments: [OCSGA_WORKSPACE_ID] }];
    const res = await capabilitiesGET(makeRequest(`https://x.test/api/participation/workspace-capabilities?workspaceId=${OCSGA_WORKSPACE_ID}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.experimentId).toBeNull();
    expect(body.documents).toEqual([]);
    expect(body.readinessAvailable).toBe(false);
    expect(body.reviewAgreementAvailable).toBe(false);
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
