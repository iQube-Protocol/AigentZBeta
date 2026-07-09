/**
 * IRL-EXP-001 Stage A — pure-core canaries (CRP-002 / metaMe IRL).
 *
 * Pins the deterministic, provider-free heart of the experiment: projection
 * fidelity (overlap/precision/recall/f1), the structural Invariant Delta
 * classification (missing/redundant), the aggregate, the label parser, the CIRS
 * protocol surface (intents + experimental stamping), and the independence
 * protocol's three cognitive roles. The prediction + generation steps
 * (callSovereign) are impure and not exercised here.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeLabel,
  projectionFidelity,
  classifyStructuralDeltas,
  aggregateStageA,
} from '@/services/experiments/irlExp001';
import {
  CIRS_VERSION,
  CIRS_INTENTS,
  buildExperimentalCIRSEntry,
  parsePredictedLabels,
} from '@/services/experiments/cirs';
import { RESEARCH_INTELLIGENCE_ROLES } from '@/types/invariantIntelligence';

describe('IRL-EXP-001 — projection fidelity (pure, deterministic)', () => {
  it('scores overlap / precision / recall / f1 correctly', () => {
    // predicted {a,b,c}; reference {b,c,d} → overlap 2, precision 2/3, recall 2/3
    const f = projectionFidelity(['a', 'b', 'c'], ['b', 'c', 'd']);
    expect(f.overlap).toBe(2);
    expect(f.precision).toBeCloseTo(2 / 3);
    expect(f.recall).toBeCloseTo(2 / 3);
    expect(f.f1).toBeCloseTo(2 / 3);
  });

  it('is normalisation-invariant (case / spacing) and empty-safe', () => {
    expect(projectionFidelity(['Human Primacy'], ['human-primacy']).overlap).toBe(1);
    const empty = projectionFidelity([], ['a']);
    expect(empty.precision).toBe(0);
    expect(empty.recall).toBe(0);
    expect(empty.f1).toBe(0);
  });

  it('normalizeLabel lowercases, trims, and dashes inner spaces', () => {
    expect(normalizeLabel('  Minimum Disclosure ')).toBe('minimum-disclosure');
  });
});

describe('IRL-EXP-001 — structural Invariant Deltas (the research data)', () => {
  it('classifies reference-misses as missing-invariant and extras as redundant-invariant', () => {
    const deltas = classifyStructuralDeltas('intent-x', ['a', 'b', 'x'], ['a', 'b', 'c']);
    const missing = deltas.filter((d) => d.classification === 'missing-invariant');
    const redundant = deltas.filter((d) => d.classification === 'redundant-invariant');
    expect(missing.map((d) => d.difference[0])).toEqual(['c']); // in reference, not predicted
    expect(redundant.map((d) => d.difference[0])).toEqual(['x']); // predicted, not in reference
    // every delta carries the full predicted + reference context
    expect(deltas[0].intent).toBe('intent-x');
    expect(deltas[0].predicted.length).toBe(3);
  });

  it('a perfect prediction yields zero deltas', () => {
    expect(classifyStructuralDeltas('i', ['a', 'b'], ['b', 'a'])).toEqual([]);
  });
});

describe('IRL-EXP-001 — aggregate + label parsing', () => {
  it('aggregates mean fidelity and counts delta classes across intents', () => {
    const results = [
      { intent: 'i1', predicted: ['a'], reference: ['a'], fidelity: projectionFidelity(['a'], ['a']), deltas: classifyStructuralDeltas('i1', ['a'], ['a']) },
      { intent: 'i2', predicted: ['x'], reference: ['a', 'b'], fidelity: projectionFidelity(['x'], ['a', 'b']), deltas: classifyStructuralDeltas('i2', ['x'], ['a', 'b']) },
    ];
    const agg = aggregateStageA(results, 'v0.1');
    expect(agg.intentCount).toBe(2);
    expect(agg.meanRecall).toBeCloseTo((1 + 0) / 2);
    // i2 contributes 2 missing (a,b) + 1 redundant (x)
    expect(agg.deltaCounts['missing-invariant']).toBe(2);
    expect(agg.deltaCounts['redundant-invariant']).toBe(1);
  });

  it('parses a JSON array, a fenced array, and a comma/line list', () => {
    expect(parsePredictedLabels('["disclosure","agency"]')).toEqual(['disclosure', 'agency']);
    expect(parsePredictedLabels('```json\n["a", "b"]\n```')).toEqual(['a', 'b']);
    expect(parsePredictedLabels('- disclosure\n- agency')).toEqual(['disclosure', 'agency']);
  });
});

describe('CIRS — protocol surface (stimuli + experimental stamping), no PI-authored answers', () => {
  it('CIRS_INTENTS is a non-empty representative spread of intents (the STIMULI only)', () => {
    expect(CIRS_VERSION).toBe('v0.1');
    expect(CIRS_INTENTS.length).toBeGreaterThanOrEqual(6);
    // Protocol holds only the intents to project — never the invariant answers.
    for (const intent of CIRS_INTENTS) expect(typeof intent).toBe('string');
  });

  it('buildExperimentalCIRSEntry stamps any generated set as experimental / not ratified', () => {
    // Simulates the generative role handing an independently-produced set through.
    const entry = buildExperimentalCIRSEntry('Verify a factual claim', ['evidence', 'provenance']);
    expect(entry.confidence).toBe('experimental');
    expect(entry.ratified).toBe(false);
    expect(entry.version).toBe('v0.1');
    expect(entry.candidateInvariants).toEqual(['evidence', 'provenance']);
  });
});

describe('Independence protocol — three cognitive roles (Aletheon 2026-07-09)', () => {
  it('separates generative, evaluative, and constitutional intelligence', () => {
    expect(RESEARCH_INTELLIGENCE_ROLES).toEqual(['generative', 'evaluative', 'constitutional']);
  });
});
