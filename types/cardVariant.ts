/**
 * CardVariant Type Definitions
 * 
 * The Smart Content Register for layout/card modals.
 * Card variants are the "vocabulary" of layouts that Copilot can use.
 * 
 * Built-in variants (~20+) from /content/demo:
 * - Desktop: hero, splash, poster3, poster2, carousel3, carousel4,
 *   thumbnail6, thumbRect, compound, compound2, compound1,
 *   iframe, featured, standard, compact, contentWide
 * - Mobile: mobileHero, mobileFeat, mobileSplit, mobileCard, mobileThumb
 * 
 * Copilot can propose new variants when existing ones don't fit.
 */

import type { Device, Modality } from './smartDrawer';

// =============================================================================
// CARD VARIANT ID
// =============================================================================

/**
 * CardVariantId - Union of all known card variant identifiers
 * Includes built-in variants plus extensibility for custom variants
 */
export type CardVariantId =
  // Desktop variants
  | 'hero'
  | 'heroShort'
  | 'splash'
  | 'poster3'
  | 'poster2'
  | 'carousel3'
  | 'carousel4'
  | 'thumbnail6'
  | 'thumbRect'
  | 'thumbnailRect'
  | 'compound'
  | 'compound1'
  | 'compound2'
  | 'iframe'
  | 'featured'
  | 'standard'
  | 'compact'
  | 'contentWide'
  // Mobile variants
  | 'mobileHero'
  | 'mobileFeat'
  | 'mobileFeatured'
  | 'mobileSplit'
  | 'mobileCard'
  | 'mobileCards'
  | 'mobileThumb'
  // Wallet-specific variants
  | 'walletOverview'
  | 'walletTasksList'
  | 'walletTimeline'
  // Allow future extensions
  | (string & {});

// =============================================================================
// CARD VARIANT DEFINITION
// =============================================================================

/** Layout density */
export type CardDensity = 'single' | 'grid-2' | 'grid-3' | 'grid-4' | 'list';

/** Aspect ratio hint */
export type AspectHint = 'tall' | 'wide' | 'square' | 'mixed';

/** Variant group */
export type VariantGroup = 'desktop' | 'mobile' | 'shared';

/**
 * CardVariantDefinition - Full metadata for a card variant
 */
export interface CardVariantDefinition {
  /** Unique identifier */
  id: CardVariantId | string;
  
  /** Human-readable label */
  label: string;
  
  /** Description of what this variant is for */
  description: string;
  
  /** Primary usage group */
  group: VariantGroup;
  
  /** Best-suited modalities */
  recommendedModality: Modality[];
  
  /** Best-suited devices */
  recommendedDevices: Device[];
  
  /** Layout density */
  density: CardDensity;
  
  /** Preferred aspect ratio for imagery */
  aspectHint?: AspectHint;
  
  // --- Behavioural hints ---
  
  /** Good for embedding agent panels or metavatars */
  supportsAgents?: boolean;
  
  /** Good for horizontally scrollable lists */
  supportsCarousels?: boolean;
  
  /** Good for pricing/payment UI */
  supportsPricing?: boolean;
  
  /** Good for tasks/rewards lists */
  supportsTasks?: boolean;
  
  // --- Component reference ---
  
  /** React component identifier (e.g., "SmartContentCardPoster3") */
  componentName: string;
  
  /** Base variant this was derived from (for auto-generated variants) */
  baseVariantHint?: CardVariantId;
  
  // --- Metadata ---
  
  /** Is this a built-in variant */
  isBuiltin?: boolean;
  
  /** Is the component implemented */
  componentImplemented?: boolean;
}

// =============================================================================
// NEW CARD VARIANT PROPOSAL
// =============================================================================

/**
 * NewCardVariantProposal - Schema for Copilot-generated variants
 * Used when Copilot proposes a new layout that doesn't exist
 */
export interface NewCardVariantProposal {
  /** Proposed unique identifier (e.g., "mobileQuizStack") */
  id: string;
  
  /** Human-readable label */
  label: string;
  
  /** Description of intended use */
  description: string;
  
  /** Primary usage group */
  group: VariantGroup;
  
  /** Best-suited modalities */
  recommendedModality: Modality[];
  
  /** Best-suited devices */
  recommendedDevices: Device[];
  
  /** Layout density */
  density: CardDensity;
  
  /** Preferred aspect ratio */
  aspectHint?: AspectHint;
  
  // --- Behavioural hints ---
  
  supportsAgents?: boolean;
  supportsCarousels?: boolean;
  supportsPricing?: boolean;
  supportsTasks?: boolean;
  
  /** Existing variant to base the new one on */
  baseVariantHint?: CardVariantId;
}

// =============================================================================
// MODAL SELECTION CONTEXT
// =============================================================================

