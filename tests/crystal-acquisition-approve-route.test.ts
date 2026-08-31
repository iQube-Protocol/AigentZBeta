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

const mockComposeAcquisitionPreconditions = vi.fn();
vi.mock('@/services/research/crystalAcquisitionPrecondition', () => ({
  composeAcquisitionPreconditions: (...args: any[]) => mockComposeAcquisitionPreconditions(...args),
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

describe('POST acquisition/approve — refuses when nothing requires acquisition (stale-decision rejection)', () => {
  it('returns 409 when acquisitionBriefApplies is false against the FRESHLY composed report — a decision reached before this composition may no longer apply, and must never be honored on stale premises', async () => {
    mockAcquisitionBriefApplies.mockReturnValue(false);
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(mockApproveAcquisitionJob).not.toHaveBeenCalled();
    // The stale check reads the report composeAcquisitionPreconditions JUST
    // produced — never a cached or client-supplied report.
    expect(mockAcquisitionBriefApplies).toHaveBeenCalledWith(
      expect.objectContaining({ invariantCount: 11 }),
    );
  });
});

describe('POST acquisition/approve — precondition timeout (fail-closed)', () => {
  it('returns 503 and writes nothing when composeAcquisitionPreconditions reports a timeout', async () => {
    mockComposeAcquisitionPreconditions.mockResolvedValue({ ok: false, reason: 'timeout', deadlineMs: 15_000 });
    const res = await POST(makeRequest({}), { params: params('EXP-P1') });
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/safety budget/);
    expect(body.retryable).toBe(true);
    // Fail-closed: neither the acquisitionBriefApplies check nor the write
    // path ever runs when the precondition composition itself failed.
    expect(mockAcquisitionBriefApplies).not.toHaveBeenCalled();
    expect(mockGetActiveAcquisitionApproval).not.toHaveBeenCalled();
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

describe('POST acquisition/approve — the happy path (successful bounded confirmation)', () => {
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

/**
 * Cross-surface parity (2026-08-31 audit finding): the Laboratory's
 * "Approve & start acquisition" control (Track2ProgrammePanel.tsx's
 * CrystalAcquisitionPlan) previously called
 * POST /api/corpus-scout/institution-discovery/domain DIRECTLY — a route
 * with no acquisitionBriefApplies precondition and no
 * crystal_acquisition_approvals write, letting a steward bypass every
 * safety semantic THIS route enforces. Source-level canary: the Laboratory
 * control must call the SAME two canonical routes the Research Copilot
 * calls, and must never call the raw institution-discovery route from its
 * own approve handler.
 */
describe('Cross-surface parity — Laboratory and Research Copilot share one canonical approval pipeline', () => {
  const readSource = (relPath: string) => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const { join } = require('node:path') as typeof import('node:path');
    return readFileSync(join(process.cwd(), relPath), 'utf-8');
  };

  it('Track2ProgrammePanel.tsx\'s CrystalAcquisitionPlan.approve() calls the canonical approve + run-step routes', () => {
    const src = readSource('components/research/Track2ProgrammePanel.tsx');
    const approveFnStart = src.indexOf('const approve = useCallback(async () => {');
    expect(approveFnStart).toBeGreaterThan(-1);
    const approveFnEnd = src.indexOf('}, [brief, experimentId, onDone]);', approveFnStart);
    expect(approveFnEnd).toBeGreaterThan(approveFnStart);
    const approveFnSrc = src.slice(approveFnStart, approveFnEnd);

    expect(approveFnSrc).toContain('/api/research/programme/${encodeURIComponent(experimentId)}/acquisition/approve');
    expect(approveFnSrc).toContain('/api/research/programme/${encodeURIComponent(experimentId)}/acquisition/run-step');
    // The exact bypass this fix closes — must never be called from THIS handler.
    expect(approveFnSrc).not.toContain('/api/corpus-scout/institution-discovery/domain');
  });

  it('the legacy institution-discovery route still exists for its OWN unrelated purpose (DomainConstitutionPanel), untouched', () => {
    const src = readSource('components/corpusScout/DomainConstitutionPanel.tsx');
    expect(src).toContain('/api/corpus-scout/institution-discovery/domain');
  });

  it('both approve/route.ts and run-step/route.ts derive readiness through the SAME bounded scope — never two independently-scoped reads for one acquisition round', () => {
    const approveSrc = readSource('app/api/research/programme/[experimentId]/acquisition/approve/route.ts');
    const runStepSrc = readSource('app/api/research/programme/[experimentId]/acquisition/run-step/route.ts');
    expect(approveSrc).toContain('composeAcquisitionPreconditions');
    expect(runStepSrc).toMatch(/scope:\s*'acquisition-gate'/);
  });
});
