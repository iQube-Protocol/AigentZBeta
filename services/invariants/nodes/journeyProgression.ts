/**
 * Invariant Decision Node — Journey Progression (CFS-035 §6, unblocked by the
 * 2026-07-18 journey-stage reconciliation).
 *
 * The incumbent (app/api/runtime/nbe/route.ts) computes the next experience
 * depth as `DEPTH_LADDER[i+1]` (array succession) and the disposition as a
 * two-case `switch` — the ordering + hard-coded-branch forms of embedded
 * compressed reasoning. This node re-expresses the same decision as a
 * transparent value projection on the ONE universal progression axis
 * (`ExperienceStage`, via the reconciliation), so "what's the next depth step?"
 * carries a "why" (universal stage index · current depth · disposition).
 *
 * Faithful by construction — same ladder succession, same disposition rule — so
 * shadow adoption is behaviour-preserving. Pure + deterministic. Server-safe.
 */

import type { ExperienceDepth, JourneyStage } from '@/types/orchestration';
import type { FieldSnapshot, ValueProjection } from '../engine';
import { registerNodeMeta } from '../engine';
import { experienceStageForJourney, universalStageIndex } from '@/services/journey/stageReconciliation';

export const JOURNEY_PROGRESSION_NODE_ID = 'progression.journey';

/** The canonical depth ladder (L0 pill → L3 codex). */
export const DEPTH_LADDER: ExperienceDepth[] = ['pill', 'capsule', 'mini_runtime', 'codex'];

registerNodeMeta({
  id: JOURNEY_PROGRESSION_NODE_ID,
  kind: 'value',
  dimensions: ['universalStageIndex', 'currentDepthIndex', 'nextDepthIndex', 'disposition'],
  surface: 'progression',
  description:
    'Projects the next experience depth + disposition on the universal ExperienceStage axis instead of array[i+1] + a 2-case switch.',
});

export interface JourneyProgressionInput {
  /** The KNYT journey stage — projects from the universal ExperienceStage. */
  journeyStage: JourneyStage;
  /** The persona's current experience depth. */
  currentDepth: ExperienceDepth | string;
}

/** Depth label for a ladder index (clamped). */
export function depthForIndex(index: number): ExperienceDepth {
  return DEPTH_LADDER[Math.max(0, Math.min(DEPTH_LADDER.length - 1, index))];
}

export function journeyProgressionProjector(
  input: JourneyProgressionInput,
  snapshot?: FieldSnapshot | null,
): ValueProjection {
  const idx = DEPTH_LADDER.indexOf(input.currentDepth as ExperienceDepth);
  const currentDepthIndex = idx < 0 ? 0 : idx;
  // Advance one rung, capped at the top (faithful to nextDepth).
  const nextDepthIndex =
    idx >= 0 && idx < DEPTH_LADDER.length - 1 ? idx + 1 : currentDepthIndex;
  // Sovereign / escalation stages require guardian approval → 'ask' (1), else 'act' (0).
  const dispositionAsk =
    input.journeyStage === 'zero' || input.journeyStage === 'investor_reactivation_candidate';
  const uStage = universalStageIndex(experienceStageForJourney(input.journeyStage));

  return {
    nodeId: JOURNEY_PROGRESSION_NODE_ID,
    value: nextDepthIndex,
    projection: {
      universalStageIndex: uStage,
      currentDepthIndex,
      nextDepthIndex,
      disposition: dispositionAsk ? 1 : 0,
    },
    citedIds: snapshot?.citedIds ?? [],
  };
}
