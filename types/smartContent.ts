/**
 * SmartContentQube v0 Type Definitions
 * 
 * Self-aware content objects that know:
 * - What they are (modalities, structure)
 * - How to render (layout hints, responsive preferences)
 * - Who can access (identity, reputation, pricing)
 * - What they relate to (episodes, series, branches)
 * - How to reward (engagement triggers, creator royalties)
 * 
 * Styling follows x402 wallet CSS patterns and Qriptopian drawer compositions.
 * Storage: QubeBase (Supabase) with extensibility to IPFS/Autonomys.
 */

// =============================================================================
// CORE ENUMS & TYPES
// =============================================================================

/** Application context for smart content */
export type SmartContentApp = 'metaKnyts' | 'Qriptopian' | 'AgentiQ' | string;

/** Content modality types */
export type ContentModality = 'read' | 'watch' | 'listen' | 'interact';

/** Identity state levels (aligned with DIDQube) */
export type IdentityState = 'anonymous' | 'pseudo' | 'semi' | 'full';

/** Pricing model kinds */
export type PricingKind = 
  | 'payPerPanel' 
  | 'payPerEpisode' 
  | 'payPerStream' 
  | 'payPerArticle'
  | 'payPerIssue'
  | 'payPerSeries'
  | 'subscription'
  | 'bundle'
  | 'free';

/** Payment currencies */
export type PaymentCurrency = 'QCT' | 'QOYN' | 'KNYT' | 'USDC' | 'ETH' | 'BTC' | 'sats';

/** Reward trigger types */
export type RewardTrigger = 
  | 'panelComplete'
  | 'episodeComplete'
  | 'seriesComplete'
  | 'articleRead'
  | 'issueComplete'
  | 'questComplete'
  | 'interactionComplete'
  | 'shareContent'
  | 'referral';

/** Content structure types */
export type ContentStructureKind = 'episode' | 'issue' | 'article' | 'series' | 'collection';

/** Relationship types for wave layer */
export type RelationshipType = 
  | 'sequence'      // Linear progression (prev/next)
  | 'branch'        // Alternative paths
  | 'series'        // Parent series grouping
  | 'collection'    // Thematic grouping
  | 'reference'     // Cross-reference
  | 'prerequisite'  // Required before access
  | 'questPath'     // Quest/journey progression
  | 'playlist';     // Curated sequence

/** Drawer types for menu integration */
export type DrawerType = 
  | 'contentViewer'
  | 'agentChat'
  | 'walletCompact'
  | 'walletFull'
  | 'libraryShelf'
  | 'questTracker'
  | 'rewardsPanel'
  | 'settingsPanel';

/** Card shape hints for layout */
export type CardShape = 'square' | 'portrait' | 'landscape' | 'banner' | 'thumbnail';

/** Responsive breakpoint targets */
export type ResponsiveTarget = 'mobile' | 'tablet' | 'desktop' | 'tv';

/** Library expiry models */
export type ExpiryModel = 'permanent' | 'rental' | 'subscription' | 'timeLimited' | 'usageLimited';

/** Storage provider for media assets */
export type StorageProvider = 'supabase' | 'ipfs' | 'autonomys' | 'cdn' | 'external';

// =============================================================================
// IDENTITY & REPUTATION REQUIREMENTS
// =============================================================================

export interface IdentityRequirements {
  /** Minimum identity disclosure level required */
  minimumIdentifiability: IdentityState;
  
  /** Specific persona IDs allowed (empty = all personas allowed) */
  allowedPersonas: string[];
  
  /** Whether user can override with different persona */
  personaOverridesAllowed: boolean;
  
  /** Require World ID human verification */
  requireHumanProof: boolean;
  
  /** Require agent declaration (for AI agents) */
  requireAgentDeclare: boolean;
}

export interface ReputationRequirements {
  /** Minimum RQH bucket level (0-4) */
  minBucket: number;
  
  /** Minimum knowledge score (0-100) */
  minKnowledgeScore: number;
  
  /** Minimum trust score (0-100) */
  minTrustScore: number;
  
  /** Show warning instead of blocking on failure */
  warningsOnFailure: boolean;
  
  /** Skill categories that boost access (from RQH) */
  preferredSkillCategories: string[];
}

// =============================================================================
// REWARDS INTEGRATION (RewardHub)
// =============================================================================

export interface EngagementReward {
  /** Trigger event for reward */
  trigger: RewardTrigger;
  
  /** Reward amount */
  amount: number;
  
  /** Payment asset */
  asset: PaymentCurrency;
  
  /** Reputation multiplier applied */
  reputationMultiplier: number;
  
