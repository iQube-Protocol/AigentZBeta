/**
 * POST /api/research/track2/[experimentId]/validate-all (al, 2026-08-04,
 * steward-workflow ruling) — the ONE genuine batch action among Stages 5-7:
 * validation is a machine-run gate with no per-record human content, so a
 * real "Validate All" is honest here. Resolves its own targets server-side
 * from the cohort, calls the EXISTING `validateInvariant` per id, and
 * discloses partial failure the same way reconcile/route.ts does.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockValidateInvariant = vi.fn();
vi.mock('@/services/invariants', () => ({
  validateInvariant: (...args: any[]) => mockValidateInvariant(...args),
}));

const mockReconcilePromotedCohort = vi.fn();
vi.mock('@/services/research/populationReconciliation', () => ({
  reconcilePromotedCohort: (...args: any[]) => mockReconcilePromotedCohort(...args),
}));

const mockResolveSuccessorConstructionCohort = vi.fn();
vi.mock('@/services/research/crystalCohortMembership', () => ({
  resolveSuccessorConstructionCohort: (...args: any[]) => mockResolveSuccessorConstructionCohort(...args),
}));

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({}),
}));

import { POST } from '@/app/api/research/track2/[experimentId]/validate-all/route';

function makeRequest(): NextRequest {
  return { nextUrl: new URL('http://localhost/api/research/track2/EXP-P1/validate-all') } as unknown as NextRequest;
}

const params = Promise.resolve({ experimentId: 'EXP-P1' });

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-steward', cartridgeFlags: { isAdmin: true } });
  mockValidateInvariant.mockReset();
  mockResolveSuccessorConstructionCohort.mockReset();
  mockResolveSuccessorConstructionCohort.mockResolvedValue({
    context: { frozenPredecessor: null, frozenGenerationMemberIds: null, frozenGenerationMembers: null },
    successorScopedCandidates: [{ id: 'c1', status: 'promoted' }],
    promotedForConstruction: [{ id: 'c1', status: 'promoted' }],
  });
  mockReconcilePromotedCohort.mockReset();
});

describe('POST validate-all — auth', () => {
  it('refuses an unauthenticated caller', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await POST(makeRequest(), { params });
    expect(res.status).toBe(401);
  });

  it('refuses a non-steward caller', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p1', cartridgeFlags: { isAdmin: false } });
    const res = await POST(makeRequest(), { params });
    expect(res.status).toBe(403);
  });

  it('refuses an unknown experiment', async () => {
    const res = await POST(makeRequest(), { params: Promise.resolve({ experimentId: 'not-real' }) });
    expect(res.status).toBe(404);
  });
});

describe('POST validate-all — successor-scoped cohort resolution (2026-08-31 fix)', () => {
  it('resolves its batch through the SHARED successor-scoping resolver, never a raw unscoped candidate list', async () => {
    mockReconcilePromotedCohort.mockResolvedValue({ unvalidatedRecords: [] });
    await POST(makeRequest(), { params });
    expect(mockResolveSuccessorConstructionCohort).toHaveBeenCalledWith(expect.anything(), 'EXP-P1', 'financial-services');
    expect(mockReconcilePromotedCohort).toHaveBeenCalledWith([{ id: 'c1', status: 'promoted' }]);
  });

  it('never validates a frozen predecessor candidate — the resolver already excluded it before this route ever sees it', async () => {
    // The resolver itself is mocked here to only ever hand back v2-scoped
    // candidates (its own unit tests in crystal-cohort-membership.test.ts
    // prove the exclusion logic) — this test proves the ROUTE consumes
    // exactly what the resolver returns, adding no candidates of its own.
    mockResolveSuccessorConstructionCohort.mockResolvedValue({
      context: { frozenPredecessor: { id: 'art-1' }, frozenGenerationMemberIds: new Set(['inv-inherited-1']), frozenGenerationMembers: [] },
      successorScopedCandidates: [{ id: 'c-new-only', status: 'promoted' }],
      promotedForConstruction: [{ id: 'c-new-only', status: 'promoted' }],
    });
    mockReconcilePromotedCohort.mockResolvedValue({ unvalidatedRecords: [] });
    await POST(makeRequest(), { params });
    expect(mockReconcilePromotedCohort).toHaveBeenCalledWith([{ id: 'c-new-only', status: 'promoted' }]);
  });

  it('surfaces a cohort read failure as a 502', async () => {
    mockResolveSuccessorConstructionCohort.mockResolvedValue({
      context: { frozenPredecessor: null, frozenGenerationMemberIds: null, frozenGenerationMembers: null },
      successorScopedCandidates: null,
      promotedForConstruction: null,
    });
    const res = await POST(makeRequest(), { params });
    expect(res.status).toBe(502);
  });
});

describe('POST validate-all — batch behaviour', () => {
  it('reports nothing to do when the cohort has no unvalidated members', async () => {
    mockReconcilePromotedCohort.mockResolvedValue({ unvalidatedRecords: [] });
    const res = await POST(makeRequest(), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.outcomes).toEqual([]);
  });

  it('validates every unvalidated cohort member and reports 200 when all succeed', async () => {
    mockReconcilePromotedCohort.mockResolvedValue({
      unvalidatedRecords: [{ id: 'inv-1', label: 'a' }, { id: 'inv-2', label: 'b' }],
    });
    mockValidateInvariant
      .mockResolvedValueOnce({ invariant: {}, verdict: { ok: true, checks: [] } })
      .mockResolvedValueOnce({ invariant: {}, verdict: { ok: true, checks: [] } });
    const res = await POST(makeRequest(), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockValidateInvariant).toHaveBeenCalledWith('inv-1', { personaId: 'persona-steward' });
    expect(mockValidateInvariant).toHaveBeenCalledWith('inv-2', { personaId: 'persona-steward' });
    expect(body.outcomes).toEqual([
      { invariantId: 'inv-1', ok: true, detail: 'validated', checks: [] },
      { invariantId: 'inv-2', ok: true, detail: 'validated', checks: [] },
    ]);
  });

  it('discloses a per-record gate failure without failing the whole batch as an HTTP error', async () => {
    mockReconcilePromotedCohort.mockResolvedValue({
      unvalidatedRecords: [{ id: 'inv-1', label: 'a' }, { id: 'inv-2', label: 'b' }],
    });
    mockValidateInvariant
      .mockResolvedValueOnce({ invariant: {}, verdict: { ok: true, checks: [] } })
      .mockResolvedValueOnce({
        invariant: {},
        verdict: { ok: false, checks: [{ name: 'groundedness', passed: false, detail: 'no evidence' }] },
      });
    const res = await POST(makeRequest(), { params });
    const body = await res.json();
    expect(res.status).toBe(207);
    expect(body.ok).toBe(false);
    expect(body.outcomes[1]).toMatchObject({ invariantId: 'inv-2', ok: false, detail: 'groundedness: no evidence' });
    expect(body.outcomes[1].checks).toEqual([{ name: 'groundedness', passed: false, detail: 'no evidence' }]);
  });

  it('catches a thrown error from one record without losing the other outcomes', async () => {
    mockReconcilePromotedCohort.mockResolvedValue({
      unvalidatedRecords: [{ id: 'inv-1', label: 'a' }, { id: 'inv-ghost', label: 'b' }],
    });
    mockValidateInvariant
      .mockResolvedValueOnce({ invariant: {}, verdict: { ok: true, checks: [] } })
      .mockRejectedValueOnce(new Error('invariant not found'));
    const res = await POST(makeRequest(), { params });
    const body = await res.json();
    expect(res.status).toBe(207);
    expect(body.outcomes).toHaveLength(2);
    expect(body.outcomes[1]).toMatchObject({ invariantId: 'inv-ghost', ok: false, detail: 'invariant not found' });
  });
});
