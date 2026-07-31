/**
 * The Constitutional Coherence Engine — v1 (CFS-014, Law XIV).
 *
 * The fourth execution layer: Ontology (what exists) → Graph (relationships)
 * → Composition Laws (local computation, CFS-013) → **Coherence** (the field
 * ensuring independently composed invariant classes collectively express one
 * constitutional reality). Sits between Composition and Rendering; never
 * alters canonical invariants; fail-closed (renderers execute only on pass,
 * operator waiver per Law XI).
 *
 * v1 scope (CFS-014 §10, stated honestly): deterministic validators over the
 * first compiled medium — the invariant video brief. Dimensions whose signals
 * don't flow yet (experience-matrix alignment, reasoning-path termination)
 * return `evaluated: false, score: null` with a recommendation. A stub that
 * says "unevaluated" is constitutional honesty; a hardcoded 100 would be a
 * Law XII violation — a score without validation.
 *
 * Server-safe and pure (no I/O) so every renderer — and the tests — can call
 * it synchronously at the Composition → Rendering seam.
 */

import type { VideoInvariantBrief } from '@/services/video/invariantVideoBrief';

export type CoherenceDimension =
  | 'semantic'
  | 'narrative'
  | 'style'
  | 'experience'
  | 'reasoning';

export const COHERENCE_DIMENSIONS: readonly CoherenceDimension[] = [
  'semantic',
  'narrative',
  'style',
  'experience',
  'reasoning',
];

export interface CoherenceViolation {
  dimension: CoherenceDimension;
  severity: 'error' | 'warning';
  message: string;
  segmentIndex?: number;
}

export interface CoherenceRecommendation {
  dimension: CoherenceDimension;
  message: string;
}

export interface DimensionScore {
  /** 0–100, or null when the dimension is not yet evaluatable (Law XII: no score without validation). */
  score: number | null;
  evaluated: boolean;
}

export interface CoherenceResult {
  /** Weighted mean over EVALUATED dimensions only. Null if nothing was evaluatable. */
  constitutionalScore: number | null;
  dimensions: Record<CoherenceDimension, DimensionScore>;
  violations: CoherenceViolation[];
  recommendations: CoherenceRecommendation[];
  /** No error-severity violations. Renderers execute only when true (CFS-014 §7). */
  pass: boolean;
}

export interface CoherenceWeights {
  semantic?: number;
  narrative?: number;
  style?: number;
  experience?: number;
  reasoning?: number;
}

const DEFAULT_WEIGHT = 1;

function finalize(
  dimensions: Record<CoherenceDimension, DimensionScore>,
  violations: CoherenceViolation[],
  recommendations: CoherenceRecommendation[],
  weights: CoherenceWeights,
): CoherenceResult {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const dim of COHERENCE_DIMENSIONS) {
    const d = dimensions[dim];
    if (d.evaluated && d.score !== null) {
      const w = weights[dim] ?? DEFAULT_WEIGHT;
      weightedSum += d.score * w;
      weightTotal += w;
    }
  }
  return {
    constitutionalScore:
      weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 10) / 10 : null,
    dimensions,
    violations,
    recommendations,
    pass: !violations.some((v) => v.severity === 'error'),
  };
}

/**
 * v1 validator for the invariant video brief (the first Invariant Compiler
 * target, CFS-013 §4). Evaluates the brief as one artifact, not as
 * independent layers (CFS-014 §4).
 */
