type PricingTier = {
  amount?: number | string | null;
  kind?: string;
};

type PremiumItem = {
  id: string;
  pricingModel?: { tiers?: PricingTier[] } | null;
  market_data?: { pricing_model?: { tiers?: PricingTier[] } | null } | null;
  price?: { amount?: number | string | null } | null;
  paymentMetadata?: { priceAmount?: number | string | null } | null;
  metadata?: {
    pricing?: {
      amount?: number | string | null;
      priceAmount?: number | string | null;
      tiers?: PricingTier[];
      gated?: boolean;
    };
  } | null;
  accessPolicy?: {
    requiresMembership?: boolean;
    requiresToken?: boolean;
    requiresOwnershipOf?: string[];
    requiresPersonaRole?: string[];
  } | null;
  requiresMembership?: boolean;
};

function toPositiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function hasPaidTier(tiers: PricingTier[] | undefined): boolean {
  if (!tiers || tiers.length === 0) return false;
  return tiers.some((tier) => tier?.kind !== "free" && toPositiveNumber(tier?.amount) !== null);
}

/**
 * Returns the first positive price amount for a content item, or null if free.
 * Checks all known price storage locations in priority order:
 *   1. item.price.amount            — section API normalized field
 *   2. item.market_data.pricing_model.tiers — Lovable admin write path
 *   3. item.pricingModel.tiers      — platform content service path
 *   4. item.metadata.pricing.amount — legacy metadata path
 */
export function getContentPrice(item: PremiumItem): number | null {
  const direct = toPositiveNumber(item.price?.amount);
  if (direct !== null) return direct;

  const marketTiers = item.market_data?.pricing_model?.tiers;
  if (Array.isArray(marketTiers)) {
    for (const tier of marketTiers) {
      if (tier?.kind === "free") continue;
      const a = toPositiveNumber(tier?.amount);
      if (a !== null) return a;
    }
  }

  const modelTiers = item.pricingModel?.tiers;
  if (Array.isArray(modelTiers)) {
    for (const tier of modelTiers) {
      if (tier?.kind === "free") continue;
      const a = toPositiveNumber(tier?.amount);
      if (a !== null) return a;
    }
  }

  return toPositiveNumber(item.metadata?.pricing?.amount);
}

function hasPriceGate(item: PremiumItem): boolean {
  if (toPositiveNumber(item.price?.amount) !== null) return true;
  if (toPositiveNumber(item.paymentMetadata?.priceAmount) !== null) return true;
  if (hasPaidTier(item.pricingModel?.tiers)) return true;
  if (hasPaidTier(item.market_data?.pricing_model?.tiers)) return true;
  if (hasPaidTier(item.metadata?.pricing?.tiers)) return true;
  if (toPositiveNumber(item.metadata?.pricing?.amount) !== null) return true;
  if (toPositiveNumber(item.metadata?.pricing?.priceAmount) !== null) return true;
  return false;
}

function hasAccessRestriction(item: PremiumItem): boolean {
  if (item.requiresMembership) return true;
  if (item.metadata?.pricing?.gated === true) return true;
  const policy = item.accessPolicy;
  if (!policy) return false;
  if (policy.requiresMembership || policy.requiresToken) return true;
  if (Array.isArray(policy.requiresOwnershipOf) && policy.requiresOwnershipOf.length > 0) return true;
  if (Array.isArray(policy.requiresPersonaRole) && policy.requiresPersonaRole.length > 0) return true;
  return false;
}

export function isPremiumContent(item: PremiumItem): boolean {
  return hasPriceGate(item) || hasAccessRestriction(item);
}

export function isLockedContent(
  item: PremiumItem,
  isOwned?: (item: PremiumItem) => boolean
): boolean {
  if (!isPremiumContent(item)) return false;
  if (!isOwned) return false;
  return !isOwned(item);
}
