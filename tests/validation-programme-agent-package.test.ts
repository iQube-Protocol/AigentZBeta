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
/**
 * Reviewer-agreement rows the package's `agreement` block is built from
 * (operator ruling, 2026-08-02). Empty by default, so the default assertion is
 * the honest one: a caller with no stored authorization reports
 * `not-authorized`, never a silent omission.
 *
 * The stub still THROWS on an unexpected table — a route that quietly starts
 * reading somewhere new should fail this suite loudly rather than pass with a
 * half-mocked dependency.
 */
let agreementRows: Array<Record<string, unknown>> = [];
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({
    from: (table: string) => {
      if (table === 'reviewer_agreement_authorizations') {
        // Both read shapes the agreement service uses: the gate's
        // persona+experiment+status query, and the any-status lookup that
        // distinguishes "revoked" from "never authorized".
        const result = async () => ({ data: agreementRows, error: null });
        const chain: Record<string, unknown> = {};
        chain.eq = () => chain;
        chain.order = () => chain;
        chain.limit = result;
        chain.then = (resolve: (v: unknown) => unknown) => result().then(resolve);
        return { select: () => chain };
      }
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

  /**
   * SUPERSEDED CLAIM CORRECTED (operator ruling, 2026-08-02).
   *
   * This canary used to assert the Locker invitation claim was the ONLY
   * agreement mechanism and that "no bespoke signing UI exists". That was true
   * when written and is now false: the Independent Reviewer Agreement is a
   * separate, canonical, experiment-scoped act with its own endpoint and its
   * own durable record. A canary defending a superseded claim is worse than no
   * canary — it actively resists the correction.
   *
   * The distinction the package must now carry: claiming an invitation ADMITS
   * you to the programme; authorizing the agreement is what permits a review
   * SUBMISSION. Two acts, two mechanisms, both named.
   */
  it('distinguishes programme ADMISSION (invitation claim) from submission AUTHORIZATION (the agreement)', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-reviewer-4', cartridgeFlags: {} });
    grantRows = [{ role: 'reviewer', allowed_experiments: null }];
    const res = await agentPackageRoute(makeRequest());
    const json = await res.json();
    const block = json.package.agreementAndAcknowledgement;
    expect(block.mechanism).toMatch(/x409|invitation/i);
    expect(block.claimAccessInvitationEndpoint).toContain('/api/participation/claim');
    expect(block.reviewerAgreementEndpoint).toContain('/api/research/reviewer-agreement');
    expect(
      block.mechanism,
      'the package must not tell an agent that no separate agreement act exists',
    ).not.toMatch(/no separate signing UI/i);
  });

  it('reports the caller’s own agreement standing, with the hash pair consent binds to', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-reviewer-4b', cartridgeFlags: {} });
    grantRows = [{ role: 'reviewer', allowed_experiments: null }];
    agreementRows = [];
    const res = await agentPackageRoute(makeRequest());
    const json = await res.json();
    const a = json.package.agreement;
    // No stored authorization → 'not-authorized', stated rather than omitted.
    expect(a.authorizationStatus).toBe('not-authorized');
    expect(a.requiresReauthorization).toBe(false);
    // The canonical hash is present BEFORE any authorization exists — it is
    // what a fresh authorization would pin, and what consent binds to.
    expect(typeof a.canonicalHash).toBe('string');
    expect(a.canonicalHash).toHaveLength(64);
    expect(a.authorizedHash).toBeNull();
    expect(a.hashMatch).toBeNull();
    expect(a.consentModel).toMatch(/exact terms/i);
    expect(a.authorizeEndpoint).toContain('/api/research/reviewer-agreement');
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
    expect(crystalStage.permittedActions).toEqual(['comment', 'recommend-change', 'contest-finding', 'submit-observer-decision']);
  });
});
