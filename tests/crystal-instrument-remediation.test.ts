/**
 * CANARY — IRL Review #001, remediation cycle 1 (2026-08-26).
 *
 * These are the tests that keep the hardened instruments honest after the
 * session that built them is over. Each one pins a SHAPE the pre-remediation
 * instruments passed and the hardened ones must reject:
 *
 *   1. Near-identical "X is essential for Y" / "Y depends on X" pairs must trip
 *      duplicate detection — the lexical pass alone finds NONE of them, which is
 *      asserted here explicitly so a regression to lexical-only fails loudly
 *      rather than quietly.
 *   2. A corpus of pure "X is essential for Y" generalities must FAIL
 *      derivation-headroom on inferential capacity, while its LABEL-DIVERSITY
 *      proxy is allowed to look healthy — the exact signature of the defect.
 *   3. A 15-statement collection must FAIL the §3.6-derived population
 *      requirement (24 ÷ 0.40 = 60), and the arithmetic must be visible in the
 *      check's own detail string.
 *   4. A collection spanning 2 of 15 declared namespaces must FAIL
 *      boundary-coverage.
 *
 * Plus the release gate: the retrospective harness must PASS (i.e. report that
 * the instruments REJECT) on the vP1-shaped fixture, and must NOT pass on an
 * empty domain or an unverified freeze — an infrastructure fault must never
 * license the gate.
 *
 * The operator's worked example (24 usable statements ⇒ a floor of 60) is
 * exercised as a TEST CASE, never as a constant in the implementation.
 */

import { describe, it, expect, vi } from 'vitest';
import { runCrystalReadinessReport } from '../services/research/crystalReadiness';
import {
  assessInferentialCapacity,
  detectRelationalStructures,
  findSemanticDuplicatePairs,
  parseRelationalForm,
  RELATIONAL_STRUCTURES,
} from '../services/research/crystalSemanticStructure';
import {
  ARM_C_SLICE_FRACTION_OF_CRYSTAL,
  REGISTERED_MINIMUM_TASK_DESIGN,
  deriveCrystalPopulationRequirement,
} from '../services/research/crystalPopulationRequirement';
import {
  CRYSTAL_READINESS_CHECK_CONTRACT,
  checksRequiringCFS054Amendment,
  crystalInstrumentSuiteFingerprint,
  crystalReadinessCheckNames,
} from '../services/research/crystalInstrumentSuite';
import { composeCrystalRetrospectiveFalsification } from '../services/research/crystalInstrumentFalsification';
import {
  BOUND_CRYSTAL_REMEDIATION_PROFILES,
  remediationProfileBindingState,
} from '../types/crystalRemediation';
import { minimumPremisesForTaskKind } from '../services/research/taskCoverage';
import { listInvariants, listEdgesForInvariants } from '@/services/invariants/store';
import { INVARIANT_NAMESPACES, type InvariantEdgeRecord } from '@/types/invariants';

vi.mock('@/services/invariants/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/invariants/store')>();
  return {
    ...actual,
    listInvariants: vi.fn(actual.listInvariants),
    listEdgesForInvariants: vi.fn(actual.listEdgesForInvariants),
  };
});

type Row = Awaited<ReturnType<typeof listInvariants>>[number];

function row(
  id: string,
  statement: string,
  overrides: Partial<{ namespace: string; semanticType: string; timesValidated: number }> = {},
): Row {
  return {
    id,
    statement,
    namespace: overrides.namespace ?? 'finance',
    semanticType: overrides.semanticType ?? 'principle',
    timesValidated: overrides.timesValidated ?? 3,
    standing: 0.5,
    provenance: { provenanceClass: 'external-established' },
  } as unknown as Row;
}

function edge(from: string, to: string): InvariantEdgeRecord {
  return {
    id: `${from}->${to}`,
    fromInvariantId: from,
    toInvariantId: to,
    edgeType: 'supports',
    weight: 1,
    contextId: null,
    rationale: null,
    provenance: {},
    reasoningProvenance: {},
    dvnReceiptId: null,
    createdAt: new Date(0).toISOString(),
  };
}

