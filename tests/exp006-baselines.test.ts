/**
 * EXP-006 baseline comparator canaries (Aletheon 2026-07-20 "43% vs what?").
 *
 * Pins the FAIR-PROTOCOL invariants of the comparator arms:
 *   1. field vocabulary = normalised union across intents (dedup, no per-intent leak);
 *   2. random arm is deterministic (seeded) and lands at precision≈recall (k=|ref|);
 *   3. keyword arm ranks by token overlap (a topically-matching label is recovered);
 *   4. the semantic arm degrades to available:false — never a fabricated score —
 *      when it cannot run (here: empty vocabulary, so no provider call).
 */

import { describe, it, expect } from 'vitest';
import type { CanonicalInvariantReference } from '@/types/invariantIntelligence';
import {
  buildFieldVocabulary,
  randomBaselineArm,
  keywordBaselineArm,
  semanticBaselineArm,
} from '@/services/experiments/exp006Baselines';

function ref(intent: string, labels: string[]): CanonicalInvariantReference {
  return { intent, candidateInvariants: labels, confidence: 'experimental', version: 'v0.1', ratified: false };
}

const CIRS: CanonicalInvariantReference[] = [
  ref('Design an authenticated delegation API', ['delegation', 'authentication', 'accountability', 'consent']),
  ref('Verify a factual claim', ['verification', 'provenance']),
  ref('Analyse a public policy', ['accountability', 'transparency', 'consent']),
];

describe('buildFieldVocabulary', () => {
  it('is the normalised, deduped union across intents', () => {
    const vocab = buildFieldVocabulary(CIRS);
    // 4 + 2 + 3 labels, with 'accountability' and 'consent' shared → 7 unique.
    expect(vocab).toEqual(
      ['accountability', 'authentication', 'consent', 'delegation', 'provenance', 'transparency', 'verification'],
    );
  });
});

describe('random arm (chance floor)', () => {
  it('is deterministic across runs (seeded)', () => {
    const vocab = buildFieldVocabulary(CIRS);
    const a = randomBaselineArm(CIRS, vocab);
    const b = randomBaselineArm(CIRS, vocab);
    expect(a.meanPrecision).toBeCloseTo(b.meanPrecision, 10);
    expect(a.meanRecall).toBeCloseTo(b.meanRecall, 10);
  });

  it('lands at precision≈recall (predicts exactly k=|reference|)', () => {
    const vocab = buildFieldVocabulary(CIRS);
    const a = randomBaselineArm(CIRS, vocab);
    expect(a.available).toBe(true);
    expect(a.meanPrecision).toBeCloseTo(a.meanRecall, 6);
    // A non-trivial floor bounded in (0,1).
    expect(a.meanPrecision).toBeGreaterThan(0);
    expect(a.meanPrecision).toBeLessThan(1);
  });
});

describe('keyword arm (lexical IR)', () => {
  it('recovers a label whose tokens appear in the intent', () => {
    const vocab = buildFieldVocabulary(CIRS);
    const a = keywordBaselineArm(CIRS, vocab);
    const delegationIntent = a.perIntent.find((r) => r.intent.includes('delegation'));
    // 'delegation' and 'authentication' (→ 'authenticated') share tokens with the
    // intent, so at least one lexical match should be predicted.
    expect(delegationIntent?.predicted).toContain('delegation');
    expect(a.meanRecall).toBeGreaterThan(0);
  });
});

describe('semantic arm (honest degradation)', () => {
  it('returns available:false on empty vocabulary — never a faked score', async () => {
    const arm = await semanticBaselineArm(CIRS, []);
    expect(arm.available).toBe(false);
    expect(arm.meanPrecision).toBe(0);
    expect(arm.perIntent).toEqual([]);
  });
});
