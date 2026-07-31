/**
 * Constitutional Coherence Engine — canaries (CFS-014, Law XIV).
 *
 * Pure-function validation over synthetic briefs: semantic guardrail
 * integrity + coverage, narrative monotonicity/anchoring, style continuity
 * carriage, honest unevaluated dimensions (Law XII: no score without
 * validation), and the fail-closed pass gate.
 */

import { describe, expect, it } from 'vitest';
import { validateVideoBriefCoherence } from '@/services/coherence';
import type { VideoInvariantBrief } from '@/services/video/invariantVideoBrief';

const CONTINUITY = 'Continuity requirements:\n- [S-001] Same protagonist.';

function makeBrief(overrides: Partial<VideoInvariantBrief> = {}): VideoInvariantBrief {
  return {
    continuityBlock: CONTINUITY,
    styleInvariantIds: ['style-1'],
    narrativeInvariantIds: ['n1', 'n2', 'n3'],
    semanticInvariantIds: ['a', 'b'],
    segments: [
      { index: 0, foregroundedInvariantIds: ['a'], narrativeInvariantId: 'n1', beat: 'b0', prompt: `${CONTINUITY}\n\nb0`, composedBy: 'template' },
      { index: 1, foregroundedInvariantIds: ['b'], narrativeInvariantId: 'n2', beat: 'b1', prompt: `${CONTINUITY}\n\nb1`, composedBy: 'template' },
      { index: 2, foregroundedInvariantIds: [], narrativeInvariantId: 'n3', beat: 'b2', prompt: `${CONTINUITY}\n\nb2`, composedBy: 'template' },
    ],
    ...overrides,
  };
}

describe('Constitutional Coherence Engine (CFS-014)', () => {
  it('a well-formed brief passes with full semantic/narrative/style scores', () => {
    const result = validateVideoBriefCoherence(makeBrief());
    expect(result.pass).toBe(true);
    expect(result.dimensions.semantic.score).toBe(100);
    expect(result.dimensions.narrative.score).toBe(100);
    expect(result.dimensions.style.score).toBe(100);
    expect(result.constitutionalScore).toBe(100);
  });

  it('experience and reasoning stay honestly unevaluated (Law XII) and are excluded from the CCS', () => {
    const result = validateVideoBriefCoherence(makeBrief());
    expect(result.dimensions.experience).toEqual({ score: null, evaluated: false });
    expect(result.dimensions.reasoning).toEqual({ score: null, evaluated: false });
    expect(result.recommendations.some((r) => r.dimension === 'experience')).toBe(true);
    expect(result.recommendations.some((r) => r.dimension === 'reasoning')).toBe(true);
  });

  it('foregrounding an invariant outside the semantic grounding is an error → fail-closed', () => {
    const brief = makeBrief();
    brief.segments[0].foregroundedInvariantIds = ['a', 'rogue'];
    const result = validateVideoBriefCoherence(brief);
    expect(result.pass).toBe(false);
    expect(result.violations.some((v) => v.dimension === 'semantic' && v.severity === 'error')).toBe(true);
  });

  it('a dropped semantic principle is a warning (coverage score dips), not a hard fail', () => {
    const brief = makeBrief();
    brief.segments[1].foregroundedInvariantIds = []; // 'b' now foregrounded nowhere
    const result = validateVideoBriefCoherence(brief);
    expect(result.pass).toBe(true);
    expect(result.dimensions.semantic.score).toBe(50);
    expect(result.violations.some((v) => v.dimension === 'semantic' && v.severity === 'warning')).toBe(true);
  });

  it('reordered narrative beats are an error → fail-closed (CFS-012 §4)', () => {
    const brief = makeBrief();
    brief.segments[0].narrativeInvariantId = 'n2';
    brief.segments[1].narrativeInvariantId = 'n1'; // goes backward
    const result = validateVideoBriefCoherence(brief);
    expect(result.pass).toBe(false);
    expect(result.dimensions.narrative.score).toBe(0);
  });

  it('a monotonic but unanchored arc scores 80 with a warning', () => {
    const brief = makeBrief();
    brief.segments[2].narrativeInvariantId = 'n2'; // never reaches n3
    const result = validateVideoBriefCoherence(brief);
    expect(result.pass).toBe(true);
    expect(result.dimensions.narrative.score).toBe(80);
    expect(result.violations.some((v) => v.dimension === 'narrative' && v.severity === 'warning')).toBe(true);
  });

  it('a template segment that drops the continuity block is a style error', () => {
    const brief = makeBrief();
    brief.segments[2].prompt = 'b2 without continuity';
    const result = validateVideoBriefCoherence(brief);
    expect(result.pass).toBe(false);
    expect(result.dimensions.style.score).toBeLessThan(100);
  });

  it('LLM-composed segments leave style honestly unevaluated instead of false-negative matching', () => {
    const brief = makeBrief();
    brief.segments[0].composedBy = 'llm';
    brief.segments[0].prompt = 'cinematic prose without the literal block';
    const result = validateVideoBriefCoherence(brief);
    expect(result.dimensions.style.evaluated).toBe(false);
    expect(result.dimensions.style.score).toBeNull();
    expect(result.pass).toBe(true); // no false error from prose translation
  });

  it('with no evaluatable dimensions the CCS is null, never a fabricated number', () => {
    const result = validateVideoBriefCoherence(
      makeBrief({
        styleInvariantIds: [],
        narrativeInvariantIds: [],
        semanticInvariantIds: [],
        segments: [
          { index: 0, foregroundedInvariantIds: [], narrativeInvariantId: null, beat: 'b', prompt: 'p', composedBy: 'template' },
        ],
      }),
    );
    expect(result.constitutionalScore).toBeNull();
    expect(result.pass).toBe(true);
  });
});
