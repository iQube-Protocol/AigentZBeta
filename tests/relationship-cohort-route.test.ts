/**
 * GET/POST /api/research/track2/[experimentId]/relationship-cohort
 * (2026-09-05) — the Steward's ONE ratification act for Track 2 Stage 7,
 * mirroring `tests/provenance-cohort-route.test.ts`'s own pattern.
 * Exercises: stale-cohort protection, idempotent/resumable execution (an
 * already-related member is skipped, never re-written), exceptions are
 * never written, and a rationale is required for a real write.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

vi.mock('@/app/api/_lib/supabaseServer', () => ({ getSupabaseServer: () => ({}) }));

const mockResolveSuccessorConstructionCohort = vi.fn();
const mockResolveFrozenPredecessorContext = vi.fn();
vi.mock('@/services/research/crystalCohortMembership', () => ({
  resolveSuccessorConstructionCohort: (...args: any[]) => mockResolveSuccessorConstructionCohort(...args),
  resolveFrozenPredecessorContext: (...args: any[]) => mockResolveFrozenPredecessorContext(...args),
}));

const mockReconcilePromotedCohort = vi.fn();
vi.mock('@/services/research/populationReconciliation', () => ({
  reconcilePromotedCohort: (...args: any[]) => mockReconcilePromotedCohort(...args),
}));

const mockPrepareRelationshipCohort = vi.fn();
vi.mock('@/services/research/relationshipCohortPreparation', () => ({
  prepareRelationshipCohort: (...args: any[]) => mockPrepareRelationshipCohort(...args),
  eligibleRelationshipCohortIds: (recs: any[]) => recs.filter((r) => r.disposition === 'ready').map((r) => r.invariantId),
  RELATIONSHIP_EXCEPTION_LABEL: {},
}));

const mockAddEdge = vi.fn();
const mockGetInvariantById = vi.fn();
const mockListEdgesForInvariants = vi.fn();
vi.mock('@/services/invariants', () => ({
  addEdge: (...args: any[]) => mockAddEdge(...args),
  getInvariantById: (...args: any[]) => mockGetInvariantById(...args),
  listEdgesForInvariants: (...args: any[]) => mockListEdgesForInvariants(...args),
}));

const mockWriteLifecycleReceipt = vi.fn();
vi.mock('@/services/research/lifecycle', () => ({
  writeLifecycleReceipt: (...args: any[]) => mockWriteLifecycleReceipt(...args),
}));

vi.mock('@/services/identity/personaReferences', () => ({ personaPublicRef: (id: string) => `pub:${id}` }));

import { GET, POST } from '@/app/api/research/track2/[experimentId]/relationship-cohort/route';
import { computeCohortHash } from '@/services/research/cohortAuthorization';

const params = Promise.resolve({ experimentId: 'EXP-P1' });

function makeGetRequest(): NextRequest {
  return { nextUrl: new URL('http://localhost/api/research/track2/EXP-P1/relationship-cohort') } as unknown as NextRequest;
}
function makePostRequest(body: unknown): NextRequest {
  return {
    nextUrl: new URL('http://localhost/api/research/track2/EXP-P1/relationship-cohort'),
    json: async () => body,
  } as unknown as NextRequest;
}

const readyRec = (id: string, relatedId: string, confidence = 40) => ({
  invariantId: id, label: id, disposition: 'ready',
  relatedInvariantId: relatedId, relatedLabel: relatedId, relationType: 'supports',
  rationale: 'cohort rationale', confidence, allSuggestions: [], exceptionCause: null, exceptionDetail: null,
});
const exceptionRec = (id: string, cause: string) => ({
  invariantId: id, label: id, disposition: 'exception',
  relatedInvariantId: null, relatedLabel: null, relationType: null, rationale: null, confidence: null,
  allSuggestions: [], exceptionCause: cause, exceptionDetail: 'detail',
});

beforeEach(() => {
  mockGetActivePersona.mockReset().mockResolvedValue({ personaId: 'persona-steward', cartridgeFlags: { isAdmin: true } });
  mockResolveSuccessorConstructionCohort.mockReset().mockResolvedValue({
    context: { frozenPredecessor: null, frozenGenerationMemberIds: null, frozenGenerationMembers: null },
    successorScopedCandidates: [{ id: 'c1', status: 'promoted' }],
    promotedForConstruction: [{ id: 'c1', status: 'promoted' }],
  });
  mockResolveFrozenPredecessorContext.mockReset().mockResolvedValue({ frozenPredecessor: null, frozenGenerationMemberIds: null });
  mockReconcilePromotedCohort.mockReset();
  mockPrepareRelationshipCohort.mockReset();
  mockAddEdge.mockReset();
  mockGetInvariantById.mockReset();
  mockListEdgesForInvariants.mockReset().mockResolvedValue([]);
  mockWriteLifecycleReceipt.mockReset().mockResolvedValue({ ok: true, receiptId: 'r-1' });
});

describe('GET relationship-cohort — auth + derivation', () => {
  it('refuses an unauthenticated caller', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await GET(makeGetRequest(), { params });
    expect(res.status).toBe(401);
  });

  it('refuses a non-steward caller', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p1', cartridgeFlags: { isAdmin: false } });
    const res = await GET(makeGetRequest(), { params });
    expect(res.status).toBe(403);
  });

  it('reports nothing to relate when the cohort has no orphan members', async () => {
    mockReconcilePromotedCohort.mockResolvedValue({ orphanRecords: [], members: [] });
    const res = await GET(makeGetRequest(), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.total).toBe(0);
    expect(body.cohortHash).toBe(computeCohortHash([]));
  });

  it('reports readyCount/exceptionCount and a matching cohort hash, never gated by confidence', async () => {
    mockReconcilePromotedCohort.mockResolvedValue({
      orphanRecords: [{ id: 'orphan-1', label: 'l', statement: 's' }, { id: 'orphan-2', label: 'l2', statement: 's2' }],
      members: [{ id: 'orphan-1', label: 'l', statement: 's' }, { id: 'orphan-2', label: 'l2', statement: 's2' }, { id: 'related-a', label: 'r', statement: 'r' }],
    });
    // Deliberately LOW confidence — still 'ready', proving the route never re-derives a threshold of its own.
    mockPrepareRelationshipCohort.mockResolvedValue({
      recommendations: [readyRec('orphan-1', 'related-a', 15), exceptionRec('orphan-2', 'no-writable-suggestion')],
    });

    const res = await GET(makeGetRequest(), { params });
    const body = await res.json();
    expect(body.readyCount).toBe(1);
    expect(body.exceptionCount).toBe(1);
    expect(body.cohortHash).toBe(computeCohortHash(['orphan-1']));
    expect(body.cohortInvariantIds).toEqual(['orphan-1']);
  });
});

describe('POST relationship-cohort — stale-cohort protection', () => {
  function setFreshCohort(readyIds: string[]) {
    mockReconcilePromotedCohort.mockResolvedValue({
      orphanRecords: readyIds.map((id) => ({ id, label: id, statement: id })),
      members: [...readyIds.map((id) => ({ id, label: id, statement: id })), { id: 'related-a', label: 'r', statement: 'r' }],
    });
    mockPrepareRelationshipCohort.mockResolvedValue({
      recommendations: readyIds.map((id) => readyRec(id, 'related-a')),
    });
  }

  it('refuses (409, recommendation-set-changed) when the fresh cohort no longer matches expectedCohortHash', async () => {
    setFreshCohort(['orphan-1']);
    const shownHash = computeCohortHash(['orphan-1', 'orphan-2']);
    const res = await POST(makePostRequest({ dryRun: false, rationale: 'ratify', expectedCohortHash: shownHash }), { params });
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error).toBe('recommendation-set-changed');
    expect(mockAddEdge).not.toHaveBeenCalled();
  });

  it('proceeds when the fresh cohort matches expectedCohortHash', async () => {
    setFreshCohort(['orphan-1']);
    mockGetInvariantById.mockResolvedValue({ id: 'orphan-1' });
    mockAddEdge.mockResolvedValue({ fromInvariantId: 'orphan-1', toInvariantId: 'related-a', edgeType: 'supports' });
    const hash = computeCohortHash(['orphan-1']);
    const res = await POST(makePostRequest({ dryRun: false, rationale: 'ratify', expectedCohortHash: hash }), { params });
    expect(res.status).toBe(200);
    expect(mockAddEdge).toHaveBeenCalledTimes(1);
  });

  it('never checks staleness on a dry run', async () => {
    setFreshCohort(['orphan-1']);
    const res = await POST(makePostRequest({ dryRun: true, expectedCohortHash: 'definitely-stale' }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dryRun).toBe(true);
  });
});

describe('POST relationship-cohort — the real write, resumability, and refusals', () => {
  it('requires a rationale for a real write', async () => {
    mockReconcilePromotedCohort.mockResolvedValue({ orphanRecords: [], members: [] });
    const res = await POST(makePostRequest({ dryRun: false }), { params });
    expect(res.status).toBe(400);
  });

  it('writes every ready member through addEdge with the chosen relationType/rationale', async () => {
    mockReconcilePromotedCohort.mockResolvedValue({
      orphanRecords: [{ id: 'orphan-1', label: 'l', statement: 's' }],
      members: [{ id: 'orphan-1', label: 'l', statement: 's' }, { id: 'related-a', label: 'r', statement: 'r' }],
    });
    mockPrepareRelationshipCohort.mockResolvedValue({ recommendations: [readyRec('orphan-1', 'related-a', 25)] });
    mockGetInvariantById.mockResolvedValue({ id: 'orphan-1' });
    mockAddEdge.mockResolvedValue({ fromInvariantId: 'orphan-1', toInvariantId: 'related-a', edgeType: 'supports' });

    const res = await POST(makePostRequest({ dryRun: false, rationale: 'cohort ratification' }), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.written).toBe(1);
    const [edgeInput] = mockAddEdge.mock.calls[0];
    expect(edgeInput.fromInvariantId).toBe('orphan-1');
    expect(edgeInput.toInvariantId).toBe('related-a');
    expect(edgeInput.edgeType).toBe('supports');
    expect(edgeInput.provenance.confidence).toBe(25);
  });

  it('RESUMABLE/IDEMPOTENT: a member that already has an edge (a partial prior run) is skipped, never re-written', async () => {
    mockReconcilePromotedCohort.mockResolvedValue({
      orphanRecords: [{ id: 'orphan-1', label: 'l', statement: 's' }],
      members: [{ id: 'orphan-1', label: 'l', statement: 's' }, { id: 'related-a', label: 'r', statement: 'r' }],
    });
    mockPrepareRelationshipCohort.mockResolvedValue({ recommendations: [readyRec('orphan-1', 'related-a')] });
    mockGetInvariantById.mockResolvedValue({ id: 'orphan-1' });
    // The FRESH re-read at write time shows an edge already exists (a prior partial run got there first).
    mockListEdgesForInvariants.mockResolvedValue([{ fromInvariantId: 'orphan-1', toInvariantId: 'related-a', edgeType: 'supports' }]);

    const res = await POST(makePostRequest({ dryRun: false, rationale: 'resume' }), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.written).toBe(0);
    expect(body.alreadyRelated).toBe(1);
    expect(mockAddEdge).not.toHaveBeenCalled();
  });

  it('never writes for an exception — exceptions are disclosed, never related', async () => {
    mockReconcilePromotedCohort.mockResolvedValue({
      orphanRecords: [{ id: 'orphan-1', label: 'l', statement: 's' }],
      members: [{ id: 'orphan-1', label: 'l', statement: 's' }],
    });
    mockPrepareRelationshipCohort.mockResolvedValue({ recommendations: [exceptionRec('orphan-1', 'no-writable-suggestion')] });

    const res = await POST(makePostRequest({ dryRun: false, rationale: 'ratify' }), { params });
    const body = await res.json();
    expect(body.written).toBe(0);
    expect(mockAddEdge).not.toHaveBeenCalled();
    expect(body.exceptions).toHaveLength(1);
  });

  it('writes ONE lifecycle receipt for the whole batch, and never rolls back a landed relationship when the receipt fails', async () => {
    mockReconcilePromotedCohort.mockResolvedValue({
      orphanRecords: [{ id: 'orphan-1', label: 'l', statement: 's' }],
      members: [{ id: 'orphan-1', label: 'l', statement: 's' }, { id: 'related-a', label: 'r', statement: 'r' }],
    });
    mockPrepareRelationshipCohort.mockResolvedValue({ recommendations: [readyRec('orphan-1', 'related-a')] });
    mockGetInvariantById.mockResolvedValue({ id: 'orphan-1' });
    mockAddEdge.mockResolvedValue({ fromInvariantId: 'orphan-1', toInvariantId: 'related-a', edgeType: 'supports' });
    mockWriteLifecycleReceipt.mockResolvedValue({ ok: false, receiptId: null });

    const res = await POST(makePostRequest({ dryRun: false, rationale: 'ratify' }), { params });
    const body = await res.json();
    expect(body.written).toBe(1);
    expect(body.receiptWritten).toBe(false);
    expect(body.receiptWarning).toMatch(/attributable record/);
    expect(mockWriteLifecycleReceipt).toHaveBeenCalledTimes(1);
  });

  it('a failed addEdge (e.g. a cycle refusal race) is counted as failed, never silently dropped', async () => {
    mockReconcilePromotedCohort.mockResolvedValue({
      orphanRecords: [{ id: 'orphan-1', label: 'l', statement: 's' }],
      members: [{ id: 'orphan-1', label: 'l', statement: 's' }, { id: 'related-a', label: 'r', statement: 'r' }],
    });
    mockPrepareRelationshipCohort.mockResolvedValue({ recommendations: [readyRec('orphan-1', 'related-a')] });
    mockGetInvariantById.mockResolvedValue({ id: 'orphan-1' });
    mockAddEdge.mockRejectedValue(new Error('edge would create a cycle'));

    const res = await POST(makePostRequest({ dryRun: false, rationale: 'ratify' }), { params });
    const body = await res.json();
    expect(body.failed).toBe(1);
    expect(body.written).toBe(0);
  });
});
