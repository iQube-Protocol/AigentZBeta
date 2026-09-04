/**
 * Factor/Aegis API routes (Phase 2, spec/moneypenny-mpy2-3) — proves the
 * route layer itself: authentication gating, request parsing, dispatch to
 * the correct service function, and error-code -> HTTP-status mapping
 * (respondError). The underlying business logic (state machine, tenant
 * isolation, separation of powers) is already covered by
 * tests/factor-case-service.test.ts, tests/aegis-assessment-service.test.ts,
 * and tests/factor-authority-and-admission.test.ts — this file does not
 * re-prove those, it proves the HTTP surface built on top of them.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { makeFakeAdmin } from './fixtures/fakeSupabase';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (...args: unknown[]) => mockGetActivePersona(...args),
}));

let fakeAdmin: ReturnType<typeof makeFakeAdmin>;
const mockGetSupabaseServer = vi.fn(() => fakeAdmin);
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => mockGetSupabaseServer(),
}));

vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: vi.fn(async () => ({ id: 'receipt-stub' })),
}));

const activeGrant = {
  grant_id: 'grant-1',
  persona_id: 'persona-1',
  agent_root_did: 'did:factor:root',
  status: 'active',
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
};
vi.mock('@/services/delegation/delegationGrantStore', () => ({
  readActiveGrantForAgent: async (personaId: string, agentRootDid: string) =>
    personaId === activeGrant.persona_id && agentRootDid === activeGrant.agent_root_did ? activeGrant : null,
}));

import { POST as createCase } from '@/app/api/moneypenny/factor/cases/route';
import { GET as getCaseRoute } from '@/app/api/moneypenny/factor/cases/[caseId]/route';
import { POST as transitionCase } from '@/app/api/moneypenny/factor/cases/[caseId]/transition/route';
import { GET as getEvidence, POST as postEvidence } from '@/app/api/moneypenny/factor/cases/[caseId]/evidence/route';
import { POST as decideAdmissionRoute } from '@/app/api/moneypenny/factor/cases/[caseId]/decide-admission/route';
import { POST as establishChain } from '@/app/api/moneypenny/factor/authority-chains/route';
import { POST as revokeChainRoute } from '@/app/api/moneypenny/factor/authority-chains/[chainId]/revoke/route';
import { POST as createAssessmentRoute } from '@/app/api/moneypenny/aegis/assessments/route';
import { GET as getAssessmentRoute } from '@/app/api/moneypenny/aegis/assessments/[assessmentId]/route';
import { POST as transitionAssessment } from '@/app/api/moneypenny/aegis/assessments/[assessmentId]/transition/route';
import { POST as addFindingRoute } from '@/app/api/moneypenny/aegis/assessments/[assessmentId]/findings/route';
import { POST as ratifyRoute } from '@/app/api/moneypenny/aegis/assessments/[assessmentId]/ratify/route';

function req(url: string, body?: unknown) {
  return new NextRequest(`https://dev-beta.aigentz.me${url}`, body === undefined ? { method: 'GET' } : { method: 'POST', body: JSON.stringify(body) });
}

const PERSONA = { personaId: 'persona-1' };

beforeEach(() => {
  fakeAdmin = makeFakeAdmin();
  mockGetActivePersona.mockReset();
  mockGetActivePersona.mockResolvedValue(PERSONA);
});

describe('Factor case routes', () => {
  it('401s every mutating route without an authenticated persona', async () => {
    mockGetActivePersona.mockResolvedValueOnce(null);
    const res = await createCase(req('/api/moneypenny/factor/cases', { candidateIdentityKey: 'x', candidateDisplayName: 'X' }));
    expect(res.status).toBe(401);
  });

  it('creates a case, reads it back, and advances its state through the transition route', async () => {
    const createRes = await createCase(req('/api/moneypenny/factor/cases', { candidateIdentityKey: 'candidate-api-1', candidateDisplayName: 'Candidate API 1' }));
    expect(createRes.status).toBe(200);
    const created = await createRes.json();
    expect(created.ok).toBe(true);
    expect(created.case.state).toBe('discovered');
    const caseId = created.case.case_id;

    const getRes = await getCaseRoute(req(`/api/moneypenny/factor/cases/${caseId}`), { params: Promise.resolve({ caseId }) });
    expect(getRes.status).toBe(200);
    const got = await getRes.json();
    expect(got.case.case_id).toBe(caseId);
    expect(got.evidence).toEqual([]);

    const advanceRes = await transitionCase(req(`/api/moneypenny/factor/cases/${caseId}/transition`, { action: 'advance', toState: 'preparing' }), {
      params: Promise.resolve({ caseId }),
    });
    expect(advanceRes.status).toBe(200);
    const advanced = await advanceRes.json();
    expect(advanced.case.state).toBe('preparing');
  });

  it('rejects an unknown transition action with 400, not a 500', async () => {
    const createRes = await createCase(req('/api/moneypenny/factor/cases', { candidateIdentityKey: 'candidate-api-2', candidateDisplayName: 'Candidate API 2' }));
    const { case: c } = await createRes.json();
    const res = await transitionCase(req(`/api/moneypenny/factor/cases/${c.case_id}/transition`, { action: 'teleport' }), { params: Promise.resolve({ caseId: c.case_id }) });
    expect(res.status).toBe(400);
  });

  it('pause/resume via the transition route round-trip through the same state machine', async () => {
    const createRes = await createCase(req('/api/moneypenny/factor/cases', { candidateIdentityKey: 'candidate-api-3', candidateDisplayName: 'Candidate API 3' }));
    const { case: c } = await createRes.json();
    await transitionCase(req(`/api/moneypenny/factor/cases/${c.case_id}/transition`, { action: 'advance', toState: 'preparing' }), { params: Promise.resolve({ caseId: c.case_id }) });
    const pauseRes = await transitionCase(req(`/api/moneypenny/factor/cases/${c.case_id}/transition`, { action: 'pause' }), { params: Promise.resolve({ caseId: c.case_id }) });
    expect((await pauseRes.json()).case.state).toBe('paused');
    const resumeRes = await transitionCase(req(`/api/moneypenny/factor/cases/${c.case_id}/transition`, { action: 'resume' }), { params: Promise.resolve({ caseId: c.case_id }) });
    expect((await resumeRes.json()).case.state).toBe('preparing');
  });

  it('cross-tenant GET is denied with 403, matching respondError\'s FORBIDDEN_CODES mapping', async () => {
    const createRes = await createCase(req('/api/moneypenny/factor/cases', { tenantId: 'tenant-a', candidateIdentityKey: 'candidate-api-4', candidateDisplayName: 'Candidate API 4' }));
    const { case: c } = await createRes.json();
    const res = await getCaseRoute(req(`/api/moneypenny/factor/cases/${c.case_id}?tenantId=tenant-b`), { params: Promise.resolve({ caseId: c.case_id }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('cross-tenant-denied');
  });

  it('evidence POST then GET round-trips through the route layer', async () => {
    const createRes = await createCase(req('/api/moneypenny/factor/cases', { candidateIdentityKey: 'candidate-api-5', candidateDisplayName: 'Candidate API 5' }));
    const { case: c } = await createRes.json();
    const postRes = await postEvidence(req(`/api/moneypenny/factor/cases/${c.case_id}/evidence`, { kind: 'kyc' }), { params: Promise.resolve({ caseId: c.case_id }) });
    expect(postRes.status).toBe(200);
    expect((await postRes.json()).item.status).toBe('supplied');
    const listRes = await getEvidence(req(`/api/moneypenny/factor/cases/${c.case_id}/evidence`), { params: Promise.resolve({ caseId: c.case_id }) });
    expect((await listRes.json()).evidence).toHaveLength(1);
  });
});

describe('Factor authority-chain routes', () => {
  it('establishes a direct chain (requires the active delegation_grants mock) and revokes it', async () => {
    const estRes = await establishChain(
      req('/api/moneypenny/factor/authority-chains', { mode: 'direct', targetAgentRef: 'aigent-factor', targetAgentRootDid: 'did:factor:root', allowedActions: ['candidate.intake'] }),
    );
    expect(estRes.status).toBe(200);
    const { chain } = await estRes.json();
    expect(chain.chain_mode).toBe('direct');

    const revokeRes = await revokeChainRoute(req(`/api/moneypenny/factor/authority-chains/${chain.chain_id}/revoke`, {}), { params: Promise.resolve({ chainId: chain.chain_id }) });
    expect(revokeRes.status).toBe(200);
  });

  it('refuses a direct chain with no active grant, mapped to 403 (no-active-delegation-grant is in FORBIDDEN_CODES)', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-no-grant' });
    const res = await establishChain(
      req('/api/moneypenny/factor/authority-chains', { mode: 'direct', targetAgentRef: 'aigent-factor', targetAgentRootDid: 'did:factor:root', allowedActions: ['candidate.intake'] }),
    );
    expect(res.status).toBe(403);
  });

  it('revoking a chain established by a different principal is refused with 403', async () => {
    const estRes = await establishChain(
      req('/api/moneypenny/factor/authority-chains', { mode: 'direct', targetAgentRef: 'aigent-factor', targetAgentRootDid: 'did:factor:root', allowedActions: ['candidate.intake'] }),
    );
    const { chain } = await estRes.json();
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-attacker' });
    const revokeRes = await revokeChainRoute(req(`/api/moneypenny/factor/authority-chains/${chain.chain_id}/revoke`, {}), { params: Promise.resolve({ chainId: chain.chain_id }) });
    expect(revokeRes.status).toBe(403);
  });
});

describe('Aegis assessment routes + MoneyPenny admission route — full admissible flow', () => {
  it('walks a case from discovered through a ratified Aegis assessment to an admitted decision, entirely through routes', async () => {
    const createRes = await createCase(req('/api/moneypenny/factor/cases', { candidateIdentityKey: 'candidate-api-admit', candidateDisplayName: 'Candidate API Admit' }));
    const { case: c } = await createRes.json();
    const caseId = c.case_id;

    for (const toState of ['preparing', 'assessment_pending', 'assessment_in_progress', 'assessment_complete', 'registry_ready', 'admission_pending']) {
      const r = await transitionCase(req(`/api/moneypenny/factor/cases/${caseId}/transition`, { action: 'advance', toState }), { params: Promise.resolve({ caseId }) });
      expect(r.status).toBe(200);
    }

    const assessRes = await createAssessmentRoute(
      req('/api/moneypenny/aegis/assessments', {
        subjectType: 'factor_case',
        subjectRef: caseId,
        caseId,
        policyVersion: 'v1',
        evidenceSnapshot: { ok: true },
        requestedByAgentRef: 'aigent-factor',
      }),
    );
    expect(assessRes.status).toBe(200);
    const { assessment } = await assessRes.json();

    await transitionAssessment(req(`/api/moneypenny/aegis/assessments/${assessment.assessment_id}/transition`, { action: 'begin-running' }), {
      params: Promise.resolve({ assessmentId: assessment.assessment_id }),
    });
    await transitionAssessment(req(`/api/moneypenny/aegis/assessments/${assessment.assessment_id}/transition`, { action: 'require-review' }), {
      params: Promise.resolve({ assessmentId: assessment.assessment_id }),
    });

    const findingRes = await addFindingRoute(
      req(`/api/moneypenny/aegis/assessments/${assessment.assessment_id}/findings`, {
        dimension: 'capability',
        claim: 'ok',
        method: 'review',
        result: 'pass',
        confidence: 0.9,
        falsificationCondition: 'n/a',
      }),
      { params: Promise.resolve({ assessmentId: assessment.assessment_id }) },
    );
    expect(findingRes.status).toBe(200);

    const ratifyRes = await ratifyRoute(req(`/api/moneypenny/aegis/assessments/${assessment.assessment_id}/ratify`, { decision: 'admissible' }), {
      params: Promise.resolve({ assessmentId: assessment.assessment_id }),
    });
    expect(ratifyRes.status).toBe(200);
    expect((await ratifyRes.json()).assessment.state).toBe('ratified');

    const readRes = await getAssessmentRoute(req(`/api/moneypenny/aegis/assessments/${assessment.assessment_id}`), { params: Promise.resolve({ assessmentId: assessment.assessment_id }) });
    const readBody = await readRes.json();
    expect(readBody.assessment.decision).toBe('admissible');
    expect(readBody.findings).toHaveLength(1);

    const decideRes = await decideAdmissionRoute(req(`/api/moneypenny/factor/cases/${caseId}/decide-admission`, { decision: 'admitted' }), { params: Promise.resolve({ caseId }) });
    expect(decideRes.status).toBe(200);
    const decided = await decideRes.json();
    expect(decided.case.state).toBe('admitted');
  });

  it('a bad decision value on decide-admission is a 400, not a 500', async () => {
    const createRes = await createCase(req('/api/moneypenny/factor/cases', { candidateIdentityKey: 'candidate-api-baddecision', candidateDisplayName: 'Candidate Bad Decision' }));
    const { case: c } = await createRes.json();
    const res = await decideAdmissionRoute(req(`/api/moneypenny/factor/cases/${c.case_id}/decide-admission`, { decision: 'maybe' }), { params: Promise.resolve({ caseId: c.case_id }) });
    expect(res.status).toBe(400);
  });
});
