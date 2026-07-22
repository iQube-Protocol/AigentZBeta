/**
 * Canary — PRD-EPI-001 §3.1 Crystal Intrinsic Readiness Report.
 *
 * Pins the honest-degradation contract: a domain with no invariants yet
 * (the expected state right now — Track 2, the crystal source-material
 * work, is paused per PRD-EPI-001 §0.6/§9) must report `ok: false` with
 * zero counts, never crash, and never silently report readiness.
 */

import { describe, it, expect } from 'vitest';
import { runCrystalReadinessReport } from '../services/research/crystalReadiness';

describe('PRD-EPI-001 §3.1 — Crystal Intrinsic Readiness Report', () => {
  it('reports ok: false, never throws, for a domain with no invariants yet', async () => {
    const report = await runCrystalReadinessReport({
      experimentId: 'EXP-P1',
      crystalDomain: 'constitutional-reasoning-does-not-exist-yet',
    });
    expect(report.ok).toBe(false);
    expect(report.invariantCount).toBe(0);
    expect(report.eligibleCount).toBe(0);
    expect(report.checks.length).toBeGreaterThan(0);
    for (const check of report.checks) {
      expect(typeof check.name).toBe('string');
      expect(typeof check.passed).toBe('boolean');
      expect(typeof check.detail).toBe('string');
    }
  });

  it('every check on an empty domain fails closed, not silently passes', async () => {
    const report = await runCrystalReadinessReport({
      experimentId: 'EXP-P1',
      crystalDomain: 'constitutional-reasoning-does-not-exist-yet',
    });
    // If the substrate itself is unreachable in this environment, the
    // function still returns a well-formed report (a single failing
    // 'invariant-fetch' check) rather than throwing — either way `ok` must
    // be false and no check may report passed:true on zero data.
    if (report.checks.length === 1 && report.checks[0].name === 'invariant-fetch') {
      expect(report.checks[0].passed).toBe(false);
    } else {
      for (const check of report.checks) {
        expect(check.passed).toBe(false);
      }
    }
  });

  it('defaults crystalDomain to constitutional-reasoning when omitted', async () => {
    // Must not throw even though no live invariant_contexts row is tagged
    // with this domain yet — the whole point of the honest-degradation
    // contract (PRD-EPI-001 §3.1 doc comment).
    const report = await runCrystalReadinessReport({ experimentId: 'EXP-P1' });
    expect(report.ok).toBe(false);
    expect(Array.isArray(report.checks)).toBe(true);
  });

  it('applies the illustrative override parameters without throwing', async () => {
    const report = await runCrystalReadinessReport({
      experimentId: 'EXP-P1',
      crystalDomain: 'constitutional-reasoning-does-not-exist-yet',
      minMeaningfulSliceSize: 1,
      minDerivationEligibleFraction: 0,
      maxDominantShapeFraction: 1,
      duplicateSimilarityThreshold: 0.99,
      fetchLimit: 10,
    });
    expect(typeof report.ok).toBe('boolean');
  });
});
