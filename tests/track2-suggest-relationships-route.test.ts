/**
 * POST /api/research/track2/[experimentId]/suggest-relationships — resolves
 * the candidate pool SERVER-SIDE from the current SUCCESSOR cohort (via the
 * shared `resolveSuccessorConstructionCohort`, 2026-08-31 fix), widened to
 * include the inherited predecessor's own members — never a client-supplied
 * member list, and never an arbitrary OTHER promoted invariant elsewhere in
 * the acquisition domain. Read-only: writes nothing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockGetInvariantById = vi.fn();
vi.mock('@/services/invariants', () => ({
  getInvariantById: (...args: any[]) => mockGetInvariantById(...args),
}));

const mockReconcilePromotedCohort = vi.fn();
vi.mock('@/services/research/populationReconciliation', () => ({
  reconcilePromotedCohort: (...args: any[]) => mockReconcilePromotedCohort(...args),
}));

const mockResolveSuccessorConstructionCohort = vi.fn();
vi.mock('@/services/research/crystalCohortMembership', () => ({
  resolveSuccessorConstructionCohort: (...args: any[]) => mockResolveSuccessorConstructionCohort(...args),
}));

const mockSuggestRelationships = vi.fn();
vi.mock('@/services/invariants/relationshipSuggestion', () => ({
  suggestRelationships: (...args: any[]) => mockSuggestRelationships(...args),
}));

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({}),
}));

import { POST } from '@/app/api/research/track2/[experimentId]/suggest-relationships/route';

function makeRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
    nextUrl: new URL('http://localhost/api/research/track2/EXP-P1/suggest-relationships'),
  } as unknown as NextRequest;
}

const params = Promise.resolve({ experimentId: 'EXP-P1' });

const NO_FROZEN_PREDECESSOR = { frozenPredecessor: null, frozenGenerationMemberIds: null, frozenGenerationMembers: null };

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-steward', cartridgeFlags: { isAdmin: true } });
  mockResolveSuccessorConstructionCohort.mockReset();
  mockResolveSuccessorConstructionCohort.mockResolvedValue({
    context: NO_FROZEN_PREDECESSOR,
    successorScopedCandidates: [{ id: 'c1', status: 'promoted' }],
    promotedForConstruction: [{ id: 'c1', status: 'promoted' }],
  });
  mockGetInvariantById.mockReset();
  mockGetInvariantById.mockResolvedValue({ id: 'inv-1', statement: 'candidate statement' });
  mockReconcilePromotedCohort.mockReset();
  mockReconcilePromotedCohort.mockResolvedValue({
    invariantIds: ['inv-1', 'inv-2'],
    members: [{ id: 'inv-1', label: 'candidate statement' }, { id: 'inv-2', label: 'other' }],
  });
  mockSuggestRelationships.mockReset();
  mockSuggestRelationships.mockResolvedValue({ ok: true, suggestions: [] });
});

describe('POST suggest-relationships — auth and validation', () => {
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
  });

  it('refuses an unknown experiment', async () => {
    const res = await POST(makeRequest({ invariantId: 'inv-1' }), { params: Promise.resolve({ experimentId: 'not-real' }) });
    expect(res.status).toBe(404);
  });

  it('refuses an invariant that is not a member of the current successor construction cohort', async () => {
    mockReconcilePromotedCohort.mockResolvedValue({ invariantIds: ['inv-2'], members: [{ id: 'inv-2', label: 'other' }] });
    const res = await POST(makeRequest({ invariantId: 'inv-1' }), { params });
    expect(res.status).toBe(409);
    expect(mockSuggestRelationships).not.toHaveBeenCalled();
  });

  it('resolves the cohort through the SHARED successor-scoping resolver, never a raw unscoped candidate list', async () => {
    await POST(makeRequest({ invariantId: 'inv-1' }), { params });
    expect(mockResolveSuccessorConstructionCohort).toHaveBeenCalledWith(expect.anything(), 'EXP-P1', 'financial-services');
    expect(mockReconcilePromotedCohort).toHaveBeenCalledWith([{ id: 'c1', status: 'promoted' }]);
  });
});

describe('POST suggest-relationships — delegates to the engine, writes nothing', () => {
  it('calls suggestRelationships with the candidate statement and the successor cohort members, and returns its result', async () => {
    mockSuggestRelationships.mockResolvedValue({
      ok: true,
      suggestions: [{ relatedInvariantId: 'inv-2', relatedLabel: 'other', relationType: 'supports', rationale: 'x', confidence: 90 }],
    });
    const res = await POST(makeRequest({ invariantId: 'inv-1' }), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(mockSuggestRelationships).toHaveBeenCalledWith(
      { id: 'inv-1', statement: 'candidate statement' },
      [{ id: 'inv-1', label: 'candidate statement' }, { id: 'inv-2', label: 'other' }],
    );
    expect(body.suggestions).toHaveLength(1);
  });

  it('THE FIX — appends inherited predecessor members to the candidate pool (a new member may relate backward into inherited Crystal structure)', async () => {
    mockResolveSuccessorConstructionCohort.mockResolvedValue({
      context: {
        frozenPredecessor: { id: 'art-1' },
        frozenGenerationMemberIds: new Set(['inv-inherited-1']),
        frozenGenerationMembers: [{ id: 'inv-inherited-1', statement: 'Risk management is a fundamental component of financial services.' }],
      },
      successorScopedCandidates: [{ id: 'c1', status: 'promoted' }],
      promotedForConstruction: [{ id: 'c1', status: 'promoted' }],
    });
    await POST(makeRequest({ invariantId: 'inv-1' }), { params });
    expect(mockSuggestRelationships).toHaveBeenCalledWith(
      { id: 'inv-1', statement: 'candidate statement' },
      [
        { id: 'inv-1', label: 'candidate statement' },
        { id: 'inv-2', label: 'other' },
        { id: 'inv-inherited-1', statement: 'Risk management is a fundamental component of financial services.' },
      ],
    );
  });

  it('never offers an arbitrary out-of-Crystal candidate — the pool is bounded to successor members + resolveSuccessorConstructionCohort\'s own inherited members, nothing else', async () => {
    // Confirms the route no longer reads raw listCandidates()/all-history
    // promoted invariants — resolveSuccessorConstructionCohort is the ONLY
    // source of the candidate pool's membership.
    await POST(makeRequest({ invariantId: 'inv-1' }), { params });
    const [, pool] = mockSuggestRelationships.mock.calls.at(-1)!;
    expect(pool).toEqual([{ id: 'inv-1', label: 'candidate statement' }, { id: 'inv-2', label: 'other' }]);
  });

  it('surfaces the engine refusal as a 502 rather than fabricating an empty success', async () => {
    mockSuggestRelationships.mockResolvedValue({ ok: false, error: 'relationship suggestion inference failed: timeout' });
    const res = await POST(makeRequest({ invariantId: 'inv-1' }), { params });
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body.ok).toBe(false);
    expect(body.error).toContain('inference failed');
  });

  it('surfaces a cohort read failure as a 502', async () => {
    mockResolveSuccessorConstructionCohort.mockResolvedValue({
      context: NO_FROZEN_PREDECESSOR,
      successorScopedCandidates: null,
      promotedForConstruction: null,
    });
    const res = await POST(makeRequest({ invariantId: 'inv-1' }), { params });
    expect(res.status).toBe(502);
  });
});
