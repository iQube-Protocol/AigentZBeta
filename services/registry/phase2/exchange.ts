/**
 * Phase 2 — iQube exchange utility (STUB).
 *
 * PRD v1.0 §13. Marketplace integration seam. Translates a pricing
 * proposal + risk/value profile into exchange-ready listings (KNYT,
 * Q¢, USDC, PayPal rails).
 *
 * QriptoCENT / Q¢ payment integration: per CLAUDE.md, "$1 = 100 Q¢"
 * canonical conversion; integer cents storage. This stub assumes the
 * Phase 1 payment gating (already supported in v1.1 §B.6) handles the
 * actual settlement; Phase 2 layers pricing intelligence on top.
 */

export interface ExchangeListing {
  iqube_id: string;
  listed_at: string;
  /** Active rail for the listing. */
  rail: 'knyt' | 'qc' | 'usdc' | 'paypal';
  /** Price in the rail's native unit (Q¢ for qc/knyt, cents for usdc/paypal). */
  price_units: number;
  /** Optional expiry. */
  expires_at?: string;
  /** Operator-set publication state. */
  state: 'draft' | 'live' | 'paused' | 'sold_out' | 'expired';
}

export interface ExchangeOptimisationOpts {
  /** Whether the optimiser may adjust price within the floor/ceiling. */
  dynamic_pricing?: boolean;
  /** Maximum percent change per period. */
  max_price_delta_pct?: number;
}

/**
 * Publish a listing on the exchange. Reads PricingProposal + RiskAssessment
 * before committing.
 *
 * @stub — Phase 2 PRD specifies the marketplace integration.
 */
export async function publishListing(
  _iqube_id: string,
  _rail: ExchangeListing['rail'],
): Promise<ExchangeListing> {
  throw new Error(
    'publishListing() is Phase 2 stub — implementation gated on dedicated Phase 2 PRD',
  );
}

/**
 * Optimise active listings for an iQube based on usage signal +
 * inventory state.
 *
 * @stub — Phase 2 PRD specifies the optimisation rules.
 */
export async function optimiseListings(
  _iqube_id: string,
  _opts?: ExchangeOptimisationOpts,
): Promise<{ adjusted: number; skipped: number }> {
  throw new Error(
    'optimiseListings() is Phase 2 stub — implementation gated on dedicated Phase 2 PRD',
  );
}