  /** PoKW basis for reward calculation */
  pokwBasis: number;
  
  /** Cooldown in seconds before reward can trigger again */
  cooldownSeconds: number;
}

export interface CreatorRoyalty {
  /** Creator's root DID */
  creatorRootDid: string;
  
  /** Royalty percentage (0-100) */
  percentage: number;
  
  /** Payment asset for royalties */
  asset: PaymentCurrency;
  
  /** Minimum threshold before payout */
  minPayoutThreshold: number;
}

export interface RewardOutcomes {
  /** Engagement-based rewards */
  engagementRewards: EngagementReward[];
  
  /** Creator royalty configuration */
  creatorRoyalties: CreatorRoyalty[];
  
  /** Quest completion rewards (linked to quest system) */
  questRewards: Array<{
    questId: string;
    reward: EngagementReward;
  }>;
  
  /** RewardHub tenant ID for proposal routing */
  rewardHubTenantId: string;
}

// =============================================================================
// MODALITIES (Read/Watch/Listen/Interact)
// =============================================================================

export interface MediaAsset {
  /** Asset ID (references storage) */
  id: string;
  
  /** Asset type (image, video, audio, document, etc.) */
  type: string;
  
  /** MIME type */
  mimeType: string;
  
  /** Storage provider */
  storageProvider: StorageProvider;
  
  /** Storage URI (Supabase path, IPFS CID, etc.) */
  storageUri: string;
  
  /** File size in bytes */
  sizeBytes: number;
  
  /** Duration in seconds (for video/audio) */
  durationSeconds?: number;
  
  /** Thumbnail URI */
  thumbnailUri?: string;
  
  /** Alt text for accessibility */
  altText?: string;
}

export interface ReadModality {
  enabled: boolean;
  
  /** Panel/page assets for comics/graphic novels */
  panels: MediaAsset[];
  
  /** Text content assets (markdown, HTML) */
  textAssets: MediaAsset[];
  
  /** Primary display targets */
  primaryOn: ResponsiveTarget[];
  
  /** Reading direction (ltr, rtl, vertical) */
  readingDirection: 'ltr' | 'rtl' | 'vertical';
  
  /** Estimated read time in minutes */
  estimatedReadMinutes: number;
}

export interface WatchModality {
  enabled: boolean;
  
  /** Video assets (multiple qualities) */
  videoAssets: MediaAsset[];
  
  /** Primary display targets */
  primaryOn: ResponsiveTarget[];
  
  /** Subtitle/caption tracks */
  subtitleTracks: Array<{
    language: string;
    uri: string;
  }>;
  
  /** Allow picture-in-picture */
  allowPip: boolean;
  
  /** Allow download for offline */
  allowDownload: boolean;
}

export interface ListenModality {
  enabled: boolean;
  
  /** Audio assets (podcast, narration, music) */
  audioAssets: MediaAsset[];
  
  /** Primary display targets */
  primaryOn: ResponsiveTarget[];
  
  /** Transcript available */
  hasTranscript: boolean;
  
  /** Transcript asset */
  transcriptAsset?: MediaAsset;
  
  /** Allow background playback */
  allowBackground: boolean;
}

export interface InteractModality {
  enabled: boolean;
  
  /** Agent IDs available for interaction */
  agents: string[];
  
  /** Tool IDs available */
  tools: Array<{
    id: string;
    kind: 'ToolQube' | 'ModelQube' | 'external';
    config?: Record<string, any>;
  }>;
  
  /** Primary display targets */
  primaryOn: ResponsiveTarget[];
  
  /** Interaction context/prompt */
  contextPrompt?: string;
  
  /** Max interaction duration in seconds */
  maxDurationSeconds?: number;
}

export interface ContentModalities {
  read: ReadModality;
  watch: WatchModality;
  listen: ListenModality;
  interact: InteractModality;
}

// =============================================================================
// EPISODE / ISSUE / SERIES STRUCTURE
// =============================================================================

export interface EpisodeStructure {
  /** Structure kind */
  kind: 'episode';
  
  /** Parent series ID */
  seriesId: string;
  
  /** Season/book number (optional) */
  seasonNumber?: number;
  
  /** Episode position within season/series */
  position: number;
  
  /** Episode title */
  title: string;
  
  /** Episode synopsis */
  synopsis?: string;
  
  /** Relationships to other episodes */
  relationships: {
    previous?: string;
    next?: string;
    branches?: string[];
  };
}

export interface IssueStructure {
  /** Structure kind */
  kind: 'issue';
  
  /** Parent collection/publication ID */
  collectionId: string;
  
