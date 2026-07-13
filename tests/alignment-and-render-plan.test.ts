/**
 * Canary for the two MISSING capabilities of the 2026-07-13 Implementation
 * Pack, now built and wired into the video-article skill:
 *   - Automated Content Alignment (services/content/alignmentService.ts) —
 *     heuristic per-segment coverage of the shared brief (validation plan #1:
 *     "correctly integrates outputs from Video Generation and Article
 *     Generation" — both composed via the brief, never re-implemented).
 *   - Rendering Optimization (services/rendering/optimization.ts) —
 *     structural render planning grounded in the REAL pipeline constraints
 *     (12s clip cap, 4-segment ceiling, 2–3 clips per stitch call); the
 *     optimization is minimal stitch passes (validation plan #2).
 */

import { describe, it, expect } from 'vitest';
import {
  salientTokens,
  segmentCoverage,
  alignArticleToBrief,
  SEGMENT_COVERAGE_FLOOR,
} from '@/services/content/alignmentService';
import { planRender, CLIP_SECONDS_CAP, MAX_SEGMENTS } from '@/services/rendering/optimization';

describe('Automated Content Alignment (heuristic)', () => {
  it('keeps invariant markers as strong cues and drops stopwords', () => {
    const tokens = salientTokens('The primitive [C-011] anchors every segment with provenance');
    expect(tokens).toContain('[C-011]');
    expect(tokens).toContain('primitive');
    expect(tokens).toContain('provenance');
    expect(tokens).not.toContain('the');
    expect(tokens).not.toContain('segment'); // domain stopword
  });

  it('scores coverage of a beat against the article body', () => {
    const { coverage, missingCues } = segmentCoverage(
      'The invariant primitive anchors provenance',
      'This article explains how the invariant primitive anchors trust.',
    );
    expect(coverage).toBeGreaterThan(0.4);
    expect(missingCues).toContain('provenance');
  });

  it('aligned article passes; a segment the article skips fails the floor', () => {
    const segments = [
      { index: 0, beat: 'The primitive appears with provenance anchoring' },
      { index: 1, beat: 'Composition graph forms between invariants' },
    ];
    const good = alignArticleToBrief(
      segments,
      'The primitive appears carrying provenance anchoring. Then the composition graph forms between invariants.',
    );
    expect(good.pass).toBe(true);
    expect(good.score).toBeGreaterThan(0.8);
    expect(good.basis).toBe('heuristic');

    const skipsSecond = alignArticleToBrief(segments, 'The primitive appears with provenance anchoring. The end.');
    expect(skipsSecond.pass).toBe(false);
    expect(skipsSecond.perSegment[1].coverage).toBeLessThan(SEGMENT_COVERAGE_FLOOR);
    expect(skipsSecond.perSegment[1].missingCues.length).toBeGreaterThan(0);
  });

  it('empty segment list never passes vacuously', () => {
    expect(alignArticleToBrief([], 'anything').pass).toBe(false);
  });
});

describe('Rendering Optimization (structural planning)', () => {
  it('24s → 2 × 12s with exactly ONE stitch pass (the skill contract)', () => {
    const plan = planRender(24);
    expect(plan.segmentCount).toBe(2);
    expect(plan.segmentSeconds).toBe(CLIP_SECONDS_CAP);
    expect(plan.plannedSeconds).toBe(24);
    expect(plan.stitchPasses).toBe(1);
    expect(plan.stitchLevels).toEqual([[[0, 1]]]);
  });

  it('36s → 3 segments packed into ONE 3-clip stitch (the optimization)', () => {
    const plan = planRender(36);
    expect(plan.segmentCount).toBe(3);
    expect(plan.stitchLevels).toEqual([[[0, 1, 2]]]);
    expect(plan.stitchPasses).toBe(1);
  });

  it('48s → the hierarchical [0,1]+[2,3]→final tree (3 passes, matches SkillVideoPlayer)', () => {
    const plan = planRender(48);
    expect(plan.segmentCount).toBe(4);
    expect(plan.stitchLevels).toEqual([[[0, 1], [2, 3]], [[0, 1]]]);
    expect(plan.stitchPasses).toBe(3);
  });

  it('clamps to the pipeline ceiling and rejects nonsense', () => {
    expect(planRender(600).segmentCount).toBe(MAX_SEGMENTS);
    expect(planRender(5).stitchPasses).toBe(0); // single clip — no stitch
    expect(() => planRender(0)).toThrow();
  });
});
