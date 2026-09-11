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
 * comparison, it gates nothing. The default coordinate axis (evidenceDensity)
 * is derived FROM standing, so on the same units the two agree by construction —
 * the bridge is the seam that will SURFACE divergence once constitutional-class
 * coordinates (CCR) enter the calibration and shift the axis. That divergence is
 * the CCR research signal (CFS-039 §4 Phase 3 / the Evolution face).
 *
 * TWO WAYS THIS SEAM LIED, both corrected 2026-07-27 (operator ruling):
 *
 *  1. UNITS. `evidenceDensity` was `clamp01(standing)` over a 0–100 column, so
 *     every invariant with standing ≥ 1 read exactly 1.0. The standing path was
 *     proportional, the coordinate path flat, and `diverges` fired on a units
 *     mismatch rather than on the research signal it is documented to measure.
 *     Fixed at the source (`normaliseStanding`, resolution.ts).
 *
 *  2. VACUOUS AGREEMENT — the mirror, and the more dangerous of the two. When
 *     the intent-scoped slice contains NONE of the node's governing seeds, both
 *     derivations fall back to all-1 and `diverges` reports false: agreement
 *     nobody computed, indistinguishable at the return value from agreement two
 *     real measurements produced. `comparable` now separates them, and no
 *     consumer may read `diverges` without it.
 *
 * Pure — composes the engine's two pure weight derivations over a resolved field.
 */

import { deriveFromStanding, deriveFromCoordinates } from './engine';
import type { ResolvedConstitutionalField } from './resolution';

export interface ProjectionComparison<K extends string> {
  /** Incumbent weights — standing over the field's snapshot. */
  standing: Record<K, number>;
  /** IRE-fed weights — the resolved field's coordinates (default axis). */
  coordinates: Record<K, number>;
  /** Mean absolute weight difference across dimensions (0 = identical). */
  meanAbsDelta: number;
  /** True once the two derivations diverge beyond tolerance (the flip signal).
   *  MEANINGLESS unless `comparable` — read the two together, never alone. */
  diverges: boolean;
  /**
   * True only when BOTH derivations engaged — i.e. each found at least one of
   * the node's governing invariants carrying a positive value. When false the
   * weights on one or both sides are faithful defaults, `meanAbsDelta` is an
   * artefact of those defaults, and `diverges: false` is NOT agreement.
   */
  comparable: boolean;
  /** How many of the node's dimensions each path actually matched (the "why"
   *  behind `comparable`, so a null result is diagnosable rather than opaque). */
  matched: { standing: number; coordinates: number };
  /**
   * The scale convention the coordinate path was computed under. Stamped so a
   * stored result can never be silently compared across a units change: results
   * produced before 2026-07-27 carry the defective `clamp01(standing)` axis and
   * are NOT numerically comparable with anything stamped here.
   */
  calibration: typeof CALIBRATION;
}

/** Bumped whenever a coordinate's conversion changes. `v2` = the 0–100 → [0,1]
 *  normalisation (operator ruling 2026-07-27). `v1` = the clamp defect. */
export const CALIBRATION = 'coordinates/v2-normalised' as const;

/** The calibration every measurement taken before 2026-07-27 was computed
 *  under: `evidenceDensity = clamp01(standing)` over a 0–100 column. */
export const PRE_FIX_CALIBRATION = 'coordinates/v1-clamped' as const;

/**
 * The label the operator ruled every affected pre-fix result must carry, in the
 * operator's exact words. It is a constant, not a sentence typed into each
 * document, so a reader can grep one string and find every labelled result and
 * every gate that enforces it.
 */
export const PRE_FIX_DIAGNOSTIC_LABEL =
  'Pre-fix diagnostic; invalid for confirmatory comparison and not numerically comparable with post-fix runs.';