/**
 * THE vP1-SHAPED FIXTURE — 15 statements, all "X is essential for Y"
 * generalities, four of them near-identical variants of another four with the
 * dependency direction inverted. Deliberately modelled on the SHAPE the
 * independent reviewer described, never on the frozen crystal's actual text
 * (which lives in the substrate, not in this repository, and which no test may
 * transcribe).
 *
 * `semanticType: 'constraint'` on most rows is not an accident: it makes the
 * LABEL-DIVERSITY proxy look healthy, so a test that only checked the proxy
 * would report this corpus as derivation-ready. That is the defect, reproduced.
 */
const VP1_SHAPED: Row[] = [
  row('v1', 'Liquidity is essential for market stability.', { semanticType: 'constraint' }),
  row('v3', 'Market stability depends on adequate liquidity.', { semanticType: 'constraint' }),
  row('v2', 'Capital adequacy is essential for bank resilience.', { semanticType: 'constraint' }),
  row('v8', 'Bank resilience depends on capital adequacy.', { semanticType: 'constraint' }),
  row('v5', 'Governance is essential for effective risk management.', { semanticType: 'constraint' }),
  row('v10', 'Effective risk management requires governance.', { semanticType: 'constraint' }),
  row('v4', 'Transparency is essential for investor confidence.', { semanticType: 'constraint' }),
  row('v7', 'Investor confidence depends on transparency.', { semanticType: 'constraint' }),
  row('v6', 'Diversification is essential for portfolio robustness.', { semanticType: 'constraint' }),
  row('v9', 'Oversight is essential for market integrity.', { semanticType: 'constraint' }),
  row('v11', 'Data quality is essential for accurate valuation.', { semanticType: 'law' }),
  row('v12', 'Regulation is essential for systemic safety.', { semanticType: 'law' }),
  row('v13', 'Reporting is essential for accountability.', { semanticType: 'law' }),
  row('v14', 'Auditing is essential for financial trust.', { semanticType: 'law' }),
  row('v15', 'Collateral is essential for secured lending.', { semanticType: 'law' }),
];

describe('IRL Review #001 finding 1 — SEMANTIC duplicate detection', () => {
  const items = VP1_SHAPED.map((r) => ({ id: r.id, statement: r.statement }));

  it('finds the four inverted-direction paraphrase pairs a word-set comparison cannot see', () => {
    // THE FALSIFICATION BAR. Mutation: revert `findSemanticDuplicatePairs` to a
    // whole-statement word-set comparison and this drops to zero pairs.
    const pairs = findSemanticDuplicatePairs(items);
    const keys = pairs.map((p) => [p.aId, p.bId].sort().join('~')).sort();
    // Sorted lexicographically, so 'v10' precedes 'v5'.
    expect(keys).toEqual(['v10~v5', 'v1~v3', 'v2~v8', 'v4~v7']);
    // Every one of them required inverting the surface direction — which is
    // precisely why the lexical pass missed them.
    expect(pairs.every((p) => p.directionInverted)).toBe(true);
  });

  it('collides "X is essential for Y" with "Y depends on X" through direction canonicalisation', () => {
    const a = parseRelationalForm('Liquidity is essential for market stability.');
    const b = parseRelationalForm('Market stability depends on adequate liquidity.');
    expect(a.relationClass).toBe('necessity');
    expect(b.relationClass).toBe('necessity');
    // The determinant is `liquidity` in BOTH, despite opposite surface order.
    expect(a.determinant).toEqual(b.determinant.filter((w) => a.determinant.includes(w)));
    expect(a.dependent).toEqual(b.dependent);
  });

  it('keeps genuinely distinct statements distinct even when they share a determinant', () => {
    const pairs = findSemanticDuplicatePairs([
      { id: 'd1', statement: 'Liquidity is essential for market stability.' },
      { id: 'd2', statement: 'Liquidity is essential for regulatory reporting.' },
    ]);
    expect(pairs).toEqual([]);
  });

  it('reports the distinct-statement estimate, not the nominal count, through the readiness check', async () => {
    vi.mocked(listInvariants).mockResolvedValueOnce(VP1_SHAPED);
    vi.mocked(listEdgesForInvariants).mockResolvedValueOnce([]);
    const report = await runCrystalReadinessReport({ experimentId: 'EXP-P1', crystalDomain: 'd' });
    const check = report.checks.find((c) => c.name === 'duplicate-detection');
    expect(check?.passed).toBe(false);
    // 15 nominal members, 4 duplicate pairs ⇒ 11 equivalence classes. This is
    // the reviewer's "~11 distinct statements, not 15", computed.
    expect(report.duplicates.distinctStatementEstimate).toBe(11);
    expect(report.duplicates.semanticPairCount).toBe(4);
    // THE PROOF THAT THE OLD GATE PASSED THIS: the lexical pass alone finds none.
    expect(report.duplicates.lexicalPairCount).toBe(0);
    expect(report.duplicates.semanticOnlyPairCount).toBe(4);
    expect(check?.detail).toContain('DISTINCT-STATEMENT ESTIMATE: 11');
  });
});

