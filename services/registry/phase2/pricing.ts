/**
 * Phase 2 — iQube pricing recommendations (STUB).
 *
 * PRD v1.0 §13. Translates risk + value + market signal into a pricing
 * proposal. Q¢ stored as integer cents per CLAUDE.md ("$1 = 100 Q¢"
 * canonical conversion).
 */

export interface PricingProposal {
  iqube_id: string;
  proposed_at: string;
  /** Suggested base price in integer Q¢ (cents). */
  base_price_qc: number;
  /** Suggested floor (do-not-sell-below). */
  floor_price_qc?: number;
  /** Suggested ceiling (do-not-sell-above). */
  ceiling_price_qc?: number;
  /** Drivers behind the recommendation, for operator review. */
  drivers: Array<{
    name: 'risk' | 'value' | 'market_comparable' | 'calibration' | 'rarity' | 'partner_floor';
    weight: number;
    detail?: string;
  }>;
  /** Optional rail-specific overrides (KNYT / Q¢ / USDC / PayPal). */
  rail_overrides?: Record<string, { base_price_qc: number }>;
}

/**
 * Propose pricing for an iQube. Reads risk + value + comparables.
 *
 * @stub — Phase 2 PRD specifies the pricing model.
 */
export async function proposePricing(_iqube_id: string): Promise<PricingProposal> {
  throw new Error(
    'proposePricing() is Phase 2 stub — implementation gated on dedicated Phase 2 PRD',
  );
}
