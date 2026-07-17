/**
 * projectionBridge — the IRE → IPE connection, shadow (CFS-039 / PRD-IPE-001,
 * Phase 2). "Projection consumes resolution end-to-end, observed before
 * authoritative" (CFS-039 §4).
 *
 * The IRE (CFS-037) resolves a field + calibrates its constitutional coordinates;
 * the IPE (CFS-035/039) projects a field into node dimension weights. This bridge
 * runs BOTH weight derivations over one resolved field —
 *   - the INCUMBENT: `deriveWeightsFromStanding` over the field's snapshot;
 *   - the IRE-FED: `deriveWeightsFromCoordinates` over the field's coordinates;
 * and reports their AGREEMENT. Observe-only (CFS-017): it computes the
 * comparison, it gates nothing. Because the default coordinate axis
 * (evidenceDensity) IS the standing axis, the two agree by construction today —
 * the bridge is the seam that will SURFACE divergence once constitutional-class
 * coordinates (CCR) enter the calibration and shift the axis. That divergence is
 * the CCR research signal (CFS-039 §4 Phase 3 / the Evolution face).
 *
 * Pure — composes the engine's two pure weight functions over a resolved field.
 */

import { deriveWeightsFromStanding, deriveWeightsFromCoordinates } from './engine';
import type { ResolvedConstitutionalField } from './resolution';

export interface ProjectionComparison<K extends string> {
  /** Incumbent weights — standing over the field's snapshot. */
  standing: Record<K, number>;
  /** IRE-fed weights — the resolved field's coordinates (default axis). */
  coordinates: Record<K, number>;
  /** Mean absolute weight difference across dimensions (0 = identical). */
  meanAbsDelta: number;
  /** True once the two derivations diverge beyond tolerance (the flip signal). */
  diverges: boolean;
}

const TOLERANCE = 1e-6;

/**
 * Project a resolved field into a node's dimension weights via BOTH paths and
 * compare. `seedMap` maps each node dimension to its governing invariant's seed
 * id (the same map the node uses). Pure; shadow.
 */
export function compareProjection<K extends string>(
  field: ResolvedConstitutionalField,
  seedMap: Record<K, string>,
  axis: 'evidenceDensity' | 'verifiability' | 'adoption' = 'evidenceDensity',
): ProjectionComparison<K> {
  const keys = Object.keys(seedMap) as K[];
  const standing = deriveWeightsFromStanding(field.snapshot, seedMap);
  const coordinates = deriveWeightsFromCoordinates(field.coordinates, seedMap, axis);
  const meanAbsDelta =
    keys.length > 0
      ? keys.reduce((s, k) => s + Math.abs((standing[k] ?? 1) - (coordinates[k] ?? 1)), 0) / keys.length
      : 0;
  return { standing, coordinates, meanAbsDelta, diverges: meanAbsDelta > TOLERANCE };
}

/** Compact trace line. Pure. */
export function describeProjection<K extends string>(cmp: ProjectionComparison<K>): string {
  return `IPE projection: ${cmp.diverges ? 'DIVERGES' : 'agrees'} (mean Δ ${cmp.meanAbsDelta.toFixed(4)}) — standing vs coordinate weights, shadow`;
}