describe('IRL Review #001 finding 2 — relational sufficiency and inferential capacity', () => {
  it('classifies "X is essential for Y" as carrying NONE of the seven structures', () => {
    for (const r of VP1_SHAPED) {
      expect(detectRelationalStructures(r.statement), r.statement).toEqual([]);
      expect(parseRelationalForm(r.statement).bareNecessity, r.statement).toBe(true);
    }
  });

  it('reports zero inferential capacity for the whole vP1-shaped corpus', () => {
    const capacity = assessInferentialCapacity(VP1_SHAPED.map((r) => ({ id: r.id, statement: r.statement })));
    expect(capacity.relationalMemberCount).toBe(0);
    expect(capacity.bareNecessityCount).toBe(15);
    expect(capacity.entailmentChainCount).toBe(0);
    expect(capacity.inferentialCapacityFraction).toBe(0);
    // All seven absent — this is the "reports which are present/absent" the
    // operator asked for, and it is the whole list.
    expect(capacity.structuresAbsent).toEqual([...RELATIONAL_STRUCTURES]);
    expect(capacity.structuresPresent).toEqual([]);
  });

  it('detects each of the seven structures when a statement actually asserts it', () => {
    const cases: Array<[string, string]> = [
      ['causal', 'A funding shock causes a widening of dealer spreads.'],
      ['conditional', 'If the collateral buffer is depleted, the clearing member is called.'],
      ['propagation', 'A dealer default propagates to the guarantee fund.'],
      ['constraint', 'Net exposure must not exceed the approved limit.'],
      ['threshold', 'Losses beyond the first tranche exceed the waterfall capacity.'],
      ['trade-off', 'Higher leverage buys return at the expense of solvency headroom.'],
      ['quantitative', 'Margin is refreshed within 2 days at 15 percent of notional.'],
    ];
    for (const [structure, statement] of cases) {
      expect(detectRelationalStructures(statement), statement).toContain(structure);
    }
  });

  it('counts bare-necessity transitivity separately and EXCLUDES it from capacity', () => {
    // "A essential for B" + "B essential for C" does compose — to another bare
    // generality. It is disclosed, never silently dropped, and never counted as
    // capacity. Mutation: fold it into the chain count and this fails.
    const capacity = assessInferentialCapacity([
      { id: 'n1', statement: 'Custody segregation is essential for client asset protection.' },
      { id: 'n2', statement: 'Client asset protection is essential for depositor trust.' },
    ]);
    expect(capacity.degenerateNecessityChainCount).toBeGreaterThan(0);
    expect(capacity.entailmentChainCount).toBe(0);
    expect(capacity.inferentialCapacityFraction).toBe(0);
  });

  it('finds a real chain when the conjunction entails something neither premise states', () => {
    const capacity = assessInferentialCapacity([
      { id: 'c1', statement: 'Elevated repo haircuts cause dealer inventory contraction.' },
      { id: 'c2', statement: 'Dealer inventory contraction causes municipal bid depth erosion.' },
    ]);
    expect(capacity.entailmentChainCount).toBe(1);
    expect(capacity.inferentiallyCapableCount).toBe(2);
  });

  it('fails derivation-headroom on the vP1-shaped corpus while the LABEL PROXY looks healthy', async () => {
    vi.mocked(listInvariants).mockResolvedValueOnce(VP1_SHAPED);
    vi.mocked(listEdgesForInvariants).mockResolvedValueOnce([]);
    const report = await runCrystalReadinessReport({ experimentId: 'EXP-P1', crystalDomain: 'd' });
    const check = report.checks.find((c) => c.name === 'derivation-headroom');
    expect(check?.passed).toBe(false);
    // THE SIGNATURE OF THE DEFECT, asserted in one place: the retired proxy is
    // at 100% (every row is semanticType constraint|law) and would have cleared
    // the old 20% bar comfortably, while actual capacity is zero.
    expect(report.derivationEligibleFraction).toBe(1);
    expect(report.derivationEligibleFraction).toBeGreaterThanOrEqual(0.2);
    expect(report.inferentialCapacity.inferentialCapacityFraction).toBe(0);
    expect(check?.detail).toContain('LABEL-DIVERSITY PROXY');
    expect(check?.detail).toContain('no longer gating');
  });

  it('does not let a caller re-weaken the gate with the retired parameter', async () => {
    vi.mocked(listInvariants).mockResolvedValueOnce(VP1_SHAPED);
    vi.mocked(listEdgesForInvariants).mockResolvedValueOnce([]);
    const report = await runCrystalReadinessReport({
      experimentId: 'EXP-P1',
      crystalDomain: 'd',
      minDerivationEligibleFraction: 0,
      minMeaningfulSliceSize: 1,
    });
    expect(report.checks.find((c) => c.name === 'derivation-headroom')?.passed).toBe(false);
    expect(report.checks.find((c) => c.name === 'selection-space')?.passed).toBe(false);
  });
});