  /** Section within publication */
  section: string;
  
  /** Position within section */
  position: number;
  
  /** Issue number (e.g., "Vol 1, Issue 3") */
  issueNumber: string;
  
  /** Publication date */
  publicationDate: string;
}

export interface ArticleStructure {
  /** Structure kind */
  kind: 'article';
  
  /** Parent series ID (for article series) */
  seriesId?: string;
  
  /** Position in series (if part of series) */
  seriesPosition?: number;
  
  /** Parent issue ID (if part of issue) */
  issueId?: string;
  
  /** Section within issue */
  section?: string;
  
  /** Article headline */
  headline: string;
  
  /** Article byline */
  byline: string;
  
  /** Publication date */
  publicationDate: string;
}

export interface SeriesStructure {
  /** Structure kind */
  kind: 'series';
  
  /** Series title */
  title: string;
  
  /** Series description */
  description: string;
  
  /** Total planned episodes/articles */
  totalPlanned?: number;
  
  /** Currently published count */
  publishedCount: number;
  
  /** Series status */
  status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled';
  
  /** Child content IDs in order */
  contentIds: string[];
}

export type ContentStructure = EpisodeStructure | IssueStructure | ArticleStructure | SeriesStructure;

// =============================================================================
// PRICING MODEL
// =============================================================================

export interface PricingTier {
  /** Pricing kind */
  kind: PricingKind;
  
  /** Price amount */
  amount: number;
  
  /** Currency */
  currency: PaymentCurrency;
  
  /** What this price covers */
  covers: string[];
  
  /** Duration for subscriptions/rentals (in seconds) */
  durationSeconds?: number;
  
  /** Usage limit for usage-limited access */
  usageLimit?: number;
}

export interface FreePreview {
  /** Number of free panels */
  panels?: number;
  
  /** Number of free paragraphs */
  paragraphs?: number;
  
  /** Free time limit in seconds */
  timeLimitSeconds?: number;
  
  /** Free percentage of content */
  percentageOfContent?: number;
}

export interface PricingModel {
  /** Primary currency for this content */
  primaryCurrency: PaymentCurrency;
  
  /** Available pricing tiers */
  tiers: PricingTier[];
  
  /** Free preview configuration */
  freePreview: FreePreview;
  
  /** x402 payment template ID (dynamically generated) */
  x402TemplateId?: string;
  
  /** Creator wallet address for payments */
  creatorWalletAddress: string;
  
  /** Platform fee percentage */
  platformFeePercentage: number;
}

// =============================================================================
// ACCESS POLICY
// =============================================================================

export interface AccessPolicy {
  /** Whether entitlement is required */
  entitlementRequired: boolean;
  
  /** Type of entitlement */
  entitlementType: 'purchase' | 'subscription' | 'rental' | 'token' | 'free';
  
  /** Transaction types that grant access */
  grantedByTxType: string[];
  
  /** TokenQube template ID for access token */
  tokenQubeTemplateId?: string;
  
  /** Capability token TTL in seconds */
  capabilityTtlSeconds: number;
  
  /** Geographic restrictions (ISO country codes) */
  geoRestrictions?: string[];
  
  /** Age rating */
  ageRating?: string;
}

// =============================================================================
// LAYOUT & MENU INTEGRATION
// =============================================================================

export interface CardLayout {
  /** Card shape */
  shape: CardShape;
  
  /** Height hint (CSS value) */
  height: string;
  
  /** Width hint (CSS value) */
  width: string;
  
  /** Aspect ratio (e.g., "16:9", "1:1") */
  aspectRatio?: string;
}

export interface LayoutHints {
  /** Default card layout */
  defaultCard: CardLayout;
  
  /** Thumbnail configuration */
  thumbnail: {
    size: 'small' | 'medium' | 'large';
    floating: boolean;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  };
  
  /** Carousel configuration */
  carousels: {
    enabled: boolean;
    groupBy: 'series' | 'collection' | 'modality' | 'none';
    itemsPerView: number;
  };
  
  /** Responsive layout overrides */
  responsive: Record<ResponsiveTarget, {
    layout: 'stack' | 'split' | 'grid' | 'carousel';
    cardShape?: CardShape;
  }>;
  
  /** iFrame embedding configuration */
  iframe: {
    allowEmbed: boolean;
    maxWidth?: string;
    maxHeight?: string;
    allowFullscreen: boolean;
  };
}

export interface MenuIntegration {
  /** Preferred drawers to show with this content */
  preferredDrawers: DrawerType[];
  
  /** Optional drawers available */
  optionalDrawers: DrawerType[];
  
