// ── KNYT Store — domain types ──────────────────────────────────────────────

// Asset families defined in the PRD
export type AssetFamily =
  | 'graphic-novel'
  | 'still-comics'
  | 'motion-comics'
  | 'knyt-cards'
  | 'scripts'
  | 'lore-docs'
  | 'page-still'       // future
  | 'page-motion'      // future
  | 'print-provenance-cert';

// Commercial layers
export type CommercialLayer =
  | 'digital-common'
  | 'print'
  | 'print-provenance'
  | 'qripto';

// Qripto rarity tiers
export type QriptoRarity = 'legendary' | 'epic' | 'rare' | 'black';

// ── Qripto rarity configuration ────────────────────────────────────────────
// Supply numbers apply to Qripto (crypto-digital) units only.
// Digital and print versions are unlimited.

export const QRIPTO_SUPPLY = 1860;

export const QRIPTO_RARITY_CONFIG: Record<QriptoRarity, { supply: number; coverLogic: string }> = {
  legendary: { supply: 18,   coverLogic: 'unique-legendary-cover' },
  epic:      { supply: 186,  coverLogic: 'unique-epic-cover' },
  rare:      { supply: 1654, coverLogic: 'common-cover-rare-badge' },
  black:     { supply: 2,    coverLogic: 'common-cover-black-badge' },
};

// Black is a hidden anomaly within the common-cover branch — not above Legendary
export const QRIPTO_RARITY_ORDER: QriptoRarity[] = ['legendary', 'epic', 'rare'];
// Black is intentionally excluded from the display order — it surfaces only when owned

// ── Pricing catalog ────────────────────────────────────────────────────────

export interface EpisodePricing {
  episodeNumber: number;   // -1 = Graphic Novel pre-episode
  /** Digital (common/unlimited) price per modality — 1/3 cheaper than Qripto */
  digitalPrice: number;
  printPrice: number;      // primary print SKU (Amazon RRP)
  /** Qripto (crypto-digital, limited 1,860) price per modality */
  qriptoPrice: number;
  // Episode -1 (GN) has two print variants; all others use printPrice for the single Amazon listing
  printVariants?: Array<{ sku: string; label: string; price: number; amazonUrl?: string }>;
}

// Helper: digital price = 2/3 of Qripto price (rounded to nearest dollar)
export function getDigitalPrice(qriptoPrice: number): number {
  return Math.round(qriptoPrice * (2 / 3));
}

export const EPISODE_PRICING: EpisodePricing[] = [
  // Episode -1 = Graphic Novel — Qripto $78, Digital $52, two print variants
  {
    episodeNumber: -1,
    qriptoPrice:  78,
    digitalPrice: 52,
    printPrice:   186,
    printVariants: [
      { sku: 'gn-1a', label: 'Paperback (−1α)', price: 186, amazonUrl: 'https://www.amazon.com/dp/B0BYGPS1HC?binding=paperback' },
      { sku: 'gn-1b', label: 'Hardcover (−1β)', price: 210, amazonUrl: 'https://www.amazon.com/dp/B0BYGPS1HC?binding=hardcover' },
    ],
  },
  { episodeNumber: 0,  qriptoPrice: 9,  digitalPrice: 6,  printPrice: 14.75, printVariants: [{ sku: 'ep0-pb', label: 'Paperback', price: 14.75, amazonUrl: 'https://www.amazon.com/dp/B0BYGPS1HC?binding=paperback&searchxofy=true&ref_=dbs_s_bs_series_rwt_tpbk&qid=1776652520&sr=1-1' }] },
  { episodeNumber: 1,  qriptoPrice: 9,  digitalPrice: 6,  printPrice: 14.75 },
  { episodeNumber: 2,  qriptoPrice: 9,  digitalPrice: 6,  printPrice: 14.75 },
  { episodeNumber: 3,  qriptoPrice: 9,  digitalPrice: 6,  printPrice: 14.75 },
  { episodeNumber: 4,  qriptoPrice: 9,  digitalPrice: 6,  printPrice: 14.75 },
  { episodeNumber: 5,  qriptoPrice: 9,  digitalPrice: 6,  printPrice: 14.75 },
  { episodeNumber: 6,  qriptoPrice: 9,  digitalPrice: 6,  printPrice: 14.75 },
  { episodeNumber: 7,  qriptoPrice: 11, digitalPrice: 7,  printPrice: 18 },
  { episodeNumber: 8,  qriptoPrice: 11, digitalPrice: 7,  printPrice: 18 },
  { episodeNumber: 9,  qriptoPrice: 11, digitalPrice: 7,  printPrice: 18 },
  { episodeNumber: 10, qriptoPrice: 14, digitalPrice: 9,  printPrice: 28 },
  { episodeNumber: 11, qriptoPrice: 11, digitalPrice: 7,  printPrice: 18 },
  { episodeNumber: 12, qriptoPrice: 18, digitalPrice: 12, printPrice: 36 },
];

