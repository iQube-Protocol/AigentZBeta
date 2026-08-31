/**
 * POST /api/research/programme/[experimentId]/acquisition/verify-step —
 * HTTP-level tests (2026-08-31, "targeted-acquisition ratified-but-
 * unverified dead end" repair). Every collaborator is mocked;
 * `crystalDomainForExperiment` is left REAL, mirroring
 * crystal-acquisition-run-step-route.test.ts's own convention.
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

const mockGetActiveAcquisitionApproval = vi.fn();
const mockRunOneInstitutionVerificationStep = vi.fn();
vi.mock('@/services/research/crystalAcquisitionJob', () => ({
  getActiveAcquisitionApproval: (...args: any[]) => mockGetActiveAcquisitionApproval(...args),
  runOneInstitutionVerificationStep: (...args: any[]) => mockRunOneInstitutionVerificationStep(...args),
}));

import { POST } from '@/app/api/research/programme/[experimentId]/acquisition/verify-step/route';

function makeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

const params = (experimentId: string) => Promise.resolve({ experimentId });

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', cartridgeFlags: { isAdmin: true } });
  mockGetSupabaseServer.mockReset();
  mockGetSupabaseServer.mockReturnValue({});
  mockGetActiveAcquisitionApproval.mockReset();
  mockGetActiveAcquisitionApproval.mockResolvedValue({ id: 'approval-1', status: 'approved' });
  mockRunOneInstitutionVerificationStep.mockReset();
  mockRunOneInstitutionVerificationStep.mockResolvedValue({
    ok: true,
    institution: { pillarKey: 'p', institutionName: 'Institution 1' },
    result: { ok: true, domain: 'financial-services', pillarKey: 'p', institutionName: 'Institution 1', outcome: { status: 'verified' } },
    exhausted: false,
  });
});

describe('POST acquisition/verify-step — auth gating', () => {
  it('refuses 401 when no persona resolves', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    expect(res.status).toBe(401);
    expect(mockRunOneInstitutionVerificationStep).not.toHaveBeenCalled();
  });

  it('refuses 403 for a non-steward persona', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', cartridgeFlags: { isAdmin: false } });
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    expect(res.status).toBe(403);
    expect(mockRunOneInstitutionVerificationStep).not.toHaveBeenCalled();
  });
});

describe('POST acquisition/verify-step — requires an ACTIVE approval', () => {
  it('refuses 409 when no active approval exists — this route can never be reached without the human authorization that already covers the whole bounded acquisition sequence', async () => {
    mockGetActiveAcquisitionApproval.mockResolvedValue(null);
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(mockRunOneInstitutionVerificationStep).not.toHaveBeenCalled();
  });
});

describe('POST acquisition/verify-step — domain resolution', () => {
  it('refuses 404 when no crystal domain is declared for the experiment', async () => {
    const res = await POST(makeRequest({}), { params: params('EXP-DOES-NOT-EXIST') });
    expect(res.status).toBe(404);
    expect(mockRunOneInstitutionVerificationStep).not.toHaveBeenCalled();
  });
});

describe('POST acquisition/verify-step — the bounded step', () => {
  it('runs exactly one verification step and reports done:false while institutions remain in "proposed"', async () => {
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.institution).toEqual({ pillarKey: 'p', institutionName: 'Institution 1' });
    expect(body.exhausted).toBe(false);
    expect(body.done).toBe(false);
    expect(mockRunOneInstitutionVerificationStep).toHaveBeenCalledTimes(1);
  });

  it('reports done:true once no ratified institution remains in "proposed" — THE LIVE CASE, after all 19 have had their one pass', async () => {
    mockRunOneInstitutionVerificationStep.mockResolvedValue({
      ok: true, institution: null, result: null, exhausted: true,
    });
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(body.institution).toBeNull();
    expect(body.exhausted).toBe(true);
    expect(body.done).toBe(true);
  });

  // ── EXCEPTION ISOLATION — a per-institution failure surfaces in the
  // response (never thrown), and does not prevent the route from being
  // callable again for the next institution.
  it('a failed/insufficient verification outcome is reported honestly, not as an HTTP error', async () => {
    mockRunOneInstitutionVerificationStep.mockResolvedValue({
      ok: true,
      institution: { pillarKey: 'p', institutionName: 'Failing Institution' },
      result: { ok: true, domain: 'financial-services', pillarKey: 'p', institutionName: 'Failing Institution', outcome: { status: 'verification_failed' } },
      exhausted: false,
    });
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.result.outcome.status).toBe('verification_failed');
  });
});

describe('POST acquisition/verify-step — service unavailable', () => {
  it('returns 503 when the admin client cannot be constructed', async () => {
    mockGetSupabaseServer.mockReturnValue(null);
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    expect(res.status).toBe(503);
    expect(mockRunOneInstitutionVerificationStep).not.toHaveBeenCalled();
  });
});
