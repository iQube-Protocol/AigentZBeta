/**
 * POST /api/research/track2/[experimentId]/suggest-relationships — resolves
 * the candidate pool SERVER-SIDE from the current cohort, never from a
 * client-supplied member list, and delegates to the suggestion engine.
 * Read-only: writes nothing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockListCandidates = vi.fn();
vi.mock('@/services/invariants/discoveryEngine', () => ({
  listCandidates: (...args: any[]) => mockListCandidates(...args),
}));

const mockGetInvariantById = vi.fn();
vi.mock('@/services/invariants', () => ({
  getInvariantById: (...args: any[]) => mockGetInvariantById(...args),
}));

const mockReconcilePromotedCohort = vi.fn();
vi.mock('@/services/research/populationReconciliation', () => ({
  reconcilePromotedCohort: (...args: any[]) => mockReconcilePromotedCohort(...args),
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

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-steward', cartridgeFlags: { isAdmin: true } });
  mockListCandidates.mockReset();
  mockListCandidates.mockResolvedValue([{ id: 'c1', status: 'promoted' }]);
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

  it('refuses an invariant that is not a member of the current promoted cohort', async () => {
    mockReconcilePromotedCohort.mockResolvedValue({ invariantIds: ['inv-2'], members: [{ id: 'inv-2', label: 'other' }] });
    const res = await POST(makeRequest({ invariantId: 'inv-1' }), { params });
    expect(res.status).toBe(409);
    expect(mockSuggestRelationships).not.toHaveBeenCalled();
  });
});

describe('POST suggest-relationships — delegates to the engine, writes nothing', () => {
  it('calls suggestRelationships with the candidate statement and the cohort members, and returns its result', async () => {
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

  it('surfaces the engine refusal as a 502 rather than fabricating an empty success', async () => {
    mockSuggestRelationships.mockResolvedValue({ ok: false, error: 'relationship suggestion inference failed: timeout' });
    const res = await POST(makeRequest({ invariantId: 'inv-1' }), { params });
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body.ok).toBe(false);
    expect(body.error).toContain('inference failed');
  });
});
