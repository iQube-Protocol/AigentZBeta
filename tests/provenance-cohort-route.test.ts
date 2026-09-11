/**
 * GET/POST /api/research/track2/[experimentId]/provenance-cohort
 * (2026-09-03) — the Steward's ONE ratification act for Track 2 Stage 5.
 * Exercises: stale-cohort protection (mirrors bulk-review's
 * `expectedCohortHash` pattern), idempotent/resumable execution (an
 * already-classified member is skipped, never re-classified), exceptions
 * are never written, and the immediate machine-safe Validate chain after a
 * successful write.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

vi.mock('@/app/api/_lib/supabaseServer', () => ({ getSupabaseServer: () => ({}) }));

const mockResolveSuccessorConstructionCohort = vi.fn();
vi.mock('@/services/research/crystalCohortMembership', () => ({
  resolveSuccessorConstructionCohort: (...args: any[]) => mockResolveSuccessorConstructionCohort(...args),
}));

const mockReconcilePromotedCohort = vi.fn();
vi.mock('@/services/research/populationReconciliation', () => ({
  reconcilePromotedCohort: (...args: any[]) => mockReconcilePromotedCohort(...args),
}));

const mockGetInvariantsByIds = vi.fn();
const mockGetInvariantById = vi.fn();
const mockUpdateInvariant = vi.fn();
vi.mock('@/services/invariants/store', () => ({
  getInvariantsByIds: (...args: any[]) => mockGetInvariantsByIds(...args),
  getInvariantById: (...args: any[]) => mockGetInvariantById(...args),
  updateInvariant: (...args: any[]) => mockUpdateInvariant(...args),
}));

const mockPrepareProvenanceCohort = vi.fn();
vi.mock('@/services/research/provenanceCohortPreparation', () => ({
  prepareProvenanceCohort: (...args: any[]) => mockPrepareProvenanceCohort(...args),
  eligibleProvenanceCohortIds: (recs: any[]) => recs.filter((r) => r.disposition === 'ready').map((r) => r.invariantId),
  PROVENANCE_EXCEPTION_LABEL: {},
}));

const mockApplyProvenanceReclassification = vi.fn();
vi.mock('@/services/research/experimentalPopulations', () => ({
  applyProvenanceReclassification: (...args: any[]) => mockApplyProvenanceReclassification(...args),
  readEvidenceProvenance: (p: any) => (p && p.provenanceClass) || null,
}));

const mockValidateInvariant = vi.fn();
vi.mock('@/services/invariants', () => ({
  validateInvariant: (...args: any[]) => mockValidateInvariant(...args),
}));

const mockWriteLifecycleReceipt = vi.fn();
vi.mock('@/services/research/lifecycle', () => ({
  writeLifecycleReceipt: (...args: any[]) => mockWriteLifecycleReceipt(...args),
}));

vi.mock('@/services/identity/personaReferences', () => ({ personaPublicRef: (id: string) => `pub:${id}` }));

import { GET, POST } from '@/app/api/research/track2/[experimentId]/provenance-cohort/route';
import { computeCohortHash } from '@/services/research/cohortAuthorization';

const params = Promise.resolve({ experimentId: 'EXP-P1' });

function makeGetRequest(): NextRequest {
  return { nextUrl: new URL('http://localhost/api/research/track2/EXP-P1/provenance-cohort') } as unknown as NextRequest;
}
function makePostRequest(body: unknown): NextRequest {
  return {
    nextUrl: new URL('http://localhost/api/research/track2/EXP-P1/provenance-cohort'),
    json: async () => body,
  } as unknown as NextRequest;
}

const readyRec = (id: string, refs: string[]) => ({
  invariantId: id, label: id, disposition: 'ready', evidenceRefs: refs, signature: refs.join('|'),
  proposedClass: 'external-established', confidence: 90, primarySource: refs[0], supportingSources: [],
  reason: 'EU regulation',
});
const exceptionRec = (id: string, cause: string) => ({
  invariantId: id, label: id, disposition: 'exception', evidenceRefs: [], signature: '',
  proposedClass: null, confidence: null, primarySource: null, supportingSources: [],
  reason: null, exceptionCause: cause, exceptionDetail: 'detail',
});

beforeEach(() => {
  mockGetActivePersona.mockReset().mockResolvedValue({ personaId: 'persona-steward', cartridgeFlags: { isAdmin: true } });
  mockResolveSuccessorConstructionCohort.mockReset().mockResolvedValue({
    context: { frozenPredecessor: null, frozenGenerationMemberIds: null, frozenGenerationMembers: null },
    successorScopedCandidates: [{ id: 'c1', status: 'promoted' }],
    promotedForConstruction: [{ id: 'c1', status: 'promoted' }],
  });
  mockReconcilePromotedCohort.mockReset();
  mockGetInvariantsByIds.mockReset().mockResolvedValue([]);
  mockGetInvariantById.mockReset();
  mockUpdateInvariant.mockReset().mockResolvedValue({});
  mockPrepareProvenanceCohort.mockReset();
  mockApplyProvenanceReclassification.mockReset();
  mockValidateInvariant.mockReset();
  mockWriteLifecycleReceipt.mockReset().mockResolvedValue({ ok: true, receiptId: 'r-1' });
});

describe('GET provenance-cohort — auth + derivation', () => {
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

  it('reports nothing to classify when the cohort has no unclassified members', async () => {
    mockReconcilePromotedCohort.mockResolvedValue({ unclassifiedRecords: [] });
    const res = await GET(makeGetRequest(), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.total).toBe(0);
    expect(body.cohortHash).toBe(computeCohortHash([]));
  });

  it('reproduces the live 48-ready / 7-exception shape and computes a matching cohort hash', async () => {
    mockReconcilePromotedCohort.mockResolvedValue({
      unclassifiedRecords: Array.from({ length: 55 }, (_, i) => ({ id: `inv-${i}`, label: `l${i}`, statement: `s${i}` })),
    });
    mockGetInvariantsByIds.mockResolvedValue(
      Array.from({ length: 55 }, (_, i) => ({ id: `inv-${i}`, statement: `s${i}`, provenance: null })),
    );
    const readyIds = Array.from({ length: 48 }, (_, i) => `inv-${i}`);
    const exceptionIds = Array.from({ length: 7 }, (_, i) => `inv-${48 + i}`);
    mockPrepareProvenanceCohort.mockResolvedValue({
      recommendations: [
        ...readyIds.map((id) => readyRec(id, ['https://eur-lex.europa.eu/mica'])),
        ...exceptionIds.map((id) => exceptionRec(id, 'repo-internal-citation')),
      ],
    });

    const res = await GET(makeGetRequest(), { params });
    const body = await res.json();
    expect(body.readyCount).toBe(48);
    expect(body.exceptionCount).toBe(7);
    expect(body.cohortHash).toBe(computeCohortHash(readyIds));
    expect(new Set(body.cohortInvariantIds)).toEqual(new Set(readyIds));
  });
});

describe('POST provenance-cohort — stale-cohort protection', () => {
  function setFreshCohort(readyIds: string[]) {
    mockReconcilePromotedCohort.mockResolvedValue({
      unclassifiedRecords: readyIds.map((id) => ({ id, label: id, statement: id })),
    });
    mockGetInvariantsByIds.mockResolvedValue(readyIds.map((id) => ({ id, statement: id, provenance: null })));
    mockPrepareProvenanceCohort.mockResolvedValue({
      recommendations: readyIds.map((id) => readyRec(id, ['https://eur-lex.europa.eu/mica'])),
    });
  }

  it('refuses (409, recommendation-set-changed) when the fresh cohort no longer matches expectedCohortHash', async () => {
    setFreshCohort(['inv-1', 'inv-2']); // fresh only has 2 — one was independently decided since the hash was shown
    const shownHash = computeCohortHash(['inv-1', 'inv-2', 'inv-3']);
    const res = await POST(makePostRequest({ dryRun: false, rationale: 'ratify', expectedCohortHash: shownHash }), { params });
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error).toBe('recommendation-set-changed');
    expect(mockApplyProvenanceReclassification).not.toHaveBeenCalled();
  });

  it('proceeds when the fresh cohort matches expectedCohortHash', async () => {
    setFreshCohort(['inv-1']);
    mockGetInvariantById.mockResolvedValue({ id: 'inv-1', provenance: null });
    mockApplyProvenanceReclassification.mockReturnValue({ ok: true, from: null, to: 'external-established', provenance: {} });
    const hash = computeCohortHash(['inv-1']);
    const res = await POST(makePostRequest({ dryRun: false, rationale: 'ratify', expectedCohortHash: hash }), { params });
    expect(res.status).toBe(200);
    expect(mockApplyProvenanceReclassification).toHaveBeenCalledTimes(1);
  });

  it('never checks staleness on a dry run', async () => {
    setFreshCohort(['inv-1']);
    const res = await POST(makePostRequest({ dryRun: true, expectedCohortHash: 'definitely-stale' }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dryRun).toBe(true);
  });
});

describe('POST provenance-cohort — the real write, resumability, and refusals', () => {
  it('requires a rationale for a real write', async () => {
    mockReconcilePromotedCohort.mockResolvedValue({ unclassifiedRecords: [] });
    const res = await POST(makePostRequest({ dryRun: false }), { params });
    expect(res.status).toBe(400);
  });

  it('classifies every ready member through applyProvenanceReclassification with recommendation-accepted, using ONLY its own resolved evidenceRefs', async () => {
    mockReconcilePromotedCohort.mockResolvedValue({
      unclassifiedRecords: [{ id: 'inv-1', label: 'l', statement: 's' }],
    });
    mockGetInvariantsByIds.mockResolvedValue([{ id: 'inv-1', statement: 's', provenance: null }]);
    mockPrepareProvenanceCohort.mockResolvedValue({ recommendations: [readyRec('inv-1', ['https://eur-lex.europa.eu/mica'])] });
    mockGetInvariantById.mockResolvedValue({ id: 'inv-1', provenance: null });
    mockApplyProvenanceReclassification.mockReturnValue({ ok: true, from: null, to: 'external-established', provenance: { provenanceClass: 'external-established' } });

    const res = await POST(makePostRequest({ dryRun: false, rationale: 'cohort ratification' }), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.written).toBe(1);
    const [, event] = mockApplyProvenanceReclassification.mock.calls[0];
    expect(event.classDisposition).toBe('recommendation-accepted');
    expect(event.evidenceRefs).toEqual(['https://eur-lex.europa.eu/mica']);
    expect(event.acceptedRecommendation.suggestedClass).toBe('external-established');
    expect(mockUpdateInvariant).toHaveBeenCalledWith('inv-1', { provenance: { provenanceClass: 'external-established' } });
  });

  it('RESUMABLE/IDEMPOTENT: an already-classified member (a partial prior run) is skipped, never re-classified', async () => {
    mockReconcilePromotedCohort.mockResolvedValue({
      unclassifiedRecords: [{ id: 'inv-1', label: 'l', statement: 's' }],
    });
    mockGetInvariantsByIds.mockResolvedValue([{ id: 'inv-1', statement: 's', provenance: null }]);
    mockPrepareProvenanceCohort.mockResolvedValue({ recommendations: [readyRec('inv-1', ['https://eur-lex.europa.eu/mica'])] });
    // The FRESH re-read at write time shows it was ALREADY classified (a prior partial run got there first).
    mockGetInvariantById.mockResolvedValue({ id: 'inv-1', provenance: { provenanceClass: 'external-established' } });

    const res = await POST(makePostRequest({ dryRun: false, rationale: 'resume' }), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.written).toBe(0);
    expect(body.alreadyClassified).toBe(1);
    expect(mockApplyProvenanceReclassification).not.toHaveBeenCalled();
  });

  it('never writes for an exception — exceptions are disclosed, never classified', async () => {
    mockReconcilePromotedCohort.mockResolvedValue({
      unclassifiedRecords: [{ id: 'inv-1', label: 'l', statement: 's' }],
    });
    mockGetInvariantsByIds.mockResolvedValue([{ id: 'inv-1', statement: 's', provenance: null }]);
    mockPrepareProvenanceCohort.mockResolvedValue({ recommendations: [exceptionRec('inv-1', 'repo-internal-citation')] });

    const res = await POST(makePostRequest({ dryRun: false, rationale: 'ratify' }), { params });
    const body = await res.json();
    expect(body.written).toBe(0);
    expect(mockApplyProvenanceReclassification).not.toHaveBeenCalled();
    expect(body.exceptions).toHaveLength(1);
  });

  it('immediately runs Validate (machine-safe) over the newly-eligible cohort after a successful write', async () => {
    mockReconcilePromotedCohort
      .mockResolvedValueOnce({ unclassifiedRecords: [{ id: 'inv-1', label: 'l', statement: 's' }] }) // pre-write triage
      .mockResolvedValueOnce({ unvalidatedRecords: [{ id: 'inv-1', label: 'l' }, { id: 'inv-2', label: 'l2' }] }); // post-write validate scan
    mockGetInvariantsByIds.mockResolvedValue([{ id: 'inv-1', statement: 's', provenance: null }]);
    mockPrepareProvenanceCohort.mockResolvedValue({ recommendations: [readyRec('inv-1', ['https://eur-lex.europa.eu/mica'])] });
    mockGetInvariantById.mockResolvedValue({ id: 'inv-1', provenance: null });
    mockApplyProvenanceReclassification.mockReturnValue({ ok: true, from: null, to: 'external-established', provenance: {} });
    mockValidateInvariant
      .mockResolvedValueOnce({ verdict: { ok: true, checks: [] } })
      .mockResolvedValueOnce({ verdict: { ok: true, checks: [] } });

    const res = await POST(makePostRequest({ dryRun: false, rationale: 'ratify' }), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(mockValidateInvariant).toHaveBeenCalledTimes(2);
    expect(body.downstream.validate.ran).toBe(2);
    expect(body.downstream.validate.passed).toBe(2);
  });

  it('writes ONE lifecycle receipt for the whole batch, and never rolls back a landed classification when the receipt fails', async () => {
    mockReconcilePromotedCohort.mockResolvedValue({ unclassifiedRecords: [{ id: 'inv-1', label: 'l', statement: 's' }] });
    mockGetInvariantsByIds.mockResolvedValue([{ id: 'inv-1', statement: 's', provenance: null }]);
    mockPrepareProvenanceCohort.mockResolvedValue({ recommendations: [readyRec('inv-1', ['https://eur-lex.europa.eu/mica'])] });
    mockGetInvariantById.mockResolvedValue({ id: 'inv-1', provenance: null });
    mockApplyProvenanceReclassification.mockReturnValue({ ok: true, from: null, to: 'external-established', provenance: {} });
    mockWriteLifecycleReceipt.mockResolvedValue({ ok: false, receiptId: null });

    const res = await POST(makePostRequest({ dryRun: false, rationale: 'ratify' }), { params });
    const body = await res.json();
    expect(body.written).toBe(1);
    expect(body.receiptWritten).toBe(false);
    expect(body.receiptWarning).toMatch(/attributable record/);
    expect(mockWriteLifecycleReceipt).toHaveBeenCalledTimes(1);
  });
});
