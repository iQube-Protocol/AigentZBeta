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
const mockListEdgesForInvariants = vi.fn();
const mockListInvariants = vi.fn();
vi.mock('@/services/invariants/store', () => ({
  getInvariantsByIds: (...args: any[]) => mockGetInvariantsByIds(...args),
  listEdgesForInvariants: (...args: any[]) => mockListEdgesForInvariants(...args),
  listInvariants: (...args: any[]) => mockListInvariants(...args),
}));

// `similarity` is the REAL comparator (2026-09-04, batched-exact-match
// rewrite) — the mock surface moved from `findDuplicates` (one Supabase
// round trip per candidate) to `listInvariants` (one batched read per
// distinct namespace); exact-match behaviour is exercised through real
// statement-equality comparison, not a stubbed verdict.

vi.mock('@/services/research/experimentalPopulations', () => ({
  readEvidenceProvenance: () => null,
}));

const mockGetValidNoDefensibleEdgeInvariantIds = vi.fn();
vi.mock('@/services/research/crystalRelationshipAdjudication', () => ({
  getValidNoDefensibleEdgeInvariantIds: (...args: any[]) => mockGetValidNoDefensibleEdgeInvariantIds(...args),
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
  mockListInvariants.mockReset();
  mockListInvariants.mockResolvedValue([]); // default: no deterministic match
  mockListEdgesForInvariants.mockReset();
  mockListEdgesForInvariants.mockResolvedValue([]); // default: no edges — every member an orphan
  mockGetValidNoDefensibleEdgeInvariantIds.mockReset();
  mockGetValidNoDefensibleEdgeInvariantIds.mockResolvedValue(new Set());
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
    mockListInvariants.mockResolvedValue([invariant('inv-existing', { statement: 'Every settlement is receipted.' })]);
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
    mockListInvariants.mockResolvedValue([]);
    const cohort = await reconcilePromotedCohort(promoted);
    expect(cohort.unaccountedRecords[0]).toMatchObject({
      defect: 'missing-invariant-id',
      deterministicRepairInvariantId: null,
      recommendedTreatment: 'exclude',
    });
    expect(cohort.unaccountedRecords[0].recommendedReason).toMatch(/steward judgment required/i);
  });
});