// Still + Motion pair bundle per modality: 2× price − 20%
export function getEpisodePairPrice(ep: EpisodePricing, layer: 'digital' | 'qripto' = 'digital'): number {
  const base = layer === 'qripto' ? ep.qriptoPrice : ep.digitalPrice;
  return Math.round(base * 2 * 0.8 * 100) / 100;
}

// Print Provenance — episode comics: $3 USD / 2 KNYT; Graphic Novel: $38 USD / 27 KNYT
export const PRINT_PROVENANCE_PRICE_USD   = 3;
export const PRINT_PROVENANCE_PRICE_KNYT  = 2;
export const GN_PROVENANCE_PRICE_USD      = 38;
export const GN_PROVENANCE_PRICE_KNYT     = 27;

// USD → KNYT conversion rate (1 KNYT = $1.40)
export const KNYT_USD_RATE = 1.40;
export function usdToKnyt(usd: number): number {
  return Math.round((usd / KNYT_USD_RATE) * 100) / 100;
}

/**
 * GN variants this bundle grants ownership of. Multiple bundles grant multiple
 * variants (e.g. Top KNYT Shelf → ['qripto', 'paperback']). Drives the per-SKU
 * Owned badge in the store's GN section so a Qripto-grade bundle holder doesn't
 * see the Digital variant falsely marked as owned. Phase C will wire matching
 * grants_gn_paperback / grants_gn_hardcover SKU flags into store_skus; this
 * client-side mapping is the bridge until that ships.
 */
export type GnVariant = 'qripto' | 'digital' | 'paperback' | 'hardcover' | 'leatherbound';

export interface BundlePricing {
  id: string;
  label: string;
  episodes: number[];
  /** Active purchase price — investor price for investor bundles, retail for public */
  digitalPrice: number;
  /** Retail (public) price shown slashed-through on investor bundles */
  retailPrice?: number;
  /**
   * Optional explicit KNYT-token base price. Overrides the static
   * usdToKnyt(digitalPrice) conversion (which uses a fixed $1.40 rate).
   * Use this for SKUs where the USD price isn't discounted vs retail and
   * the KNYT-rail price needs to track a different rate so the 20% KNYT
   * discount lands at a sensible token figure. Example: Satoshi KNYT
   * Collection — digitalPrice $2100, baseKnytOverride 1800 → KNYT
   * discounted = 1440 (rather than 2100/1.40×0.8 = 1200).
   */
  baseKnytOverride?: number;
  /** Visual badge on bundle cards: 'qripto' = purple Qripto badge, 'digital' = sky Digital badge */
  badgeTier?: 'qripto' | 'digital';
  memberPrice?: number;    // persona-gated cohort price (e.g. ZeroKNYT members)
  memberCohort?: string;   // cohort slug required to unlock memberPrice
  isFullSeason: boolean;
  isInvestorOnly?: boolean;
  isLimited?: boolean;
  limitedSupply?: number;
  /** When true this bundle is locked until conditionalMinOrders threshold is met */
  isConditional?: boolean;
  conditionalMinOrders?: number;
  conditionalNote?: string;
  printFulfillment: 'post-kickstarter' | 'publisher' | 'signed-author';
  includes?: string[];   // human-readable contents
  accessGrant?: string;  // e.g. 'zero-knyt-order' for Order of Metaiye tiers
  /** Which GN variants this bundle grants. See GnVariant. Empty/undefined → bundle does not grant the GN. */
  gnVariants?: GnVariant[];
}

