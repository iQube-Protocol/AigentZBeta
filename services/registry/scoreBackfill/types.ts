/**
 * iQube score data backfill — shared types.
 *
 * Per the 2026-05-31 backlog item. Every iQube carries 4 raw axes
 * (sensitivity / accuracy / verifiability / risk) + 2 derived
 * (reliability / trust). Per-primitive derivers compute defaults; per-
 * axis _source flag lets operators override individual axes without
 * losing the derived baseline.
 *
 * Authority compliance: derivers NEVER decide access, NEVER reimplement
 * the spine. They read source-of-truth tables + return numbers.
 */

export type ScoreAxis = 'sensitivity' | 'accuracy' | 'verifiability' | 'risk';

export type ScoreSource = 'derived' | 'operator_override';

export interface RawScores {
  sensitivity: number; // 0..10
  accuracy: number;
  verifiability: number;
  risk: number;
}

export interface DerivedScores {
  reliability: number; // accuracy * 0.6 + verifiability * 0.4
  trust: number;       // 10 - (sensitivity * 0.4 + risk * 0.6)
}

export interface ScoreRow {
  iqube_id: string;
  sensitivity: number | null;
  accuracy: number | null;
  verifiability: number | null;
  risk: number | null;
  derived_reliability: number | null;
  derived_trust: number | null;
  sensitivity_source: ScoreSource;
  accuracy_source: ScoreSource;
  verifiability_source: ScoreSource;
  risk_source: ScoreSource;
  derivation_strategy: string | null;
  populated_at: string;
  updated_at: string;
}

/**
 * Strategy result — what the deriver returns for one iQube. Axes can
 * be returned as numbers OR explicitly omitted (the deriver doesn't
 * have signal for that axis on this primitive). The backfill driver
 * preserves operator overrides on omitted axes.
 */
export interface DerivationResult {
  iqube_id: string;
  scores: Partial<RawScores>;
  /** Strategy identifier — written to derivation_strategy column. */
  strategy: string;
  /** Optional diagnostic note (e.g. 'low confidence — no chain anchor'). */
  notes?: string;
}

export interface BackfillSourceReport {
  primitive_type: string;
  processed: number;
  populated: number;
  preserved_overrides: number;
  skipped: number;
  errors: Array<{ iqube_id: string; error: string }>;
  duration_ms: number;
}

export interface BackfillReport {
  started_at: string;
  finished_at: string;
  per_primitive: BackfillSourceReport[];
  total_populated: number;
  total_preserved_overrides: number;
  total_errors: number;
}

// ── Derived score formulas (mirror legacy components/registry/scoreUtils.tsx) ──

export function computeReliability(accuracy: number, verifiability: number): number {
  return Math.round((accuracy * 0.6 + verifiability * 0.4) * 10) / 10;
}

export function computeTrust(sensitivity: number, risk: number): number {
  return Math.round((10 - (sensitivity * 0.4 + risk * 0.6)) * 10) / 10;
}

export function computeDerivedScores(raw: RawScores): DerivedScores {
  return {
    reliability: computeReliability(raw.accuracy, raw.verifiability),
    trust: computeTrust(raw.sensitivity, raw.risk),
  };
}

/**
 * Clamp + round a derived axis value to 0..10 integer. The per-primitive
 * derivers compute via formulas that may produce out-of-range or
 * fractional values; this normaliser is the single guard.
 */
export function clampAxis(value: number): number {
  if (Number.isNaN(value)) return 5;
  if (value < 0) return 0;
  if (value > 10) return 10;
  return Math.round(value);
}
