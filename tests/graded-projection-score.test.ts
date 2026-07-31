/**
 * EXP-006 graded scorer canary (Aletheon 2026-07-20 instrument calibration).
 *
 * Pins that the normalized tier folds the observed morphological / separator
 * variants that the exact-match scorer double-counted, WITHOUT merging genuinely
 * distinct concepts — and that the exact tier still reproduces the raw baseline.
 */

import { describe, it, expect } from 'vitest';
import { canonicalizeLabel, gradedIntentScore } from '@/services/experiments/gradedProjectionScore';

describe('canonicalizeLabel (separator + morphological folding)', () => {
  const folds: [string, string][] = [
    ['accessibility', 'accessible'],
    ['data collection', 'data_collection'],
    ['root cause', 'root_cause'],
    ['transparency', 'transparent'],
    ['engaging', 'engagement'],
    ['user-engagement', 'user engagement'],
  ];
  it.each(folds)('folds "%s" ≈ "%s"', (a, b) => {
    expect(canonicalizeLabel(a)).toBe(canonicalizeLabel(b));
  });

  it('does NOT merge genuinely distinct concepts', () => {
    // security ⊇ secure-access is subsumption, not morphology — stays distinct.
    expect(canonicalizeLabel('security')).not.toBe(canonicalizeLabel('secure access'));
    expect(canonicalizeLabel('delegation')).not.toBe(canonicalizeLabel('scope limitation'));
  });
});

describe('gradedIntentScore (exact baseline preserved; normalized lifts it)', () => {
  it('reproduces the zero-overlap exact baseline but recovers it at the normalized tier', () => {
    // The real "Diagnose a system failure"-style mismatch: same concepts, only
    // separator/morphology differ → exact scores 0, normalized recovers them.
    const predicted = ['data collection', 'root cause'];
    const reference = ['data_collection', 'root_cause'];
    const s = gradedIntentScore('t', predicted, reference);

    expect(s.exact.overlap).toBe(0); // the raw Stage-A defect, unchanged
    expect(s.normalized.precision).toBe(1);
    expect(s.normalized.recall).toBe(1);
    expect(s.genuineMissing).toEqual([]);     // no longer double-counted as missing
    expect(s.genuineRedundant).toEqual([]);   // …nor as redundant
  });

  it('keeps genuine gaps as deltas after normalization', () => {
    const s = gradedIntentScore('t', ['accessible', 'security'], ['accessibility', 'secure access', 'audit logging']);
    // 'accessible' folds onto 'accessibility'; 'security' does not fold onto the
    // operational refinements → they remain genuine.
    expect(s.normalized.overlap).toBe(1);
    expect(s.genuineMissing).toEqual(expect.arrayContaining(['secure access', 'audit logging']));
    expect(s.genuineRedundant).toEqual(['security']);
  });
});