export const BUNDLE_PRICING: BundlePricing[] = [
  // ── Public episode bundles ─────────────────────────────────────────────────
  { id: 'bundle-0-2',  label: 'Episodes 0–2',     episodes: [0,1,2],                          digitalPrice: 18,  isFullSeason: false, printFulfillment: 'post-kickstarter' },
  { id: 'bundle-3-7',  label: 'Episodes 3–7',     episodes: [3,4,5,6,7],                      digitalPrice: 35,  isFullSeason: false, printFulfillment: 'post-kickstarter' },
  { id: 'bundle-8-12', label: 'Episodes 8–12',    episodes: [8,9,10,11,12],                   digitalPrice: 48,  isFullSeason: false, printFulfillment: 'post-kickstarter' },
  { id: 'bundle-full', label: 'Full Season 0–12', episodes: [0,1,2,3,4,5,6,7,8,9,10,11,12],  digitalPrice: 90,  isFullSeason: true,  printFulfillment: 'post-kickstarter' },

  // ── Investor bundles ───────────────────────────────────────────────────────
  // ── Qripto investor bundles ────────────────────────────────────────────────
  {
    id: 'knyt-codex-investor',
    label: 'Qripto KNYT Codex',
    episodes: [-1,0,1,2,3,4,5,6,7,8,9,10,11,12],
    digitalPrice: 168,   // investor price
    retailPrice:  186,   // retail (slashed through)
    badgeTier: 'qripto',
    isFullSeason: false,
    isInvestorOnly: true,
    printFulfillment: 'post-kickstarter',
    gnVariants: ['qripto'],
    includes: [
      '1 QAGN (Qripto AgentiQ Graphic Novel)',
      '13 Qripto Editions (all episodes)',
      '13 KNYT Characters',
    ],
  },
  {
    id: 'top-knyt-investor',
    label: 'Top KNYT Shelf',
    episodes: [-1,0,1,2,3,4,5,6,7,8,9,10,11,12],
    digitalPrice: 288,   // investor price
    retailPrice:  388,   // retail
    badgeTier: 'qripto',
    isFullSeason: false,
    isInvestorOnly: true,
    printFulfillment: 'post-kickstarter',
    gnVariants: ['qripto', 'paperback'],
    includes: [
      '1 QAGN (Qripto AgentiQ Graphic Novel)',
      '13 Qripto Editions (all episodes)',
      '13 KNYT Characters',
      'Paperback AgentiQ Graphic Novel (AGN)',
    ],
  },
  {
    id: 'first-knyt-investor',
    label: 'First KNYT',
    episodes: [-1,0,1,2,3,4,5,6,7,8,9,10,11,12],
    digitalPrice: 640,   // investor price
    retailPrice:  798,   // retail
    badgeTier: 'qripto',
    isFullSeason: false,
    isInvestorOnly: true,
    printFulfillment: 'signed-author',
    gnVariants: ['qripto', 'hardcover'],
    includes: [
      '1 QAGN (Qripto AgentiQ Graphic Novel)',
      '13 Qripto Editions (all episodes)',
      '13 KNYT Characters',
      'Collector Card',
      '1 Hardcover AgentiQ Graphic Novel (AGN)',
      '13 Print Episodes',
      'Proof of Print Certificate',
    ],
  },
  {
    id: 'zero-knyt-investor',
    label: 'Zero KNYT',
    episodes: [-1,0,1,2,3,4,5,6,7,8,9,10,11,12],
    digitalPrice: 800,   // investor price
    retailPrice:  1000,  // retail
    memberPrice:  600,   // existing Zero KNYTs
    memberCohort: 'zero-knyt',
    badgeTier: 'qripto',
    isFullSeason: false,
    isInvestorOnly: true,
    isLimited: true,
    limitedSupply: 21,
    printFulfillment: 'signed-author',
    accessGrant: 'zero-knyt-order',
    gnVariants: ['qripto', 'hardcover'],
    includes: [
      '1 QAGN (Qripto AgentiQ Graphic Novel)',
      '13 Qripto Editions (all episodes)',
      '13 KNYT Characters',
      'Collector Card',
      '1 Author-signed Hardcover AGN',
      '1 QAGN Proof of Print Certificate',
      'Zero KNYT Access — Order of Metaiye',
    ],
  },
  {
    id: 'satoshi-knyt-investor',
    label: 'Satoshi KNYT Collection',
    episodes: [-1,0,1,2,3,4,5,6,7,8,9,10,11,12],
    digitalPrice: 2100,  // same for retail and investor — no USD discount on this perk
    retailPrice:  2100,
    // No discount on retail USD, so usdToKnyt($2100) → 1500 KNYT undershoots
    // the actual KNYT/USD market. Lock the KNYT base to 1800 so the rail
    // discount lands at 1440 KNYT instead of 1200.
    baseKnytOverride: 1800,
    badgeTier: 'qripto',
    isFullSeason: false,
    isInvestorOnly: true,
    isLimited: true,
    isConditional: true,
    conditionalMinOrders: 7,
    conditionalNote: 'Unlocks when 7 Satoshi KNYT orders are confirmed',
    limitedSupply: 21,
    printFulfillment: 'signed-author',
    accessGrant: 'zero-knyt-order',
    gnVariants: ['qripto', 'hardcover', 'leatherbound'],
    includes: [
      'Special leather-bound author-signed Hardcover AGN (investor exclusive)',
      '2 author-signed Hardcover AGNs',
      '1 QAGN Proof of Print Certificate',
      '2 QAGNs (Qripto AgentiQ Graphic Novels)',
      '2× 13 author-signed Print Editions',
      '2× 13 KNYT Character Packs',
      '2× Collector Cards',
      'Zero KNYT Access — Order of Metaiye',
    ],
  },

  // ── Agentic Graphic Novel bundles — 20% off retail, KNYT COYN gives further 20% ───────
  {
    id: 'gn-investor-qripto',
    label: 'Agentic Graphic Novel Qripto',
    episodes: [-1],
    digitalPrice: 62,   // 20% off retail ($78)
    retailPrice:  78,
    badgeTier: 'qripto',
    isFullSeason: false,
    isInvestorOnly: true,
    printFulfillment: 'publisher',
    gnVariants: ['qripto'],
    includes: ['1 QAGN (Qripto AgentiQ Graphic Novel)'],
  },
  {
    id: 'gn-investor-digital',
    label: 'Agentic Graphic Novel Digital',
    episodes: [-1],
    digitalPrice: 42,   // 20% off retail ($52)
    retailPrice:  52,
    badgeTier: 'digital',
    isFullSeason: false,
    isInvestorOnly: true,
    printFulfillment: 'publisher',
    gnVariants: ['digital'],
    includes: ['1 Digital AGN (AgentiQ Graphic Novel)'],
  },
  {
    id: 'gn-investor-paperback',
    label: 'Agentic Graphic Novel Paperback',
    episodes: [-1],
    digitalPrice: 149,  // 20% off retail ($186)
    retailPrice:  186,
    isFullSeason: false,
    isInvestorOnly: true,
    printFulfillment: 'publisher',
    gnVariants: ['paperback'],
    includes: ['Paperback AgentiQ Graphic Novel (AGN)'],
  },
  {
    id: 'gn-investor-hardcover',
    label: 'Agentic Graphic Novel Hardcover',
    episodes: [-1],
    digitalPrice: 168,  // 20% off retail ($210)
    retailPrice:  210,
    isFullSeason: false,
    isInvestorOnly: true,
    printFulfillment: 'publisher',
    gnVariants: ['hardcover'],
    includes: ['Hardcover AgentiQ Graphic Novel (AGN)'],
  },

  // ── Digital investor bundles ───────────────────────────────────────────────
  {
    id: 'digital-knyt-cartridge',
    label: 'KNYT Cartridge',
    episodes: [-1,0,1,2,3,4,5,6,7,8,9,10,11,12],
    digitalPrice: 112,   // 1/3 cheaper than Qripto ($168)
    retailPrice:  124,   // 1/3 cheaper than Qripto retail ($186)
    badgeTier: 'digital',
    isFullSeason: false,
    isInvestorOnly: true,
    printFulfillment: 'post-kickstarter',
    gnVariants: ['digital'],
    includes: [
      '1 Digital AGN (AgentiQ Graphic Novel)',
      '13 Digital Editions (all episodes)',
      '13 KNYT Character Cards',
    ],
  },
  {
    id: 'digital-knyt-shelf',
    label: 'Digital KNYT Shelf',
    episodes: [-1,0,1,2,3,4,5,6,7,8,9,10,11,12],
    digitalPrice: 192,   // 1/3 cheaper than Qripto ($288)
    retailPrice:  259,   // 1/3 cheaper than Qripto retail ($388)
    badgeTier: 'digital',
    isFullSeason: false,
    isInvestorOnly: true,
    printFulfillment: 'post-kickstarter',
    gnVariants: ['digital', 'paperback'],
    includes: [
      '1 Digital AGN (AgentiQ Graphic Novel)',
      '13 Digital Editions (all episodes)',
      '13 KNYT Character Cards',
      'Paperback AgentiQ Graphic Novel (AGN)',
    ],
  },
  {
    id: 'digital-first-knyt',
    label: 'Digital First KNYT',
    episodes: [-1,0,1,2,3,4,5,6,7,8,9,10,11,12],
    digitalPrice: 427,   // 1/3 cheaper than Qripto ($640)
    retailPrice:  532,   // 1/3 cheaper than Qripto retail ($798)
    badgeTier: 'digital',
    isFullSeason: false,
    isInvestorOnly: true,
    printFulfillment: 'signed-author',
    gnVariants: ['digital', 'hardcover'],
    includes: [
      '1 Digital AGN (AgentiQ Graphic Novel)',
      '13 Digital Editions (all episodes)',
      '13 KNYT Character Cards',
      'Collector Card',
      '1 Hardcover AgentiQ Graphic Novel (AGN)',
      '13 Print Episodes',
      'Proof of Print Certificate',
    ],
  },
];

