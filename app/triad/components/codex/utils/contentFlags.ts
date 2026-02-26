type PricingTier = {
  amount?: number | string | null;
};

type PremiumItem = {
  id: string;
  pricingModel?: {
    tiers?: PricingTier[];
  } | null;
  price?: {
    amount?: number | string | null;
  } | null;
  paymentMetadata?: {
    priceAmount?: number | string | null;
  } | null;
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
  return tiers.some((tier) => toPositiveNumber(tier?.amount) !== null);
}

function hasPriceGate(item: PremiumItem): boolean {
  if (toPositiveNumber(item.price?.amount) !== null) return true;
  if (toPositiveNumber(item.paymentMetadata?.priceAmount) !== null) return true;
  if (hasPaidTier(item.pricingModel?.tiers)) return true;
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
