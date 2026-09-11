/**
 * POST /api/research/track2/[experimentId]/relationship-adjudication — the
 * steward act for "a crystal member may legitimately have zero
 * relationships" (operator report, 2026-08-31). Resolves cohort membership
 * SERVER-SIDE (never client-supplied) and delegates the actual write to
 * services/research/crystalRelationshipAdjudication.ts — this route holds
 * no rule of its own beyond auth + cohort-membership validation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockResolveSuccessorConstructionCohort = vi.fn();
vi.mock('@/services/research/crystalCohortMembership', () => ({
  resolveSuccessorConstructionCohort: (...args: any[]) => mockResolveSuccessorConstructionCohort(...args),
  // Real implementation — pure union logic, no reason to fake it.
  resolveTargetCrystalMembershipUniverse: (
    context: { frozenGenerationMemberIds: Set<string> | null },
    successorMemberIds: string[],
  ) => {
    const inheritedMemberIds = context.frozenGenerationMemberIds ?? new Set<string>();
    return { memberIds: new Set([...inheritedMemberIds, ...successorMemberIds]), inheritedMemberIds, inheritedMembers: [] };
  },
}));

const mockReconcilePromotedCohort = vi.fn();
vi.mock('@/services/research/populationReconciliation', () => ({
  reconcilePromotedCohort: (...args: any[]) => mockReconcilePromotedCohort(...args),
}));

const mockRecordNoDefensibleEdgeAdjudication = vi.fn();
vi.mock('@/services/research/crystalRelationshipAdjudication', () => ({
  recordNoDefensibleEdgeAdjudication: (...args: any[]) => mockRecordNoDefensibleEdgeAdjudication(...args),
}));

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({}),
}));

import { POST } from '@/app/api/research/track2/[experimentId]/relationship-adjudication/route';

function makeRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
    nextUrl: new URL('http://localhost/api/research/track2/EXP-P1/relationship-adjudication'),
  } as unknown as NextRequest;
}

const params = Promise.resolve({ experimentId: 'EXP-P1' });

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-steward', cartridgeFlags: { isAdmin: true } });
  mockResolveSuccessorConstructionCohort.mockReset();
  mockResolveSuccessorConstructionCohort.mockResolvedValue({
    context: { frozenPredecessor: null, frozenGenerationMemberIds: null, frozenGenerationMembers: null },
    successorScopedCandidates: [{ id: 'c1', status: 'promoted' }],
    promotedForConstruction: [{ id: 'c1', status: 'promoted' }],
  });
  mockReconcilePromotedCohort.mockReset();
  mockReconcilePromotedCohort.mockResolvedValue({ invariantIds: ['inv-1', 'inv-2'] });
  mockRecordNoDefensibleEdgeAdjudication.mockReset();
  mockRecordNoDefensibleEdgeAdjudication.mockResolvedValue({
    ok: true,
    adjudication: { id: 'row-1', cohortFingerprint: 'fp-1', adjudicatedAt: '2026-08-31T00:00:00Z' },
  });
});

describe('POST relationship-adjudication — auth and validation', () => {
  it('refuses an unauthenticated caller', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await POST(makeRequest({ invariantId: 'inv-1' }), { params });
    expect(res.status).toBe(401);
  });

  it('refuses a non-steward caller', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p1', cartridgeFlags: { isAdmin: false } });
    const res = await POST(makeRequest({ invariantId: 'inv-1' }), { params });
    expect(res.status).toBe(403);
  });

  it('refuses a request with no invariantId', async () => {
    const res = await POST(makeRequest({}), { params });
    expect(res.status).toBe(400);
    expect(mockRecordNoDefensibleEdgeAdjudication).not.toHaveBeenCalled();
  });

  it('refuses an unknown experiment', async () => {
    const res = await POST(makeRequest({ invariantId: 'inv-1' }), { params: Promise.resolve({ experimentId: 'not-real' }) });
    expect(res.status).toBe(404);
  });

  it('refuses an invariant that is not a member of the current promoted cohort — never adjudicates a non-member', async () => {
    mockReconcilePromotedCohort.mockResolvedValue({ invariantIds: ['inv-2'] });
    const res = await POST(makeRequest({ invariantId: 'inv-1' }), { params });
    expect(res.status).toBe(409);
    expect(mockRecordNoDefensibleEdgeAdjudication).not.toHaveBeenCalled();
  });
});

describe('POST relationship-adjudication — records the fact, never an edge', () => {
  it('calls recordNoDefensibleEdgeAdjudication with the SERVER-resolved cohort membership', async () => {
    const res = await POST(makeRequest({ invariantId: 'inv-1', reviewedCandidateIds: ['inv-2:supports'] }), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockRecordNoDefensibleEdgeAdjudication).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        experimentId: 'EXP-P1',
        invariantId: 'inv-1',
        cohortMemberIds: ['inv-1', 'inv-2'],
        adjudicatedByPersonaId: 'persona-steward',
        reviewedCandidateIds: ['inv-2:supports'],
      }),
    );
  });

  it('ignores a client-supplied cohortMemberIds-shaped field — membership always comes from the server-resolved cohort', async () => {
    // No such field exists on the request body schema at all; this proves
    // the route reads cohort.invariantIds, not anything from `body`.
    await POST(makeRequest({ invariantId: 'inv-1', cohortMemberIds: ['inv-999'] }), { params });
    expect(mockRecordNoDefensibleEdgeAdjudication).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ cohortMemberIds: ['inv-1', 'inv-2'] }),
    );
  });

  it('surfaces a write failure as a 500 rather than fabricating success', async () => {
    mockRecordNoDefensibleEdgeAdjudication.mockResolvedValue({ ok: false, error: 'insert failed' });
    const res = await POST(makeRequest({ invariantId: 'inv-1' }), { params });
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('insert failed');
  });

  it('THE FIX — the fingerprint (cohortMemberIds) includes the inherited predecessor members too, not just the successor cohort', async () => {
    mockResolveSuccessorConstructionCohort.mockResolvedValue({
      context: {
        frozenPredecessor: { id: 'art-1' },
        frozenGenerationMemberIds: new Set(['inv-inherited-1']),
        frozenGenerationMembers: [],
      },
      successorScopedCandidates: [{ id: 'c1', status: 'promoted' }],
      promotedForConstruction: [{ id: 'c1', status: 'promoted' }],
    });
    await POST(makeRequest({ invariantId: 'inv-1' }), { params });
    const call = mockRecordNoDefensibleEdgeAdjudication.mock.calls.at(-1)![1];
    expect(new Set(call.cohortMemberIds)).toEqual(new Set(['inv-1', 'inv-2', 'inv-inherited-1']));
  });

  it('membership validation still checks the SUCCESSOR cohort only — only new members are adjudicated, never an inherited one', async () => {
    // cohort.invariantIds (from reconcilePromotedCohort) never includes
    // inherited ids — this proves the 409 gate reads that, not the wider
    // target-Crystal universe.
    mockResolveSuccessorConstructionCohort.mockResolvedValue({
      context: {
        frozenPredecessor: { id: 'art-1' },
        frozenGenerationMemberIds: new Set(['inv-inherited-1']),
        frozenGenerationMembers: [],
      },
      successorScopedCandidates: [{ id: 'c1', status: 'promoted' }],
      promotedForConstruction: [{ id: 'c1', status: 'promoted' }],
    });
    const res = await POST(makeRequest({ invariantId: 'inv-inherited-1' }), { params });
    expect(res.status).toBe(409);
    expect(mockRecordNoDefensibleEdgeAdjudication).not.toHaveBeenCalled();
  });
});
