/**
 * POST /api/cart/quote
 *
 * Server-side authoritative pricing quote for a multi-line cart. Computes
 * per-rail totals (KNYT / Q¢ / USDC / PayPal) by running each line through
 * the existing getMultiRailPricing helper and summing across the cart.
 *
 * Read-only — no DB writes, no balance checks, no debits. The /cart/complete
 * endpoint does those for the actually-selected rail.
 *
 * Body:
 *   {
 *     personaId?: string,                     // optional (anonymous quote OK)
 *     lines: [{
 *       id: string,                           // cart line id (e.g. capsule id)
 *       contentType?: CartContentType,        // see types/knyt-store.ts
 *       priceUsd: number,                     // base USD per unit
 *       qty?: number,                         // default 1
 *     }, ...],
 *   }
 *
 * Returns:
 *   {
 *     ok: true,
 *     baseTotalUsd: number,
 *     totalLines: number,
 *     totalQty: number,
 *     rails: {
 *       knyt:   { total: number, currency: 'KNYT',  discountPct: number, perLine: [...] },
 *       qcents: { total: number, currency: 'QC',                          perLine: [...] },
 *       usdc:   { total: number, currency: 'USDC', feePct: number,        perLine: [...] },
 *       paypal: { total: number, currency: 'USD',  feePct: number,        perLine: [...] },
 *     },
 *   }
 *
 * Lines without contentType fall back to a generic 'scroll_still' for pricing
 * shape — the rail multipliers (KNYT discount, USDC fee, PayPal fee) apply
 * uniformly to the priceUsd regardless of contentType, so the rail totals
 * are still authoritative for those lines.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getMultiRailPricing, KNYT_USD_RATE, type ContentType } from '@/services/wallet/knyt/knytPricingService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface QuoteLineInput {
  id: string;
  contentType?: string;
  priceUsd: number;
  qty?: number;
}

interface QuoteRequest {
  personaId?: string;
  lines: QuoteLineInput[];
}

interface QuotePerLineRail {
  id: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
}

function clampQty(qty: number | undefined): number {
  if (typeof qty !== 'number' || !Number.isFinite(qty) || qty < 1) return 1;
  return Math.floor(qty);
}

export async function POST(req: NextRequest) {
  let body: QuoteRequest;
  try {
    body = (await req.json()) as QuoteRequest;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (lines.length === 0) {
    return NextResponse.json({ ok: false, error: 'lines array required and non-empty' }, { status: 400 });
  }

  const knytPerLine: QuotePerLineRail[] = [];
  const qcentsPerLine: QuotePerLineRail[] = [];
  const usdcPerLine: QuotePerLineRail[] = [];
  const paypalPerLine: QuotePerLineRail[] = [];

  let knytTotal = 0;
  let qcentsTotal = 0;
  let usdcTotal = 0;
  let paypalTotal = 0;
  let baseTotalUsd = 0;
  let totalQty = 0;

  let knytDiscountPct = 0;
  let usdcFeePct = 0;
  let paypalFeePct = 0;

  for (const line of lines) {
    const qty = clampQty(line.qty);
    const priceUsd = typeof line.priceUsd === 'number' && Number.isFinite(line.priceUsd) && line.priceUsd >= 0 ? line.priceUsd : 0;
    const baseKnyt = priceUsd / KNYT_USD_RATE;
    const ct = (line.contentType as ContentType | undefined) ?? 'scroll_still';

    const rail = getMultiRailPricing(line.id, ct, baseKnyt);
    knytDiscountPct = rail.rails.knyt.discount ?? knytDiscountPct;
    usdcFeePct = rail.rails.usdc.fee ?? usdcFeePct;
    paypalFeePct = rail.rails.paypal.fee ?? paypalFeePct;

    const knytLine = rail.rails.knyt.price * qty;
    const qcentsLine = rail.rails.qc.price * qty;
    const usdcLine = rail.rails.usdc.price * qty;
    const paypalLine = rail.rails.paypal.price * qty;

    knytPerLine.push({ id: line.id, unitPrice: rail.rails.knyt.price, qty, lineTotal: knytLine });
    qcentsPerLine.push({ id: line.id, unitPrice: rail.rails.qc.price, qty, lineTotal: qcentsLine });
    usdcPerLine.push({ id: line.id, unitPrice: rail.rails.usdc.price, qty, lineTotal: usdcLine });
    paypalPerLine.push({ id: line.id, unitPrice: rail.rails.paypal.price, qty, lineTotal: paypalLine });

    knytTotal += knytLine;
    qcentsTotal += qcentsLine;
    usdcTotal += usdcLine;
    paypalTotal += paypalLine;

    baseTotalUsd += priceUsd * qty;
    totalQty += qty;
  }

  // Round totals — pricing helper rounds per-unit; sums of rounded values can
  // drift cents over many lines.
  const round2 = (n: number) => Math.round(n * 100) / 100;

  return NextResponse.json({
    ok: true,
    baseTotalUsd: round2(baseTotalUsd),
    totalLines: lines.length,
    totalQty,
    rails: {
      knyt:   { total: round2(knytTotal),   currency: 'KNYT', discountPct: knytDiscountPct, perLine: knytPerLine },
      qcents: { total: round2(qcentsTotal), currency: 'QC',                                  perLine: qcentsPerLine },
      usdc:   { total: round2(usdcTotal),   currency: 'USDC', feePct: usdcFeePct,            perLine: usdcPerLine },
      paypal: { total: round2(paypalTotal), currency: 'USD',  feePct: paypalFeePct,          perLine: paypalPerLine },
    },
  });
}
