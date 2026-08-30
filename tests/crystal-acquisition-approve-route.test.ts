/**
 * POST /api/research/programme/[experimentId]/acquisition/approve —
 * HTTP-level tests (2026-08-30, "turn Discover Sources into a precise
 * Copilot authorization"). Every collaborator is mocked; `crystalDomainForExperiment`
 * is left REAL (EXP-P1 has a ratified declaration; an unknown id does not) so
 * the 404 case exercises the real lookup, mirroring crystal-freeze-route.test.ts's
 * own convention.
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

const mockCurrentCrystalArtifactId = vi.fn();
vi.mock('@/services/research/artifacts', () => ({
  currentCrystalArtifactId: (...args: any[]) => mockCurrentCrystalArtifactId(...args),
}));

const mockListInvariants = vi.fn();
vi.mock('@/services/invariants/store', () => ({
  listInvariants: (...args: any[]) => mockListInvariants(...args),
}));

const mockAcquisitionBriefApplies = vi.fn();
const mockBuildCrystalAcquisitionBrief = vi.fn();
vi.mock('@/services/research/crystalAcquisitionBrief', () => ({
  acquisitionBriefApplies: (...args: any[]) => mockAcquisitionBriefApplies(...args),
  buildCrystalAcquisitionBrief: (...args: any[]) => mockBuildCrystalAcquisitionBrief(...args),
}));

const mockApproveAcquisitionJob = vi.fn();
const mockGetActiveAcquisitionApproval = vi.fn();
vi.mock('@/services/research/crystalAcquisitionJob', () => ({
  approveAcquisitionJob: (...args: any[]) => mockApproveAcquisitionJob(...args),
  getActiveAcquisitionApproval: (...args: any[]) => mockGetActiveAcquisitionApproval(...args),
}));

// crystalDomainForExperiment is left REAL — EXP-P1 has a ratified declaration.
import { POST } from '@/app/api/research/programme/[experimentId]/acquisition/approve/route';

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
  mockRunCrystalReadinessReport.mockResolvedValue({ invariantCount: 11, checks: [] });
  mockCurrentCrystalArtifactId.mockReset();
  mockCurrentCrystalArtifactId.mockResolvedValue('EXP-P1/crystal-v2');
  mockListInvariants.mockReset();
  mockListInvariants.mockResolvedValue([]);
  mockAcquisitionBriefApplies.mockReset();
  mockAcquisitionBriefApplies.mockReturnValue(true);
  mockBuildCrystalAcquisitionBrief.mockReset();
  mockBuildCrystalAcquisitionBrief.mockReturnValue({
    experimentId: 'EXP-P1', requiredNetNewDistinctMembers: 49, missingNamespaces: ['causal'],
    deficientRelationalStructures: ['causal'], sourceAdmissibilityConstraints: ['ratified institutions/sources only'],
  });
  mockApproveAcquisitionJob.mockReset();
  mockApproveAcquisitionJob.mockResolvedValue({ ok: true, approval: { id: 'approval-1', status: 'approved' } });
  mockGetActiveAcquisitionApproval.mockReset();
  mockGetActiveAcquisitionApproval.mockResolvedValue(null);
});

describe('POST acquisition/approve — auth gating', () => {
  it('refuses 401 when no persona resolves', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    expect(res.status).toBe(401);
    expect(mockApproveAcquisitionJob).not.toHaveBeenCalled();
  });

  it('refuses 403 for a non-steward persona', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', cartridgeFlags: { isAdmin: false } });
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    expect(res.status).toBe(403);
    expect(mockApproveAcquisitionJob).not.toHaveBeenCalled();
  });
});

describe('POST acquisition/approve — domain resolution', () => {
  it('refuses 404 when no crystal domain is declared for the experiment', async () => {
    const res = await POST(makeRequest({}), { params: params('EXP-DOES-NOT-EXIST') });
    expect(res.status).toBe(404);
    expect(mockApproveAcquisitionJob).not.toHaveBeenCalled();
  });
});

describe('POST acquisition/approve — refuses when nothing requires acquisition', () => {
  it('returns 409 when acquisitionBriefApplies is false', async () => {
    mockAcquisitionBriefApplies.mockReturnValue(false);
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(mockApproveAcquisitionJob).not.toHaveBeenCalled();
  });
});

describe('POST acquisition/approve — idempotent re-approval', () => {
  it('returns the existing active approval without writing a new one', async () => {
    mockGetActiveAcquisitionApproval.mockResolvedValue({ id: 'existing-approval', status: 'approved' });
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.alreadyApproved).toBe(true);
    expect(body.approval.id).toBe('existing-approval');
    expect(mockApproveAcquisitionJob).not.toHaveBeenCalled();
  });
});

describe('POST acquisition/approve — the happy path', () => {
  it('builds the brief from live readiness and writes the approval', async () => {
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.alreadyApproved).toBe(false);
    expect(body.approval.id).toBe('approval-1');
    expect(body.brief.requiredNetNewDistinctMembers).toBe(49);
    expect(mockApproveAcquisitionJob).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      experimentId: 'EXP-P1',
      approvedByPersonaId: 'persona-1',
    }));
  });

  it('returns 500 when the approval write itself fails', async () => {
    mockApproveAcquisitionJob.mockResolvedValue({ ok: false, error: 'db unavailable' });
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe('db unavailable');
  });
});

describe('POST acquisition/approve — service unavailable', () => {
  it('returns 503 when the admin client cannot be constructed', async () => {
    mockGetSupabaseServer.mockReturnValue(null);
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    expect(res.status).toBe(503);
    expect(mockApproveAcquisitionJob).not.toHaveBeenCalled();
  });
});
