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
  digitalPrice: number;    // per modality (still or motion) — same price for each
  printPrice: number;      // primary print SKU (Amazon RRP)
  qriptoPrice: number;     // same as digitalPrice per modality
  // Episode -1 (GN) has two print variants; all others use printPrice for the single Amazon listing
  printVariants?: Array<{ sku: string; label: string; price: number; amazonUrl?: string }>;
}

export const EPISODE_PRICING: EpisodePricing[] = [
  // Episode -1 = Graphic Novel — digital $78 per modality, two print variants
  {
    episodeNumber: -1,
    digitalPrice:  78,
    printPrice:    186,
    qriptoPrice:   78,
    printVariants: [
      { sku: 'gn-1a', label: 'Paperback (−1\u03b1)', price: 186, amazonUrl: 'https://www.amazon.com/dp/B0BYGPS1HC?binding=paperback' },
      { sku: 'gn-1b', label: 'Hardcover (−1\u03b2)', price: 210, amazonUrl: 'https://www.amazon.com/dp/B0BYGPS1HC?binding=hardcover' },
    ],
  },
  { episodeNumber: 0,  digitalPrice: 9,  printPrice: 14.75, qriptoPrice: 9,  printVariants: [{ sku: 'ep0-pb', label: 'Paperback', price: 14.75, amazonUrl: 'https://www.amazon.com/dp/B0BYGPS1HC?binding=paperback&searchxofy=true&ref_=dbs_s_bs_series_rwt_tpbk&qid=1776652520&sr=1-1' }] },
  { episodeNumber: 1,  digitalPrice: 9,  printPrice: 14.75, qriptoPrice: 9  },
  { episodeNumber: 2,  digitalPrice: 9,  printPrice: 14.75, qriptoPrice: 9  },
  { episodeNumber: 3,  digitalPrice: 9,  printPrice: 14.75, qriptoPrice: 9  },
  { episodeNumber: 4,  digitalPrice: 9,  printPrice: 14.75, qriptoPrice: 9  },
  { episodeNumber: 5,  digitalPrice: 9,  printPrice: 14.75, qriptoPrice: 9  },
  { episodeNumber: 6,  digitalPrice: 9,  printPrice: 14.75, qriptoPrice: 9  },
  { episodeNumber: 7,  digitalPrice: 11, printPrice: 18,    qriptoPrice: 11 },
  { episodeNumber: 8,  digitalPrice: 11, printPrice: 18,    qriptoPrice: 11 },
  { episodeNumber: 9,  digitalPrice: 11, printPrice: 18,    qriptoPrice: 11 },
  { episodeNumber: 10, digitalPrice: 14, printPrice: 28,    qriptoPrice: 14 },
  { episodeNumber: 11, digitalPrice: 11, printPrice: 18,    qriptoPrice: 11 },
  { episodeNumber: 12, digitalPrice: 18, printPrice: 36,    qriptoPrice: 18 },
];

// Still + Motion pair bundle per episode = 2x digital price − 20%
export function getEpisodePairPrice(ep: EpisodePricing): number {
  return Math.round(ep.digitalPrice * 2 * 0.8 * 100) / 100;
}

// Print Provenance: $3 USD or 2 KNYT — provides Common edition cover to KNYT Shelf
export const PRINT_PROVENANCE_PRICE_USD   = 3;
export const PRINT_PROVENANCE_PRICE_KNYT  = 2;

export interface BundlePricing {
  id: string;
  label: string;
  episodes: number[];
  digitalPrice: number;
  isFullSeason: boolean;
  isInvestorOnly?: boolean;
  isLimited?: boolean;
  limitedSupply?: number;
  printFulfillment: 'post-kickstarter' | 'publisher' | 'signed-author';
  includes?: string[];   // human-readable contents for special bundles
  accessGrant?: string;  // e.g. 'zero-knyt-order' for Order of Metaiye tiers
}

