/**
 * Coherent Bundle Generation canaries (operationalizes EXP-001, 2026-07-19).
 *
 * Pins the DETERMINISTIC coherence math and the opt-in judge's scoring:
 *   1. computeBundleCoherence — absent signals are EXCLUDED (never faked); the
 *      composite is the mean of present signals; pass requires every present
 *      verdict to pass.
 *   2. computeJudgementScore — verdict weights + the contradiction veto.
 */

import { describe, it, expect } from 'vitest';
import { computeBundleCoherence } from '@/services/skills/coherentBundleSkill';
import { computeJudgementScore, type InvariantFidelity } from '@/services/skills/bundleJudgement';
import type { VideoInvariantBrief } from '@/services/video/invariantVideoBrief';

const brief = (semantic: string[] = ['a', 'b']): VideoInvariantBrief => ({
  continuityBlock: 'cb',
  styleInvariantIds: [],
  narrativeInvariantIds: [],
  semanticInvariantIds: semantic,
  segments: [],
});

describe('computeBundleCoherence — cheap deterministic score', () => {
  it('excludes absent signals (never fakes a pass) and averages present ones', () => {
    // Only a brief coherence signal present; grammar + alignment absent.
    const c = computeBundleCoherence({
      brief: brief(),
      videoPlan: null,
      briefCoherence: { constitutionalScore: 80, pass: true },
      alignment: null,
    });
    expect(c.grammar).toBeNull();
    expect(c.articleAlignment).toBeNull();
    expect(c.composite).toBe(80); // mean of the single present signal
    expect(c.pass).toBe(true);
    expect(c.foregroundedInvariantIds).toEqual(['a', 'b']);
  });

  it('averages multiple present signals and requires ALL present verdicts to pass', () => {
    const c = computeBundleCoherence({
      brief: brief(),
      videoPlan: { grammar: { pass: true, violations: [] } } as never,
      briefCoherence: { constitutionalScore: 90, pass: true },
      alignment: { score: 0.5, pass: false, perSegment: [], basis: 'heuristic' },
    });
    // signals: brief 90, grammar 100 (pass), alignment 50 → mean 80
    expect(c.composite).toBe(80);
    // one present verdict (alignment) fails → overall fail
    expect(c.pass).toBe(false);
  });

  it('grammar violations dock the grammar signal', () => {
    const c = computeBundleCoherence({
      brief: brief([]),
      videoPlan: { grammar: { pass: false, violations: ['v1', 'v2'] } } as never,
      briefCoherence: null,
      alignment: null,
    });
    // grammar-only: 100 - 2*20 = 60
    expect(c.composite).toBe(60);
    expect(c.pass).toBe(false);
  });

  it('no present signals → null composite, not a fake pass', () => {
    const c = computeBundleCoherence({ brief: brief([]), videoPlan: null, briefCoherence: null, alignment: null });
    expect(c.composite).toBeNull();
    expect(c.pass).toBe(false);
  });
});

describe('computeJudgementScore — opt-in judge', () => {
  const mk = (verdicts: InvariantFidelity['verdict'][]): InvariantFidelity[] =>
    verdicts.map((verdict, i) => ({ invariantId: `i${i}`, marker: '[X-000]', verdict, note: '' }));

  it('weights preserved=1, weakened=0.5, contradicted/absent=0', () => {
    const { score } = computeJudgementScore(mk(['preserved', 'weakened', 'absent', 'preserved']));
    // (1 + 0.5 + 0 + 1) / 4 = 0.625 → 63
    expect(score).toBe(63);
  });

  it('a single contradiction vetoes the pass regardless of score', () => {
    const { score, pass } = computeJudgementScore(mk(['preserved', 'preserved', 'preserved', 'preserved', 'contradicted']));
    expect(score).toBe(80); // 4/5
    expect(pass).toBe(false); // contradiction veto
  });

  it('passes only at >=80 with zero contradictions', () => {
    // all preserved → 100, pass
    expect(computeJudgementScore(mk(['preserved', 'preserved', 'preserved', 'preserved', 'preserved'])).pass).toBe(true);
    // (1+1+0.5+0)/4 = 0.625 → 63 < 80 → fail
    expect(computeJudgementScore(mk(['preserved', 'preserved', 'weakened', 'absent'])).pass).toBe(false);
  });
});
