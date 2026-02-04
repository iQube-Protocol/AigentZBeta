/**
 * KNYT Pricing Service
 * 
 * Calculates prices for content in both KNYT and PayPal USD.
 * - KNYT payments get a discount (default 15%)
 * - PayPal direct payments have a premium (default 20%)
 */

import { DEFAULT_KNYT_CONFIG } from './types';

// =============================================================================
// CONTENT TYPES & PRICING
// =============================================================================

/**
 * Phase 1 Content Types - KNYT Codex / KNYTMall SKUs
 * 
 * Singles:
 * - knyt_scroll_still: Single still/PDF episode (3 KNYT)
 * - knyt_scroll_motion: Full motion comic episode (10 KNYT)
 * - knyt_character_card_still: Single character/poster card (1 KNYT)
 * 
 * Bundles - Still:
 * - knyt_scroll_bundle_still_3: 3 still scrolls (5 KNYT)
 * - knyt_scroll_bundle_still_5: 5 still scrolls (8 KNYT)
 * - knyt_season_codex_stills: 13 still scrolls - full season (25 KNYT)
 * 
 * Bundles - Motion:
 * - knyt_season_codex_motion: 13 motion scrolls - full season (40 KNYT)
 */
export type ContentType = 
  // Singles
  | 'knyt_scroll_still'           // Single still/PDF episode - 3 KNYT
  | 'knyt_scroll_motion'          // Full motion comic episode - 10 KNYT
  | 'knyt_character_card_still'   // Single character card - 1 KNYT
  // Bundles - Still
  | 'knyt_scroll_bundle_still_3'  // 3-scroll still bundle - 5 KNYT
  | 'knyt_scroll_bundle_still_5'  // 5-scroll still bundle - 8 KNYT
  | 'knyt_season_codex_stills'    // Season Codex (13 stills) - 25 KNYT
  // Bundles - Motion
  | 'knyt_season_codex_motion'    // Season Codex (13 motion) - 40 KNYT
  // Future / Phase 1.5 (defined but not exposed)
  | 'knyt_scroll_bundle_motion_3' // 3-episode motion bundle - ~24 KNYT
  | 'knyt_scroll_bundle_motion_5' // 5-episode motion bundle - ~35 KNYT
  | 'knyt_character_card_motion'  // Motion character card - future
  // Legacy (deprecated, map to new types)
  | 'scroll'           // → knyt_scroll_still
  | 'episode'          // → knyt_scroll_motion
  | 'codex_entry'      // → knyt_scroll_bundle_still_3
  | 'codex_volume'     // → knyt_season_codex_stills
  | 'episode_bundle'   // → knyt_season_codex_motion
  | 'premium_feature';

export interface ContentPricing {
  contentId: string;
  contentType: ContentType;
  /** Base price in KNYT (before discounts) */
  baseKnytPrice: number;
  /** Final KNYT price (with discount applied) */
  knytPrice: number;
  /** PayPal USD price (with premium applied) */
  paypalUsdPrice: number;
  /** KNYT discount percentage (0-1) */
  knytDiscount: number;
  /** PayPal premium percentage (0-1) */
  paypalPremium: number;
  /** USD rate used for conversion */
  knytUsdRate: number;
}

// =============================================================================
// PHASE 1 PRICING CONFIGURATION
// =============================================================================

/** Internal KNYT to USD rate for pricing calculations */
export const KNYT_USD_RATE = 1.40;

/** Payment rail fee/premium configuration */
export const RAIL_CONFIG = {
  /** PayPal processing fee */
  fiatFeePercent: 0.03,
  /** USDC processing fee */
  usdcFeePercent: 0.01,
  /** Premium for fiat payments (configurable) */
  fiatPremiumPercent: 0.07,
  /** Discount for KNYT payments (configurable) */
  knytDiscountPercent: 0.20,
};

/** Payment rail types */
export type PaymentRail = 'qc' | 'knyt' | 'usdc' | 'paypal';

// Base prices in KNYT for different content types (Phase 1 SKUs)
const BASE_PRICES: Record<ContentType, number> = {
  // Singles
  knyt_scroll_still: 3,           // 3 KNYT per still scroll
  knyt_scroll_motion: 10,         // 10 KNYT per motion episode
  knyt_character_card_still: 1,   // 1 KNYT per character card
  // Bundles - Still
  knyt_scroll_bundle_still_3: 5,  // 5 KNYT for 3-scroll bundle
  knyt_scroll_bundle_still_5: 8,  // 8 KNYT for 5-scroll bundle
  knyt_season_codex_stills: 25,   // 25 KNYT for season codex (stills)
  // Bundles - Motion
  knyt_season_codex_motion: 40,   // 40 KNYT for season codex (motion)
  // Future / Phase 1.5
  knyt_scroll_bundle_motion_3: 24, // ~24 KNYT for 3-motion bundle
  knyt_scroll_bundle_motion_5: 35, // ~35 KNYT for 5-motion bundle
  knyt_character_card_motion: 3,   // 3 KNYT for motion card (future)
  // Legacy mappings (deprecated)
  scroll: 3,            // → knyt_scroll_still
  episode: 10,          // → knyt_scroll_motion
  codex_entry: 5,       // → knyt_scroll_bundle_still_3
  codex_volume: 25,     // → knyt_season_codex_stills
  episode_bundle: 40,   // → knyt_season_codex_motion
  premium_feature: 15,  // Generic premium feature
};

