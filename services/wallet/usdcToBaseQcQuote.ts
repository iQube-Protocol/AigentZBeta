/**
 * usdcToBaseQcQuote — the ONE pure rate/fee formula for USDC -> BASE_QC
 * conversion (2026-09-01, CTP Slice C). Extracted verbatim from the
 * pre-existing rate/fee math in app/api/wallet/qct/convert/usdc-to-qc/route.ts
 * so it has exactly one home — the CTP primitive's projectConsequence() and
 * the route both call this, never a second copy of the formula (CLAUDE.md
 * "extend, don't duplicate").
 */

export const USDC_TO_BASE_QC_RATE = 100; // 1 USDC = 100 Q¢ (CLAUDE.md Q¢ pricing: $1 = 100 Q¢)
export const USDC_TO_BASE_QC_FEE_PERCENT = 0.01;

export interface UsdcToBaseQcQuote {
  usdcAmount: number;
  rate: number;
  feePercent: number;
  qctGross: number;
  feeQct: number;
  qctNet: number;
}

function round8(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

/** Pure. No I/O. Given a USDC amount, returns the deterministic BASE_QC quote. */
export function quoteUsdcToBaseQc(usdcAmount: number): UsdcToBaseQcQuote {
  const qctGross = usdcAmount * USDC_TO_BASE_QC_RATE;
  const feeQct = qctGross * USDC_TO_BASE_QC_FEE_PERCENT;
  const qctNet = qctGross - feeQct;
  return {
    usdcAmount: round8(usdcAmount),
    rate: USDC_TO_BASE_QC_RATE,
    feePercent: USDC_TO_BASE_QC_FEE_PERCENT,
    qctGross: round8(qctGross),
    feeQct: round8(feeQct),
    qctNet: round8(qctNet),
  };
}
