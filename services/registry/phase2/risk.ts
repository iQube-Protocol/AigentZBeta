/**
 * Phase 2 — iQube risk analysis (STUB).
 *
 * PRD v1.0 §13. Quantified risk score against a canonical risk model.
 * Used by the canonization queue to surface high-risk iQubes for
 * heightened operator scrutiny.
 */

export interface RiskAssessment {
  iqube_id: string;
  assessed_at: string;
  /** Overall risk score 0..100. Higher = riskier. */
  overall_score: number;
  /** Per-dimension breakdown. Phase 2 PRD names the dimensions
   *  canonically (e.g. data_sensitivity, downstream_blast_radius,
   *  reversibility, regulatory_class). */
  dimensions: Record<string, number>;
  /** Flags that may require special handling (PII, financial,
   *  PHI, etc.). */
  risk_flags: string[];
  /** Suggested mitigations. */
  recommended_controls?: string[];
}

/**
 * Assess the risk profile of an iQube.
 *
 * @stub — Phase 2 PRD specifies the risk model.
 */
export async function assessRisk(_iqube_id: string): Promise<RiskAssessment> {
  throw new Error(
    'assessRisk() is Phase 2 stub — implementation gated on dedicated Phase 2 PRD',
  );
}