/** Map legacy content types to new Phase 1 types */
export function normalizeContentType(type: ContentType): ContentType {
  const legacyMap: Partial<Record<ContentType, ContentType>> = {
    scroll: 'knyt_scroll_still',
    episode: 'knyt_scroll_motion',
    codex_entry: 'knyt_scroll_bundle_still_3',
    codex_volume: 'knyt_season_codex_stills',
    episode_bundle: 'knyt_season_codex_motion',
  };
  return legacyMap[type] || type;
}

// =============================================================================
// PRICING FUNCTIONS
// =============================================================================

/** Multi-rail pricing result */
export interface MultiRailPricing {
  contentId: string;
  contentType: ContentType;
  /** Base price in KNYT (reference) */
  baseKnytPrice: number;
  /** Base price in USD (KNYT * 1.40) */
  usdBasePrice: number;
  /** Price per payment rail */
  rails: {
    /** Q¢ (Base) - no fee, no premium */
    qc: { price: number; currency: 'QC' };
    /** KNYT - discounted vs fiat */
    knyt: { price: number; currency: 'KNYT'; discount: number };
    /** USDC - with fee + premium */
    usdc: { price: number; currency: 'USDC'; fee: number };
    /** PayPal/USD - with fee + premium */
    paypal: { price: number; currency: 'USD'; fee: number };
  };
}

/**
 * Get multi-rail pricing for a content item (Phase 1)
 * 
 * Pricing logic:
 * - Q¢ (Base): usdBasePrice (no fee, no premium)
 * - KNYT: usdBasePrice * (1 - knytDiscount) / 1.40 → rounded to KNYT tokens
 * - USDC: usdBasePrice * (1 + usdcFee + fiatPremium)
 * - PayPal: usdBasePrice * (1 + fiatFee + fiatPremium)
 */
export function getMultiRailPricing(
  contentId: string,
  contentType: ContentType,
  customBaseKnytPrice?: number
): MultiRailPricing {
  const normalizedType = normalizeContentType(contentType);
  const baseKnytPrice = customBaseKnytPrice ?? BASE_PRICES[normalizedType];
  const usdBasePrice = baseKnytPrice * KNYT_USD_RATE;
  
  // Q¢ (Base) - no fee, no premium
  const qcPrice = Math.round(usdBasePrice * 100) / 100;
  
  // KNYT - discounted vs fiat, then convert back to KNYT tokens
  const knytPriceUsd = usdBasePrice * (1 - RAIL_CONFIG.knytDiscountPercent);
  const knytPriceTokens = Math.round(knytPriceUsd / KNYT_USD_RATE * 100) / 100;
  
  // USDC - with fee + premium
  const usdcPrice = Math.round(usdBasePrice * (1 + RAIL_CONFIG.usdcFeePercent + RAIL_CONFIG.fiatPremiumPercent) * 100) / 100;
  
  // PayPal/USD - with fee + premium
  const paypalPrice = Math.round(usdBasePrice * (1 + RAIL_CONFIG.fiatFeePercent + RAIL_CONFIG.fiatPremiumPercent) * 100) / 100;
  
  return {
    contentId,
    contentType: normalizedType,
    baseKnytPrice,
    usdBasePrice,
    rails: {
      qc: { price: qcPrice, currency: 'QC' },
      knyt: { price: knytPriceTokens, currency: 'KNYT', discount: RAIL_CONFIG.knytDiscountPercent },
      usdc: { price: usdcPrice, currency: 'USDC', fee: RAIL_CONFIG.usdcFeePercent + RAIL_CONFIG.fiatPremiumPercent },
      paypal: { price: paypalPrice, currency: 'USD', fee: RAIL_CONFIG.fiatFeePercent + RAIL_CONFIG.fiatPremiumPercent },
    },
  };
}

/**
 * Get pricing for a content item (legacy function, uses new multi-rail internally)
 */
export function getContentPricing(
  contentId: string,
  contentType: ContentType,
  customBasePrice?: number
): ContentPricing {
  const multiRail = getMultiRailPricing(contentId, contentType, customBasePrice);
  
  return {
    contentId,
    contentType: multiRail.contentType,
    baseKnytPrice: multiRail.baseKnytPrice,
    knytPrice: multiRail.rails.knyt.price,
    paypalUsdPrice: multiRail.rails.paypal.price,
    knytDiscount: RAIL_CONFIG.knytDiscountPercent,
    paypalPremium: RAIL_CONFIG.fiatPremiumPercent,
    knytUsdRate: KNYT_USD_RATE,
  };
}