  /** Show wallet summary in content view */
  showWalletSummary: boolean;
  
  /** Show library status (owned, rented, etc.) */
  showLibraryStatus: boolean;
  
  /** Show quest progress if applicable */
  showQuestProgress: boolean;
  
  /** User preference overrides allowed */
  allowUserOverrides: boolean;
}

// =============================================================================
// LIBRARY METADATA
// =============================================================================

export interface LibraryMetadata {
  /** Primary category */
  category: string;
  
  /** Tags for discovery */
  tags: string[];
  
  /** Recommended shelf/collection */
  recommendedShelf: string;
  
  /** Expiry model */
  expiryModel: ExpiryModel;
  
  /** Expiry duration in seconds (null = permanent) */
  expiryDurationSeconds: number | null;
  
  /** Sort priority (higher = more prominent) */
  sortPriority: number;
  
  /** Featured status */
  featured: boolean;
  
  /** Featured until date */
  featuredUntil?: string;
  
  /** Content rating */
  contentRating: string;
  
  /** Language */
  language: string;
  
  /** Additional languages available */
  additionalLanguages: string[];
}


// =============================================================================
// MEDIA VARIANTS
// =============================================================================

export type MediaOrientation = 'portrait' | 'landscape' | 'square';
export type MediaDevice = 'mobile' | 'tablet' | 'desktop';
export type MediaRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '21:9' | '1:3' | '2:3' | '1:4' | '1:2' | 'full' | `custom:${string}`;
export type ScreenFraction = 'screen-1-4' | 'screen-1-3' | 'screen-1-2' | 'screen-2-3' | 'screen-3-4' | 'screen-full';

export interface MediaCachePolicy {
  key?: string;
  maxBytes?: number;
  ttlSeconds?: number;
  preferredSizes?: string[];
}

export interface ImageVariant {
  id?: string;
  url: string;
  ratio?: MediaRatio;
  sizePx?: { w: number; h: number };
  sizeRel?: { w?: ScreenFraction; h?: ScreenFraction };
  crop?: 'contain' | 'cover' | 'fill';
  focalPoint?: { x: number; y: number };
  orientation?: MediaOrientation;
  tags?: string[];
  cache?: MediaCachePolicy;
}

export interface VideoVariant {
  id?: string;
  url: string;
  ratio?: MediaRatio;
  sizePx?: { w: number; h: number };
  sizeRel?: { w?: ScreenFraction; h?: ScreenFraction };
  crop?: 'contain' | 'cover' | 'fill';
  focalPoint?: { x: number; y: number };
  orientation?: MediaOrientation;
  tags?: string[];
  cache?: MediaCachePolicy;
}

export interface SpatialVariant {
  id?: string;
  url: string;
  format?: 'glb' | 'usdz' | 'gltf' | string;
  orientation?: MediaOrientation;
  tags?: string[];
  cache?: MediaCachePolicy;
}

export interface MediaVariantGroup<T> {
  default?: T;
  device?: Partial<Record<MediaDevice, T>>;
  orientation?: Partial<Record<MediaOrientation, T>>;
  ratios?: Partial<Record<MediaRatio, T>>;
  sizes?: Record<string, T>;
}

export interface MediaVariants {
  image?: MediaVariantGroup<ImageVariant>;
  video?: MediaVariantGroup<VideoVariant>;
  spatial?: MediaVariantGroup<SpatialVariant>;
}

// =============================================================================
// SMART CONTENT QUBE v0 - MAIN INTERFACE
// =============================================================================

export interface SmartContentQube {
  /** Unique identifier */
  id: string;
  
  /** Type discriminator */
  type: 'SmartContentQube';
  
  /** Application context */
  app: SmartContentApp;
  
  /** Content title */
  title: string;
  
  /** URL-friendly slug */
  slug: string;
  
  /** Version number */
  version: number;
  
  /** Description/synopsis */
  description: string;
  
  /** Cover image URI */
  coverImageUri: string;

  /** Media variants (image/video/spatial) */
  mediaVariants?: MediaVariants;
  
  /** Creator root DID */
  creatorRootDid: string;
  
  /** Tenant ID */
  tenantId: string;
  
  // --- Identity & Reputation ---
  identityRequirements: IdentityRequirements;
  reputationRequirements: ReputationRequirements;
  
  // --- Rewards ---
  rewardOutcomes: RewardOutcomes;
  
  // --- Modalities ---
  modalities: ContentModalities;
  
  // --- Structure ---
  structure?: ContentStructure;
  
  // --- Pricing ---
  pricingModel: PricingModel;
  
  // --- Access ---
  accessPolicy: AccessPolicy;
  
