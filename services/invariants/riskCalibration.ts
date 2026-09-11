/**
 * Risk calibration primitives extracted from the Lehigh ERM/iQube lineage.
 *
 * IMPORTANT: these functions preserve distinct evidence signals. They do not
 * assert that corpus prevalence, enforcement cost, or intent relevance are
 * interchangeable measures of risk.
 */

export type ConsequenceType =
  | 'fine'
  | 'settlement'
  | 'remediation'
  | 'operational-loss'
  | 'reputational-loss'
  | 'other';

export type VerificationState = 'unverified' | 'secondary' | 'authoritative';

export interface ConsequenceCalibrationEvidence {
  id: string;
  riskDimensionIds: string[];
  regime?: string;
  violationType?: string;
  consequenceType: ConsequenceType;
  amount?: number;
  currency?: string;
  frequency?: number;
  observedAt?: string;
  authorityRef?: string;
  sourceRef: string;
  verificationState: VerificationState;
}

export interface QualitativeRiskCounts {
  high: number;
  medium: number;
  low: number;
}

export type DimensionRiskCounts = Record<string, QualitativeRiskCounts>;

/**
 * Executable lineage from Test metatMe_DataRisk.ipynb:
 * score = 3*High + 2*Medium + 1*Low, normalized so mean dimension weight = 1.
 *
 * This is deliberately named `derivePrevalenceWeights`: frequency/severity of
 * labels in a corpus is NOT assumed to equal causal importance or consequence.
 */
export function derivePrevalenceWeights(
  countsByDimension: DimensionRiskCounts,
): Record<string, number> {
  const entries = Object.entries(countsByDimension);
  if (entries.length === 0) return {};

  const scores = entries.map(([dimension, counts]) => {
    for (const value of [counts.high, counts.medium, counts.low]) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Risk counts for ${dimension} must be finite non-negative numbers`);
      }
    }
    return [dimension, counts.high * 3 + counts.medium * 2 + counts.low] as const;
  });

  const mean = scores.reduce((sum, [, score]) => sum + score, 0) / scores.length;
  if (mean === 0) return Object.fromEntries(scores.map(([dimension]) => [dimension, 0]));

  return Object.fromEntries(scores.map(([dimension, score]) => [dimension, score / mean]));
}

export interface RiskCalibrationSignals {
  /** Corpus-derived prevalence; typically mean-normalized around 1. */
  prevalenceWeight?: number;
  /** Consequence/loss calibration kept distinct from prevalence. */
  consequenceWeight?: number;
  /** Relevance to current intent, normalized 0..1 by caller policy. */
  intentMateriality?: number;
  /** Confidence/verification of the calibration evidence, normalized 0..1. */
  evidenceConfidence?: number;
}

/**
 * A transport object for IDE/risk-field orchestration. No universal aggregation
 * formula is imposed: experiments must explicitly preregister any projection.
 */
export interface DimensionCalibration {
  riskDimensionId: string;
  signals: RiskCalibrationSignals;
  evidenceRefs: string[];
}

export function groupConsequenceEvidenceByDimension(
  evidence: readonly ConsequenceCalibrationEvidence[],
): Map<string, ConsequenceCalibrationEvidence[]> {
  const grouped = new Map<string, ConsequenceCalibrationEvidence[]>();
  for (const item of evidence) {
    for (const dimensionId of item.riskDimensionIds) {
      const current = grouped.get(dimensionId) ?? [];
      current.push(item);
      grouped.set(dimensionId, current);
    }
  }
  return grouped;
}