/**
 * Calculate how much KNYT a user gets for a PayPal purchase
 */
export function calculateKnytForUsd(usdAmount: number): {
  knytAmount: number;
  effectiveRate: number;
} {
  const config = DEFAULT_KNYT_CONFIG;
  const knytAmount = Math.floor(usdAmount / config.knytUsdRate);
  return {
    knytAmount,
    effectiveRate: config.knytUsdRate,
  };
}

/**
 * Get bulk pricing for multiple content items
 */
export function getBulkPricing(
  items: Array<{ contentId: string; contentType: ContentType; customPrice?: number }>
): {
  items: ContentPricing[];
  totalKnyt: number;
  totalPaypalUsd: number;
} {
  const pricedItems = items.map(item => 
    getContentPricing(item.contentId, item.contentType, item.customPrice)
  );
  
  return {
    items: pricedItems,
    totalKnyt: pricedItems.reduce((sum, p) => sum + p.knytPrice, 0),
    totalPaypalUsd: pricedItems.reduce((sum, p) => sum + p.paypalUsdPrice, 0),
  };
}

// KNYT to ETH rate: 1 KNYT = 0.0005 ETH
const KNYT_ETH_RATE = 0.0005;

// Cache for ETH price
let cachedEthPrice: { price: number; timestamp: number } | null = null;
const ETH_PRICE_CACHE_MS = 60000; // 1 minute cache

/**
 * Fetch current ETH price from CoinGecko
 */
async function fetchEthPrice(): Promise<number> {
  // Return cached price if fresh
  if (cachedEthPrice && Date.now() - cachedEthPrice.timestamp < ETH_PRICE_CACHE_MS) {
    return cachedEthPrice.price;
  }
  
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const data = await res.json();
    const price = data?.ethereum?.usd || 3500; // Fallback to $3500
    cachedEthPrice = { price, timestamp: Date.now() };
    return price;
  } catch {
    return cachedEthPrice?.price || 3500; // Use cached or fallback
  }
}

/**
 * Calculate KNYT price in USD based on live ETH price
 * 1 KNYT = 0.0005 ETH
 */
export async function getKnytUsdPrice(): Promise<number> {
  const ethPrice = await fetchEthPrice();
  return ethPrice * KNYT_ETH_RATE;
}

/**
 * Get KNYT package options for PayPal purchase (with live pricing)
 */
export async function getKnytPackagesAsync(): Promise<Array<{
  packageId: string;
  knytAmount: number;
  usdPrice: number;
  bonusKnyt: number;
  label: string;
}>> {
  const knytUsdPrice = await getKnytUsdPrice();
  
  return [
    { packageId: 'knyt_10', knytAmount: 10, usdPrice: Math.round(10 * knytUsdPrice * 100) / 100, bonusKnyt: 0, label: '10 KNYT' },
    { packageId: 'knyt_50', knytAmount: 50, usdPrice: Math.round(50 * knytUsdPrice * 0.9 * 100) / 100, bonusKnyt: 5, label: '50 KNYT (+5 bonus)' }, // 10% discount
    { packageId: 'knyt_100', knytAmount: 100, usdPrice: Math.round(100 * knytUsdPrice * 0.8 * 100) / 100, bonusKnyt: 20, label: '100 KNYT (+20 bonus)' }, // 20% discount
    { packageId: 'knyt_500', knytAmount: 500, usdPrice: Math.round(500 * knytUsdPrice * 0.7 * 100) / 100, bonusKnyt: 150, label: '500 KNYT (+150 bonus)' }, // 30% discount
  ];
}

/**
 * Get KNYT package options for PayPal purchase (sync version with fallback)
 * @deprecated Use getKnytPackagesAsync for live pricing
 */
export function getKnytPackages(): Array<{
  packageId: string;
  knytAmount: number;
  usdPrice: number;
  bonusKnyt: number;
  label: string;
}> {
  // Fallback prices based on ~$3500 ETH ($1.75 per KNYT)
  const fallbackKnytPrice = 1.75;
  return [
    { packageId: 'knyt_10', knytAmount: 10, usdPrice: Math.round(10 * fallbackKnytPrice * 100) / 100, bonusKnyt: 0, label: '10 KNYT' },
    { packageId: 'knyt_50', knytAmount: 50, usdPrice: Math.round(50 * fallbackKnytPrice * 0.9 * 100) / 100, bonusKnyt: 5, label: '50 KNYT (+5 bonus)' },
    { packageId: 'knyt_100', knytAmount: 100, usdPrice: Math.round(100 * fallbackKnytPrice * 0.8 * 100) / 100, bonusKnyt: 20, label: '100 KNYT (+20 bonus)' },
    { packageId: 'knyt_500', knytAmount: 500, usdPrice: Math.round(500 * fallbackKnytPrice * 0.7 * 100) / 100, bonusKnyt: 150, label: '500 KNYT (+150 bonus)' },
  ];
}
