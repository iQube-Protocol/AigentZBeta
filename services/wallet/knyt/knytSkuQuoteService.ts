import { getSmartContentService } from "@/services/content";
import type { PaymentCurrency, PricingKind } from "@/types/smartContent";

const QCT_PER_USD = 100;

export interface PricingKnobs {
  knytUsdRate: number;
  paypalFeePercent: number;
  usdcFeePercent: number;
  fiatPremiumPercent: number;
  qctPremiumPercent: number;
  knytDiscountPercent: number;
}

export interface QuoteSnapshot {
  knobs: PricingKnobs;
  computedAt: string;
}

export interface PricedOfferQuote {
  kind: PricingKind;
  amount: number;
  currency: PaymentCurrency;
  label: string;
  covers: string[];
  usdBasePrice?: number;
  qctBaseAmount?: number;
  paypalTotalUsd?: number;
  usdcTotalUsd?: number;
  knytTokens?: number;
  snapshot?: QuoteSnapshot;
  quoteError?: string;
}

export interface SkuQuoteResult {
  sku: string;
  owned: boolean;
  entitlement?: unknown;
  bestOfferKind?: PricingKind;
  offers: PricedOfferQuote[];
  selectedOffer?: PricedOfferQuote;
}

function roundToCents(n: number): number {
  return Math.round(n * 100) / 100;
}

function roundKnyt(n: number): number {
  return Math.round(n * 100) / 100;
}

function roundQct(n: number): number {
  return Math.round(n);
}

function getNumberEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function getPhase1PricingKnobs(): PricingKnobs {
  return {
    knytUsdRate: getNumberEnv("KNYT_USD_RATE", 1.4),
    paypalFeePercent: getNumberEnv("PAYPAL_FEE_PERCENT", getNumberEnv("FIAT_FEE_PERCENT", 0.03)),
    usdcFeePercent: getNumberEnv("USDC_FEE_PERCENT", 0.01),
    fiatPremiumPercent: getNumberEnv("FIAT_PREMIUM_PERCENT", 0.07),
    qctPremiumPercent: getNumberEnv("QCT_PREMIUM_PERCENT", 0),
    knytDiscountPercent: getNumberEnv("KNYT_DISCOUNT_PERCENT", 0.2),
  };
}

export function quoteFromUsdBase(usdBasePrice: number, knobs: PricingKnobs): {
  usdBasePrice: number;
  qctBaseAmount: number;
  paypalTotalUsd: number;
  usdcTotalUsd: number;
  knytTokens: number;
  snapshot: QuoteSnapshot;
} {
  const qctBaseAmount = roundQct(usdBasePrice * (1 + knobs.qctPremiumPercent) * QCT_PER_USD);

  const paypalTotalUsd = roundToCents(
    usdBasePrice * (1 + knobs.paypalFeePercent + knobs.fiatPremiumPercent)
  );

  const usdcTotalUsd = roundToCents(
    usdBasePrice * (1 + knobs.usdcFeePercent + knobs.fiatPremiumPercent)
  );

  const knytPriceUsd = usdBasePrice * (1 - knobs.knytDiscountPercent);
  const knytTokens = roundKnyt(knytPriceUsd / knobs.knytUsdRate);

  return {
    usdBasePrice: roundToCents(usdBasePrice),
    qctBaseAmount,
    paypalTotalUsd,
    usdcTotalUsd,
    knytTokens,
    snapshot: {
      knobs,
      computedAt: new Date().toISOString(),
    },
  };
}

export async function quoteSkuOffers(input: {
  sku: string;
  personaId?: string;
  tierKind?: PricingKind;
}): Promise<SkuQuoteResult> {
  const service = getSmartContentService();
  const snapshot = await service.getPricingSnapshot(input.sku, input.personaId);
  const knobs = getPhase1PricingKnobs();

  const offers: PricedOfferQuote[] = snapshot.allOffers.map((o) => {
    const base: PricedOfferQuote = {
      kind: o.kind,
      amount: o.amount,
      currency: o.currency,
      label: o.label,
      covers: o.covers,
    };

    if (o.currency !== "USDC" && o.currency !== "QCT") {
      return {
        ...base,
        quoteError: `Unsupported currency for Tier 0 pricing quote: ${o.currency}`,
      };
    }

    const usdBasePrice = o.currency === "QCT" ? o.amount / QCT_PER_USD : o.amount;
    const q = quoteFromUsdBase(usdBasePrice, knobs);
    return {
      ...base,
      usdBasePrice: q.usdBasePrice,
      qctBaseAmount: q.qctBaseAmount,
      paypalTotalUsd: q.paypalTotalUsd,
      usdcTotalUsd: q.usdcTotalUsd,
      knytTokens: q.knytTokens,
      snapshot: q.snapshot,
    };
  });

  const selectedOffer = input.tierKind
    ? offers.find((o) => o.kind === input.tierKind)
    : undefined;

  return {
    sku: input.sku,
    owned: snapshot.owned,
    entitlement: snapshot.entitlement,
    bestOfferKind: snapshot.bestOffer?.kind,
    offers,
    selectedOffer,
  };
}
