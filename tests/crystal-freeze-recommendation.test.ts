/**
 * Canary — Crystal Freeze Recommendation (CFS-054 §5 / PRD-EPI-001 §3.1
 * Workstream 4). Pure-composition tests over synthetic readiness/statistics
 * inputs — no I/O, no substrate mocking needed.
 *
 * Pins: (1) the verdict is a MECHANICAL derivation of `readiness.ok`, never
 * a separate judgement; (2) every named rationale item traces to a real
 * check by name — a mutation that stops reading `readiness.checks` fails
 * this; (3) the advisory note is present verbatim on every recommendation,
 * regardless of verdict; (4) this module never mutates or writes anything.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { composeCrystalFreezeRecommendation } from '../services/research/crystalFreezeRecommendation';
import type { CrystalReadinessReport } from '../services/research/crystalReadiness';
import type { CrystalStatisticsReport } from '../services/research/crystalStatistics';

function passingReadiness(): CrystalReadinessReport {
  const names = [
    'selection-space',
    'derivation-headroom',
    'structural-diversity',
    'duplicate-detection',
    'provenance-eligibility',
    'lifecycle-validation-integrity',
    'relationship-density',
    'graph-connectivity',
    'orphan-detection',
  ];
  return {
    ok: true,
    checks: names.map((name) => ({ name, passed: true, detail: `${name} ok` })),
    invariantCount: 10,
    eligibleCount: 10,
    populations: { A: 10, B: 0, C: 0, unclassified: 0, ablationCount: 10 },
    derivationEligibleFraction: 0.4,
    duplicatePairCount: 0,
    graph: {
      relationshipCount: 8,
      relationshipDensity: 0.3,
      componentCount: 1,
      largestComponentSize: 10,
      connectivityRatio: 1,
      orphanCount: 0,
      orphanFraction: 0,
    },
  };
}

function statsFor(readiness: CrystalReadinessReport, overrides: Partial<CrystalStatisticsReport> = {}): CrystalStatisticsReport {
  return {
    ok: readiness.ok,
    experimentId: 'EXP-P1',
    crystalDomain: 'd',
    computedAt: new Date(0).toISOString(),
    invariantCount: readiness.invariantCount,
    sourceCount: 3,
    documentCount: 3,
    externalSources: ['Source A', 'Source B', 'Source C'],
    relationshipCount: readiness.graph.relationshipCount,
    averageValidationDepth: 4,
    standingDistribution: [],
    compositionDensity: readiness.graph.relationshipDensity,
    semanticDiversity: 1.2,
    namespaceDistributionEntropy: 1.2,
    coverageEstimate: { boundaryNamespaceCount: 15, representedNamespaceCount: 3, ratio: 0.2 },
    derivationHeadroom: readiness.derivationEligibleFraction,
    sliceRatio: 0.4,
    selectionEntropy: 1.2,
    duplicateRatio: 0,
    frozenHash: 'deadbeef'.repeat(8),
    substrateError: null,
    ...overrides,
  };
}

describe('Crystal Freeze Recommendation', () => {
  it('recommends READY_FOR_FREEZE only when the readiness report is fully green', () => {
    const readiness = passingReadiness();
    const rec = composeCrystalFreezeRecommendation('EXP-P1', 'd', readiness, statsFor(readiness));
    expect(rec.verdict).toBe('READY_FOR_FREEZE');
    expect(rec.ok).toBe(true);
    expect(rec.rationale.every((r) => r.satisfied)).toBe(true);
  });

  it('recommends NOT_READY the moment a single check fails, and names it in remainingRisks', () => {
    const readiness = passingReadiness();
    const failing = readiness.checks.map((c) => (c.name === 'orphan-detection' ? { ...c, passed: false, detail: '3/10 orphans' } : c));
    const notReady: CrystalReadinessReport = { ...readiness, ok: false, checks: failing };
    const rec = composeCrystalFreezeRecommendation('EXP-P1', 'd', notReady, statsFor(notReady));
    expect(rec.verdict).toBe('NOT_READY');
    expect(rec.rationale.find((r) => r.id === 'no-excess-orphans')?.satisfied).toBe(false);
    expect(rec.remainingRisks.some((r) => r.includes('No excess orphans'))).toBe(true);
  });

  it('always carries the advisory note, on both verdicts', () => {
    const readiness = passingReadiness();
    const ready = composeCrystalFreezeRecommendation('EXP-P1', 'd', readiness, statsFor(readiness));
    expect(ready.advisoryNote).toMatch(/ADVISORY ONLY/);
    expect(ready.advisoryNote).toMatch(/never marks/);

    const notReadyReport: CrystalReadinessReport = { ...readiness, ok: false };
    const notReady = composeCrystalFreezeRecommendation('EXP-P1', 'd', notReadyReport, statsFor(notReadyReport));
    expect(notReady.advisoryNote).toBe(ready.advisoryNote);
  });

  it('flags a non-zero duplicate ratio as a remaining risk even when the gating check passed', () => {
    const readiness = passingReadiness();
    const rec = composeCrystalFreezeRecommendation(
      'EXP-P1',
      'd',
      readiness,
      statsFor(readiness, { duplicateRatio: 0.02 }),
    );
    expect(rec.verdict).toBe('READY_FOR_FREEZE'); // gate itself is unaffected
    expect(rec.remainingRisks.some((r) => r.includes('duplicate ratio'))).toBe(true);
  });

  it('surfaces a statistics substrate error as a remaining risk', () => {
    const readiness = passingReadiness();
    const rec = composeCrystalFreezeRecommendation(
      'EXP-P1',
      'd',
      readiness,
      statsFor(readiness, { substrateError: 'edge substrate down' }),
    );
    expect(rec.remainingRisks.some((r) => r.includes('edge substrate down'))).toBe(true);
  });
});

/**
 * NOTHING TO ASSESS ≠ ASSESSED AND FAILING (operator report, 2026-08-02).
 *
 * The operator's own reviewer bundle showed `NOT_READY` with 9/9 checks
 * failing over `constitutional-reasoning` — and every failure said "0
 * invariants". Read cold, that is nine defects in Crystal vP1. It is not: the
 * domain holds no rows, and each check is correctly declining to certify an
 * empty set.
 *
 * The distinction is not cosmetic. `crystalReadiness.ts`'s own header records
 * that no live `invariant_contexts` row carries the crystal domain tag,
 * because Track 2 — the crystal source-material workstream — is separately
 * chartered and PAUSED. Its plan is explicit that growing the collection is
 * "genuine lab work, not a quick fix", proceeds by receipted accrual, and that
 * "no invariant is authored to hit a number".
 *
 * So the state is "not yet done", not "broken" — and no code change can make
 * it ready. Presenting it as nine failures invites exactly the wrong response
 * from exactly the wrong party: an external reviewer concluding the crystal is
 * defective, or an engineer relaxing the readiness filter to make a count rise.
 */
