/**
 * Phase 2 — iQube calibration (STUB).
 *
 * PRD v1.0 §13. Interface-only. Calibration is the process of adjusting
 * an iQube's metaQube parameters against ground-truth signal (operator
 * feedback, downstream usage telemetry, performance benchmarks).
 */

export interface CalibrationProfile {
  iqube_id: string;
  /** When was this calibration profile last recomputed. */
  calibrated_at: string;
  /** Granular per-dimension scores. Domain-specific; not enumerated
   *  here because Phase 2 PRD names the canonical dimensions. */
  dimensions: Record<string, number>;
  /** Suggested adjustments operator can apply. */
  suggested_adjustments?: Array<{ field: string; from: unknown; to: unknown; rationale: string }>;
  /** Trust-band that this calibration profile recommends (KNYT §14
   *  alignment for AigentQubes). */
  recommended_trust_band?: 0 | 1 | 2 | 3 | 4;
}

/**
 * Compute a calibration profile for an iQube. Reads usage telemetry
 * + operator feedback + benchmark scores.
 *
 * @stub — Phase 2 PRD specifies the calibration algorithm.
 */
export async function calibrate(_iqube_id: string): Promise<CalibrationProfile> {
  throw new Error(
    'calibrate() is Phase 2 stub — implementation gated on dedicated Phase 2 PRD',
  );
}
