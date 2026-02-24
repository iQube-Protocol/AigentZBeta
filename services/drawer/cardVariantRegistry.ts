/**
 * Card Variant Registry
 * 
 * The "vocabulary" of layouts that Copilot can use.
 * Contains all builtin variants (~20+) plus support for custom variants.
 */

import type {
  CardVariantDefinition,
  CardVariantId,
  VariantSearchOptions,
  VariantSearchResult,
  NewCardVariantProposal,
} from '@/types/cardVariant';
import type { Modality, Device } from '@/types/smartDrawer';

// =============================================================================
// BUILTIN CARD VARIANTS
// =============================================================================

export const BUILTIN_CARD_VARIANTS: CardVariantDefinition[] = [
  // -------------------------------------------------------------------------
  // DESKTOP VARIANTS
  // -------------------------------------------------------------------------
  {
    id: 'hero',
    label: 'Hero',
    description: 'Large hero card, ideal for primary featured content',
    group: 'desktop',
    recommendedModality: ['read', 'watch'],
    recommendedDevices: ['desktop', 'tv'],
    density: 'single',
    aspectHint: 'wide',
    supportsAgents: false,
    supportsCarousels: false,
    supportsPricing: true,
    supportsTasks: false,
    componentName: 'SmartContentCard',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'heroShort',
    label: 'Hero Short',
    description: 'Compact hero card with less vertical space',
    group: 'desktop',
    recommendedModality: ['read', 'watch'],
    recommendedDevices: ['desktop', 'tv'],
    density: 'single',
    aspectHint: 'wide',
    supportsAgents: false,
    supportsCarousels: false,
    supportsPricing: true,
    supportsTasks: false,
    componentName: 'SmartContentCard',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'splash',
    label: 'Splash',
    description: 'Full-width splash banner for immersive content',
    group: 'desktop',
    recommendedModality: ['watch', 'read'],
    recommendedDevices: ['desktop', 'tv'],
    density: 'single',
    aspectHint: 'wide',
    supportsAgents: false,
    supportsCarousels: false,
    supportsPricing: true,
    supportsTasks: false,
    componentName: 'SmartContentCard',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'poster3',
    label: 'Poster 3-up',
    description: 'Three portrait posters per row, good for episodes and articles',
    group: 'desktop',
    recommendedModality: ['read', 'watch'],
    recommendedDevices: ['desktop'],
    density: 'grid-3',
    aspectHint: 'tall',
    supportsAgents: false,
    supportsCarousels: false,
    supportsPricing: true,
    supportsTasks: false,
    componentName: 'SmartContentCard',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'poster2',
    label: 'Poster 2-up',
    description: 'Two portrait posters per row, larger format',
    group: 'desktop',
    recommendedModality: ['read', 'watch'],
    recommendedDevices: ['desktop', 'tv'],
    density: 'grid-2',
    aspectHint: 'tall',
    supportsAgents: false,
    supportsCarousels: false,
    supportsPricing: true,
    supportsTasks: false,
    componentName: 'SmartContentCard',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'carousel3',
    label: 'Carousel 3',
    description: 'Horizontal scrolling carousel showing 3 items',
    group: 'shared',
    recommendedModality: ['read', 'watch', 'listen'],
    recommendedDevices: ['desktop', 'mobile'],
    density: 'grid-3',
    aspectHint: 'mixed',
    supportsAgents: false,
    supportsCarousels: true,
    supportsPricing: true,
    supportsTasks: false,
    componentName: 'SmartContentCard',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'carousel4',
    label: 'Carousel 4',
    description: 'Horizontal scrolling carousel showing 4 items',
    group: 'desktop',
    recommendedModality: ['read', 'watch', 'listen'],
    recommendedDevices: ['desktop'],
    density: 'grid-4',
    aspectHint: 'mixed',
    supportsAgents: false,
    supportsCarousels: true,
    supportsPricing: true,
    supportsTasks: false,
    componentName: 'SmartContentCard',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'thumbnail6',
    label: 'Thumbnail 6-up',
    description: 'Six small thumbnails per row, compact grid',
    group: 'desktop',
    recommendedModality: ['read', 'watch'],
    recommendedDevices: ['desktop'],
    density: 'grid-4',
    aspectHint: 'square',
    supportsAgents: false,
    supportsCarousels: false,
    supportsPricing: false,
    supportsTasks: false,
    componentName: 'SmartContentCard',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'thumbRect',
    label: 'Thumbnail Rectangle',
    description: 'Rectangular thumbnails, good for video content',
    group: 'desktop',
    recommendedModality: ['watch', 'listen'],
    recommendedDevices: ['desktop'],
    density: 'grid-3',
    aspectHint: 'wide',
    supportsAgents: false,
    supportsCarousels: false,
    supportsPricing: false,
    supportsTasks: false,
    componentName: 'SmartContentCard',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'thumbnailRect',
    label: 'Thumbnail Rectangle',
    description: 'Rectangular thumbnails, alias for thumbRect',
    group: 'desktop',
    recommendedModality: ['watch', 'listen'],
    recommendedDevices: ['desktop'],
    density: 'grid-3',
    aspectHint: 'wide',
    supportsAgents: false,
    supportsCarousels: false,
    supportsPricing: false,
    supportsTasks: false,
    componentName: 'SmartContentCard',
    baseVariantHint: 'thumbRect',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'compound',
    label: 'Compound',
    description: 'Complex layout combining hero with supporting items',
    group: 'desktop',
    recommendedModality: ['read', 'watch', 'interact'],
    recommendedDevices: ['desktop'],
    density: 'single',
    aspectHint: 'mixed',
    supportsAgents: true,
    supportsCarousels: false,
    supportsPricing: true,
    supportsTasks: false,
    componentName: 'SmartContentCard',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'compound1',
    label: 'Compound 1',
    description: 'Compound layout variant 1',
    group: 'desktop',
    recommendedModality: ['read', 'watch'],
    recommendedDevices: ['desktop'],
    density: 'single',
    aspectHint: 'mixed',
    supportsAgents: true,
    supportsCarousels: false,
    supportsPricing: true,
    supportsTasks: false,
    componentName: 'SmartContentCard',
    baseVariantHint: 'compound',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'compound2',
    label: 'Compound 2',
    description: 'Compound layout variant 2, good for codex/dynamic content',
    group: 'desktop',
    recommendedModality: ['read', 'interact'],
    recommendedDevices: ['desktop'],
    density: 'single',
    aspectHint: 'mixed',
    supportsAgents: true,
    supportsCarousels: false,
    supportsPricing: true,
    supportsTasks: true,
    componentName: 'SmartContentCard',
    baseVariantHint: 'compound',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'iframe',
    label: 'Iframe',
    description: 'Embedded iframe for external content, metavatars, or tools',
    group: 'shared',
    recommendedModality: ['interact', 'watch'],
    recommendedDevices: ['desktop', 'mobile'],
    density: 'single',
    aspectHint: 'wide',
    supportsAgents: true,
    supportsCarousels: false,
    supportsPricing: false,
    supportsTasks: false,
    componentName: 'SmartContentCard',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'featured',
    label: 'Featured',
    description: 'Featured content card with prominent styling',
    group: 'shared',
    recommendedModality: ['read', 'watch'],
    recommendedDevices: ['desktop', 'mobile'],
    density: 'single',
    aspectHint: 'wide',
    supportsAgents: false,
    supportsCarousels: false,
    supportsPricing: true,
    supportsTasks: false,
    componentName: 'SmartContentCard',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'standard',
    label: 'Standard',
    description: 'Standard content card, versatile default',
    group: 'shared',
    recommendedModality: ['read', 'watch', 'listen', 'interact'],
    recommendedDevices: ['desktop', 'mobile', 'tv'],
    density: 'single',
    aspectHint: 'mixed',
    supportsAgents: false,
    supportsCarousels: false,
    supportsPricing: true,
    supportsTasks: true,
    componentName: 'SmartContentCard',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'compact',
    label: 'Compact',
    description: 'Compact card for dense layouts',
    group: 'shared',
    recommendedModality: ['read', 'listen'],
    recommendedDevices: ['desktop', 'mobile'],
    density: 'list',
    aspectHint: 'wide',
    supportsAgents: false,
    supportsCarousels: false,
    supportsPricing: false,
    supportsTasks: true,
    componentName: 'SmartContentCard',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'contentWide',
    label: 'Content Wide',
    description: 'Wide content card spanning full width',
    group: 'desktop',
    recommendedModality: ['read', 'watch'],
    recommendedDevices: ['desktop', 'tv'],
    density: 'single',
    aspectHint: 'wide',
    supportsAgents: false,
    supportsCarousels: false,
    supportsPricing: true,
    supportsTasks: false,
    componentName: 'SmartContentCard',
    isBuiltin: true,
    componentImplemented: true,
  },

  // -------------------------------------------------------------------------
  // MOBILE VARIANTS
  // -------------------------------------------------------------------------
  {
    id: 'mobileHero',
    label: 'Mobile Hero',
    description: 'Hero card optimized for mobile screens',
    group: 'mobile',
    recommendedModality: ['read', 'watch'],
    recommendedDevices: ['mobile'],
    density: 'single',
    aspectHint: 'tall',
    supportsAgents: false,
    supportsCarousels: false,
    supportsPricing: true,
    supportsTasks: false,
    componentName: 'SmartContentCard',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'mobileFeat',
    label: 'Mobile Featured',
    description: 'Featured card for mobile',
    group: 'mobile',
    recommendedModality: ['read', 'watch'],
    recommendedDevices: ['mobile'],
    density: 'single',
    aspectHint: 'tall',
    supportsAgents: false,
    supportsCarousels: false,
    supportsPricing: true,
    supportsTasks: false,
    componentName: 'SmartContentCard',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'mobileFeatured',
    label: 'Mobile Featured',
    description: 'Featured card for mobile (alias)',
    group: 'mobile',
    recommendedModality: ['read', 'watch'],
    recommendedDevices: ['mobile'],
    density: 'single',
    aspectHint: 'tall',
    supportsAgents: false,
    supportsCarousels: false,
    supportsPricing: true,
    supportsTasks: false,
    componentName: 'SmartContentCard',
    baseVariantHint: 'mobileFeat',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'mobileSplit',
    label: 'Mobile Split',
    description: 'Split layout for mobile with image and text side by side',
    group: 'mobile',
    recommendedModality: ['read', 'interact'],
    recommendedDevices: ['mobile'],
    density: 'single',
    aspectHint: 'wide',
    supportsAgents: true,
    supportsCarousels: false,
    supportsPricing: true,
    supportsTasks: true,
    componentName: 'SmartContentCard',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'mobileCard',
    label: 'Mobile Card',
    description: 'Standard mobile card',
    group: 'mobile',
    recommendedModality: ['read', 'watch', 'listen'],
    recommendedDevices: ['mobile'],
    density: 'single',
    aspectHint: 'mixed',
    supportsAgents: false,
    supportsCarousels: false,
    supportsPricing: true,
    supportsTasks: true,
    componentName: 'SmartContentCard',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'mobileCards',
    label: 'Mobile Cards',
    description: 'Stacked mobile cards for lists',
    group: 'mobile',
    recommendedModality: ['read', 'interact'],
    recommendedDevices: ['mobile'],
    density: 'list',
    aspectHint: 'mixed',
    supportsAgents: false,
    supportsCarousels: false,
    supportsPricing: true,
    supportsTasks: true,
    componentName: 'SmartContentCard',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'mobileThumb',
    label: 'Mobile Thumbnail',
    description: 'Small thumbnail for mobile lists',
    group: 'mobile',
    recommendedModality: ['read', 'watch'],
    recommendedDevices: ['mobile'],
    density: 'list',
    aspectHint: 'square',
    supportsAgents: false,
    supportsCarousels: false,
    supportsPricing: false,
    supportsTasks: false,
    componentName: 'SmartContentCard',
    isBuiltin: true,
    componentImplemented: true,
  },

  // -------------------------------------------------------------------------
  // WALLET-SPECIFIC VARIANTS
  // -------------------------------------------------------------------------
  {
    id: 'walletOverview',
    label: 'Wallet Overview',
    description: 'Overview card for wallet balances and quick actions',
    group: 'shared',
    recommendedModality: ['interact'],
    recommendedDevices: ['desktop', 'mobile'],
    density: 'single',
    aspectHint: 'wide',
    supportsAgents: false,
    supportsCarousels: false,
    supportsPricing: true,
    supportsTasks: true,
    componentName: 'SmartContentCard',
    baseVariantHint: 'standard',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'walletTasksList',
    label: 'Wallet Tasks List',
    description: 'List layout for wallet tasks and rewards',
    group: 'shared',
    recommendedModality: ['interact'],
    recommendedDevices: ['desktop', 'mobile'],
    density: 'list',
    aspectHint: 'mixed',
    supportsAgents: false,
    supportsCarousels: false,
    supportsPricing: true,
    supportsTasks: true,
    componentName: 'SmartContentCard',
    baseVariantHint: 'mobileCards',
    isBuiltin: true,
    componentImplemented: true,
  },
  {
    id: 'walletTimeline',
    label: 'Wallet Timeline',
    description: 'Timeline view for entitlements and transaction history',
    group: 'shared',
    recommendedModality: ['interact', 'read'],
    recommendedDevices: ['desktop', 'mobile'],
    density: 'list',
    aspectHint: 'wide',
    supportsAgents: false,
    supportsCarousels: false,
    supportsPricing: true,
    supportsTasks: false,
    componentName: 'SmartContentCard',
    baseVariantHint: 'compact',
    isBuiltin: true,
    componentImplemented: true,
  },
];