export function validateVideoBriefCoherence(
  brief: VideoInvariantBrief,
  weights: CoherenceWeights = {},
): CoherenceResult {
  const violations: CoherenceViolation[] = [];
  const recommendations: CoherenceRecommendation[] = [];

  // ── 3.1 Semantic coherence — guardrail integrity + full coverage ──────
  const semanticSet = new Set(brief.semanticInvariantIds);
  let semanticScore: number | null = null;
  let semanticEvaluated = false;
  if (brief.semanticInvariantIds.length > 0) {
    semanticEvaluated = true;
    const foregroundedAll = new Set<string>();
    for (const segment of brief.segments) {
      for (const id of segment.foregroundedInvariantIds) {
        if (!semanticSet.has(id)) {
          violations.push({
            dimension: 'semantic',
            severity: 'error',
            message: `segment foregrounds invariant ${id} outside the semantic grounding — asserts beyond the collection`,
            segmentIndex: segment.index,
          });
        }
        foregroundedAll.add(id);
      }
    }
    const covered = brief.semanticInvariantIds.filter((id) => foregroundedAll.has(id)).length;
    semanticScore = Math.round((covered / brief.semanticInvariantIds.length) * 1000) / 10;
    if (covered < brief.semanticInvariantIds.length) {
      violations.push({
        dimension: 'semantic',
        severity: 'warning',
        message: `${brief.semanticInvariantIds.length - covered} semantic invariant(s) foregrounded by no segment — principle dropped from the experience`,
      });
    }
  } else {
    recommendations.push({
      dimension: 'semantic',
      message: 'no semantic grounding provided — nothing constrains what the artifact asserts',
    });
  }

  // ── 3.2 Narrative coherence — sequential, monotonic, full arc ─────────
  let narrativeScore: number | null = null;
  let narrativeEvaluated = false;
  if (brief.narrativeInvariantIds.length > 0) {
    narrativeEvaluated = true;
    const arcOrder = new Map(brief.narrativeInvariantIds.map((id, i) => [id, i]));
    const mapped = brief.segments.map((s) => s.narrativeInvariantId);
    let monotonic = true;
    let previous = -1;
    mapped.forEach((id, segmentIndex) => {
      if (!id) {
        monotonic = false;
        violations.push({
          dimension: 'narrative',
          severity: 'error',
          message: 'segment carries no narrative beat while a narrative grounding is present — arc discontinuity',
          segmentIndex,
        });
        return;
      }
      const position = arcOrder.get(id);
      if (position === undefined) {
        monotonic = false;
        violations.push({
          dimension: 'narrative',
          severity: 'error',
          message: `segment carries beat ${id} outside the narrative grounding`,
          segmentIndex,
        });
        return;
      }
      if (position < previous) {
        monotonic = false;
        violations.push({
          dimension: 'narrative',
          severity: 'error',
          message: 'narrative beats reordered — the arc must be monotonic (CFS-012 §4)',
          segmentIndex,
        });
      }
      previous = Math.max(previous, position);
    });
    const first = mapped[0] ? arcOrder.get(mapped[0]) : undefined;
    const last = mapped[mapped.length - 1] ? arcOrder.get(mapped[mapped.length - 1]!) : undefined;
    const anchored = first === 0 && last === brief.narrativeInvariantIds.length - 1;
    if (!anchored && monotonic) {
      violations.push({
        dimension: 'narrative',
        severity: 'warning',
        message: 'arc does not open on the first beat and close on the last — transformation may read incomplete',
      });
    }
    narrativeScore = monotonic ? (anchored ? 100 : 80) : 0;
  } else {
    recommendations.push({
      dimension: 'narrative',
      message: 'no narrative grounding — segments have principles but no fixed arc (CFS-012)',
    });
  }

  // ── 3.3 Style coherence — one continuity block, carried everywhere ────
  let styleScore: number | null = null;
  let styleEvaluated = false;
  if (brief.styleInvariantIds.length > 0) {
    const templateSegments = brief.segments.filter((s) => s.composedBy === 'template');
    if (templateSegments.length === brief.segments.length) {
      // Deterministic path: the continuity block must appear verbatim in every prompt.
      styleEvaluated = true;
      let carried = 0;
      for (const segment of brief.segments) {
        if (segment.prompt.includes(brief.continuityBlock)) carried += 1;
        else {
          violations.push({
            dimension: 'style',
            severity: 'error',
            message: 'segment prompt dropped the continuity block — style invariants are global (CFS-013)',
            segmentIndex: segment.index,
          });
        }
      }
      styleScore = Math.round((carried / brief.segments.length) * 1000) / 10;
    } else {
      // LLM-composed prose translates (rather than embeds) the block; verbatim
      // matching would be a false negative, and asserting adherence unverified
      // would be a false positive. Honest answer: unevaluated pre-render.
      recommendations.push({
        dimension: 'style',
        message:
          'LLM-composed segment prose: style adherence is verified at render evaluation (EXP-002 acceptance checks), not statically',
      });
    }
  } else {
    recommendations.push({
      dimension: 'style',
      message: 'no style grounding — no cinematic identity is enforced across segments (CFS-011)',
    });
  }

  // ── 3.4 / 3.5 Experience + Reasoning — signals not yet flowing ────────
  recommendations.push(
    {
      dimension: 'experience',
      message:
        'unevaluated in v1 — requires experience-model/matrix alignment telemetry from the renderer (CFS-014 §10)',
    },
    {
      dimension: 'reasoning',
      message:
        'unevaluated in v1 — requires reasoning-path termination checks against the originating KnowledgeQube (CFS-014 §10)',
    },
  );

  return finalize(
    {
      semantic: { score: semanticScore, evaluated: semanticEvaluated },
      narrative: { score: narrativeScore, evaluated: narrativeEvaluated },
      style: { score: styleScore, evaluated: styleEvaluated },
      experience: { score: null, evaluated: false },
      reasoning: { score: null, evaluated: false },
    },
    violations,
    recommendations,
    weights,
  );
}
