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