describe('IRL Review #001 finding 3 — the §3.6-derived population requirement', () => {
  it('derives 24 ÷ 0.40 = 60 from the registered minimum task design, with visible arithmetic', () => {
    // The operator's worked example, exercised as a TEST CASE. The
    // implementation contains no 24 and no 60 as a threshold: 24 comes from the
    // registered task design, 0.40 is the frozen guard, 60 is the quotient.
    const requirement = deriveCrystalPopulationRequirement();
    expect(requirement.derivable).toBe(true);
    expect(requirement.requiredEvaluationSliceSize).toBe(24);
    expect(requirement.minimumCollectionSize).toBe(60);
    expect(requirement.sliceFractionOfCrystal).toBe(0.4);
    expect(requirement.sliceDemandBasis).toBe('registered-minimum-task-design');
    expect(requirement.derivation.join(' ')).toContain('24 ÷ 0.40 = 60');
    // Consistent with §6's own worked illustration (18 members ⇒ slice 7,
    // "plainly insufficient"), which is the frozen protocol's own rejection.
    expect(requirement.crossCheckAgainstSection6).toContain('CONSISTENT');
  });

  it('RISES MECHANICALLY when a finalized task set demands a larger slice', () => {
    const tasks = Array.from({ length: 30 }, (_, i) => ({
      id: `t${i}`,
      kind: (i % 2 === 0 ? 'derivation' : 'recall') as 'derivation' | 'recall',
      requiredInvariantIds: i % 2 === 0 ? [`inv${i}`, `inv${i + 100}`] : [`inv${i}`],
      expectedAnswer: 'x',
    }));
    const requirement = deriveCrystalPopulationRequirement({ tasks });
    expect(requirement.sliceDemandBasis).toBe('finalized-task-set');
    // 30 distinct singleton/pair grounds: 30 primary + 15 second premises = 45.
    expect(requirement.requiredEvaluationSliceSize).toBe(45);
    expect(requirement.minimumCollectionSize).toBe(Math.ceil(45 / 0.4));
    expect(requirement.minimumCollectionSize).toBeGreaterThan(60);
  });

  it('reports UNKNOWN rather than a default when the task set is under-specified', () => {
    const requirement = deriveCrystalPopulationRequirement({
      // A derivation task citing one premise cannot be grounded at all.
      tasks: [{ id: 'bad', kind: 'derivation', requiredInvariantIds: ['only-one'], expectedAnswer: 'x' }],
    });
    expect(requirement.derivable).toBe(false);
    expect(requirement.minimumCollectionSize).toBeNull();
    expect(requirement.insufficientInputs.length).toBeGreaterThan(0);
    // The point of the whole finding: NEVER a silent fallback.
    expect(requirement.requiredEvaluationSliceSize).toBeNull();
  });

  it('reuses taskCoverage\'s premise primitive rather than restating it', () => {
    expect(minimumPremisesForTaskKind('recall')).toBe(1);
    expect(minimumPremisesForTaskKind('derivation')).toBe(2);
    expect(deriveCrystalPopulationRequirement().derivation.join(' ')).toContain('minimumPremisesForTaskKind');
  });

  it('fails selection-space on a 15-statement collection and shows the division', async () => {
    vi.mocked(listInvariants).mockResolvedValueOnce(VP1_SHAPED);
    vi.mocked(listEdgesForInvariants).mockResolvedValueOnce([]);
    const report = await runCrystalReadinessReport({ experimentId: 'EXP-P1', crystalDomain: 'd' });
    const check = report.checks.find((c) => c.name === 'selection-space');
    expect(check?.passed).toBe(false);
    // ⌊0.40 × 15⌋ = 6, against a required slice of 24.
    expect(check?.detail).toContain('= 6 usable statement(s)');
    expect(check?.detail).toContain('24 ÷ 0.40 = 60');
    expect(check?.detail).toContain('short of 60 by 45');
    // The retired bar of 5 WOULD have passed this — that is the criterion drift.
    expect(Math.floor(15 * ARM_C_SLICE_FRACTION_OF_CRYSTAL)).toBeGreaterThanOrEqual(5);
  });

  it('keeps the registered task design in parity with the frozen protocol README', () => {
    // A hand-maintained mirror of a markdown source needs a canary. The full
    // text comparison lives in tests/source-of-truth-parity.test.ts; this pins
    // the internal consistency of the mirror itself.
    expect(REGISTERED_MINIMUM_TASK_DESIGN.recallTasks + REGISTERED_MINIMUM_TASK_DESIGN.derivationTasks).toBe(
      REGISTERED_MINIMUM_TASK_DESIGN.totalTasks,
    );
  });
});

