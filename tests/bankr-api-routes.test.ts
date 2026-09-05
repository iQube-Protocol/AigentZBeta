/**
 * Bankr HTTP routes (Factor + Aegis Bankr PRD, Phase 6) — proves the route
 * layer itself: authentication gating, request parsing, dispatch to the
 * correct services/factor/bankrCapabilityHandlers.ts function, and
 * error-code -> HTTP-status mapping. The underlying business logic (state
 * machine, tenant isolation, drift enforcement, authority-chain gating) is
 * already covered by tests/bankr-capability-handlers.test.ts and
 * tests/token-launch-service.test.ts — this file proves the HTTP surface
 * built on top of them, mirroring tests/factor-aegis-api-routes.test.ts's
 * own scope split.
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

const FACTOR_OWNER_ADDRESS = '0xF67299Ad3CB85f3A788CE38012C99Df7213E2734';
const FACTOR_SETTLEMENT_ADDRESS = '0xE478E454b8c97682CACabe0345bb01AF30900ac1';
vi.mock('@/services/wallet/agentPurposeWalletService', () => ({
  AgentPurposeWalletService: vi.fn().mockImplementation(() => ({
    getOwnerWalletAddress: vi.fn(async () => FACTOR_OWNER_ADDRESS),
    getBinding: vi.fn(async () => ({ address: FACTOR_SETTLEMENT_ADDRESS })),
  })),
}));

import { POST as readinessRoute } from '@/app/api/moneypenny/factor/bankr/readiness/route';
import { POST as createLaunch } from '@/app/api/moneypenny/factor/bankr/launches/route';
import { GET as getLaunch } from '@/app/api/moneypenny/factor/bankr/launches/[launchId]/route';
import { POST as launchAction } from '@/app/api/moneypenny/factor/bankr/launches/[launchId]/action/route';
import { POST as approveLaunch } from '@/app/api/moneypenny/factor/bankr/launches/[launchId]/approve/route';
import { beginRunning, requireReview, addFinding, ratifyAssessment, getCurrentAssessment } from '@/services/aegis/aegisAssessmentService';

function req(url: string, body?: unknown) {
  return new NextRequest(`https://dev-beta.aigentz.me${url}`, body === undefined ? { method: 'GET' } : { method: 'POST', body: JSON.stringify(body) });
}

const PERSONA = { personaId: 'persona-1' };
const DRAFT_BODY = {
  beneficiaryAgentRuntimeId: 'aigent-factor',
  preparingAgentRuntimeId: 'aigent-factor',
  chain: 'base',
  tokenName: 'Factor Token',
  tokenSymbol: 'FCTR',
};

async function ratifyAdmissibleFor(launchId: string) {
  await launchAction(req(`/api/moneypenny/factor/bankr/launches/${launchId}/action`, {
    action: 'request_aegis',
    policyVersion: 'v1',
    evidenceSnapshot: { ok: true },
    requestedByAgentRef: 'aigent-factor',
  }), { params: Promise.resolve({ launchId }) });
  const current = await getCurrentAssessment(fakeAdmin, 'token_launch', launchId);
  const assessmentId = current!.assessment_id;
  await beginRunning(fakeAdmin, assessmentId);
  await requireReview(fakeAdmin, assessmentId);
  await addFinding(fakeAdmin, { assessmentId, dimension: 'utility', claim: 'ok', method: 'review', result: 'pass', confidence: 0.9, falsificationCondition: 'n/a' });
  await ratifyAssessment(fakeAdmin, { assessmentId, decision: 'admissible', ratifiedByPersonaId: 'persona-moneypenny' });
}

async function walkToApproved(): Promise<string> {
  const createRes = await createLaunch(req('/api/moneypenny/factor/bankr/launches', DRAFT_BODY));
  const created = await createRes.json();
  const launchId = created.launch.id;
  await launchAction(req(`/api/moneypenny/factor/bankr/launches/${launchId}/action`, { action: 'preflight' }), { params: Promise.resolve({ launchId }) });
  await ratifyAdmissibleFor(launchId);
  await launchAction(req(`/api/moneypenny/factor/bankr/launches/${launchId}/action`, { action: 'request_approval' }), { params: Promise.resolve({ launchId }) });
  const approveRes = await approveLaunch(req(`/api/moneypenny/factor/bankr/launches/${launchId}/approve`, {}), { params: Promise.resolve({ launchId }) });
  expect(approveRes.status).toBe(200);
  return launchId;
}

beforeEach(() => {
  fakeAdmin = makeFakeAdmin();
  mockGetActivePersona.mockReset();
  mockGetActivePersona.mockResolvedValue(PERSONA);
});

describe('auth gating — every Bankr route 401s without an authenticated persona', () => {
  it('readiness route', async () => {
    mockGetActivePersona.mockResolvedValueOnce(null);
    const res = await readinessRoute(req('/api/moneypenny/factor/bankr/readiness', { beneficiaryAgentRuntimeId: 'aigent-factor' }));
    expect(res.status).toBe(401);
  });

  it('create-launch route', async () => {
    mockGetActivePersona.mockResolvedValueOnce(null);
    const res = await createLaunch(req('/api/moneypenny/factor/bankr/launches', DRAFT_BODY));
    expect(res.status).toBe(401);
  });

  it('launch action route', async () => {
    mockGetActivePersona.mockResolvedValueOnce(null);
    const res = await launchAction(req('/api/moneypenny/factor/bankr/launches/x/action', { action: 'preflight' }), { params: Promise.resolve({ launchId: 'x' }) });
    expect(res.status).toBe(401);
  });

  it('approve route', async () => {
    mockGetActivePersona.mockResolvedValueOnce(null);
    const res = await approveLaunch(req('/api/moneypenny/factor/bankr/launches/x/approve', {}), { params: Promise.resolve({ launchId: 'x' }) });
    expect(res.status).toBe(401);
  });
});

describe('readiness route', () => {
  it('reports unconfigured Bankr + missing binding, then provisioning drops the binding blocker', async () => {
    const res1 = await readinessRoute(req('/api/moneypenny/factor/bankr/readiness', { beneficiaryAgentRuntimeId: 'aigent-factor' }));
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.readiness.ready).toBe(false);
    expect(body1.readiness.blockers).toHaveLength(2);

    const res2 = await readinessRoute(req('/api/moneypenny/factor/bankr/readiness', { beneficiaryAgentRuntimeId: 'aigent-factor', action: 'provision_binding' }));
    const body2 = await res2.json();
    expect(body2.binding.status).toBe('active');
    expect(body2.readiness.blockers).toHaveLength(1);
  });

  it('400s when beneficiaryAgentRuntimeId is missing', async () => {
    const res = await readinessRoute(req('/api/moneypenny/factor/bankr/readiness', {}));
    expect(res.status).toBe(400);
  });
});

describe('create + read a launch', () => {
  it('creates a draft launch and reads it back via GET', async () => {
    const createRes = await createLaunch(req('/api/moneypenny/factor/bankr/launches', DRAFT_BODY));
    expect(createRes.status).toBe(200);
    const created = await createRes.json();
    expect(created.launch.state).toBe('preparing');
    expect(created.launch.token_symbol).toBe('FCTR');

    const getRes = await getLaunch(req(`/api/moneypenny/factor/bankr/launches/${created.launch.id}`), { params: Promise.resolve({ launchId: created.launch.id }) });
    expect(getRes.status).toBe(200);
    const got = await getRes.json();
    expect(got.launch.id).toBe(created.launch.id);
  });

  it('404s reading a launch under a different tenant', async () => {
    const createRes = await createLaunch(req('/api/moneypenny/factor/bankr/launches', DRAFT_BODY));
    const created = await createRes.json();
    const getRes = await getLaunch(req(`/api/moneypenny/factor/bankr/launches/${created.launch.id}?tenantId=other-tenant`), { params: Promise.resolve({ launchId: created.launch.id }) });
    expect(getRes.status).toBe(403);
  });

  it('400s when required fields are missing', async () => {
    const res = await createLaunch(req('/api/moneypenny/factor/bankr/launches', { beneficiaryAgentRuntimeId: 'aigent-factor' }));
    expect(res.status).toBe(400);
  });
});

describe('launch action dispatch', () => {
  it('400s on an unknown action, and never accepts "approve" as an action (separate authority surface)', async () => {
    const createRes = await createLaunch(req('/api/moneypenny/factor/bankr/launches', DRAFT_BODY));
    const created = await createRes.json();
    const res = await launchAction(req(`/api/moneypenny/factor/bankr/launches/${created.launch.id}/action`, { action: 'approve' }), { params: Promise.resolve({ launchId: created.launch.id }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('unknown-action');
  });

  it('walks a launch through preflight -> aegis -> approval-request -> approve -> submit -> inspect_status', async () => {
    const launchId = await walkToApproved();

    const submitRes = await launchAction(req(`/api/moneypenny/factor/bankr/launches/${launchId}/action`, { action: 'submit', idempotencyKey: 'idem-route-1' }), {
      params: Promise.resolve({ launchId }),
    });
    expect(submitRes.status).toBe(200);
    const submitted = await submitRes.json();
    expect(submitted.launch.state).toBe('submitting');
    expect(submitted.launch.bankr_job_id).toMatch(/^sim-job-/);

    const statusRes = await launchAction(req(`/api/moneypenny/factor/bankr/launches/${launchId}/action`, { action: 'inspect_status' }), { params: Promise.resolve({ launchId }) });
    expect(statusRes.status).toBe(200);

    const feeRes = await launchAction(req(`/api/moneypenny/factor/bankr/launches/${launchId}/action`, { action: 'fee_claims' }), { params: Promise.resolve({ launchId }) });
    expect(feeRes.status).toBe(200);
    const fee = await feeRes.json();
    expect(fee.feeClaims.claimableAmountKnown).toBe(false);
  });

  it('changed Bankr economics force reapproval through the route: submit refuses and the launch moves to revision_required', async () => {
    const launchId = await walkToApproved();
    await fakeAdmin.from('token_launches').update({ bankr_terms_hash: 'stale-hash' }).eq('id', launchId);

    const res = await launchAction(req(`/api/moneypenny/factor/bankr/launches/${launchId}/action`, { action: 'submit', idempotencyKey: 'idem-route-drift' }), {
      params: Promise.resolve({ launchId }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('bankr-terms-drift');

    const getRes = await getLaunch(req(`/api/moneypenny/factor/bankr/launches/${launchId}`), { params: Promise.resolve({ launchId }) });
    const got = await getRes.json();
    expect(got.launch.state).toBe('revision_required');
  });
});

describe('approve route — the sole path to approved, separate from action dispatch', () => {
  it('refuses to approve before an Aegis assessment is ratified', async () => {
    const createRes = await createLaunch(req('/api/moneypenny/factor/bankr/launches', DRAFT_BODY));
    const created = await createRes.json();
    await launchAction(req(`/api/moneypenny/factor/bankr/launches/${created.launch.id}/action`, { action: 'preflight' }), { params: Promise.resolve({ launchId: created.launch.id }) });
    await launchAction(req(`/api/moneypenny/factor/bankr/launches/${created.launch.id}/action`, { action: 'request_approval' }), { params: Promise.resolve({ launchId: created.launch.id }) });
    const res = await approveLaunch(req(`/api/moneypenny/factor/bankr/launches/${created.launch.id}/approve`, {}), { params: Promise.resolve({ launchId: created.launch.id }) });
    expect(res.status).not.toBe(200);
  });
});