/**
 * ModalSelectionContext - Input for Copilot modal selection
 */
export interface ModalSelectionContext {
  /** Application context */
  appId: string;
  
  /** Persona context */
  personaId: string;
  
  /** Tenant context */
  tenantId: string;
  
  // --- What we're trying to fill ---
  
  /** Drawer ID */
  drawerId: string;
  
  /** Tab ID */
  tabId: string;
  
  /** Use case for this slot */
  useCase: ModalUseCase;
  
  // --- Content context ---
  
  /** SmartContentQube (if available) */
  contentQube?: {
    id: string;
    layoutHints?: {
      preferredModal?: string;
      aspectRatio?: AspectHint;
    };
  };
  
  /** Primary modality */
  modality: Modality;
  
  /** Target device */
  device: Device;
  
  /** Is this a dynamic drawer (e.g., Codex / KNYTMall) */
  isDynamicDrawer: boolean;
  
  /** NL summary of what user asked for */
  userPromptSummary?: string;
}

/** Modal use cases */
export type ModalUseCase = 
  | 'hero'
  | 'grid'
  | 'thumbnails'
  | 'agent'
  | 'wallet'
  | 'tasks'
  | 'codex'
  | 'story'
  | 'custom';

// =============================================================================
// MODAL DECISION
// =============================================================================

/**
 * ModalDecision - Output from Copilot modal selection
 */
export interface ModalDecision {
  /** Decision mode */
  mode: 'existing' | 'proposal';
  
  /** Selected variant ID (if mode = 'existing') */
  variantId?: string;
  
  /** Proposed new variant (if mode = 'proposal') */
  proposal?: NewCardVariantProposal;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Reasons for this decision */
  reasons: string[];
}

// =============================================================================
// VARIANT SEARCH OPTIONS
// =============================================================================

/**
 * VariantSearchOptions - Options for finding best variant
 */
export interface VariantSearchOptions {
  /** Required modality */
  modality: Modality;
  
  /** Target device */
  device: Device;
  
  /** Use case hint */
  useCase?: ModalUseCase;
  
  /** Content layout hints */
  contentHints?: {
    preferredModal?: string;
    aspectRatio?: AspectHint;
  };
  
  /** App context */
  appId?: string;
}

/**
 * VariantSearchResult - Result from variant search
 */
export interface VariantSearchResult {
  /** Found variant */
  variant: CardVariantDefinition;
  
  /** Match score (0-100) */
  score: number;
}

// =============================================================================
// JSON SCHEMA REFERENCE
// =============================================================================

/**
 * JSON Schema for NewCardVariantProposal validation
 * Can be used for backend validation
 */
export const NEW_CARD_VARIANT_PROPOSAL_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'NewCardVariantProposal',
  type: 'object',
  required: [
    'id',
    'label',
    'description',
    'group',
    'recommendedModality',
    'recommendedDevices',
    'density',
  ],
  properties: {
    id: {
      type: 'string',
      description: "Unique identifier for the new modal, e.g. 'mobileQuizStack'.",
    },
    label: {
      type: 'string',
      description: "Human-readable name, e.g. 'Mobile Quiz Stack'.",
    },
    description: {
      type: 'string',
      description: 'High-level description of intended use.',
    },
    group: {
      type: 'string',
      enum: ['mobile', 'desktop', 'shared'],
      description: 'Primary usage group for this variant.',
    },
    recommendedModality: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['read', 'watch', 'listen', 'interact'],
      },
      minItems: 1,
      description: 'Modalities this layout is best suited for.',
    },
    recommendedDevices: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['mobile', 'desktop', 'tv'],
      },
      minItems: 1,
      description: 'Devices this layout is best suited for.',
    },
    density: {
      type: 'string',
      enum: ['single', 'grid-2', 'grid-3', 'grid-4', 'list'],
      description: 'Rough layout density / item count per view.',
    },
    aspectHint: {
      type: 'string',
      enum: ['tall', 'wide', 'square', 'mixed'],
      description: 'Preferred aspect ratio for imagery, if any.',
    },
    supportsAgents: {
      type: 'boolean',
      description: 'True if the layout is suitable for embedding agent panels or metavatars.',
      default: false,
    },
    supportsCarousels: {
      type: 'boolean',
      description: 'True if the layout is intended for horizontally scrollable lists.',
      default: false,
    },
    supportsPricing: {
      type: 'boolean',
      description: 'True if the layout is friendly to pricing/payment UI.',
      default: false,
    },
    supportsTasks: {
      type: 'boolean',
      description: 'True if the layout is optimized for tasks/rewards lists.',
      default: false,
    },
    baseVariantHint: {
      type: 'string',
      description: "Optional existing variant to inherit from, e.g. 'mobileCard'.",
    },
  },
  additionalProperties: false,
} as const;