describe('an unpopulated domain is reported as such, never as a failing collection', () => {
  it('exposes assessability as a distinct axis from the verdict', async () => {
    const mod = await import('@/services/research/crystalFreezeRecommendation');
    // The verdict stays mechanically derived — an empty domain is emphatically
    // NOT ready — so this must not become a third verdict value.
    expect(mod.DOMAIN_UNPOPULATED_PROVENANCE).toContain('Track 2');
    expect(mod.DOMAIN_UNPOPULATED_PROVENANCE).toContain('CRYSTAL-ENLARGEMENT_plan.md');
  });

  it('the provenance names the accrual discipline and forbids the shortcut', async () => {
    const { DOMAIN_UNPOPULATED_PROVENANCE } = await import('@/services/research/crystalFreezeRecommendation');
    // Two shortcuts a reader might otherwise reach for, both explicitly closed.
    expect(DOMAIN_UNPOPULATED_PROVENANCE).toMatch(/never by authoring invariants to reach a number/i);
    expect(DOMAIN_UNPOPULATED_PROVENANCE).toMatch(/no change to this software can make the domain ready/i);
  });

  it('an empty domain puts the reason FIRST among the remaining risks', () => {
    const src = stripComments(readSource('services/research/crystalFreezeRecommendation.ts'));
    const pushAt = src.indexOf('if (assessability === ');
    const loopAt = src.indexOf('for (const item of rationale)', pushAt);
    expect(pushAt).toBeGreaterThan(-1);
    expect(loopAt).toBeGreaterThan(-1);
    expect(
      pushAt,
      'a reader who meets nine zeroes before the reason draws the wrong conclusion',
    ).toBeLessThan(loopAt);
  });

  it('assessability is derived from the invariant count, never asserted', () => {
    const src = stripComments(readSource('services/research/crystalFreezeRecommendation.ts'));
    expect(src).toMatch(/readiness\.invariantCount === 0 \? 'DOMAIN_UNPOPULATED' : 'ASSESSED'/);
  });

  it('the reviewer-facing route hoists it above the failing checks', () => {
    const src = stripComments(readSource('app/api/research/crystal/[experimentId]/route.ts'));
    // Scope to the RESPONSE literal — `readiness,` also appears in the
    // destructure above it, and matching that would compare the wrong pair.
    const bodyAt = src.indexOf('requestSucceeded: true');
    expect(bodyAt).toBeGreaterThan(-1);
    const body = src.slice(bodyAt);
    const assessAt = body.indexOf('assessability: recommendation.assessability');
    const readinessAt = body.indexOf('readiness,');
    expect(assessAt).toBeGreaterThan(-1);
    expect(readinessAt).toBeGreaterThan(-1);
    expect(assessAt, 'the reason must precede the failures in the payload').toBeLessThan(readinessAt);
  });

  it('the readiness filter is unchanged — an empty count is never fixed by widening it', () => {
    const src = stripComments(readSource('services/research/crystalReadiness.ts'));
    // validated|canonical only. Admitting 'proposed' would raise the count by
    // admitting rows the pre-registered experiment policy excludes — the exact
    // move the provenance forbids.
    expect(src).toMatch(/status:\s*\['validated',\s*'canonical'\]/);
    expect(src).not.toMatch(/status:\s*\[[^\]]*'proposed'/);
  });
});