/** Returns true when the bundle includes a physical print GN (Paperback or Hardcover AGN). */
export function bundleIncludesPrintGn(bundleId: string): boolean {
  const bundle = BUNDLE_PRICING.find(b => b.id === bundleId);
  return bundle?.includes?.some(item => /paperback|hardcover/i.test(item)) ?? false;
}

/**
 * Given a set of asset IDs the persona owns (direct entitlement asset_ids or
 * bundle SKU ids — both come through the same column), return the set of GN
 * variants those grants resolve to. Investor bundles can grant multiple at
 * once (e.g. Top KNYT Shelf → qripto + paperback). Use this to drive the
 * per-variant Owned badge in the GN section of the store.
 */
export function getOwnedGnVariants(ownedAssetIds: Iterable<string>): Set<GnVariant> {
  const variants = new Set<GnVariant>();
  for (const id of ownedAssetIds) {
    const bundle = BUNDLE_PRICING.find((b) => b.id === id);
    if (bundle?.gnVariants) {
      for (const v of bundle.gnVariants) variants.add(v);
    }
  }
  return variants;
}

export interface GraphicNovelPricing {
  layer: CommercialLayer;
  label: string;
  price: number;
  sku?: string;
  amazonUrl?: string;
}

// GN order: Qripto → Digital → Paperback → Hardback
export const GRAPHIC_NOVEL_PRICING: GraphicNovelPricing[] = [
  { layer: 'qripto',         label: 'Qripto Edition',   price: 78,  sku: 'gn-qripto' },
  { layer: 'digital-common', label: 'Digital / Common', price: 52,  sku: 'gn-digital' },
  { layer: 'print',          label: 'Paperback (−1α)',  price: 186, sku: 'gn-1a', amazonUrl: 'https://www.amazon.com/dp/B0BYGPS1HC?binding=paperback' },
  { layer: 'print',          label: 'Hardcover (−1β)',  price: 210, sku: 'gn-1b', amazonUrl: 'https://www.amazon.com/dp/B0BYGPS1HC?binding=hardcover' },
];