describe('IRL Review #001 finding 4 — boundary-coverage', () => {
  it('fails when the crystal spans 2 of the 15 declared namespaces', async () => {
    const twoNamespaces = VP1_SHAPED.map((r, i) =>
      row(r.id, r.statement, {
        namespace: i % 2 === 0 ? 'finance' : 'reasoning',
        semanticType: r.semanticType ?? undefined,
      }),
    );
    vi.mocked(listInvariants).mockResolvedValueOnce(twoNamespaces);
    vi.mocked(listEdgesForInvariants).mockResolvedValueOnce([]);
    const report = await runCrystalReadinessReport({ experimentId: 'EXP-P1', crystalDomain: 'd' });
    const check = report.checks.find((c) => c.name === 'boundary-coverage');
    expect(check?.passed).toBe(false);
    expect(report.coverage.representedNamespaceCount).toBe(2);
    expect(report.coverage.boundaryNamespaceCount).toBe(INVARIANT_NAMESPACES.length);
    expect(report.coverage.missingNamespaces).toHaveLength(INVARIANT_NAMESPACES.length - 2);
    expect(check?.tier).toBe('scientific-readiness');
    expect(report.ok).toBe(false);
  });

  it('points the remedy at corpus extension and REFUSES boundary narrowing', async () => {
    vi.mocked(listInvariants).mockResolvedValueOnce(VP1_SHAPED);
    vi.mocked(listEdgesForInvariants).mockResolvedValueOnce([]);
    const report = await runCrystalReadinessReport({ experimentId: 'EXP-P1', crystalDomain: 'd' });
    const remedy = report.checks.find((c) => c.name === 'boundary-coverage')?.remedy ?? '';
    expect(remedy).toContain('Extend the corpus');
    expect(remedy).toContain('DO NOT narrow the declared boundary');
    expect(remedy).toContain('SEPARATE GOVERNANCE DECISION');
  });

  it('never lets a passing report be produced by narrowing the boundary in the report itself', async () => {
    // A caller MAY inspect a hypothetical narrower boundary — and when they do,
    // the detail says so, so a narrowed result can never be mistaken for a
    // result against the ratified boundary.
    vi.mocked(listInvariants).mockResolvedValueOnce(
      VP1_SHAPED.map((r) => row(r.id, r.statement, { namespace: 'finance' })),
    );
    vi.mocked(listEdgesForInvariants).mockResolvedValueOnce([]);
    const report = await runCrystalReadinessReport({
      experimentId: 'EXP-P1',
      crystalDomain: 'd',
      declaredNamespaceBoundary: ['finance'],
    });
    const check = report.checks.find((c) => c.name === 'boundary-coverage');
    expect(check?.passed).toBe(true);
    expect(check?.detail).toContain('CALLER-SUPPLIED boundary');
    expect(check?.detail).toContain('not a narrowing of the ratified boundary');
  });

  it('coverage is computed ONCE — statistics reads readiness rather than re-deriving', async () => {
    // inv.engineering.036: the figure that GATES and the figure that DISPLAYS
    // must be the same computation, or they will eventually disagree.
    const { runCrystalStatisticsReport } = await import('../services/research/crystalStatistics');
    const fixture = VP1_SHAPED.map((r, i) =>
      row(r.id, r.statement, {
        namespace: i % 2 === 0 ? 'finance' : 'reasoning',
        semanticType: r.semanticType ?? undefined,
      }),
    );
    vi.mocked(listInvariants).mockResolvedValue(fixture);
    vi.mocked(listEdgesForInvariants).mockResolvedValue([]);
    const stats = await runCrystalStatisticsReport({ experimentId: 'EXP-P1', crystalDomain: 'd' });
    expect(stats.coverageEstimate.representedNamespaceCount).toBe(2);
    expect(stats.coverageEstimate.boundaryNamespaceCount).toBe(INVARIANT_NAMESPACES.length);
    // And the birth certificate now reports CAPACITY as headroom, with the
    // retired proxy beside it under its own name.
    expect(stats.derivationHeadroom).toBe(0);
    expect(stats.labelDiversityFraction).toBe(1);
    vi.mocked(listInvariants).mockReset();
    vi.mocked(listEdgesForInvariants).mockReset();
  });
});

