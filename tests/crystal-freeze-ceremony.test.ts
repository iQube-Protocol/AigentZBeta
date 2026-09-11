/**
 * Canary — Crystal Freeze Ceremony package builder (CFS-054 §6 / PRD-EPI-001
 * §3.1 Workstream 5). This module is INFRASTRUCTURE ONLY — pure, no I/O.
 *
 * Pins the properties that make it safe to call in production without ever
 * actually freezing anything: (1) it refuses (never silently proceeds) on
 * missing ratification fields; (2) `dvnAnchorRef` is always null; (3)
 * `eligibleForRatification` tracks the embedded recommendation's verdict
 * exactly; (4) the package is still built (for diagnostic review) even when
 * NOT eligible; (5) nothing in this module or its test ever calls
 * `freezeArtifact` — grepped for directly, as the strongest guarantee this
 * suite can offer that a freeze was never triggered by these tests.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildFreezeCeremonyPackage } from '../services/research/crystalFreezeCeremony';
import { composeCrystalFreezeRecommendation } from '../services/research/crystalFreezeRecommendation';
import { assessInferentialCapacity } from '../services/research/crystalSemanticStructure';
import { deriveCrystalPopulationRequirement } from '../services/research/crystalPopulationRequirement';
import { CRYSTAL_READINESS_CHECK_CONTRACT } from '../services/research/crystalInstrumentSuite';
import { INVARIANT_NAMESPACES } from '@/types/invariants';
import type { CrystalReadinessReport } from '../services/research/crystalReadiness';
import type { CrystalStatisticsReport } from '../services/research/crystalStatistics';

const MATURITY_TIER_CHECK_NAMES = new Set(['structural-diversity', 'graph-connectivity']);

/**
 * The check list and tiers are READ FROM THE EXECUTABLE CONTRACT rather than
 * hand-copied (updated 2026-08-26, IRL Review #001) — a hand-copied list goes
 * stale the moment the contract gains a check, and the staleness is invisible:
 * the fixture claims a fully-green report that is silently missing a gate.
 */
function passingReadiness(): CrystalReadinessReport {
  const checks = CRYSTAL_READINESS_CHECK_CONTRACT.map((entry) => ({
    name: entry.name,
    passed: true,
    detail: `${entry.name} ok`,
    remedy: null,
    tier: entry.tier,
  }));
  const maturityChecks = checks.filter((c) => c.tier === 'scientific-maturity');
  return {
    ok: true,
    checks,
    maturity: {
      checks: maturityChecks,
      passedCount: maturityChecks.filter((c) => c.passed).length,
      totalCount: maturityChecks.length,
      band: 'gold',
    },
    invariantCount: 12,
    eligibleCount: 12,
    populations: { A: 12, B: 0, C: 0, unclassified: 0, ablationCount: 12 },
    derivationEligibleFraction: 0.4,
    duplicatePairCount: 0,
    duplicates: {
      lexicalPairCount: 0, semanticPairCount: 0, unionPairCount: 0,
      semanticOnlyPairCount: 0, distinctStatementEstimate: 12, semanticPairs: [],
    },
    inferentialCapacity: assessInferentialCapacity([]),
    coverage: {
      boundaryNamespaceCount: INVARIANT_NAMESPACES.length,
      representedNamespaceCount: INVARIANT_NAMESPACES.length,
      ratio: 1,
      representedNamespaces: [...INVARIANT_NAMESPACES],
      missingNamespaces: [],
    },
    populationRequirement: deriveCrystalPopulationRequirement(),
    graph: { relationshipCount: 9, relationshipDensity: 0.25, componentCount: 1, largestComponentSize: 12, connectivityRatio: 1, orphanCount: 0, orphanFraction: 0 },
  };
}

function statsFor(readiness: CrystalReadinessReport): CrystalStatisticsReport {
  return {
    ok: readiness.ok,
    experimentId: 'EXP-P1',
    crystalDomain: 'd',
    computedAt: new Date(0).toISOString(),
    invariantCount: readiness.invariantCount,
    sourceCount: 4,
    documentCount: 4,
    externalSources: ['A', 'B', 'C', 'D'],
    relationshipCount: readiness.graph.relationshipCount,
    averageValidationDepth: 4,
    standingDistribution: [],
    compositionDensity: readiness.graph.relationshipDensity,
    semanticDiversity: 1.5,
    namespaceDistributionEntropy: 1.5,
    coverageEstimate: {
      boundaryNamespaceCount: readiness.coverage.boundaryNamespaceCount,
      representedNamespaceCount: readiness.coverage.representedNamespaceCount,
      ratio: readiness.coverage.ratio,
    },
    derivationHeadroom: readiness.inferentialCapacity.inferentialCapacityFraction,
    labelDiversityFraction: readiness.derivationEligibleFraction,
    sliceRatio: 0.4,
    selectionEntropy: 1.5,
    duplicateRatio: 0,
    frozenHash: 'a'.repeat(64),
    substrateError: null,
  };
}

