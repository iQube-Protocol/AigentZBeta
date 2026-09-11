/**
 * POST /api/research/programme/[experimentId]/acquisition/revise —
 * HTTP-level tests (2026-09-05, "complete human proposal-decision contract"
 * fix). Mirrors tests/crystal-acquisition-decline-route.test.ts's own
 * mocking convention; the material difference from decline is the required
 * `rationale` and the idempotency comparison also matching on it (a
 * DIFFERENT rationale against the same brief is still a fresh direction
 * worth recording).
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

const mockComposeAcquisitionPreconditions = vi.fn();
vi.mock('@/services/research/crystalAcquisitionPrecondition', () => ({
  composeAcquisitionPreconditions: (...args: any[]) => mockComposeAcquisitionPreconditions(...args),
}));

const mockAcquisitionBriefApplies = vi.fn();
const mockBuildCrystalAcquisitionBrief = vi.fn();
const mockHashAcquisitionBrief = vi.fn();
vi.mock('@/services/research/crystalAcquisitionBrief', () => ({
  acquisitionBriefApplies: (...args: any[]) => mockAcquisitionBriefApplies(...args),
  buildCrystalAcquisitionBrief: (...args: any[]) => mockBuildCrystalAcquisitionBrief(...args),
  hashAcquisitionBrief: (...args: any[]) => mockHashAcquisitionBrief(...args),
}));

const mockGetActiveAcquisitionApproval = vi.fn();
const mockGetLatestAcquisitionDisposition = vi.fn();
const mockRecordAcquisitionDisposition = vi.fn();
vi.mock('@/services/research/crystalAcquisitionJob', () => ({
  getActiveAcquisitionApproval: (...args: any[]) => mockGetActiveAcquisitionApproval(...args),
  getLatestAcquisitionDisposition: (...args: any[]) => mockGetLatestAcquisitionDisposition(...args),
  recordAcquisitionDisposition: (...args: any[]) => mockRecordAcquisitionDisposition(...args),
}));

// crystalDomainForExperiment is left REAL — EXP-P1 has a ratified declaration.
import { POST } from '@/app/api/research/programme/[experimentId]/acquisition/revise/route';

function makeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

const params = (experimentId: string) => Promise.resolve({ experimentId });

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', cartridgeFlags: { isAdmin: true } });
  mockGetSupabaseServer.mockReset();
  mockGetSupabaseServer.mockReturnValue({});
  mockComposeAcquisitionPreconditions.mockReset();
  mockComposeAcquisitionPreconditions.mockResolvedValue({
    ok: true,
    report: { invariantCount: 11, checks: [] },
    crystalGeneration: 'EXP-P1/crystal-v2',
    admitted: [],
  });
  mockAcquisitionBriefApplies.mockReset();
  mockAcquisitionBriefApplies.mockReturnValue(true);
  mockBuildCrystalAcquisitionBrief.mockReset();
  mockBuildCrystalAcquisitionBrief.mockReturnValue({
    experimentId: 'EXP-P1', crystalGeneration: 'EXP-P1/crystal-v2', requiredNetNewDistinctMembers: 49, missingNamespaces: ['causal'],
    deficientRelationalStructures: ['causal'], sourceAdmissibilityConstraints: ['ratified institutions/sources only'],
  });
  mockHashAcquisitionBrief.mockReset();
  mockHashAcquisitionBrief.mockReturnValue('brief-hash-fixed');
  mockGetActiveAcquisitionApproval.mockReset();
  mockGetActiveAcquisitionApproval.mockResolvedValue(null);
  mockGetLatestAcquisitionDisposition.mockReset();
  mockGetLatestAcquisitionDisposition.mockResolvedValue(null);
  mockRecordAcquisitionDisposition.mockReset();
  mockRecordAcquisitionDisposition.mockResolvedValue({ ok: true, approval: { id: 'revise-1', status: 'revision_requested' } });
});

describe('POST acquisition/revise — auth gating', () => {
  it('refuses 401 when no persona resolves', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await POST(makeRequest({ rationale: 'x' }), { params: params('EXP-P1') });
    expect(res.status).toBe(401);
    expect(mockRecordAcquisitionDisposition).not.toHaveBeenCalled();
  });

  it('refuses 403 for a non-steward persona', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', cartridgeFlags: { isAdmin: false } });
    const res = await POST(makeRequest({ rationale: 'x' }), { params: params('EXP-P1') });
    expect(res.status).toBe(403);
    expect(mockRecordAcquisitionDisposition).not.toHaveBeenCalled();
  });
});

describe('POST acquisition/revise — rationale is required', () => {
  it('returns 400 when rationale is missing', async () => {
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(mockComposeAcquisitionPreconditions).not.toHaveBeenCalled();
    expect(mockRecordAcquisitionDisposition).not.toHaveBeenCalled();
  });

  it('returns 400 when rationale is whitespace-only', async () => {
    const res = await POST(makeRequest({ rationale: '   ' }), { params: params('EXP-P1') });
    expect(res.status).toBe(400);
    expect(mockRecordAcquisitionDisposition).not.toHaveBeenCalled();
  });
});

describe('POST acquisition/revise — domain resolution', () => {
  it('refuses 404 when no crystal domain is declared for the experiment', async () => {
    const res = await POST(makeRequest({ rationale: 'x' }), { params: params('EXP-DOES-NOT-EXIST') });
    expect(res.status).toBe(404);
    expect(mockRecordAcquisitionDisposition).not.toHaveBeenCalled();
  });
});

describe('POST acquisition/revise — refuses when nothing requires acquisition', () => {
  it('returns 409 when acquisitionBriefApplies is false', async () => {
    mockAcquisitionBriefApplies.mockReturnValue(false);
    const res = await POST(makeRequest({ rationale: 'x' }), { params: params('EXP-P1') });
    expect(res.status).toBe(409);
    expect(mockRecordAcquisitionDisposition).not.toHaveBeenCalled();
  });
});

describe('POST acquisition/revise — an already-approved exact proposal cannot also be revised', () => {
  it('returns 409 when an active approval exists for the SAME crystal generation + brief hash', async () => {
    mockGetActiveAcquisitionApproval.mockResolvedValue({
      id: 'approval-1', status: 'approved', crystalGeneration: 'EXP-P1/crystal-v2', briefHash: 'brief-hash-fixed',
    });
    const res = await POST(makeRequest({ rationale: 'x' }), { params: params('EXP-P1') });
    expect(res.status).toBe(409);
    expect(mockRecordAcquisitionDisposition).not.toHaveBeenCalled();
  });
});

describe('POST acquisition/revise — idempotent repeat submission', () => {
  it('short-circuits when the SAME rationale is resubmitted against the SAME brief', async () => {
    mockGetLatestAcquisitionDisposition.mockResolvedValue({
      id: 'revise-existing', status: 'revision_requested', crystalGeneration: 'EXP-P1/crystal-v2',
      briefHash: 'brief-hash-fixed', rationale: 'narrow the search',
    });
    const res = await POST(makeRequest({ rationale: 'narrow the search' }), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.alreadyRecorded).toBe(true);
    expect(body.disposition.id).toBe('revise-existing');
    expect(mockRecordAcquisitionDisposition).not.toHaveBeenCalled();
  });

  it('records a NEW row when a DIFFERENT rationale is submitted against the same brief — a new direction is still worth recording', async () => {
    mockGetLatestAcquisitionDisposition.mockResolvedValue({
      id: 'revise-existing', status: 'revision_requested', crystalGeneration: 'EXP-P1/crystal-v2',
      briefHash: 'brief-hash-fixed', rationale: 'narrow the search',
    });
    const res = await POST(makeRequest({ rationale: 'actually widen the search instead' }), { params: params('EXP-P1') });
    const body = await res.json();
    expect(body.alreadyRecorded).toBe(false);
    expect(mockRecordAcquisitionDisposition).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      rationale: 'actually widen the search instead',
    }));
  });

  it('records a NEW row when the latest disposition is a DIFFERENT status (e.g. declined) even with the same brief', async () => {
    mockGetLatestAcquisitionDisposition.mockResolvedValue({
      id: 'decline-existing', status: 'declined', crystalGeneration: 'EXP-P1/crystal-v2', briefHash: 'brief-hash-fixed', rationale: null,
    });
    const res = await POST(makeRequest({ rationale: 'reconsider' }), { params: params('EXP-P1') });
    const body = await res.json();
    expect(body.alreadyRecorded).toBe(false);
    expect(mockRecordAcquisitionDisposition).toHaveBeenCalled();
  });
});

describe('POST acquisition/revise — the happy path', () => {
  it('records the revision request with the given rationale', async () => {
    const res = await POST(makeRequest({ rationale: 'narrow the search to ns-c only first' }), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.disposition.id).toBe('revise-1');
    expect(mockRecordAcquisitionDisposition).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      experimentId: 'EXP-P1',
      disposition: 'revision_requested',
      decidedByPersonaId: 'persona-1',
      rationale: 'narrow the search to ns-c only first',
    }));
  });

  it('returns 500 when the disposition write itself fails', async () => {
    mockRecordAcquisitionDisposition.mockResolvedValue({ ok: false, error: 'db unavailable' });
    const res = await POST(makeRequest({ rationale: 'x' }), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe('db unavailable');
  });
});

describe('POST acquisition/revise — service unavailable', () => {
  it('returns 503 when the admin client cannot be constructed', async () => {
    mockGetSupabaseServer.mockReturnValue(null);
    const res = await POST(makeRequest({ rationale: 'x' }), { params: params('EXP-P1') });
    expect(res.status).toBe(503);
    expect(mockRecordAcquisitionDisposition).not.toHaveBeenCalled();
  });
});
