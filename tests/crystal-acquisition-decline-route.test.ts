/**
 * POST /api/research/programme/[experimentId]/acquisition/decline —
 * HTTP-level tests (2026-09-05, "complete human proposal-decision contract"
 * fix: the card previously exposed ONLY "Approve targeted acquisition").
 * Mirrors tests/crystal-acquisition-approve-route.test.ts's own mocking
 * convention exactly. `crystalDomainForExperiment` is left REAL — EXP-P1 has
 * a ratified declaration; an unknown id does not.
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
import { POST } from '@/app/api/research/programme/[experimentId]/acquisition/decline/route';

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
  mockRecordAcquisitionDisposition.mockResolvedValue({ ok: true, approval: { id: 'decline-1', status: 'declined' } });
});

describe('POST acquisition/decline — auth gating', () => {
  it('refuses 401 when no persona resolves', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    expect(res.status).toBe(401);
    expect(mockRecordAcquisitionDisposition).not.toHaveBeenCalled();
  });

  it('refuses 403 for a non-steward persona', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', cartridgeFlags: { isAdmin: false } });
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    expect(res.status).toBe(403);
    expect(mockRecordAcquisitionDisposition).not.toHaveBeenCalled();
  });
});

describe('POST acquisition/decline — domain resolution', () => {
  it('refuses 404 when no crystal domain is declared for the experiment', async () => {
    const res = await POST(makeRequest({}), { params: params('EXP-DOES-NOT-EXIST') });
    expect(res.status).toBe(404);
    expect(mockRecordAcquisitionDisposition).not.toHaveBeenCalled();
  });
});

describe('POST acquisition/decline — refuses when nothing requires acquisition', () => {
  it('returns 409 when acquisitionBriefApplies is false against the freshly composed report', async () => {
    mockAcquisitionBriefApplies.mockReturnValue(false);
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(mockRecordAcquisitionDisposition).not.toHaveBeenCalled();
  });
});

describe('POST acquisition/decline — precondition timeout (fail-closed)', () => {
  it('returns 503 and writes nothing when composeAcquisitionPreconditions reports a timeout', async () => {
    mockComposeAcquisitionPreconditions.mockResolvedValue({ ok: false, reason: 'timeout', deadlineMs: 15_000 });
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.retryable).toBe(true);
    expect(mockRecordAcquisitionDisposition).not.toHaveBeenCalled();
  });
});

describe('POST acquisition/decline — an already-approved exact proposal cannot also be declined', () => {
  it('returns 409 when an active approval exists for the SAME crystal generation + brief hash', async () => {
    mockGetActiveAcquisitionApproval.mockResolvedValue({
      id: 'approval-1', status: 'approved', crystalGeneration: 'EXP-P1/crystal-v2', briefHash: 'brief-hash-fixed',
    });
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(mockRecordAcquisitionDisposition).not.toHaveBeenCalled();
  });

  it('proceeds when the active approval is for a DIFFERENT brief (materially changed proposal)', async () => {
    mockGetActiveAcquisitionApproval.mockResolvedValue({
      id: 'approval-1', status: 'approved', crystalGeneration: 'EXP-P1/crystal-v2', briefHash: 'a-different-hash',
    });
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    expect(res.status).toBe(200);
    expect(mockRecordAcquisitionDisposition).toHaveBeenCalled();
  });
});

describe('POST acquisition/decline — idempotent repeat decline', () => {
  it('short-circuits to the existing disposition without writing a new one, when the SAME brief was already declined', async () => {
    mockGetLatestAcquisitionDisposition.mockResolvedValue({
      id: 'decline-existing', status: 'declined', crystalGeneration: 'EXP-P1/crystal-v2', briefHash: 'brief-hash-fixed',
    });
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.alreadyRecorded).toBe(true);
    expect(body.disposition.id).toBe('decline-existing');
    expect(mockRecordAcquisitionDisposition).not.toHaveBeenCalled();
  });

  it('proceeds to a new decline when the latest disposition is for a DIFFERENT brief hash', async () => {
    mockGetLatestAcquisitionDisposition.mockResolvedValue({
      id: 'decline-old', status: 'declined', crystalGeneration: 'EXP-P1/crystal-v2', briefHash: 'a-stale-hash',
    });
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(body.alreadyRecorded).toBe(false);
    expect(mockRecordAcquisitionDisposition).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      disposition: 'declined',
      briefHash: 'brief-hash-fixed',
    }));
  });
});

describe('POST acquisition/decline — the happy path', () => {
  it('records the decline with an optional rationale and never marks any check satisfied (brief/readiness untouched)', async () => {
    const res = await POST(makeRequest({ rationale: 'not needed right now' }), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.alreadyRecorded).toBe(false);
    expect(body.disposition.id).toBe('decline-1');
    expect(mockRecordAcquisitionDisposition).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      experimentId: 'EXP-P1',
      disposition: 'declined',
      decidedByPersonaId: 'persona-1',
      rationale: 'not needed right now',
    }));
  });

  it('records a null rationale when none is given', async () => {
    await POST(makeRequest({}), { params: params('EXP-P1') });
    expect(mockRecordAcquisitionDisposition).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ rationale: null }));
  });

  it('returns 500 when the disposition write itself fails', async () => {
    mockRecordAcquisitionDisposition.mockResolvedValue({ ok: false, error: 'db unavailable' });
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe('db unavailable');
  });
});

describe('POST acquisition/decline — service unavailable', () => {
  it('returns 503 when the admin client cannot be constructed', async () => {
    mockGetSupabaseServer.mockReturnValue(null);
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    expect(res.status).toBe(503);
    expect(mockRecordAcquisitionDisposition).not.toHaveBeenCalled();
  });
});