export interface CardsPricing {
  layer: CommercialLayer | 'physical';
  label: string;
  price: number;
}

// Qripto first, then Digital, then Physical
export const KNYT_CARDS_PRICING: CardsPricing[] = [
  { layer: 'qripto',         label: 'Qripto Pack',          price: 26 },
  { layer: 'digital-common', label: 'Digital / Common Pack', price: 26 },
  { layer: 'physical',       label: 'Physical Pack',         price: 26 },
];

// 20% discount when paying with KNYT / $KNYT COYN.
// Applied at checkout for all items EXCEPT non-investor print bundles.
export const KNYT_COYN_DISCOUNT = 0.20;

export function getKnytDiscountedPrice(baseUsd: number): number {
  return Math.round(baseUsd * (1 - KNYT_COYN_DISCOUNT) * 100) / 100;
}

export function getPrintFulfillmentMessage(isSingleEpisode: boolean): string {
  return isSingleEpisode
    ? 'Available now via Amazon'
    : 'Print bundles are aggregated during Kickstarter and fulfilled post-campaign';
}

// ── Cart types ─────────────────────────────────────────────────────────────
//
// Cart primitives are now generic and live in `services/cart/`. This module
// re-exports them for back-compat with consumers that import from
// `@/types/knyt-store`, and adds KNYT-specific extensions (the COYN-discount
// total, the productType mapper).

import {
  type CartItem,
  type CartItemModality,
  type CartItemLayer,
  cartTotal,
  cartItemCount,
  lineQty,
} from '@/services/cart';

