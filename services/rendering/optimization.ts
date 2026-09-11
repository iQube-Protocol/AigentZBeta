/**
 * rendering/optimization — Rendering Optimization (Implementation Pack
 * 2026-07-13, MISSING capability #2, small. Dep: Video Generation — composed.)
 *
 * Structural render planning for multi-segment videos: given a target
 * runtime, produce the segment plan and the hierarchical stitch tree that the
 * REAL pipeline constraints dictate — grounded verbatim in SkillVideoPlayer
 * (SEGMENT_SECONDS = 12 provider cap, MAX_SEGMENTS = 4) and the stitch route
 * (/api/skills/video/stitch accepts 2–3 clips per call; a 4-segment video
 * stitches hierarchically [0,1]→A, [2,3]→B, [A,B]→final).
 *
 * The optimization is MINIMIZING STITCH PASSES: every extra pass is a full
 * encode + upload round-trip, the slow half of rendering. The planner packs
 * clips 3-per-call where the route allows it, so e.g. 3 segments render in
 * ONE stitch pass instead of two.
 *
 * HONEST SCOPE: this plans structure; it does not (and cannot) speed up the
 * providers' generation time. No wall-clock estimates are fabricated — the
 * plan reports pass COUNTS, which are real, not seconds, which would be
 * guessed. Pure + node-drillable.
 */

/** Provider clip cap (SkillVideoPlayer SEGMENT_SECONDS). */
export const CLIP_SECONDS_CAP = 12;
/** Pipeline ceiling (SkillVideoPlayer MAX_SEGMENTS — 4×12 = 48s). */
export const MAX_SEGMENTS = 4;
/** The stitch route accepts 2–3 clips per call. */
export const MAX_CLIPS_PER_STITCH = 3;

export interface RenderPlan {
  targetSeconds: number;
  /** Actual renderable runtime (segmentCount × segmentSeconds). */
  plannedSeconds: number;
  segmentCount: number;
  segmentSeconds: number;
  /**
   * Hierarchical stitch tree: each level is a list of groups (arrays of
   * indexes into the previous level's outputs; level 0 indexes the segment
   * clips). Empty for single-segment renders (no stitch needed).
   */
  stitchLevels: number[][][];
  /** Total stitch calls — the number the optimization minimizes. */
  stitchPasses: number;
}

/** Group `n` items into stitch calls of ≤ MAX_CLIPS_PER_STITCH (≥2 each). */
function groupForStitch(n: number): number[][] {
  if (n <= 1) return [];
  const groups: number[][] = [];
  let i = 0;
  while (n - i > 0) {
    const remaining = n - i;
    // 4 remaining must split 2+2 (a 3+1 leaves an unstitchable singleton).
    const take = remaining === 4 ? 2 : Math.min(MAX_CLIPS_PER_STITCH, remaining);
    groups.push(Array.from({ length: take }, (_, k) => i + k));
    i += take;
  }
  return groups;
}

/**
 * Plan the render for a target runtime. Segment count = ceil(target / cap),
 * clamped to the pipeline ceiling; stitch tree packed for the fewest passes
 * the route's 2–3-clip limit allows. Pure + deterministic.
 */
export function planRender(targetSeconds: number): RenderPlan {
  const target = Number(targetSeconds);
  if (!Number.isFinite(target) || target <= 0) {
    throw new Error('targetSeconds must be a positive number');
  }
  const segmentCount = Math.min(MAX_SEGMENTS, Math.max(1, Math.ceil(target / CLIP_SECONDS_CAP)));

  const stitchLevels: number[][][] = [];
  let width = segmentCount;
  while (width > 1) {
    const level = groupForStitch(width);
    stitchLevels.push(level);
    width = level.length;
  }

  return {
    targetSeconds: target,
    plannedSeconds: segmentCount * CLIP_SECONDS_CAP,
    segmentCount,
    segmentSeconds: CLIP_SECONDS_CAP,
    stitchLevels,
    stitchPasses: stitchLevels.reduce((a, l) => a + l.length, 0),
  };
}