describe('the executable readiness contract', () => {
  it('emits exactly the checks the contract declares, in order', async () => {
    vi.mocked(listInvariants).mockResolvedValueOnce(VP1_SHAPED);
    vi.mocked(listEdgesForInvariants).mockResolvedValueOnce([]);
    const report = await runCrystalReadinessReport({ experimentId: 'EXP-P1', crystalDomain: 'd' });
    expect(report.checks.map((c) => c.name)).toEqual(crystalReadinessCheckNames());
    for (const check of report.checks) {
      const declared = CRYSTAL_READINESS_CHECK_CONTRACT.find((c) => c.name === check.name);
      expect(declared, `check '${check.name}' has no contract entry`).toBeTruthy();
      expect(check.tier).toBe(declared?.tier);
    }
  });

  it('names boundary-coverage as the ONE check needing a CFS-054 amendment', () => {
    // Three of the four findings landed as implementation corrections behind
    // already-pinned names, so they need no amendment. This one is a new
    // first-class name and does. Never self-ratified.
    expect(checksRequiringCFS054Amendment()).toEqual(['boundary-coverage']);
  });

  it('produces a stable, deterministic suite fingerprint', () => {
    const a = crystalInstrumentSuiteFingerprint();
    const b = crystalInstrumentSuiteFingerprint();
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16,}$/);
  });
});