// =============================================================================
// REGISTRY CLASS
// =============================================================================

class CardVariantRegistry {
  private variants: Map<string, CardVariantDefinition> = new Map();
  private customVariants: CardVariantDefinition[] = [];

  constructor() {
    // Load builtin variants
    for (const variant of BUILTIN_CARD_VARIANTS) {
      this.variants.set(variant.id, variant);
    }
  }

  /**
   * Get variant by ID
   */
  getVariantById(id: string): CardVariantDefinition | undefined {
    return this.variants.get(id);
  }

  /**
   * List all variants
   */
  listVariants(): CardVariantDefinition[] {
    return Array.from(this.variants.values());
  }

  /**
   * List builtin variants only
   */
  listBuiltinVariants(): CardVariantDefinition[] {
    return BUILTIN_CARD_VARIANTS;
  }

  /**
   * List custom variants only
   */
  listCustomVariants(): CardVariantDefinition[] {
    return this.customVariants;
  }

  /**
   * Add custom variants (from database)
   */
  addCustomVariants(variants: CardVariantDefinition[]): void {
    for (const variant of variants) {
      this.variants.set(variant.id, variant);
      this.customVariants.push(variant);
    }
  }

  /**
   * Register a new variant from proposal
   */
  registerVariant(proposal: NewCardVariantProposal, createdBy?: string): CardVariantDefinition {
    const componentName = `SmartContentCard${this.toPascalCase(proposal.id)}`;
    
    const definition: CardVariantDefinition = {
      ...proposal,
      componentName,
      isBuiltin: false,
      componentImplemented: false,
    };

    this.variants.set(definition.id, definition);
    this.customVariants.push(definition);

    return definition;
  }

