/**
 * Invariant Intelligence — CRP-002 Phase 1 contract canaries (metaMe IRL).
 *
 * Pins the two contract-first primitives the charter names:
 *   1. The reframed iQube pipeline order — and that CURATION is deliberately
 *      absent (it is the RESULT of invariant discovery, not a stage).
 *   2. The intent grammar STRUCTURE — the candidate primitive set + total
 *      coverage of the candidate intent→concern bias. The canary pins the
 *      structure, NOT the truth of any mapping (that is WP1's to refine).
 */

import { describe, it, expect } from 'vitest';
import {
  IQUBE_PIPELINE,
  PROJECTION_STAGES,
  isProjectionStage,
  stagesDownstreamOf,
  INTENT_PRIMITIVES,
  INVARIANT_CONCERN_CLASSES,
  CANDIDATE_INTENT_BIAS,
  candidateIntentBias,
  INVARIANT_INTELLIGENCE_WORKSTREAMS,
  IRL_EXP002_ARMS,
  PROPAGATION_MODALITIES,
} from '@/types/invariantIntelligence';

describe('CRP-002 §2 — the reframed iQube pipeline (order pinned)', () => {
  it('is intent-first, price-last, with invariant-discovery replacing curation', () => {
    expect([...IQUBE_PIPELINE]).toEqual([
      'intent',
      'invariant-discovery',
      'knowledge-compression',
      'knowledge-qube',
      'risk',
      'value',
      'consequence',
      'price',
    ]);
    expect(IQUBE_PIPELINE[0]).toBe('intent');
    expect(IQUBE_PIPELINE[IQUBE_PIPELINE.length - 1]).toBe('price');
  });

  it('does NOT contain "curation" — it is the RESULT of invariant discovery, not a stage', () => {
    expect((IQUBE_PIPELINE as readonly string[]).includes('curation')).toBe(false);
    // invariant-discovery is the stage that yields curation as its result.
    expect((IQUBE_PIPELINE as readonly string[]).includes('invariant-discovery')).toBe(true);
  });

  it('the projection stages are exactly the tail after knowledge-qube', () => {
    const qubeIdx = IQUBE_PIPELINE.indexOf('knowledge-qube');
    expect(IQUBE_PIPELINE.slice(qubeIdx + 1)).toEqual([...PROJECTION_STAGES]);
    for (const s of PROJECTION_STAGES) {
      expect(isProjectionStage(s)).toBe(true);
    }
    // front-end stages are NOT projections
    expect(isProjectionStage('intent')).toBe(false);
    expect(isProjectionStage('knowledge-qube')).toBe(false);
  });

  it('stagesDownstreamOf returns the true tail (projections inherit one basis)', () => {
    expect(stagesDownstreamOf('knowledge-qube')).toEqual(['risk', 'value', 'consequence', 'price']);
    expect(stagesDownstreamOf('price')).toEqual([]);
    expect(stagesDownstreamOf('intent')[0]).toBe('invariant-discovery');
  });
});

describe('CRP-002 §3 — the intent grammar (candidate hypothesis; structure pinned)', () => {
  it('has the 13 chartered candidate primitives', () => {
    expect(INTENT_PRIMITIVES).toHaveLength(13);
    for (const p of [
      'acquire-knowledge', 'explain', 'compare', 'design', 'predict', 'diagnose',
      'evaluate', 'create', 'govern', 'negotiate', 'collaborate', 'teach', 'verify',
    ]) {
      expect((INTENT_PRIMITIVES as readonly string[]).includes(p)).toBe(true);
    }
  });

  it('the candidate intent→concern bias covers EVERY primitive with known concern classes', () => {
    const concerns = new Set<string>(INVARIANT_CONCERN_CLASSES);
    for (const primitive of INTENT_PRIMITIVES) {
      const bias = CANDIDATE_INTENT_BIAS[primitive];
      expect(Array.isArray(bias)).toBe(true);
      expect(bias.length).toBeGreaterThan(0);
      for (const c of bias) {
        // every biased concern is a known concern class (no free-text drift)
        expect(concerns.has(c)).toBe(true);
      }
    }
    // no extra keys beyond the primitive set
    expect(Object.keys(CANDIDATE_INTENT_BIAS).sort()).toEqual([...INTENT_PRIMITIVES].sort());
  });

  it('candidateIntentBias is a hypothesis surface (empty for an unknown intent)', () => {
    expect(candidateIntentBias('govern')).toContain('governance');
    expect(candidateIntentBias('not-an-intent')).toEqual([]);
  });
});

describe('CRP-002 Aletheon amendment (2026-07-09) — WP0, four-arm EXP-002, propagation', () => {
  it('adds WP0 Invariant Theory before Intent Science (order pinned)', () => {
    expect([...INVARIANT_INTELLIGENCE_WORKSTREAMS]).toEqual([
      'wp0-invariant-theory',
      'wp1-intent-science',
      'wp2-invariant-discovery',
      'wp3-knowledge-compression',
      'wp4-invariant-runtime',
    ]);
    // WP0 comes strictly before Intent Science — you must define invariants
    // before you can rigorously discover them.
    expect(INVARIANT_INTELLIGENCE_WORKSTREAMS.indexOf('wp0-invariant-theory')).toBeLessThan(
      INVARIANT_INTELLIGENCE_WORKSTREAMS.indexOf('wp1-intent-science'),
    );
  });

  it('IRL-EXP-002 is a FOUR-arm ladder ending at the invariant runtime (existing-kb is the honest bar)', () => {
    expect([...IRL_EXP002_ARMS]).toEqual([
      'large-context',
      'naive-rag',
      'existing-kb',
      'invariant-runtime',
    ]);
    expect(IRL_EXP002_ARMS[IRL_EXP002_ARMS.length - 1]).toBe('invariant-runtime');
    // the honest bar (our own production retrieval) precedes the experimental arm
    expect(IRL_EXP002_ARMS.indexOf('existing-kb')).toBeLessThan(
      IRL_EXP002_ARMS.indexOf('invariant-runtime'),
    );
  });

  it('Propagation Fidelity spans the named cross-modal set', () => {
    expect([...PROPAGATION_MODALITIES]).toEqual(['article', 'story', 'image', 'ux', 'prd']);
  });
});