describe('the retrospective falsification harness — a release gate with an INVERTED sense', () => {
  async function vp1Readiness() {
    vi.mocked(listInvariants).mockResolvedValueOnce(
      VP1_SHAPED.map((r, i) =>
        row(r.id, r.statement, {
          namespace: i % 2 === 0 ? 'finance' : 'reasoning',
          semanticType: r.semanticType ?? undefined,
        }),
      ),
    );
    vi.mocked(listEdgesForInvariants).mockResolvedValueOnce([]);
    return runCrystalReadinessReport({ experimentId: 'EXP-P1', crystalDomain: 'd' });
  }

  it('PASSES — i.e. reports that the hardened gates REJECT the vP1-shaped artifact', async () => {
    const readiness = await vp1Readiness();
    const verdict = composeCrystalRetrospectiveFalsification({
      experimentId: 'EXP-P1',
      crystalDomain: 'd',
      readiness,
      crystalContentHash: 'deadbeef',
      verifiedAgainstFreeze: true,
      computedAt: '2026-08-26T00:00:00.000Z',
    });
    expect(verdict.reproducedReviewerObjections).toBe(true);
    expect(verdict.readinessRejectsFrozenCrystal).toBe(true);
    expect(verdict.blockingGaps).toEqual([]);
    expect(verdict.concerns.map((c) => c.concernId).sort()).toEqual([
      'boundary-coverage',
      'duplication',
      'population-size',
      'relational-structure',
    ]);
    expect(verdict.concerns.every((c) => c.rejected === true)).toBe(true);
    expect(verdict.distinctStatementEstimate).toBe(11);
    expect(verdict.interpretation).toContain('RETROSPECTIVE PASSED');
  });

  it('does NOT pass when the freeze commitment is unverified — a drifted set is not the frozen set', async () => {
    const readiness = await vp1Readiness();
    const verdict = composeCrystalRetrospectiveFalsification({
      experimentId: 'EXP-P1',
      crystalDomain: 'd',
      readiness,
      crystalContentHash: 'deadbeef',
      verifiedAgainstFreeze: false,
      computedAt: '2026-08-26T00:00:00.000Z',
    });
    expect(verdict.reproducedReviewerObjections).toBe(false);
    expect(verdict.blockingGaps.join(' ')).toContain('did NOT verify against the freeze commitment');
  });

  it('does NOT pass on an EMPTY domain — an infrastructure state must never license the gate', async () => {
    vi.mocked(listInvariants).mockResolvedValueOnce([]);
    vi.mocked(listEdgesForInvariants).mockResolvedValueOnce([]);
    const readiness = await runCrystalReadinessReport({ experimentId: 'EXP-P1', crystalDomain: 'empty' });
    const verdict = composeCrystalRetrospectiveFalsification({
      experimentId: 'EXP-P1',
      crystalDomain: 'empty',
      readiness,
      crystalContentHash: 'deadbeef',
      verifiedAgainstFreeze: true,
    });
    // Every check fails closed on an empty set, so a naive "all checks failed ⇒
    // reproduced" harness would report success here. It must not.
    expect(readiness.ok).toBe(false);
    expect(verdict.reproducedReviewerObjections).toBe(false);
    expect(verdict.concerns.every((c) => c.rejected === 'unknown')).toBe(true);
    expect(verdict.blockingGaps.join(' ')).toContain('holds no invariants');
    expect(verdict.interpretation).toContain('FAILURE OF THE REMEDIATION');
  });

  it('does NOT pass when the substrate is unreadable', async () => {
    vi.mocked(listInvariants).mockRejectedValueOnce(new Error('substrate down'));
    const readiness = await runCrystalReadinessReport({ experimentId: 'EXP-P1', crystalDomain: 'd' });
    const verdict = composeCrystalRetrospectiveFalsification({
      experimentId: 'EXP-P1',
      crystalDomain: 'd',
      readiness,
      crystalContentHash: 'deadbeef',
      verifiedAgainstFreeze: true,
    });
    expect(verdict.reproducedReviewerObjections).toBe(false);
    expect(verdict.blockingGaps.join(' ')).toContain('infrastructure fault is not');
  });

  it('carries no field called `ok`, so the inverted sense cannot be misread', async () => {
    const readiness = await vp1Readiness();
    const verdict = composeCrystalRetrospectiveFalsification({
      experimentId: 'EXP-P1',
      crystalDomain: 'd',
      readiness,
      crystalContentHash: 'deadbeef',
      verifiedAgainstFreeze: true,
    });
    expect(Object.prototype.hasOwnProperty.call(verdict, 'ok')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(verdict, 'reproducedReviewerObjections')).toBe(true);
  });
});

