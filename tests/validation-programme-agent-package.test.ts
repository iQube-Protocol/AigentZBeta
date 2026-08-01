/**
 * GET /api/journey/validation-programme/agent-package — the Validation
 * Programme's JSON Agent Package manifest (operator instruction 2026-08-01,
 * Phase 2). Every real dependency mocked; exercises the route handler
 * directly, same pattern as tests/horizen-register-status-route.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

vi.mock('@/app/api/agents/_lib/requestOrigin', () => ({
  resolveRequestOrigin: () => 'https://dev-beta.aigentz.me',
}));

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

const FIXTURE_COLLECTIONS = JSON.stringify({
  collections: [
    {
      id: 'col_experiments',
      items: [
        'foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md',
        'foundation/experiments/exp-p1-representation-runtime-gauntlet/STAGE-0_HANDOFF.md',
        'foundation/experiments/exp-p2-consequential-performance/README.md',
        'foundation/experiments/exp-011-structural-invariance/README.md',
      ],
    },
  ],
});
vi.mock('@/services/knowledge/packCorpusStore', () => ({
  corpusReadPackFile: vi.fn(async () => FIXTURE_COLLECTIONS),
}));

import { GET as agentPackageRoute } from '@/app/api/journey/validation-programme/agent-package/route';
import { RESEARCH_WORKSPACE_ROLE_AUTHORITY } from '@/services/research/researchWorkspaceRoles';

function makeRequest(): NextRequest {
  return {
    headers: { get: () => null },
    nextUrl: { origin: 'https://dev-beta.aigentz.me' },
  } as unknown as NextRequest;
}

beforeEach(() => {
  mockGetActivePersona.mockReset();
  grantRows = [];
});

describe('GET validation-programme/agent-package', () => {
  it('401s when unauthenticated', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await agentPackageRoute(makeRequest());
    expect(res.status).toBe(401);
  });

  it('403s a caller with no admin flag and no qualifying research-lab grant', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-outsider-1', cartridgeFlags: {} });
    grantRows = [];
    const res = await agentPackageRoute(makeRequest());
    expect(res.status).toBe(403);
  });

  it('403s a caller whose grant is scoped to a DIFFERENT experiment only', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-other-exp', cartridgeFlags: {} });
    grantRows = [{ role: 'reviewer', allowed_experiments: ['EXP-P2'] }];
    const res = await agentPackageRoute(makeRequest());
    expect(res.status).toBe(403);
  });

  it('200s an admin caller with no scoped grant, honestly labelled admin-preview', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-admin-1', cartridgeFlags: { isAdmin: true } });
    grantRows = [];
    const res = await agentPackageRoute(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.package.reviewer.role).toBe('admin-preview');
    expect(json.package.reviewer.allowedExperiments).toBe('all');
    expect(json.package.reviewer.note).toMatch(/admin preview/i);
    // No real grant to project an authority ceiling from — never fabricated.
    expect(json.package.permittedAuthority).toBeNull();
  });

  it('200s a scoped reviewer grant, reporting the REAL role and its authority ceiling', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-reviewer-1', cartridgeFlags: {} });
    grantRows = [{ role: 'reviewer', allowed_experiments: ['EXP-P1'] }];
    const res = await agentPackageRoute(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.package.reviewer.role).toBe('reviewer');
    expect(json.package.reviewer.allowedExperiments).toEqual(['EXP-P1']);
    expect(json.package.permittedAuthority).toEqual(RESEARCH_WORKSPACE_ROLE_AUTHORITY.reviewer);
    // The authority ceiling withholds exactly what governance requires.
    expect(json.package.permittedAuthority.mayFreeze).toBe(false);
    expect(json.package.permittedAuthority.mayCanonize).toBe(false);
    expect(json.package.permittedAuthority.mayGrantStanding).toBe(false);
  });

  it('never leaks the raw personaId — only the T2-safe commitment ref', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-reviewer-secret-uuid', cartridgeFlags: {} });
    grantRows = [{ role: 'reviewer', allowed_experiments: null }];
    const res = await agentPackageRoute(makeRequest());
    const raw = await res.text();
    expect(raw).not.toContain('persona-reviewer-secret-uuid');
  });

  it('resolves EXP-P1 document resources from the real col_experiments collection, excluding sibling experiments', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-reviewer-2', cartridgeFlags: {} });
    grantRows = [{ role: 'reviewer', allowed_experiments: null }];
    const res = await agentPackageRoute(makeRequest());
    const json = await res.json();
    const paths = json.package.documentResources.map((d: { path: string }) => d.path);
    expect(paths).toEqual([
      'foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md',
      'foundation/experiments/exp-p1-representation-runtime-gauntlet/STAGE-0_HANDOFF.md',
    ]);
    for (const d of json.package.documentResources) {
      expect(d.url).toContain('/api/codex/packs/irl/file?path=');
    }
  });

  it('points the Crystal Review endpoint at the real crystal route for EXP-P1', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-reviewer-3', cartridgeFlags: {} });
    grantRows = [{ role: 'reviewer', allowed_experiments: null }];
    const res = await agentPackageRoute(makeRequest());
    const json = await res.json();
    expect(json.package.crystalReviewEndpoint).toBe('https://dev-beta.aigentz.me/api/research/crystal/EXP-P1');
  });

  it('names the Locker invitation claim as the ONLY agreement/acknowledgement mechanism — no bespoke signing UI', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-reviewer-4', cartridgeFlags: {} });
    grantRows = [{ role: 'reviewer', allowed_experiments: null }];
    const res = await agentPackageRoute(makeRequest());
    const json = await res.json();
    expect(json.package.agreementAndAcknowledgement.mechanism).toMatch(/x409|invitation/i);
    expect(json.package.agreementAndAcknowledgement.claimAccessInvitationEndpoint).toContain('/api/participation/claim');
    expect(json.package.agreementAndAcknowledgement.claimAgreementEndpoint).toContain('/api/polity-passport/locker/claim-agreement');
  });

  it('states every required prohibition: governance/freeze, corpus mutation, standing changes, experiment execution', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-reviewer-5', cartridgeFlags: {} });
    grantRows = [{ role: 'reviewer', allowed_experiments: null }];
    const res = await agentPackageRoute(makeRequest());
    const json = await res.json();
    const joined = (json.package.prohibitions as string[]).join(' \n ').toLowerCase();
    expect(joined).toMatch(/freeze/);
    expect(joined).toMatch(/ratif/);
    expect(joined).toMatch(/corpus/);
    expect(joined).toMatch(/standing/);
    expect(joined).toMatch(/experiment.*(run|execut)/);
    expect(joined).toMatch(/unless.*authoriz/);
  });

  it('reports all four journey stages with their real permittedActions — never a hand-copied summary', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-reviewer-6', cartridgeFlags: {} });
    grantRows = [{ role: 'reviewer', allowed_experiments: null }];
    const res = await agentPackageRoute(makeRequest());
    const json = await res.json();
    expect(json.package.stages.map((s: { id: string }) => s.id)).toEqual([
      'overview',
      'crystal-review',
      'submit-review',
      'experiment-progress',
    ]);
    const crystalStage = json.package.stages.find((s: { id: string }) => s.id === 'crystal-review');
    expect(crystalStage.permittedActions).toEqual(['comment', 'recommend-change', 'contest-finding']);
  });
});
