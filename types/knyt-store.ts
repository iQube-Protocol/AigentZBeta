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
  episodeNumber: number;
  digitalPrice: number;   // USD
  printPrice: number;     // Amazon RRP USD
  qriptoPrice: number;    // same as digital
}

export const EPISODE_PRICING: EpisodePricing[] = [
  { episodeNumber: 0,  digitalPrice: 9,  printPrice: 14.75, qriptoPrice: 9  },
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

export interface BundlePricing {
  id: string;
  label: string;
  episodes: number[];
  digitalPrice: number;
  isFullSeason: boolean;
  printFulfillment: 'post-kickstarter';
}

export const BUNDLE_PRICING: BundlePricing[] = [
  { id: 'bundle-0-2',  label: 'Episodes 0–2',  episodes: [0,1,2],             digitalPrice: 18, isFullSeason: false, printFulfillment: 'post-kickstarter' },
  { id: 'bundle-3-7',  label: 'Episodes 3–7',  episodes: [3,4,5,6,7],         digitalPrice: 35, isFullSeason: false, printFulfillment: 'post-kickstarter' },
  { id: 'bundle-8-12', label: 'Episodes 8–12', episodes: [8,9,10,11,12],      digitalPrice: 48, isFullSeason: false, printFulfillment: 'post-kickstarter' },
  { id: 'bundle-full', label: 'Full Season 0–12', episodes: [0,1,2,3,4,5,6,7,8,9,10,11,12], digitalPrice: 90, isFullSeason: true, printFulfillment: 'post-kickstarter' },
];

export interface GraphicNovelPricing {
  layer: CommercialLayer;
  label: string;
  price: number;
}

export const GRAPHIC_NOVEL_PRICING: GraphicNovelPricing[] = [
  { layer: 'digital-common', label: 'Digital / Common', price: 78  },
  { layer: 'print',          label: 'Paperback',        price: 186 },
  { layer: 'print',          label: 'Hardcover',        price: 210 },
  { layer: 'qripto',         label: 'Qripto Edition',   price: 78  },
];

export interface CardsPricing {
  layer: CommercialLayer | 'physical';
  label: string;
  price: number;
}

export const KNYT_CARDS_PRICING: CardsPricing[] = [
  { layer: 'physical',       label: 'Physical Pack',        price: 26 },
  { layer: 'digital-common', label: 'Digital / Common Pack', price: 26 },
  { layer: 'qripto',         label: 'Qripto Pack',           price: 26 },
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