describe('reconcilePromotedCohort — batched exact-match lookup (2026-09-04, N+1 repair)', () => {
  it('N candidates missing an invariant_id in the SAME domain resolve via exactly ONE listInvariants call, not N', async () => {
    const broken = Array.from({ length: 5 }, (_, i) =>
      candidate({ id: `c-missing-${i}`, promotedInvariantId: null, statement: `Statement ${i}.` }),
    );
    mockListInvariants.mockResolvedValue([]); // no deterministic match for any of them
    const cohort = await reconcilePromotedCohort(broken);
    expect(cohort.unaccountedRecords).toHaveLength(5);
    expect(cohort.unaccountedRecords.every((r) => r.defect === 'missing-invariant-id')).toBe(true);
    // The whole point of the fix: one namespace, one read — was 5 sequential
    // findDuplicates round trips (one full domain scan each) before this fix.
    expect(mockListInvariants).toHaveBeenCalledTimes(1);
  });

  it('an empty withoutId set never calls listInvariants at all', async () => {
    const promoted = [candidate({ id: 'c1', promotedInvariantId: 'inv-1' })];
    mockGetInvariantsByIds.mockResolvedValue([invariant('inv-1')]);
    await reconcilePromotedCohort(promoted);
    expect(mockListInvariants).not.toHaveBeenCalled();
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
    // The exact-match lookup must never run for an already-excluded record —
    // no wasted work computing a recommendation nobody will see.
    expect(mockListInvariants).not.toHaveBeenCalled();
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
    // Both `broken` candidates share a domain, so they share ONE namespace
    // pool — this is exactly the batched-read shape being tested: a single
    // `listInvariants` result serving both candidates' exact-match lookups.
    mockListInvariants.mockResolvedValue([
      invariant('inv-repaired-a', { statement: 'Statement A.' }),
      invariant('inv-repaired-b', { statement: 'Statement B.' }),
    ]);

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

/**
 * Stage 7 three-state orphan derivation (operator report, 2026-08-31):
 * a crystal member may legitimately have zero relationships. `orphanRecords`/
 * `graph.orphanCount` must distinguish (1) unreviewed orphan, (2) reviewed
 * orphan / no defensible edge, and (3) related member — only (1) is pending.
 * Exercised ONLY via the optional `adjudicationContext` parameter; every test
 * above (which never passes it) proves the edge-only behaviour is unchanged
 * for every caller that does not opt in.
 */
describe('reconcilePromotedCohort — Stage 7 reviewed-orphan adjudication (adjudicationContext)', () => {
  const fakeAdmin = {} as any;

  it('without adjudicationContext, a zero-edge member is an orphan exactly as before — no behaviour change for other callers', async () => {
    const promoted = [candidate({ id: 'c1', promotedInvariantId: 'inv-1' })];
    mockGetInvariantsByIds.mockResolvedValue([invariant('inv-1')]);
    const cohort = await reconcilePromotedCohort(promoted);
    expect(cohort.graph).toEqual({ relationshipCount: 0, orphanCount: 1 });
    expect(cohort.orphanRecords.map((r) => r.id)).toEqual(['inv-1']);
    expect(mockGetValidNoDefensibleEdgeInvariantIds).not.toHaveBeenCalled();
  });

  it('case 1 — unreviewed orphan: no edge, no adjudication → still pending', async () => {
    const promoted = [candidate({ id: 'c1', promotedInvariantId: 'inv-1' })];
    mockGetInvariantsByIds.mockResolvedValue([invariant('inv-1')]);
    mockGetValidNoDefensibleEdgeInvariantIds.mockResolvedValue(new Set()); // nothing adjudicated

    const cohort = await reconcilePromotedCohort(promoted, { admin: fakeAdmin, experimentId: 'EXP-P1' });
    expect(cohort.orphanRecords.map((r) => r.id)).toEqual(['inv-1']);
    expect(cohort.graph).toEqual({ relationshipCount: 0, orphanCount: 1 });
  });

  it('case 2 — reviewed orphan: no edge, but a valid no-defensible-edge adjudication → resolved, no edge fabricated', async () => {
    const promoted = [candidate({ id: 'c1', promotedInvariantId: 'inv-1' })];
    mockGetInvariantsByIds.mockResolvedValue([invariant('inv-1')]);
    mockGetValidNoDefensibleEdgeInvariantIds.mockResolvedValue(new Set(['inv-1']));

    const cohort = await reconcilePromotedCohort(promoted, { admin: fakeAdmin, experimentId: 'EXP-P1' });
    expect(cohort.orphanRecords).toEqual([]);
    // orphanCount drops to 0; relationshipCount stays 0 — resolved by
    // adjudication, never by inventing an edge.
    expect(cohort.graph).toEqual({ relationshipCount: 0, orphanCount: 0 });
  });

  it('case 3 — related member: an admitted edge resolves the member regardless of adjudication state', async () => {
    const promoted = [
      candidate({ id: 'c1', promotedInvariantId: 'inv-1' }),
      candidate({ id: 'c2', promotedInvariantId: 'inv-2' }),
    ];
    mockGetInvariantsByIds.mockResolvedValue([invariant('inv-1'), invariant('inv-2')]);
    mockListEdgesForInvariants.mockResolvedValue([{ fromInvariantId: 'inv-1', toInvariantId: 'inv-2' }]);
    mockGetValidNoDefensibleEdgeInvariantIds.mockResolvedValue(new Set()); // no adjudication needed

    const cohort = await reconcilePromotedCohort(promoted, { admin: fakeAdmin, experimentId: 'EXP-P1' });
    expect(cohort.orphanRecords).toEqual([]);
    expect(cohort.graph).toEqual({ relationshipCount: 1, orphanCount: 0 });
  });

  it('Stage 7 can complete with zero accepted relationships when every cohort member is a legitimately-adjudicated reviewed orphan', async () => {
    const promoted = [
      candidate({ id: 'c1', promotedInvariantId: 'inv-1' }),
      candidate({ id: 'c2', promotedInvariantId: 'inv-2' }),
    ];
    mockGetInvariantsByIds.mockResolvedValue([invariant('inv-1'), invariant('inv-2')]);
    mockGetValidNoDefensibleEdgeInvariantIds.mockResolvedValue(new Set(['inv-1', 'inv-2']));

    const cohort = await reconcilePromotedCohort(promoted, { admin: fakeAdmin, experimentId: 'EXP-P1' });
    expect(cohort.orphanRecords).toEqual([]);
    expect(cohort.graph).toEqual({ relationshipCount: 0, orphanCount: 0 });
  });

  it('an adjudication-log read failure fails CLOSED — the member stays pending, never silently resolved', async () => {
    const promoted = [candidate({ id: 'c1', promotedInvariantId: 'inv-1' })];
    mockGetInvariantsByIds.mockResolvedValue([invariant('inv-1')]);
    mockGetValidNoDefensibleEdgeInvariantIds.mockRejectedValue(new Error('db down'));

    const cohort = await reconcilePromotedCohort(promoted, { admin: fakeAdmin, experimentId: 'EXP-P1' });
    expect(cohort.orphanRecords.map((r) => r.id)).toEqual(['inv-1']);
    expect(cohort.graph).toEqual({ relationshipCount: 0, orphanCount: 1 });
  });

  it('passes the FULL current cohort member ids to the adjudication read, scoped to this experiment', async () => {
    const promoted = [
      candidate({ id: 'c1', promotedInvariantId: 'inv-1' }),
      candidate({ id: 'c2', promotedInvariantId: 'inv-2' }),
    ];
    mockGetInvariantsByIds.mockResolvedValue([invariant('inv-1'), invariant('inv-2')]);

    await reconcilePromotedCohort(promoted, { admin: fakeAdmin, experimentId: 'EXP-P1' });
    expect(mockGetValidNoDefensibleEdgeInvariantIds).toHaveBeenCalledWith(fakeAdmin, {
      experimentId: 'EXP-P1',
      cohortMemberIds: ['inv-1', 'inv-2'],
    });
  });
});

/**
 * The target-Crystal membership universe (operator ruling, 2026-08-31,
 * "successor cohort vs successor Crystal are not the same thing" — the live
 * Record 3 incident): a new successor member's edge to an INHERITED
 * predecessor member counts toward Stage 7 exactly like an edge to another
 * successor member. An edge to an arbitrary OTHER invariant — neither a
 * successor member nor inherited — must not.
 */
describe('reconcilePromotedCohort — target-Crystal membership universe (inheritedMemberIds)', () => {
  const fakeAdmin = {} as any;

  it('new→new: an edge between two successor members counts (unaffected by inheritedMemberIds)', async () => {
    const promoted = [
      candidate({ id: 'c1', promotedInvariantId: 'inv-new-1' }),
      candidate({ id: 'c2', promotedInvariantId: 'inv-new-2' }),
    ];
    mockGetInvariantsByIds.mockResolvedValue([invariant('inv-new-1'), invariant('inv-new-2')]);
    mockListEdgesForInvariants.mockResolvedValue([{ fromInvariantId: 'inv-new-1', toInvariantId: 'inv-new-2' }]);

    const cohort = await reconcilePromotedCohort(promoted, {
      admin: fakeAdmin,
      experimentId: 'EXP-P1',
      inheritedMemberIds: new Set(['inv-inherited-1']),
    });
    expect(cohort.orphanRecords).toEqual([]);
    expect(cohort.graph).toEqual({ relationshipCount: 1, orphanCount: 0 });
  });

  it('new→inherited: an edge from a successor member to an inherited predecessor member counts — the Record 3 fix', async () => {
    const promoted = [candidate({ id: 'c3', promotedInvariantId: 'inv-record-3' })];
    mockGetInvariantsByIds.mockResolvedValue([invariant('inv-record-3')]);
    // The accepted supports edge: Record 3 (successor) -> inherited member,
    // exactly the live 8e13b697...->b94c323e... shape.
    mockListEdgesForInvariants.mockResolvedValue([
      { fromInvariantId: 'inv-record-3', toInvariantId: 'inv-inherited-risk-mgmt' },
    ]);

    const cohort = await reconcilePromotedCohort(promoted, {
      admin: fakeAdmin,
      experimentId: 'EXP-P1',
      inheritedMemberIds: new Set(['inv-inherited-risk-mgmt']),
    });
    expect(cohort.orphanRecords).toEqual([]);
    expect(cohort.graph).toEqual({ relationshipCount: 1, orphanCount: 0 });
  });

  it('new→arbitrary out-of-Crystal invariant does NOT count — neither a successor member nor inherited', async () => {
    const promoted = [candidate({ id: 'c1', promotedInvariantId: 'inv-new-1' })];
    mockGetInvariantsByIds.mockResolvedValue([invariant('inv-new-1')]);
    // Edge target is some OTHER promoted invariant elsewhere in the
    // acquisition domain — not in inheritedMemberIds, not a successor member.
    mockListEdgesForInvariants.mockResolvedValue([
      { fromInvariantId: 'inv-new-1', toInvariantId: 'inv-arbitrary-elsewhere' },
    ]);

    const cohort = await reconcilePromotedCohort(promoted, {
      admin: fakeAdmin,
      experimentId: 'EXP-P1',
      inheritedMemberIds: new Set(['inv-inherited-1']), // does not include inv-arbitrary-elsewhere
    });
    expect(cohort.orphanRecords.map((r) => r.id)).toEqual(['inv-new-1']);
    expect(cohort.graph).toEqual({ relationshipCount: 0, orphanCount: 1 });
  });

  it('no edge is manufactured to satisfy the stage — an out-of-Crystal edge remains a real graph fact, just uncounted', async () => {
    const promoted = [candidate({ id: 'c1', promotedInvariantId: 'inv-new-1' })];
    mockGetInvariantsByIds.mockResolvedValue([invariant('inv-new-1')]);
    mockListEdgesForInvariants.mockResolvedValue([
      { fromInvariantId: 'inv-new-1', toInvariantId: 'inv-arbitrary-elsewhere' },
    ]);
    const cohort = await reconcilePromotedCohort(promoted, {
      admin: fakeAdmin,
      experimentId: 'EXP-P1',
      inheritedMemberIds: new Set(),
    });
    // relationshipCount reflects only qualifying (in-universe) edges — the
    // out-of-Crystal edge is neither counted NOR is a replacement edge ever
    // written (this function only ever reads invariant_edges).
    expect(cohort.graph).toEqual({ relationshipCount: 0, orphanCount: 1 });
  });

  it('the no-defensible-edge adjudication fingerprint is keyed on the FULL target-Crystal universe, not the successor cohort alone', async () => {
    const promoted = [
      candidate({ id: 'c1', promotedInvariantId: 'inv-new-1' }),
      candidate({ id: 'c2', promotedInvariantId: 'inv-new-2' }),
    ];
    mockGetInvariantsByIds.mockResolvedValue([invariant('inv-new-1'), invariant('inv-new-2')]);

    await reconcilePromotedCohort(promoted, {
      admin: fakeAdmin,
      experimentId: 'EXP-P1',
      inheritedMemberIds: new Set(['inv-inherited-1']),
    });
    expect(mockGetValidNoDefensibleEdgeInvariantIds).toHaveBeenCalledWith(fakeAdmin, {
      experimentId: 'EXP-P1',
      cohortMemberIds: expect.arrayContaining(['inv-new-1', 'inv-new-2', 'inv-inherited-1']),
    });
    const call = mockGetValidNoDefensibleEdgeInvariantIds.mock.calls.at(-1)![1];
    expect(call.cohortMemberIds).toHaveLength(3);
  });

  it('no frozen predecessor / no inheritedMemberIds supplied — falls back to intra-successor-cohort-only, today\'s behaviour', async () => {
    const promoted = [candidate({ id: 'c1', promotedInvariantId: 'inv-new-1' })];
    mockGetInvariantsByIds.mockResolvedValue([invariant('inv-new-1')]);
    mockListEdgesForInvariants.mockResolvedValue([
      { fromInvariantId: 'inv-new-1', toInvariantId: 'inv-would-be-inherited-if-declared' },
    ]);
    // adjudicationContext supplied but inheritedMemberIds omitted entirely.
    const cohort = await reconcilePromotedCohort(promoted, { admin: fakeAdmin, experimentId: 'EXP-P1' });
    expect(cohort.orphanRecords.map((r) => r.id)).toEqual(['inv-new-1']);
  });
});