export const BUNDLE_PRICING: BundlePricing[] = [
  { id: 'bundle-0-2',  label: 'Episodes 0–2',     episodes: [0,1,2],                                         digitalPrice: 18,   isFullSeason: false, printFulfillment: 'post-kickstarter' },
  { id: 'bundle-3-7',  label: 'Episodes 3–7',     episodes: [3,4,5,6,7],                                     digitalPrice: 35,   isFullSeason: false, printFulfillment: 'post-kickstarter' },
  { id: 'bundle-8-12', label: 'Episodes 8–12',    episodes: [8,9,10,11,12],                                  digitalPrice: 48,   isFullSeason: false, printFulfillment: 'post-kickstarter' },
  { id: 'bundle-full', label: 'Full Season 0–12', episodes: [0,1,2,3,4,5,6,7,8,9,10,11,12],                 digitalPrice: 90,   isFullSeason: true,  printFulfillment: 'post-kickstarter' },

  // Investor-gated bundles
  {
    id: 'knyt-codex-investor',
    label: 'KNYT Codex',
    episodes: [-1,0,1,2,3,4,5,6,7,8,9,10,11,12],
    digitalPrice: 168,
    isFullSeason: false,
    isInvestorOnly: true,
    printFulfillment: 'post-kickstarter',
    includes: [
      '1 Qripto Still + 1 Qripto Motion per episode (all 13)',
      '1 Qripto Still + 1 Qripto Animated per character card (all 13)',
      '1 Qripto Graphic Novel (Still)',
    ],
  },
  {
    id: 'top-knyt-investor',
    label: 'Top KNYT Shelf',
    episodes: [-1,0,1,2,3,4,5,6,7,8,9,10,11,12],
    digitalPrice: 288,
    isFullSeason: false,
    isInvestorOnly: true,
    printFulfillment: 'post-kickstarter',
    includes: [
      'Everything in KNYT Codex bundle',
      'Paperback Graphic Novel',
    ],
  },
  {
    id: 'zero-knyt-investor',
    label: 'Zero KNYT',
    episodes: [-1,0,1,2,3,4,5,6,7,8,9,10,11,12],
    digitalPrice: 500,
    isFullSeason: false,
    isInvestorOnly: true,
    isLimited: true,
    limitedSupply: 21,
    printFulfillment: 'signed-author',
    accessGrant: 'zero-knyt-order',
    includes: [
      'Everything in Top KNYT Shelf bundle',
      'Hardcover Graphic Novel (author signed)',
      'Instant access: Zero KNYT tier — Order of Metaiye',
    ],
  },
  {
    id: 'satoshi-knyt-investor',
    label: 'Satoshi KNYT Collection',
    episodes: [-1,0,1,2,3,4,5,6,7,8,9,10,11,12],
    digitalPrice: 2100,
    isFullSeason: false,
    isInvestorOnly: true,
    isLimited: true,
    limitedSupply: 21,
    printFulfillment: 'signed-author',
    accessGrant: 'zero-knyt-order',
    includes: [
      '1 author-signed leatherbound hardback Graphic Novel',
      '1 standard hardback Graphic Novel',
      '2 KNYT Codex claims',
      '2× Print bundle claims (all author signed)',
      'Instant access: Zero KNYT tier — Order of Metaiye',
    ],
  },
];

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
  { layer: 'digital-common', label: 'Digital / Common', price: 78,  sku: 'gn-digital' },
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

// 20% discount when paying with KNYT / $KNYT COYN
export const KNYT_COYN_DISCOUNT = 0.20;

export function getKnytDiscountedPrice(baseUsd: number): number {
  return Math.round(baseUsd * (1 - KNYT_COYN_DISCOUNT) * 100) / 100;
}

export function getPrintFulfillmentMessage(isSingleEpisode: boolean): string {
  return isSingleEpisode
    ? 'Available now via Amazon'
    : 'Print bundles are aggregated during Kickstarter and fulfilled post-campaign';
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
  // Journey/NBE hooks — placeholder for future progression system
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
  // NBE/quest progression placeholder
  progressionState?: 'none' | 'in-progress' | 'complete';
}