export type { CartItem, CartItemModality, CartItemLayer };
export { cartTotal, cartItemCount, lineQty };

/**
 * Maps a cart line's contentType to the productType expected by
 * services/rewards/purchaseHandler. KNYT-specific — lives here rather than
 * in services/cart so the generic primitive stays cartridge-agnostic.
 */
export function cartContentTypeToProductType(contentType: NonNullable<CartItem['contentType']>): string {
  const map: Record<NonNullable<CartItem['contentType']>, string> = {
    scroll_still:           'knyt_scroll_still',
    scroll_motion:          'knyt_scroll_motion',
    character_card:         'knyt_character_card_still',
    character_card_motion:  'knyt_character_card_motion',
    bundle_3_still:         'knyt_scroll_bundle_still_3',
    bundle_5_still:         'knyt_scroll_bundle_still_5',
    bundle_3_motion:        'knyt_scroll_bundle_motion_3',
    bundle_5_motion:        'knyt_scroll_bundle_motion_5',
    season_codex_still:     'knyt_season_codex_stills',
    season_codex_motion:    'knyt_season_codex_motion',
  };
  return map[contentType];
}

/** KNYT-specific cart total with the 20% native-token discount applied
    per-line, except for lines flagged excludeKnytDiscount. */
export function cartTotalWithKnyt(items: CartItem[]): number {
  return items.reduce((s, i) => {
    const linePrice = i.excludeKnytDiscount ? i.priceUsd : getKnytDiscountedPrice(i.priceUsd);
    return s + linePrice * lineQty(i);
  }, 0);
}

// ── Entity types ───────────────────────────────────────────────────────────

export interface Product {
  id: string;
  family: AssetFamily;
  layer: CommercialLayer;
  label: string;
  description?: string;
  episodeNumber?: number;
  basePrice: number;
  knytEligible: boolean;
  codexInclusion: boolean;
  shelfRendering: boolean;
  provenanceEligible: boolean;
  printFulfillmentNote?: string;
  thumbnailUrl?: string;
  amazonUrl?: string;
}

export interface QriptoRelease {
  id: string;
  productId: string;
  episodeNumber?: number;
  family: AssetFamily;
  totalSupply: number;
  rarityBreakdown: Record<QriptoRarity, number>;
  listPrice: number;
  rarityIsRandom: true;
  coverLogicByRarity: Record<QriptoRarity, string>;
}

export type OwnedCollectibleState = 'owned' | 'missing' | 'claimable' | 'complete' | 'incomplete';

export interface OwnedCollectible {
  id: string;
  personaId: string;
  productId: string;
  qriptoReleaseId?: string;
  rarity?: QriptoRarity;
  state: OwnedCollectibleState;
  claimedAt?: string;
  isVintage?: boolean;
  provenanceRecordId?: string;
  collectionGroup?: string;
  episodeNumber?: number;
  journeyHooks?: string[];
}

export interface CanonicalCodexAsset {
  id: string;
  family: AssetFamily;
  title: string;
  description?: string;
  episodeNumber?: number;
  mediaUrl?: string;
  thumbnailUrl?: string;
  isQriptoCollectible: false;
  canonicallyAuthoritative: true;
}

export interface VintageEntitlement {
  id: string;
  personaId: string;
  walletAddress?: string;
  episodeNumber: number;
  vintageEditionId: string;
  claimState: 'unclaimed' | 'claimed' | 'pending';
  correspondingQriptoReleaseId?: string;
  assignedRarity?: QriptoRarity;
  claimedAt?: string;
}

export interface ProvenanceRecord {
  id: string;
  personaId: string;
  productId: string;
  episodeNumber?: number;
  printLayer: 'print' | 'print-provenance';
  certificateUrl?: string;
  amazonOrderRef?: string;
  verifiedAt?: string;
}

export type ShelfItemSource = 'codex' | 'cartridge' | 'provenance';

export interface ShelfItem {
  id: string;
  personaId: string;
  source: ShelfItemSource;
  family: AssetFamily;
  label: string;
  thumbnailUrl?: string;
  state: OwnedCollectibleState;
  rarity?: QriptoRarity;
  isQripto: boolean;
  isVintage?: boolean;
  hasProvenance?: boolean;
  collectionGroup?: string;
  episodeNumber?: number;
  progressionState?: 'none' | 'in-progress' | 'complete';
}
