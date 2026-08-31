/**
 * POST /api/research/programme/[experimentId]/acquisition/run-step —
 * HTTP-level tests (2026-08-30). Every collaborator is mocked;
 * `crystalDomainForExperiment` is left REAL (mirrors
 * crystal-acquisition-approve-route.test.ts's own convention).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockGetSupabaseServer = vi.fn();
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => mockGetSupabaseServer(),
}));

const mockRunCrystalReadinessReport = vi.fn();
vi.mock('@/services/research/crystalReadiness', () => ({
  runCrystalReadinessReport: (...args: any[]) => mockRunCrystalReadinessReport(...args),
}));

const mockAcquisitionBriefApplies = vi.fn();
vi.mock('@/services/research/crystalAcquisitionBrief', () => ({
  acquisitionBriefApplies: (...args: any[]) => mockAcquisitionBriefApplies(...args),
}));

const mockGetActiveAcquisitionApproval = vi.fn();
const mockRunOneAcquisitionStep = vi.fn();
const mockCompleteAcquisitionJob = vi.fn();
vi.mock('@/services/research/crystalAcquisitionJob', () => ({
  getActiveAcquisitionApproval: (...args: any[]) => mockGetActiveAcquisitionApproval(...args),
  runOneAcquisitionStep: (...args: any[]) => mockRunOneAcquisitionStep(...args),
  completeAcquisitionJob: (...args: any[]) => mockCompleteAcquisitionJob(...args),
}));

import { POST } from '@/app/api/research/programme/[experimentId]/acquisition/run-step/route';

function makeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

const params = (experimentId: string) => Promise.resolve({ experimentId });

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', cartridgeFlags: { isAdmin: true } });
  mockGetSupabaseServer.mockReset();
  mockGetSupabaseServer.mockReturnValue({});
  mockRunCrystalReadinessReport.mockReset();
  mockRunCrystalReadinessReport.mockResolvedValue({ invariantCount: 12, checks: [] });
  mockAcquisitionBriefApplies.mockReset();
  mockAcquisitionBriefApplies.mockReturnValue(true);
  mockGetActiveAcquisitionApproval.mockReset();
  mockGetActiveAcquisitionApproval.mockResolvedValue({ id: 'approval-1', status: 'approved' });
  mockRunOneAcquisitionStep.mockReset();
  mockRunOneAcquisitionStep.mockResolvedValue({
    ok: true,
    institution: { pillarKey: 'partnerships', institutionName: 'NBER' },
    discovery: { ok: true, pagesFetched: 1, candidates: [] },
    exhausted: false,
    eligibleInstitutionCountAtStart: 1,
    ratifiedVerifiedInstitutionCount: 2,
  });
  mockCompleteAcquisitionJob.mockReset();
  mockCompleteAcquisitionJob.mockResolvedValue(undefined);
});

describe('POST acquisition/run-step — auth gating', () => {
  it('refuses 401 when no persona resolves', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    expect(res.status).toBe(401);
    expect(mockRunOneAcquisitionStep).not.toHaveBeenCalled();
  });

  it('refuses 403 for a non-steward persona', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', cartridgeFlags: { isAdmin: false } });
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    expect(res.status).toBe(403);
    expect(mockRunOneAcquisitionStep).not.toHaveBeenCalled();
  });
});

describe('POST acquisition/run-step — requires an ACTIVE approval', () => {
  it('refuses 409 when no active approval exists — this route can never be reached without the human authorization', async () => {
    mockGetActiveAcquisitionApproval.mockResolvedValue(null);
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(mockRunOneAcquisitionStep).not.toHaveBeenCalled();
  });
});

describe('POST acquisition/run-step — domain resolution', () => {
  it('refuses 404 when no crystal domain is declared for the experiment', async () => {
    const res = await POST(makeRequest({}), { params: params('EXP-DOES-NOT-EXIST') });
    expect(res.status).toBe(404);
    expect(mockRunOneAcquisitionStep).not.toHaveBeenCalled();
  });
});

describe('POST acquisition/run-step — the bounded step + re-derived readiness', () => {
  it('runs exactly one step and reports done:false while readiness still needs acquisition and institutions remain', async () => {
    mockAcquisitionBriefApplies.mockReturnValue(true); // readiness STILL needs acquisition
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.institution).toEqual({ pillarKey: 'partnerships', institutionName: 'NBER' });
    expect(body.exhausted).toBe(false);
    expect(body.readinessSatisfied).toBe(false);
    expect(body.done).toBe(false);
    expect(mockRunOneAcquisitionStep).toHaveBeenCalledTimes(1);
    expect(mockCompleteAcquisitionJob).not.toHaveBeenCalled();
  });

  it('marks the approval completed and reports done:true once readiness no longer needs acquisition', async () => {
    mockAcquisitionBriefApplies.mockReturnValue(false); // readiness NOW satisfied
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(body.readinessSatisfied).toBe(true);
    expect(body.done).toBe(true);
    expect(mockCompleteAcquisitionJob).toHaveBeenCalledWith(expect.anything(), 'approval-1');
  });

  it('marks the approval completed and reports done:true once every ratified+verified institution is GENUINELY exhausted (real attempts were made), even if readiness is still unsatisfied', async () => {
    mockAcquisitionBriefApplies.mockReturnValue(true);
    // ratifiedVerifiedInstitutionCount > 0 (something WAS eligible in this
    // domain), eligibleInstitutionCountAtStart === 0 (all of it already
    // attempted, this call or an earlier one) — a real, completed round,
    // distinct from the "nothing was EVER eligible" case below. This is the
    // exact shape a legitimate multi-call round ends on, and must NOT be
    // misread as blocked.
    mockRunOneAcquisitionStep.mockResolvedValue({
      ok: true, institution: null, discovery: null, exhausted: true,
      eligibleInstitutionCountAtStart: 0, ratifiedVerifiedInstitutionCount: 2,
    });
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(body.exhausted).toBe(true);
    expect(body.readinessSatisfied).toBe(false);
    expect(body.done).toBe(true);
    expect(body.sourceUniverseBlocked).toBe(false);
    expect(mockCompleteAcquisitionJob).toHaveBeenCalledWith(expect.anything(), 'approval-1');
  });

  // ── THE PREMATURE-COMPLETION FIX (2026-08-31, "targeted-acquisition
  // state-machine" repair) — the live defect: an approval click followed by
  // a run-step call where the domain has ZERO ratified+verified institutions
  // AT ALL was marking the approval 'completed' on the very first call,
  // before anything was ever attempted. That destroyed the durable record
  // that a steward had authorized acquisition, and the next read re-offered
  // "Approve targeted acquisition" from scratch — the reported "approval
  // remains outstanding after clicking Approve" defect.
  it('does NOT mark the approval completed when the domain has NOTHING ratified+verified at all (source universe blocked) — the durable approval record survives', async () => {
    mockAcquisitionBriefApplies.mockReturnValue(true); // readiness still needs acquisition
    mockRunOneAcquisitionStep.mockResolvedValue({
      ok: true, institution: null, discovery: null, exhausted: true,
      eligibleInstitutionCountAtStart: 0, ratifiedVerifiedInstitutionCount: 0,
    });
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(body.exhausted).toBe(true);
    expect(body.readinessSatisfied).toBe(false);
    expect(body.sourceUniverseBlocked).toBe(true);
    // Loop-control still stops the caller from spinning (done:true) —
    // blocked is a terminal state for THIS call, just not a completed one.
    expect(body.done).toBe(true);
    expect(mockCompleteAcquisitionJob).not.toHaveBeenCalled();
  });

  it('a genuinely satisfied readiness still completes the approval even when the domain has nothing ratified+verified at all', async () => {
    mockAcquisitionBriefApplies.mockReturnValue(false); // readiness NOW satisfied
    mockRunOneAcquisitionStep.mockResolvedValue({
      ok: true, institution: null, discovery: null, exhausted: true,
      eligibleInstitutionCountAtStart: 0, ratifiedVerifiedInstitutionCount: 0,
    });
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(body.readinessSatisfied).toBe(true);
    expect(body.sourceUniverseBlocked).toBe(false);
    expect(body.done).toBe(true);
    expect(mockCompleteAcquisitionJob).toHaveBeenCalledWith(expect.anything(), 'approval-1');
  });
});

describe('POST acquisition/run-step — service unavailable', () => {
  it('returns 503 when the admin client cannot be constructed', async () => {
    mockGetSupabaseServer.mockReturnValue(null);
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    expect(res.status).toBe(503);
    expect(mockRunOneAcquisitionStep).not.toHaveBeenCalled();
  });
});
