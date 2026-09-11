/**
 * POST /api/research/programme/[experimentId]/acquisition/verify-step —
 * HTTP-level tests (2026-08-31, "targeted-acquisition ratified-but-
 * unverified dead end" repair, then "verification wall-clock granularity"
 * repair). Every collaborator is mocked; `crystalDomainForExperiment` is
 * left REAL, mirroring crystal-acquisition-run-step-route.test.ts's own
 * convention.
 *
 * Mocks `runOneInstitutionVerificationStep` at the `{ institution, step,
 * exhausted }` boundary — its own phase-selection logic is pinned in
 * tests/crystal-acquisition-job.test.ts, and the underlying bounded
 * primitive's phase-by-phase/deadline-race behavior is pinned in
 * tests/corpus-scout-verification-step.test.ts. This level pins ONLY the
 * route's OWN concern: auth, the active-approval requirement, and mapping
 * `step` onto the HTTP response the operator's ask specified (`status`,
 * `institution`, `outcome`, `diagnostics`, `nextAction`).
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

const IN_PROGRESS_STEP = {
  ok: true, status: 'in-progress', domain: 'financial-services', pillarKey: 'p', institutionName: 'BIS',
  diagnostics: { institutionName: 'BIS', phase: 'fetch-document', cursor: 2, elapsedMs: 4200, externalCallsAttempted: 1 },
};

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', cartridgeFlags: { isAdmin: true } });
  mockGetSupabaseServer.mockReset();
  mockGetSupabaseServer.mockReturnValue({});
  mockGetActiveAcquisitionApproval.mockReset();
  mockGetActiveAcquisitionApproval.mockResolvedValue({ id: 'approval-1', status: 'approved' });
  mockRunOneInstitutionVerificationStep.mockReset();
  mockRunOneInstitutionVerificationStep.mockResolvedValue({
    ok: true, institution: { pillarKey: 'p', institutionName: 'BIS' }, step: IN_PROGRESS_STEP, exhausted: false,
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

describe('POST acquisition/verify-step — the bounded phase-step (2026-08-31 wall-clock granularity repair)', () => {
  it('THE LIVE FIX: an in-progress phase (the BIS 504 case) returns a structured response, never an empty 504 — status/institution/diagnostics all present', async () => {
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe('in-progress');
    expect(body.institution).toEqual({ pillarKey: 'p', institutionName: 'BIS' });
    expect(body.outcome).toBeNull();
    // The exact diagnostics shape the operator asked for.
    expect(body.diagnostics).toEqual({
      institutionName: 'BIS', phase: 'fetch-document', cursor: 2, elapsedMs: 4200, externalCallsAttempted: 1,
    });
    expect(body.nextAction).toBe('continue-verification');
    expect(body.done).toBe(false);
    // The domain is not exhausted just because ONE institution's phase
    // advanced — 18 others may still need work.
    expect(body.exhausted).toBe(false);
  });

  it('a terminal outcome (verified) is reported with the outcome populated, status distinct from "in-progress"', async () => {
    mockRunOneInstitutionVerificationStep.mockResolvedValue({
      ok: true,
      institution: { pillarKey: 'p', institutionName: 'BIS' },
      step: {
        ok: true, status: 'verified', domain: 'financial-services', pillarKey: 'p', institutionName: 'BIS',
        outcome: { status: 'verified', resolvedUrl: 'https://bis.org', checkedAt: '2026-08-31T00:00:00Z', candidatesFound: 3, documentsInspected: 2, qualifyingDocuments: [{ documentUrl: 'https://bis.org/doc.pdf', contentHash: 'h', mimeType: 'application/pdf', fileSizeBytes: 100, pageCount: 5, substantiveTextCharacters: 900, blankPageRatio: 0 }], standard: 'CQS', detail: 'verified' },
        diagnostics: { institutionName: 'BIS', phase: 'fetch-document', cursor: 1, elapsedMs: 3000, externalCallsAttempted: 1 },
      },
      exhausted: false,
    });
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(body.status).toBe('verified');
    expect(body.outcome.status).toBe('verified');
    expect(body.outcome.qualifyingDocuments).toHaveLength(1);
  });

  it('a failed/insufficient TERMINAL outcome is reported honestly, not as an HTTP error — exception isolation, never thrown', async () => {
    mockRunOneInstitutionVerificationStep.mockResolvedValue({
      ok: true,
      institution: { pillarKey: 'p', institutionName: 'Failing Institution' },
      step: {
        ok: true, status: 'verification_failed', domain: 'financial-services', pillarKey: 'p', institutionName: 'Failing Institution',
        outcome: { status: 'verification_failed', resolvedUrl: null, checkedAt: '2026-08-31T00:00:00Z', candidatesFound: 0, documentsInspected: 0, qualifyingDocuments: [], standard: 'CQS', detail: 'seed URL did not resolve: unknown' },
        diagnostics: { institutionName: 'Failing Institution', phase: 'resolve-seed', cursor: 0, elapsedMs: 500, externalCallsAttempted: 1 },
      },
      exhausted: false,
    });
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe('verification_failed');
    expect(body.outcome.status).toBe('verification_failed');
  });

  it('reports done:true, exhausted:true only once NO institution has any outstanding verification work', async () => {
    mockRunOneInstitutionVerificationStep.mockResolvedValue({ ok: true, institution: null, step: null, exhausted: true });
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(body.status).toBe('exhausted');
    expect(body.institution).toBeNull();
    expect(body.exhausted).toBe(true);
    expect(body.done).toBe(true);
    expect(body.nextAction).toBe('none');
  });

  it('a structured per-institution failure from the bounded step (e.g. malformed checkpoint) surfaces as a 500 with the error, never a thrown exception', async () => {
    mockRunOneInstitutionVerificationStep.mockResolvedValue({
      ok: true,
      institution: { pillarKey: 'p', institutionName: 'BIS' },
      step: { ok: false, domain: 'financial-services', pillarKey: 'p', institutionName: 'BIS', error: 'cannot start verification from \'deprecated\' — re-open the entry first' },
      exhausted: false,
    });
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/deprecated/);
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
