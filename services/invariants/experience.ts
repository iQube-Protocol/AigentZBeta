/**
 * Face 3 — Experience (CFS-035 §4, §7). The field projects DIFFERENTLY per
 * pathway: a lens is not a separate invariant set, it is a different projection
 * of one field (CFS-035 §7). The five Invariant Lenses map 1:1 to the five
 * `OperatorArchetype` pathways — so the same Field Snapshot renders per-pathway
 * without forking the substrate.
 *
 * A lens is a declared per-dimension bias applied ON TOP OF the standing-derived
 * weights (deriveWeightsFromStanding): it re-balances which dimensions a pathway
 * foregrounds, then re-normalises to mean 1 so the overall score scale is
 * unchanged (behaviour-preserving in aggregate; only the emphasis shifts).
 *
 * The bias values here are the Experience face's DECLARED projection parameters
 * (v0) — themselves candidates for future invariant-derivation (an `inv.lens.*`
 * workstream), exactly as the node dimension weights are. Pure + deterministic.
 */

import type { OperatorArchetype } from '@/services/iqube/experienceQube';

export interface InvariantLens {
  archetype: OperatorArchetype;
  /** Human-facing lens name (CFS-035 §7). */
  name: string;
  /** The pathway's optimisation objective — what this lens maximises. */
  objective: string;
  /** Per-dimension multiplier (>1 foregrounds, <1 backgrounds). Dimensions not
   *  listed default to 1 (unbiased). Keyed by the node dimension names. */
  dimensionBias: Record<string, number>;
}

// The five lenses — one per OperatorArchetype (CFS-035 §7). Objectives are the
// plan's: Citizen=clarity, Founder=progress, Developer=observability,
// Creative=inspiration, Research=discovery.
export const LENSES: Record<OperatorArchetype, InvariantLens> = {
  citizen: {
    archetype: 'citizen',
    name: 'Citizen',
    objective: 'maximise clarity — simplify to what is most consequential and trusted',
    dimensionBias: { importance: 1.3, trust: 1.2, novelty: 0.7, need: 1.0, veracity: 1.2, contribution: 0.9 },
  },
  entrepreneurial: {
    archetype: 'entrepreneurial',
    name: 'Founder',
    objective: 'maximise progress — reduce uncertainty toward the active goal',
    dimensionBias: { need: 1.4, importance: 1.1, novelty: 0.8, trust: 1.0, veracity: 1.0, contribution: 1.1 },
  },
  technical: {
    archetype: 'technical',
    name: 'Developer',
    objective: 'maximise observability — expose provenance and runtime state',
    dimensionBias: { trust: 1.3, importance: 1.1, novelty: 0.9, need: 1.0, veracity: 1.3, contribution: 0.9 },
  },
  creative: {
    archetype: 'creative',
    name: 'Creative',
    objective: 'maximise inspiration — surface the novel while preserving intent',
    dimensionBias: { novelty: 1.4, need: 1.1, trust: 0.7, importance: 1.0, veracity: 0.9, contribution: 1.1 },
  },
  research: {
    archetype: 'research',
    name: 'Research',
    objective: 'maximise discovery — surface the new and the contradictory',
    dimensionBias: { novelty: 1.4, need: 1.1, trust: 0.9, importance: 0.9, veracity: 1.1, contribution: 1.0 },
  },
};

/** The lens for an archetype (null archetype → no lens). */
export function getLens(archetype: OperatorArchetype | null | undefined): InvariantLens | null {
  return archetype ? LENSES[archetype] ?? null : null;
}

/**
 * Apply a lens to standing-derived dimension weights: multiply each weight by
 * the lens bias (default 1 for unbiased dimensions), then re-normalise to mean 1
 * so the lens re-balances emphasis without changing the overall score scale.
 * Returns the weights unchanged when no lens is supplied (faithful).
 */
export function applyLensToWeights<K extends string>(
  weights: Record<K, number>,
  lens: InvariantLens | null | undefined,
): Record<K, number> {
  if (!lens) return weights;
  const keys = Object.keys(weights) as K[];
  const biased = {} as Record<K, number>;
  let sum = 0;
  for (const k of keys) {
    const b = lens.dimensionBias[k] ?? 1;
    biased[k] = weights[k] * b;
    sum += biased[k];
  }
  const mean = keys.length > 0 ? sum / keys.length : 1;
  if (mean <= 0) return weights;
  for (const k of keys) biased[k] = biased[k] / mean;
  return biased;
}

/** Lens id for a DecisionProjection.lens label (CFS-035 §6 node schema). */
export function lensLabel(lens: InvariantLens | null | undefined): string | undefined {
  return lens ? `lens:${lens.archetype}` : undefined;
}