  /**
   * Find best variant for given options
   */
  findBestVariant(opts: VariantSearchOptions): VariantSearchResult | null {
    const candidates: VariantSearchResult[] = [];

    for (const variant of this.variants.values()) {
      const score = this.scoreVariant(variant, opts);
      if (score > 0) {
        candidates.push({ variant, score });
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
  }

  /**
   * Find closest base variant for new variant creation
   */
  findClosestBase(opts: { modality: Modality; device: Device; useCase?: string }): CardVariantId {
    const result = this.findBestVariant({
      modality: opts.modality,
      device: opts.device,
      useCase: opts.useCase as any,
    });

    if (result) {
      return result.variant.id as CardVariantId;
    }

    // Fallback to standard
    return 'standard';
  }

  /**
   * Get variants suitable for a specific use case
   */
  getVariantsForUseCase(useCase: string): CardVariantDefinition[] {
    return Array.from(this.variants.values()).filter((v) => {
      switch (useCase) {
        case 'agent':
          return v.supportsAgents === true;
        case 'wallet':
        case 'tasks':
          return v.supportsTasks === true || v.supportsPricing === true;
        case 'hero':
          return v.density === 'single' && v.aspectHint === 'wide';
        case 'grid':
          return v.density?.startsWith('grid-');
        case 'thumbnails':
          return v.id.includes('thumb') || v.id.includes('Thumb');
        default:
          return true;
      }
    });
  }

  /**
   * Get variants for a specific device
   */
  getVariantsForDevice(device: Device): CardVariantDefinition[] {
    return Array.from(this.variants.values()).filter((v) =>
      v.recommendedDevices.includes(device)
    );
  }

  /**
   * Get variants for a specific modality
   */
  getVariantsForModality(modality: Modality): CardVariantDefinition[] {
    return Array.from(this.variants.values()).filter((v) =>
      v.recommendedModality.includes(modality)
    );
  }

  // -------------------------------------------------------------------------
  // PRIVATE HELPERS
  // -------------------------------------------------------------------------

  private scoreVariant(variant: CardVariantDefinition, opts: VariantSearchOptions): number {
    let score = 0;

    // Modality match (high weight)
    if (variant.recommendedModality.includes(opts.modality)) {
      score += 30;
    }

    // Device match (high weight)
    if (variant.recommendedDevices.includes(opts.device)) {
      score += 30;
    }

    // Use case match
    if (opts.useCase) {
      switch (opts.useCase) {
        case 'agent':
          if (variant.supportsAgents) score += 25;
          break;
        case 'wallet':
        case 'tasks':
          if (variant.supportsTasks) score += 20;
          if (variant.supportsPricing) score += 15;
          break;
        case 'hero':
          if (variant.density === 'single' && variant.aspectHint === 'wide') score += 25;
          break;
        case 'grid':
          if (variant.density?.startsWith('grid-')) score += 25;
          break;
        case 'thumbnails':
          if (variant.id.includes('thumb') || variant.id.includes('Thumb')) score += 25;
          break;
        case 'codex':
          if (variant.supportsAgents || variant.id.includes('compound')) score += 20;
          break;
      }
    }

    // Content hints match
    if (opts.contentHints?.preferredModal) {
      if (variant.id === opts.contentHints.preferredModal) {
        score += 40; // Strong preference for content's own hint
      }
    }

    if (opts.contentHints?.aspectRatio && variant.aspectHint === opts.contentHints.aspectRatio) {
      score += 10;
    }

    // Group match (shared variants get a small bonus)
    if (variant.group === 'shared') {
      score += 5;
    }

    // Prefer implemented components
    if (variant.componentImplemented) {
      score += 5;
    }

    return score;
  }

  private toPascalCase(str: string): string {
    return str
      .split(/[-_\s]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const cardVariantRegistry = new CardVariantRegistry();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get variant definition by ID
 */
export function getVariantById(id: string): CardVariantDefinition | undefined {
  return cardVariantRegistry.getVariantById(id);
}

/**
 * Find best variant for options
 */
export function findBestVariant(opts: VariantSearchOptions): VariantSearchResult | null {
  return cardVariantRegistry.findBestVariant(opts);
}

/**
 * Find closest base variant for new variant creation
 */
export function findClosestBase(opts: { modality: Modality; device: Device; useCase?: string }): CardVariantId {
  return cardVariantRegistry.findClosestBase(opts);
}

/**
 * List all variants
 */
export function listVariants(): CardVariantDefinition[] {
  return cardVariantRegistry.listVariants();
}