/**
 * The result metrics the DEFECTIVE coordinate path produced — and only those.
 *
 * This list is the whole of the honesty in the labelling exercise, so it is
 * derived rather than assumed. A metric belongs here iff computing it reads a
 * coordinate VALUE:
 *
 *   - `coordinateWeightsReproducible` / `coordinateReproducibleRate` — compare
 *     `deriveWeightsFromCoordinates` output across reps. Pre-fix that output
 *     was a PRESENCE indicator, not a magnitude (every standing ≥ 1 mapped to
 *     1.0), so its cross-rep stability was identical by construction to the
 *     seed-set stability the same run reports separately. The measurement could
 *     not have failed independently.
 *   - `meanAbsDelta` / `meanAbsDeltaVariance` / `divergesConsistent` — all read
 *     the coordinate path against the standing path.
 *
 * Deliberately ABSENT, because the coordinate value never enters them:
 *   - `stability` / `ireSeedSetStability` / `seedSetStability` — Jaccard over
 *     resolved seed IDs, which `calibrateStructural` passes through untouched.
 *   - `coverage` / `compression` / `novelty` — computed from seed→statement
 *     text against the Synthetic Expert Baseline.
 *   - `standingWeightsReproducible` / `standingReproducibleRate` — read raw
 *     `standing` off the snapshot, never a coordinate.
 *
 * The reason those are safe is structural, not lucky: slice MEMBERSHIP and
 * ORDER come from `buildInvariantSlice`'s standing-primary rank, server-side,
 * BEFORE `calibrateStructural` runs. The defect could not perturb which
 * invariants were selected — only what they were labelled with afterwards.
 */
export const COORDINATE_DERIVED_METRICS = [
  'coordinateWeightsReproducible',
  'coordinateReproducibleRate',
  'meanAbsDelta',
  'meanAbsDeltaVariance',
  'divergesConsistent',
] as const;

/** Which coordinate-derived metrics a result record carries. Pure. */
export function coordinateDerivedMetrics(record: Record<string, unknown> | null | undefined): string[] {
  if (!record) return [];
  return COORDINATE_DERIVED_METRICS.filter((m) => Object.prototype.hasOwnProperty.call(record, m));
}

export type CalibrationVerdict = { allowed: true } | { allowed: false; reason: string };

/**
 * May this result be used for confirmatory comparison?
 *
 * Fail-closed on every unknown value (the `canRunInstitutionDiscovery` shape):
 * a record that carries a coordinate-derived metric and does NOT declare the
 * calibration it was computed under is refused, because before 2026-07-27 no
 * such stamp existed — an absent stamp IS the pre-fix case, and treating it as
 * "probably fine" would let exactly the results this gate exists for through.
 *
 * A record carrying no coordinate-derived metric is allowed regardless of its
 * stamp: the defect never reached it, and marking it invalid would be the
 * blanket-labelling the ruling forbids.
 */
export function canUseForConfirmatoryComparison(record: {
  calibration?: string | null;
  aggregates?: Record<string, unknown> | null;
}): CalibrationVerdict {
  const affected = coordinateDerivedMetrics(record.aggregates);
  if (affected.length === 0) return { allowed: true };

  const calibration = record.calibration ?? null;
  if (calibration === CALIBRATION) return { allowed: true };
  if (calibration === null || calibration === undefined || calibration === '') {
    return {
      allowed: false,
      reason:
        `record carries coordinate-derived metric(s) [${affected.join(', ')}] but declares no calibration — ` +
        `no stamp existed before ${CALIBRATION}, so an undeclared record is a pre-fix measurement. ` +
        PRE_FIX_DIAGNOSTIC_LABEL,
    };
  }
  return {
    allowed: false,
    reason:
      `record carries coordinate-derived metric(s) [${affected.join(', ')}] computed under '${calibration}', ` +
      `not '${CALIBRATION}'. ` +
      PRE_FIX_DIAGNOSTIC_LABEL,
  };
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
  const std = deriveFromStanding(field.snapshot, seedMap);
  const coord = deriveFromCoordinates(field.coordinates, seedMap, axis);
  const meanAbsDelta =
    keys.length > 0
      ? keys.reduce((s, k) => s + Math.abs((std.weights[k] ?? 1) - (coord.weights[k] ?? 1)), 0) / keys.length
      : 0;
  return {
    standing: std.weights,
    coordinates: coord.weights,
    meanAbsDelta,
    diverges: meanAbsDelta > TOLERANCE,
    comparable: std.engaged && coord.engaged,
    matched: { standing: std.matched, coordinates: coord.matched },
    calibration: CALIBRATION,
  };
}

/** Compact trace line. Pure. */
export function describeProjection<K extends string>(cmp: ProjectionComparison<K>): string {
  // An incomparable projection must never render as "agrees". The trace is what
  // a reader sees; printing agreement for two faithful defaults is the exact
  // false-presence this seam was corrected for.
  const verdict = !cmp.comparable
    ? `NOT COMPARABLE (matched ${cmp.matched.standing}/${cmp.matched.coordinates} — one or both paths defaulted; no agreement was computed)`
    : cmp.diverges
      ? 'DIVERGES'
      : 'agrees';
  return `IPE projection [${cmp.calibration}]: ${verdict} (mean Δ ${cmp.meanAbsDelta.toFixed(4)}) — standing vs coordinate weights, shadow`;
}
