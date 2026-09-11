/**
 * IDE v2 risk-field primitives — CFS-056.
 *
 * Source lineage:
 * - Lehigh GBUS 485 Data Risk for Marketplace (2025): 23 core dimensions,
 *   context-specific weighting, verifiability, combination effects, dynamic risk.
 * - Data Risk for Marketplaces v2 (June 2025): temporal/contextual/technical
 *   extensions, continuous verification factors, risk/value balance, intent
 *   modulation, non-linear combination analysis, explainability and underwriting.
 *
 * This module intentionally encodes STRUCTURE before coefficients. Historical
 * papers contain demonstration/random weights and proposed factors that are not
 * yet validated as canonical runtime constants. Callers must supply calibrated
 * thresholds, weights and modulation factors.
 */

export const LEHIGH_CORE_RISK_DIMENSIONS = [
  'identifiability',
  'sensitivity',
  'confidentiality',
  'competitiveness',
  'reputation',
  'compliance',
  'financial',
  'political',
  'diplomatic',
  'emotional',
  'commercial',
  'legal',
  'geopolitical',
  'military',
  'intelligence',
  'social',
  'public-welfare',
  'strategic',
  'operational',
  'environmental',
  'security',
  'health-and-safety',
  'verifiability',
] as const;

export type LehighCoreRiskDimension = typeof LEHIGH_CORE_RISK_DIMENSIONS[number];

/** Later Lehigh work extends the original 23 rather than replacing them. */
export type RiskDimensionFamily =
  | 'core'
  | 'temporal'
  | 'contextual'
  | 'technical'
  | 'value';

export interface RiskDimensionRef {
  id: string;
  family: RiskDimensionFamily;
  sourceRef?: string;
}

export interface VerificationEvidence {
  /** 0..1 — verification method strength. */
  strength: number;
  /** 0..1 — freshness/recency factor. */
  recency: number;
  /** 0..1 — authority credibility factor. */
  authority: number;
  evidenceRef?: string;
}

export interface IntentRiskVector {
  id: string;
  dimension: RiskDimensionRef;
  /** Relevance of this dimension to the current intent, 0..1. */
  relevance: number;
  /** Confidence in the relevance assessment, 0..1. */
  confidence: number;
  /** Optional raw/effective severity signal, 0..1. */
  severity?: number;
  likelihood?: number;
  detectability?: number;
  reversibility?: number;
  repairCost?: number;
  blastRadius?: number;
  timeToConsequence?: number;
  evidenceRefs: string[];
  rationale?: string;
}

export interface IntentRiskField {
  intentId: string;
  vectors: IntentRiskVector[];
  materialVectorIds: string[];
  unresolvedVectorIds: string[];
  constitutionalConstraintRefs: string[];
  sourceRefs: string[];
}

export interface RepairPath {
  id: string;
  riskVectorId: string;
  adverseState: string;
  causalPrecursors: string[];
  detectionConditions: string[];
  containmentConditions: string[];
  reversalConditions: string[];
  irreversibleConditions: string[];
  evidenceRefs: string[];
  confidence: number;
}

export type DiscoveryBearing = 'ttv-only' | 'ror-only' | 'dual-bearing';

export interface VerificationAdjustment {
  factor: number;
  evidenceCount: number;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * Implements the v2 paper's verification structure:
 *   sum(strength * recency * authority) / maxVerificationScore.
 * With normalized 0..1 inputs, the maximum score for N independent methods is N.
 */
export function calculateVerificationFactor(
  evidence: readonly VerificationEvidence[],
): VerificationAdjustment {
  if (evidence.length === 0) return { factor: 0, evidenceCount: 0 };

  const observed = evidence.reduce(
    (sum, item) => sum
      + clamp01(item.strength)
      * clamp01(item.recency)
      * clamp01(item.authority),
    0,
  );

  return {
    factor: clamp01(observed / evidence.length),
    evidenceCount: evidence.length,
  };
}

/**
 * Apply an externally supplied verification impact. The historical papers propose
 * context-dependent impact; this module does not canonize a universal coefficient.
 */
export function adjustRiskForVerification(
  baseRisk: number,
  verificationFactor: number,
  verificationImpact: number,
): number {
  return Math.max(0, baseRisk * (1 - clamp01(verificationFactor) * clamp01(verificationImpact)));
}

/**
 * Intent modulation is deliberately caller-calibrated. Historical research proposes
 * beneficial/neutral/questionable/harmful bands, but those values remain evidence,
 * not constitutional runtime constants.
 */
export function modulateRiskByIntent(baseRisk: number, intentFactor: number): number {
  if (!Number.isFinite(intentFactor) || intentFactor < 0) {
    throw new Error('intentFactor must be a finite non-negative number');
  }
  return baseRisk * intentFactor;
}

export interface MaterialityPolicy {
  relevanceThreshold: number;
  confidenceThreshold?: number;
}

/** Pure projection: never mutates the risk vectors or promotes invariants. */
export function selectMaterialRiskVectors(
  vectors: readonly IntentRiskVector[],
  policy: MaterialityPolicy,
): { materialVectorIds: string[]; unresolvedVectorIds: string[] } {
  const relevanceThreshold = clamp01(policy.relevanceThreshold);
  const confidenceThreshold = clamp01(policy.confidenceThreshold ?? 0);
  const materialVectorIds: string[] = [];
  const unresolvedVectorIds: string[] = [];

  for (const vector of vectors) {
    const relevance = clamp01(vector.relevance);
    const confidence = clamp01(vector.confidence);
    if (relevance < relevanceThreshold) continue;
    if (confidence < confidenceThreshold) unresolvedVectorIds.push(vector.id);
    else materialVectorIds.push(vector.id);
  }

  return { materialVectorIds, unresolvedVectorIds };
}

export function discoveryBearing(
  appearsInTtvPass: boolean,
  appearsInRorPass: boolean,
): DiscoveryBearing | null {
  if (appearsInTtvPass && appearsInRorPass) return 'dual-bearing';
  if (appearsInTtvPass) return 'ttv-only';
  if (appearsInRorPass) return 'ror-only';
  return null;
}

export interface InvariantCandidateBearingInput {
  candidateId: string;
  pass: 'forward_ttv' | 'reverse_ror';
}

/**
 * Merge discovery-pass provenance without treating dual-bearing as validity.
 * Validation remains the separate CFS-048 lifecycle gate.
 */
export function convergeDiscoveryBearings(
  inputs: readonly InvariantCandidateBearingInput[],
): Map<string, DiscoveryBearing> {
  const seen = new Map<string, { ttv: boolean; ror: boolean }>();
  for (const input of inputs) {
    const current = seen.get(input.candidateId) ?? { ttv: false, ror: false };
    if (input.pass === 'forward_ttv') current.ttv = true;
    else current.ror = true;
    seen.set(input.candidateId, current);
  }

  const out = new Map<string, DiscoveryBearing>();
  for (const [candidateId, value] of seen.entries()) {
    const bearing = discoveryBearing(value.ttv, value.ror);
    if (bearing) out.set(candidateId, bearing);
  }
  return out;
}

export interface RiskAdjustedValueInput {
  overallValueScore: number;
  overallRiskScore: number;
  riskAversion: number;
}

/**
 * Research projection from Data Risk for Marketplaces v2. It is retained here as
 * an explicit, testable projection — not as the final economic price function.
 */
export function researchRiskAdjustedValue(input: RiskAdjustedValueInput): number {
  const risk = clamp01(input.overallRiskScore / 100);
  return input.overallValueScore * (1 - risk * input.riskAversion);
}