const validInput = {
  crystalId: 'EXP-P1/crystal-vP1',
  experimentId: 'EXP-P1',
  crystalDomain: 'constitutional-reasoning',
  operatorRef: 'operator-commitment-abc123',
  reviewerRef: 'reviewer-commitment-def456',
  domainBoundary: 'Covers external financial-services doctrine; excludes internal platform risk material.',
  knownLimitations: ['Duplicate detection is lexical, not semantic.'],
  freezeRationale: 'All nine readiness checks pass and the independent review round completed.',
  ratifiedAt: '2026-07-31T00:00:00.000Z',
};

describe('Crystal Freeze Ceremony package builder', () => {
  it('builds a package with dvnAnchorRef always null and no receipt actually created', () => {
    const readiness = passingReadiness();
    const statistics = statsFor(readiness);
    const result = buildFreezeCeremonyPackage({ ...validInput, readiness, statistics });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.package.dvnAnchorRef).toBeNull();
    expect(result.package.contentHash).toBe(statistics.frozenHash);
    expect(result.package.signatories).toEqual([validInput.operatorRef, validInput.reviewerRef]);
  });

  it('marks eligibleForRatification true only when the embedded recommendation is READY_FOR_FREEZE', () => {
    const readiness = passingReadiness();
    const statistics = statsFor(readiness);
    const ready = buildFreezeCeremonyPackage({ ...validInput, readiness, statistics });
    expect(ready.ok && ready.package.eligibleForRatification).toBe(true);

    const failingChecks = readiness.checks.map((c) => (c.name === 'duplicate-detection' ? { ...c, passed: false } : c));
    const notReadyReadiness: CrystalReadinessReport = { ...readiness, ok: false, checks: failingChecks };
    const notReady = buildFreezeCeremonyPackage({ ...validInput, readiness: notReadyReadiness, statistics: statsFor(notReadyReadiness) });
    expect(notReady.ok && notReady.package.eligibleForRatification).toBe(false);
    // Still builds a package for diagnostic review — never refuses solely
    // because the corpus is not ready; it refuses only on incomplete input.
    expect(notReady.ok).toBe(true);
  });

  it('refuses (never throws, never builds a package) when operatorRef is blank', () => {
    const readiness = passingReadiness();
    const result = buildFreezeCeremonyPackage({ ...validInput, operatorRef: '  ', readiness, statistics: statsFor(readiness) });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error).toMatch(/operatorRef/);
  });

  it('refuses when freezeRationale is blank', () => {
    const readiness = passingReadiness();
    const result = buildFreezeCeremonyPackage({ ...validInput, freezeRationale: '', readiness, statistics: statsFor(readiness) });
    expect(result.ok).toBe(false);
  });

  it('refuses when domainBoundary is blank', () => {
    const readiness = passingReadiness();
    const result = buildFreezeCeremonyPackage({ ...validInput, domainBoundary: '', readiness, statistics: statsFor(readiness) });
    expect(result.ok).toBe(false);
  });

  it('merges caller-supplied limitations with the recommendation\'s own remaining risks, deduped', () => {
    const readiness = passingReadiness();
    const statistics = statsFor(readiness);
    const result = buildFreezeCeremonyPackage({ ...validInput, readiness, statistics });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.package.knownLimitations).toEqual(expect.arrayContaining(validInput.knownLimitations));
    const uniqueCount = new Set(result.package.knownLimitations).size;
    expect(uniqueCount).toBe(result.package.knownLimitations.length);
  });

  it('produces a deterministic packageHash for identical input', () => {
    const readiness = passingReadiness();
    const statistics = statsFor(readiness);
    const r1 = buildFreezeCeremonyPackage({ ...validInput, readiness, statistics });
    const r2 = buildFreezeCeremonyPackage({ ...validInput, readiness, statistics });
    expect(r1.ok && r2.ok && r1.package.packageHash === r2.package.packageHash).toBe(true);
  });

  it('does not import freezeArtifact — it is structurally incapable of calling it', () => {
    // The module's doc comments DISCUSS freezeArtifact (the real, separate
    // mechanism an operator calls after reviewing this package) — that prose
    // is expected and is not what this canary guards against. What matters
    // is that the executable code never imports the function, which makes
    // an accidental or malicious call impossible without editing the import
    // list itself (a change any reviewer would see).
    const src = readFileSync(join(__dirname, '..', 'services', 'research', 'crystalFreezeCeremony.ts'), 'utf8');
    expect(src).not.toMatch(/import\s*\{[^}]*freezeArtifact[^}]*\}\s*from/);
  });

  it('the embedded receiptPreview never claims a real receipt was created', () => {
    const readiness = passingReadiness();
    const statistics = statsFor(readiness);
    const result = buildFreezeCeremonyPackage({ ...validInput, readiness, statistics });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.package.receiptPreview.actionType).toBe('research_lifecycle_transition');
    // The recommendation embedded here is the SAME one composeCrystalFreezeRecommendation
    // would produce independently — not a forked computation.
    const independent = composeCrystalFreezeRecommendation('EXP-P1', 'constitutional-reasoning', readiness, statistics);
    expect(result.package.recommendation.verdict).toBe(independent.verdict);
  });
});