describe('CrystalRemediationProfile — the shared configuration object', () => {
  it('EXP-P1 carries a real ingested profile (2026-08-29), and every consumer still fails closed because it is not yet bound', () => {
    // No longer the empty-registry state this canary originally asserted:
    // EXP-P1's v1 profile is ingested from real, hash-verifiable source refs
    // (IRL Review #001, the resolution record, the frozen README). It is
    // deliberately still NOT bound — `retrospective: null`, because
    // computing it needs a live read of the frozen artifact this profile's
    // authoring pass had no database access to perform. Fail-closed still
    // holds: `remediationProfileBindingState` derives, never trusts, so a
    // stored `binding` of anything but `'bound'` still gates every consumer.
    expect(BOUND_CRYSTAL_REMEDIATION_PROFILES).toHaveLength(1);
    const profile = BOUND_CRYSTAL_REMEDIATION_PROFILES[0];
    expect(profile.experimentId).toBe('EXP-P1');
    expect(profile.retrospective).toBeNull();
    expect(profile.binding).not.toBe('bound');
    expect(remediationProfileBindingState(profile).binding).toBe(profile.binding);
  });

  it('refuses to bind without a source ref — a chat paste is not an artifact', () => {
    const state = remediationProfileBindingState({
      sourceRefs: [],
      checkMappings: [],
      populationFormula: {
        sliceFractionOfCrystal: 0.4,
        sliceGuardSourceRef: 'x',
        sliceDemandBasis: 'registered-minimum-task-design',
        requiredEvaluationSliceSize: 24,
        minimumCollectionSize: 60,
        derivationLines: [],
        insufficientInputs: [],
      },
      boundaryRequirement: {
        boundarySourceRef: 'types/invariants.ts',
        declaredNamespaces: [...INVARIANT_NAMESPACES],
        requiredRepresentedNamespaceCount: INVARIANT_NAMESPACES.length,
        remedy: 'extend-corpus',
        mayNarrowBoundary: false,
      },
      retrospective: null,
    });
    expect(state.binding).toBe('unbound-no-artifact');
    expect(state.bindingGaps.join(' ')).toContain('not an artifact');
  });

  it('refuses to bind while the retrospective has not reproduced the objections', () => {
    const state = remediationProfileBindingState({
      sourceRefs: [
        { refId: 'r1', locator: 'codexes/…/review-001.md', contentHash: 'abc', kind: 'external-review', note: null },
      ],
      checkMappings: [
        {
          findingId: 'f1',
          label: 'duplicates',
          bearsOnChecks: ['duplicate-detection'],
          instrument: 'services/research/crystalSemanticStructure.ts',
          executable: true,
          gap: null,
        },
      ],
      populationFormula: {
        sliceFractionOfCrystal: 0.4,
        sliceGuardSourceRef: 'x',
        sliceDemandBasis: 'registered-minimum-task-design',
        requiredEvaluationSliceSize: 24,
        minimumCollectionSize: 60,
        derivationLines: [],
        insufficientInputs: [],
      },
      boundaryRequirement: {
        boundarySourceRef: 'types/invariants.ts',
        declaredNamespaces: [...INVARIANT_NAMESPACES],
        requiredRepresentedNamespaceCount: INVARIANT_NAMESPACES.length,
        remedy: 'extend-corpus',
        mayNarrowBoundary: false,
      },
      retrospective: {
        reproducedReviewerObjections: false,
        verdictRoute: '/api/research/crystal/EXP-P1/instrument-falsification',
        crystalContentHash: 'abc',
        verifiedAgainstFreeze: true,
        computedAt: '2026-08-26T00:00:00.000Z',
      },
    });
    expect(state.binding).toBe('unbound-retrospective-not-reproduced');
    expect(state.bindingGaps.join(' ')).toContain('failure of the remediation');
  });
});