  // --- Layout & Menu ---
  layoutHints: LayoutHints;
  menuIntegration: MenuIntegration;
  
  // --- Library ---
  libraryMetadata: LibraryMetadata;
  
  // --- Linked iQube ---
  /** Linked ContentQube ID (for BlakQube storage) */
  contentQubeId?: string;
  
  /** MetaQube CID */
  metaQubeCid?: string;
  
  // --- Timestamps ---
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  
  // --- Status ---
  status: 'draft' | 'published' | 'archived' | 'scheduled';
}

// =============================================================================
// FACTORY DEFAULTS
// =============================================================================

export const defaultIdentityRequirements: IdentityRequirements = {
  minimumIdentifiability: 'anonymous',
  allowedPersonas: [],
  personaOverridesAllowed: true,
  requireHumanProof: false,
  requireAgentDeclare: false,
};

export const defaultReputationRequirements: ReputationRequirements = {
  minBucket: 0,
  minKnowledgeScore: 0,
  minTrustScore: 0,
  warningsOnFailure: true,
  preferredSkillCategories: [],
};

export const defaultRewardOutcomes: RewardOutcomes = {
  engagementRewards: [],
  creatorRoyalties: [],
  questRewards: [],
  rewardHubTenantId: '',
};

export const defaultModalities: ContentModalities = {
  read: {
    enabled: false,
    panels: [],
    textAssets: [],
    primaryOn: ['mobile', 'desktop'],
    readingDirection: 'ltr',
    estimatedReadMinutes: 0,
  },
  watch: {
    enabled: false,
    videoAssets: [],
    primaryOn: ['desktop', 'tv'],
    subtitleTracks: [],
    allowPip: true,
    allowDownload: false,
  },
  listen: {
    enabled: false,
    audioAssets: [],
    primaryOn: ['mobile'],
    hasTranscript: false,
    allowBackground: true,
  },
  interact: {
    enabled: false,
    agents: [],
    tools: [],
    primaryOn: ['desktop'],
  },
};

export const defaultPricingModel: PricingModel = {
  primaryCurrency: 'QCT',
  tiers: [],
  freePreview: {},
  creatorWalletAddress: '',
  platformFeePercentage: 10,
};

export const defaultAccessPolicy: AccessPolicy = {
  entitlementRequired: false,
  entitlementType: 'free',
  grantedByTxType: [],
  capabilityTtlSeconds: 86400, // 24 hours
};

export const defaultLayoutHints: LayoutHints = {
  defaultCard: {
    shape: 'portrait',
    height: '320px',
    width: '240px',
  },
  thumbnail: {
    size: 'medium',
    floating: false,
    position: 'center',
  },
  carousels: {
    enabled: true,
    groupBy: 'series',
    itemsPerView: 4,
  },
  responsive: {
    mobile: { layout: 'stack' },
    tablet: { layout: 'grid' },
    desktop: { layout: 'split' },
    tv: { layout: 'carousel' },
  },
  iframe: {
    allowEmbed: false,
    allowFullscreen: true,
  },
};

export const defaultMenuIntegration: MenuIntegration = {
  preferredDrawers: ['contentViewer'],
  optionalDrawers: ['walletCompact', 'agentChat'],
  showWalletSummary: true,
  showLibraryStatus: true,
  showQuestProgress: false,
  allowUserOverrides: true,
};

export const defaultLibraryMetadata: LibraryMetadata = {
  category: 'Uncategorized',
  tags: [],
  recommendedShelf: 'Recent',
  expiryModel: 'permanent',
  expiryDurationSeconds: null,
  sortPriority: 0,
  featured: false,
  contentRating: 'G',
  language: 'en',
  additionalLanguages: [],
};

/** Create a new SmartContentQube with defaults */
export function createSmartContentQube(
  partial: Partial<SmartContentQube> & Pick<SmartContentQube, 'id' | 'app' | 'title' | 'slug' | 'creatorRootDid' | 'tenantId'>
): SmartContentQube {
  const now = new Date().toISOString();
  return {
    type: 'SmartContentQube',
    version: 1,
    description: '',
    coverImageUri: '',
    identityRequirements: defaultIdentityRequirements,
    reputationRequirements: defaultReputationRequirements,
    rewardOutcomes: defaultRewardOutcomes,
    modalities: defaultModalities,
    pricingModel: defaultPricingModel,
    accessPolicy: defaultAccessPolicy,
    layoutHints: defaultLayoutHints,
    menuIntegration: defaultMenuIntegration,
    libraryMetadata: defaultLibraryMetadata,
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    ...partial,
  };
}
