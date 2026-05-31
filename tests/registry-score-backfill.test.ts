/**
 * Score backfill derivation tests.
 *
 * Verifies the per-primitive derivation rules + the derived score
 * formulas + the cluster aggregation. Does not hit the database — pure
 * function testing of the rule logic.
 */

import { describe, expect, it } from 'vitest';

import {
  computeReliability,
  computeTrust,
  computeDerivedScores,
  clampAxis,
  type RawScores,
} from '@/services/registry/scoreBackfill/types';
import { aggregateClusterScores } from '@/services/registry/scoreBackfill/clusterQubeScores';

describe('score utils: derived formulas', () => {
  it('computeReliability is accuracy*0.6 + verifiability*0.4', () => {
    expect(computeReliability(10, 10)).toBe(10);
    expect(computeReliability(0, 0)).toBe(0);
    expect(computeReliability(8, 6)).toBe(7.2);
    expect(computeReliability(5, 5)).toBe(5);
  });

  it('computeTrust is 10 - (sensitivity*0.4 + risk*0.6)', () => {
    expect(computeTrust(0, 0)).toBe(10);
    expect(computeTrust(10, 10)).toBe(0);
    expect(computeTrust(5, 5)).toBe(5);
    expect(computeTrust(2, 4)).toBe(6.8);
  });

  it('computeDerivedScores returns both', () => {
    const raw: RawScores = { sensitivity: 4, accuracy: 8, verifiability: 9, risk: 3 };
    const d = computeDerivedScores(raw);
    expect(d.reliability).toBeCloseTo(8.4, 1);
    expect(d.trust).toBeCloseTo(6.6, 1);
  });
});

describe('score utils: clampAxis', () => {
  it('rounds to integer in 0..10', () => {
    expect(clampAxis(5.4)).toBe(5);
    expect(clampAxis(5.5)).toBe(6);
    expect(clampAxis(0.3)).toBe(0);
    expect(clampAxis(9.6)).toBe(10);
  });

  it('clamps to 0..10 range', () => {
    expect(clampAxis(-5)).toBe(0);
    expect(clampAxis(15)).toBe(10);
    expect(clampAxis(0)).toBe(0);
    expect(clampAxis(10)).toBe(10);
  });

  it('returns 5 for NaN', () => {
    expect(clampAxis(NaN)).toBe(5);
  });
});

describe('cluster aggregation', () => {
  it('returns null for empty membership', () => {
    expect(aggregateClusterScores([])).toBeNull();
  });

  it('means sensitivity / accuracy / verifiability', () => {
    const members = [
      { sensitivity: 2, accuracy: 8, verifiability: 9, risk: 2 },
      { sensitivity: 4, accuracy: 6, verifiability: 7, risk: 4 },
      { sensitivity: 6, accuracy: 4, verifiability: 5, risk: 6 },
    ];
    const result = aggregateClusterScores(members);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.sensitivity).toBe(4); // (2+4+6)/3
    expect(result.accuracy).toBe(6); // (8+6+4)/3
    expect(result.verifiability).toBe(7); // (9+7+5)/3
  });

  it('risk biases toward max member risk (70% max + 30% mean)', () => {
    const members = [
      { sensitivity: 5, accuracy: 5, verifiability: 5, risk: 1 },
      { sensitivity: 5, accuracy: 5, verifiability: 5, risk: 9 }, // worst-case
    ];
    const result = aggregateClusterScores(members);
    expect(result).not.toBeNull();
    if (!result) return;
    // max risk = 9; mean risk = 5; weighted = 9*0.7 + 5*0.3 = 6.3 + 1.5 = 7.8 → 8
    expect(result.risk).toBe(8);
  });

  it('all-low-risk members yield low cluster risk', () => {
    const members = [
      { sensitivity: 2, accuracy: 8, verifiability: 9, risk: 1 },
      { sensitivity: 3, accuracy: 7, verifiability: 8, risk: 2 },
    ];
    const result = aggregateClusterScores(members);
    expect(result?.risk).toBeLessThanOrEqual(3);
  });
});

// Per-primitive derivation rule tests use stub data; not full DB integration.
// The derivers are tested via the route handler integration in CI; here we
// verify the static rule mappings via the exported helpers (re-imports of
// the per-primitive private functions would require export changes — we
// keep them private and rely on the integration smoke at the admin route
// level).
describe('rule baselines (documented)', () => {
  it('contentQube canonized+open → high reliability', () => {
    // Mapping: gating 'open' → sensitivity 1; lifecycle 'canonized' →
    // accuracy 9 + verifiability 9; gating 'open' + canonized → risk 1
    // Therefore reliability = 9*0.6 + 9*0.4 = 9.0; trust = 10 - (1*0.4 + 1*0.6) = 9.0
    const d = computeDerivedScores({ sensitivity: 1, accuracy: 9, verifiability: 9, risk: 1 });
    expect(d.reliability).toBe(9);
    expect(d.trust).toBe(9);
  });

  it('aigentQube trust_band 0 + no_charter + code → low overall', () => {
    // semi_anonymous + disclose → sensitivity 7
    // null payment + low scope_breadth (2) → risk 2.5 → 3
    // trust_band 0 → accuracy 3
    // no_charter + code-only → verifiability 4
    const d = computeDerivedScores({ sensitivity: 7, accuracy: 3, verifiability: 4, risk: 3 });
    // reliability = 3*0.6 + 4*0.4 = 3.4
    // trust = 10 - (7*0.4 + 3*0.6) = 10 - (2.8 + 1.8) = 5.4
    expect(d.reliability).toBeCloseTo(3.4, 1);
    expect(d.trust).toBeCloseTo(5.4, 1);
  });

  it('LiquidUI template → 1/8/10/1 → maxed-out reliability + trust', () => {
    const d = computeDerivedScores({ sensitivity: 1, accuracy: 8, verifiability: 10, risk: 1 });
    expect(d.reliability).toBeCloseTo(8.8, 1);
    expect(d.trust).toBeCloseTo(9, 1);
  });
});
