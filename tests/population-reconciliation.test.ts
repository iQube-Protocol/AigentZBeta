/**
 * services/research/populationReconciliation.ts — the Population
 * Reconciliation Board's domain logic (al, 2026-08-04).
 *
 * ── The live symptom this closes ─────────────────────────────────────────────
 *
 *   Review & Promote declared: 17
 *   Classify Provenance received: 15
 *   Explicitly excluded: 0
 *   Unaccounted for: 2
 *
 * The most likely cause, proven here rather than asserted: two candidates
 * legitimately resolving to the SAME invariant (promoteCandidate's own
 * 'already-exists' rediscovery path) silently vanished from every count —
 * the old resolvePromotedCohort deduplicated `invariantIds` but never
 * checked whether a SECOND candidate's id had already been claimed, so that
 * candidate landed in neither `invariantIds` nor `excluded`.
 *
 * The acceptance test at the bottom is Aletheon's own scenario, verbatim:
 * 17 promoted, 15 provenance-ready, 0 excluded, 2 missing invariant ids.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CandidateRow } from '@/services/invariants/discoveryEngine';

const mockGetInvariantsByIds = vi.fn();
vi.mock('@/services/invariants/store', () => ({
  getInvariantsByIds: (...args: any[]) => mockGetInvariantsByIds(...args),
  listEdgesForInvariants: vi.fn(async () => []),
}));

const mockFindDuplicates = vi.fn();
vi.mock('@/services/invariants/comparison', () => ({
  findDuplicates: (...args: any[]) => mockFindDuplicates(...args),
}));

vi.mock('@/services/research/experimentalPopulations', () => ({
  readEvidenceProvenance: () => null,
}));

import { reconcilePromotedCohort } from '@/services/research/populationReconciliation';

function candidate(overrides: Partial<CandidateRow> = {}): CandidateRow {
  return {
    id: `cand-${Math.random().toString(36).slice(2)}`,
    domain: 'financial-services',
    subDomain: null,
    scopeLevel: 'domain',
    abstractionLevel: 'L2',
    discoveryClass: 'constitutional',
    statement: 'A statement.',
    rationale: '',
    evidenceIds: ['ev-1'],
    confidence: 0.6,
    status: 'promoted',
    promotedInvariantId: null,
    createdAt: '2026-08-04T00:00:00.000Z',
    stage: 'constitutional',
    classification: null,
    coverage: null,
    compression: null,
    crystalExclusion: null,
    ...overrides,
  };
}

function invariant(id: string, overrides: Record<string, unknown> = {}) {
  return { id, statement: 'x', provenance: {}, timesValidated: 1, ...overrides } as any;
}

beforeEach(() => {
  mockGetInvariantsByIds.mockReset();
  mockFindDuplicates.mockReset();
  mockFindDuplicates.mockResolvedValue([]); // default: no deterministic match
});

describe('reconcilePromotedCohort — the clean cases', () => {
  it('every candidate resolves to a distinct invariant — nothing unaccounted', async () => {
    const promoted = [candidate({ id: 'c1', promotedInvariantId: 'inv-1' }), candidate({ id: 'c2', promotedInvariantId: 'inv-2' })];
    mockGetInvariantsByIds.mockResolvedValue([invariant('inv-1'), invariant('inv-2')]);
    const cohort = await reconcilePromotedCohort(promoted);
    expect(cohort.invariantIds).toEqual(['inv-1', 'inv-2']);
    expect(cohort.excluded).toEqual([]);
    expect(cohort.unaccountedRecords).toEqual([]);
  });

  it('an empty promoted list reconciles to an empty cohort, not a crash', async () => {
    const cohort = await reconcilePromotedCohort([]);
    expect(cohort).toMatchObject({ invariantIds: [], excluded: [], unaccountedRecords: [] });
  });
});

describe('reconcilePromotedCohort — missing invariant_id', () => {
  it('with a deterministic exact-statement match: named, repairable, the exact recommendation stated', async () => {
    const promoted = [candidate({ id: 'c-missing', promotedInvariantId: null, statement: 'Every settlement is receipted.' })];
    mockFindDuplicates.mockResolvedValue([{ invariant: invariant('inv-existing'), similarity: 1, exact: true }]);
    const cohort = await reconcilePromotedCohort(promoted);
    expect(cohort.unaccountedRecords).toHaveLength(1);
    const r = cohort.unaccountedRecords[0];
    expect(r).toMatchObject({
      candidateId: 'c-missing',
      defect: 'missing-invariant-id',
      deterministicRepairInvariantId: 'inv-existing',
      recommendedTreatment: 'repair',
    });
    expect(r.recommendedReason).toContain('inv-existing');
    expect(r.recommendedReason).not.toMatch(/steward judgment/i);
  });

  it('with no deterministic match: named, steward judgment required, never a guessed repair', async () => {
    const promoted = [candidate({ id: 'c-missing', promotedInvariantId: null })];
    mockFindDuplicates.mockResolvedValue([]);
    const cohort = await reconcilePromotedCohort(promoted);
    expect(cohort.unaccountedRecords[0]).toMatchObject({
      defect: 'missing-invariant-id',
      deterministicRepairInvariantId: null,
      recommendedTreatment: 'exclude',
    });
    expect(cohort.unaccountedRecords[0].recommendedReason).toMatch(/steward judgment required/i);
  });
});

describe('reconcilePromotedCohort — unresolvable invariant_id', () => {
  it('a promoted_invariant_id that does not resolve to a row is named, never silently dropped', async () => {
    const promoted = [candidate({ id: 'c-orphan', promotedInvariantId: 'inv-gone' })];
    mockGetInvariantsByIds.mockResolvedValue([]); // the id does not resolve
    const cohort = await reconcilePromotedCohort(promoted);
    expect(cohort.invariantIds).toEqual([]);
    expect(cohort.unaccountedRecords).toHaveLength(1);
    expect(cohort.unaccountedRecords[0]).toMatchObject({
      candidateId: 'c-orphan',
      defect: 'unresolvable-invariant-id',
      promotedInvariantId: 'inv-gone',
      recommendedTreatment: 'exclude',
    });
  });
});

describe('reconcilePromotedCohort — duplicate invariant_id (the likely live cause)', () => {
  it('two candidates resolving to the SAME invariant: the first counts as the distinct member, the second is named as a duplicate — never silently absorbed', async () => {
    const promoted = [
      candidate({ id: 'c-first', promotedInvariantId: 'inv-shared' }),
      candidate({ id: 'c-second', promotedInvariantId: 'inv-shared' }),
    ];
    mockGetInvariantsByIds.mockResolvedValue([invariant('inv-shared')]);
    const cohort = await reconcilePromotedCohort(promoted);
    // getInvariantsByIds was called with the DEDUPED id list — one request, not two.
    expect(mockGetInvariantsByIds).toHaveBeenCalledWith(['inv-shared']);
    expect(cohort.invariantIds).toEqual(['inv-shared']);
    expect(cohort.unaccountedRecords).toHaveLength(1);
    expect(cohort.unaccountedRecords[0]).toMatchObject({
      candidateId: 'c-second',
      defect: 'duplicate-invariant-id',
      duplicateOfCandidateId: 'c-first',
      recommendedTreatment: 'exclude',
    });
    expect(cohort.unaccountedRecords[0].recommendedReason).toContain('c-first');
  });
});

describe('reconcilePromotedCohort — operator-confirmed exclusions', () => {
  it('a candidate carrying crystalExclusion counts in `excluded`, never re-enters `unaccountedRecords`', async () => {
    const promoted = [
      candidate({
        id: 'c-excluded',
        promotedInvariantId: null,
        crystalExclusion: {
          reason: 'duplicate of another candidate, confirmed by steward',
          excludedBy: 'persona-1',
          excludedAt: '2026-08-04T00:00:00.000Z',
          crystalId: 'EXP-P1',
          fromStageId: 'review-and-promote',
          toStageId: 'classify-provenance',
        },
      }),
    ];
    const cohort = await reconcilePromotedCohort(promoted);
    expect(cohort.excluded).toEqual([{ recordId: 'c-excluded', reason: 'duplicate of another candidate, confirmed by steward' }]);
    expect(cohort.unaccountedRecords).toEqual([]);
    // findDuplicates must never be called for an already-excluded record — no
    // wasted work computing a recommendation nobody will see.
    expect(mockFindDuplicates).not.toHaveBeenCalled();
  });
});

describe('THE ACCEPTANCE TEST (al, 2026-08-04, verbatim seed)', () => {
  it('17 promoted / 15 provenance-ready / 0 excluded / 2 missing invariant ids — both deterministically repairable', async () => {
    const clean = Array.from({ length: 15 }, (_, i) => candidate({ id: `clean-${i}`, promotedInvariantId: `inv-${i}` }));
    const broken = [
      candidate({ id: 'broken-1', promotedInvariantId: null, statement: 'Statement A.' }),
      candidate({ id: 'broken-2', promotedInvariantId: null, statement: 'Statement B.' }),
    ];
    mockGetInvariantsByIds.mockResolvedValue(clean.map((c) => invariant(c.promotedInvariantId!)));
    mockFindDuplicates.mockImplementation(async (statement: string) =>
      statement === 'Statement A.'
        ? [{ invariant: invariant('inv-repaired-a'), similarity: 1, exact: true }]
        : [{ invariant: invariant('inv-repaired-b'), similarity: 1, exact: true }],
    );

    const cohort = await reconcilePromotedCohort([...clean, ...broken]);
    expect(cohort.invariantIds).toHaveLength(15);
    expect(cohort.excluded).toEqual([]);
    expect(cohort.unaccountedRecords).toHaveLength(2);
    expect(cohort.unaccountedRecords.every((r) => r.recommendedTreatment === 'repair')).toBe(true);
    expect(cohort.unaccountedRecords.map((r) => r.deterministicRepairInvariantId).sort()).toEqual([
      'inv-repaired-a',
      'inv-repaired-b',
    ]);

    // The handover arithmetic this whole model exists to make checkable:
    // 15 received + 0 excluded + 2 unaccounted = 17 declared.
    const declaredOut = clean.length + broken.length;
    expect(cohort.invariantIds.length + cohort.excluded.length + cohort.unaccountedRecords.length).toBe(declaredOut);
  });
});

describe('CohortMemberRef carries the real statement, not just the truncated label (2026-08-05 regression)', () => {
  it('members[].statement is the full, untruncated statement — suggestRelationships requires {id, statement}, and label alone left it undefined at runtime', async () => {
    const longStatement = `S${'x'.repeat(200)}.`; // > 140 chars, so label WILL truncate it
    const promoted = [candidate({ id: 'c-long', promotedInvariantId: 'inv-long', statement: longStatement })];
    // `records` resolves through getInvariantsByIds — the INVARIANT's statement is what
    // members[].statement must carry, not the candidate row's own statement field.
    mockGetInvariantsByIds.mockResolvedValue([invariant('inv-long', { statement: longStatement })]);

    const cohort = await reconcilePromotedCohort(promoted);
    const member = cohort.members.find((m) => m.id === 'inv-long');
    expect(member).toBeTruthy();
    expect(member!.statement).toBe(longStatement);
    expect(member!.label.length).toBeLessThan(longStatement.length);
    expect(member!.label).not.toBe(member!.statement);
  });
});
