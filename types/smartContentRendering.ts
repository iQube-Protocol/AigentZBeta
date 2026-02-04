/**
 * SmartContent Rendering System v1.0
 * 
 * Defines how SmartContent items should render their action icons
 * across all content types, variants, and contexts.
 * 
 * This is the canonical source for Copilot template composition
 * and ensures consistent SmartContentActions across the SmartTriad system.
 */

// =============================================================================
// CONTENT DISPLAY VARIANTS
// =============================================================================

/**
 * All supported content display variants across SmartTriad
 * These map to specific rendering behaviors for SmartContentActions
 */
export type SmartContentVariant =
  // Card variants (main app)
  | 'compact'        // List row - library style
  | 'standard'       // Grid card - 3-4 per row
  | 'featured'       // Large card with details
  | 'hero'           // Full-width splash (66vh or 100vh)
  | 'carousel4'      // 4 per row - narrow thumbnails
  | 'carousel3'      // 3.25 per row - with description
  | 'thumbnail6'     // 6+ per row - small squares
  | 'thumbnailRect'  // 6+ per row - short rectangles
  | 'poster2'        // 2 per row - large posters
  | 'poster3'        // 3 per row - tall portrait
  | 'compound'       // Multi-section with links
  | 'iframe'         // Iframe embed
  | 'contentWide'    // 2-column content container
  // Mobile variants
  | 'mobileHero'     // Mobile hero - full width portrait
  | 'mobileFeatured' // Mobile featured - title overlay
  | 'mobileSplit'    // Mobile split - iframe + article
  | 'mobileCard'     // Mobile card - thumb + icons + desc
  | 'mobileThumb'    // Mobile thumbnail - carousel thumbs
  // Qriptopian/Liquid UI variants
  | 'drawerViewer'   // Main viewer in drawer (SmartContentViewer)
  | 'drawerThumbnail'// Thumbnail in drawer carousel
  | 'heroSection'    // Home page hero
  | 'newsCard'       // Latest news carousel card
  | 'scrollItem'     // Scrolls drawer item
  | 'kn0wdzItem';    // Kn0wdZ drawer item

// =============================================================================
// ACTION DISPLAY CONTEXTS
// =============================================================================

/**
 * Context where SmartContentActions are displayed
 * Affects which actions are shown and their styling
 */
export type SmartContentContext =
  | 'thumbnail'      // Small thumbnail - minimal actions, expand available
  | 'card'           // Card view - standard actions
  | 'poster'         // Poster view - prominent actions
  | 'hero'           // Hero section - large actions
  | 'drawer'         // Drawer viewer - full actions
  | 'fullscreen'     // Fullscreen mode - all actions
  | 'modal'          // Modal view - contextual actions
  | 'inline';        // Inline in content - minimal actions

// =============================================================================
// ACTION TYPES
// =============================================================================

/**
 * All possible SmartContent actions
 */
export type SmartContentAction =
  | 'read'           // Open text reader
  | 'watch'          // Play video
  | 'listen'         // Play audio
  | 'interact'       // Start agent chat
  | 'link'           // Open external URL
  | 'expand'         // Expand to larger view
  | 'share'          // Share content
  | 'bookmark'       // Add to library
  | 'purchase'       // Buy/unlock content
  | 'download';      // Download for offline

// =============================================================================
// MODALITIES INTERFACE
// =============================================================================

/**
 * Content modalities with availability flags and URLs
 * This is the canonical interface for modality checking
 */
export interface SmartContentModalities {
  read?: {
    available: boolean;
    text?: string;
    duration?: string;
    wordCount?: number;
  };
  watch?: {
    available: boolean;
    video_url?: string;
    duration?: string;
    thumbnail?: string;
  };
  listen?: {
    available: boolean;
    audio_url?: string;
    duration?: string;
  };
  interact?: {
    available: boolean;
    agent_id?: string;
    context_prompt?: string;
  };
  link?: {
    available: boolean;
    url?: string;
    label?: string;
  };
}

// =============================================================================
// RENDERING CONTRACT
// =============================================================================

/**
 * Defines how SmartContentActions should render for a given variant/context
 */
export interface SmartContentActionsContract {
  /** Which actions to show based on available modalities */
  showModalities: boolean;
  /** Show expand action (for thumbnails) */
  showExpand: boolean;
  /** Show share action */
  showShare: boolean;
  /** Show bookmark action */
  showBookmark: boolean;
  /** Show purchase action (if not owned) */
  showPurchase: boolean;
  /** Action icon size */
  size: 'xs' | 'sm' | 'md' | 'lg';
  /** Position of actions overlay */
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center' | 'inline';
  /** Show on hover only */
  hoverOnly: boolean;
  /** Show labels with icons */
  showLabels: boolean;
  /** Maximum number of modality icons to show */
  maxModalityIcons: number;
}

// =============================================================================
// VARIANT RENDERING CONTRACTS
// =============================================================================

/**
 * Default rendering contracts for each variant
 * Copilot uses these to compose templates correctly
 */
export const VARIANT_CONTRACTS: Record<SmartContentVariant, SmartContentActionsContract> = {
  // Card variants
  compact: {
    showModalities: true,
    showExpand: false,
    showShare: false,
    showBookmark: false,
    showPurchase: false,
    size: 'xs',
    position: 'inline',
    hoverOnly: false,
    showLabels: false,
    maxModalityIcons: 2,
  },
  standard: {
    showModalities: true,
    showExpand: false,
    showShare: true,
    showBookmark: true,
    showPurchase: true,
    size: 'sm',
    position: 'bottom-right',
    hoverOnly: true,
    showLabels: false,
    maxModalityIcons: 4,
  },
  featured: {
    showModalities: true,
    showExpand: false,
    showShare: true,
    showBookmark: true,
    showPurchase: true,
    size: 'md',
    position: 'bottom-right',
    hoverOnly: false,
    showLabels: true,
    maxModalityIcons: 4,
  },
  hero: {
    showModalities: true,
    showExpand: false,
    showShare: true,
    showBookmark: true,
    showPurchase: true,
    size: 'lg',
    position: 'inline',
    hoverOnly: false,
    showLabels: true,
    maxModalityIcons: 4,
  },
  carousel4: {
    showModalities: true,
    showExpand: true,
    showShare: false,
    showBookmark: false,
    showPurchase: false,
    size: 'xs',
    position: 'bottom-right',
    hoverOnly: true,
    showLabels: false,
    maxModalityIcons: 2,
  },
  carousel3: {
    showModalities: true,
    showExpand: true,
    showShare: true,
    showBookmark: false,
    showPurchase: false,
    size: 'sm',
    position: 'bottom-right',
    hoverOnly: true,
    showLabels: false,
    maxModalityIcons: 3,
  },
  thumbnail6: {
    showModalities: true,
    showExpand: true,
    showShare: false,
    showBookmark: false,
    showPurchase: false,
    size: 'xs',
    position: 'bottom-left',
    hoverOnly: true,
    showLabels: false,
    maxModalityIcons: 2,
  },
  thumbnailRect: {
    showModalities: true,
    showExpand: true,
    showShare: false,
    showBookmark: false,
    showPurchase: false,
    size: 'xs',
    position: 'bottom-left',
    hoverOnly: true,
    showLabels: false,
    maxModalityIcons: 2,
  },
  poster2: {
    showModalities: true,
    showExpand: false,
    showShare: true,
    showBookmark: true,
    showPurchase: true,
    size: 'md',
    position: 'top-right',
    hoverOnly: false,
    showLabels: false,
    maxModalityIcons: 4,
  },
  poster3: {
    showModalities: true,
    showExpand: false,
    showShare: true,
    showBookmark: true,
    showPurchase: true,
    size: 'md',
    position: 'top-right',
    hoverOnly: false,
    showLabels: false,
    maxModalityIcons: 4,
  },
  compound: {
    showModalities: true,
    showExpand: false,
    showShare: true,
    showBookmark: true,
    showPurchase: true,
    size: 'sm',
    position: 'inline',
    hoverOnly: false,
    showLabels: true,
    maxModalityIcons: 4,
  },
  iframe: {
    showModalities: true,
    showExpand: true,
    showShare: false,
    showBookmark: false,
    showPurchase: false,
    size: 'sm',
    position: 'top-right',
    hoverOnly: false,
    showLabels: false,
    maxModalityIcons: 4,
  },
  contentWide: {
    showModalities: true,
    showExpand: true,
    showShare: true,
    showBookmark: true,
    showPurchase: true,
    size: 'md',
    position: 'bottom-right',
    hoverOnly: false,
    showLabels: true,
    maxModalityIcons: 4,
  },
  // Mobile variants
  mobileHero: {
    showModalities: true,
    showExpand: false,
    showShare: true,
    showBookmark: true,
    showPurchase: true,
    size: 'lg',
    position: 'inline',
    hoverOnly: false,
    showLabels: false,
    maxModalityIcons: 4,
  },
  mobileFeatured: {
    showModalities: true,
    showExpand: false,
    showShare: true,
    showBookmark: false,
    showPurchase: true,
    size: 'md',
    position: 'bottom-left',
    hoverOnly: false,
    showLabels: false,
    maxModalityIcons: 3,
  },
  mobileSplit: {
    showModalities: true,
    showExpand: false,
    showShare: true,
    showBookmark: true,
    showPurchase: true,
    size: 'md',
    position: 'inline',
    hoverOnly: false,
    showLabels: true,
    maxModalityIcons: 4,
  },
  mobileCard: {
    showModalities: true,
    showExpand: false,
    showShare: true,
    showBookmark: false,
    showPurchase: false,
    size: 'sm',
    position: 'inline',
    hoverOnly: false,
    showLabels: false,
    maxModalityIcons: 4,
  },
  mobileThumb: {
    showModalities: true,
    showExpand: true,
    showShare: false,
    showBookmark: false,
    showPurchase: false,
    size: 'xs',
    position: 'bottom-right',
    hoverOnly: true,
    showLabels: false,
    maxModalityIcons: 2,
  },
  // Qriptopian/Liquid UI variants
  drawerViewer: {
    showModalities: true,
    showExpand: true,
    showShare: true,
    showBookmark: true,
    showPurchase: true,
    size: 'md',
    position: 'bottom-right',
    hoverOnly: false,
    showLabels: false,
    maxModalityIcons: 4,
  },
  drawerThumbnail: {
    showModalities: true,
    showExpand: true,
    showShare: false,
    showBookmark: false,
    showPurchase: false,
    size: 'sm',
    position: 'bottom-right',
    hoverOnly: true,
    showLabels: false,
    maxModalityIcons: 3,
  },
  heroSection: {
    showModalities: true,
    showExpand: false,
    showShare: true,
    showBookmark: false,
    showPurchase: false,
    size: 'lg',
    position: 'inline',
    hoverOnly: false,
    showLabels: false,
    maxModalityIcons: 4,
  },
  newsCard: {
    showModalities: true,
    showExpand: false,
    showShare: true,
    showBookmark: false,
    showPurchase: false,
    size: 'sm',
    position: 'top-right',
    hoverOnly: false,
    showLabels: false,
    maxModalityIcons: 3,
  },
  scrollItem: {
    showModalities: true,
    showExpand: true,
    showShare: true,
    showBookmark: false,
    showPurchase: false,
    size: 'sm',
    position: 'bottom-right',
    hoverOnly: true,
    showLabels: false,
    maxModalityIcons: 3,
  },
  kn0wdzItem: {
    showModalities: true,
    showExpand: true,
    showShare: false,
    showBookmark: false,
    showPurchase: false,
    size: 'sm',
    position: 'bottom-right',
    hoverOnly: true,
    showLabels: false,
    maxModalityIcons: 3,
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if content has playable video
 */
export function hasPlayableContent(modalities?: SmartContentModalities | null): boolean {
  return !!(modalities?.watch?.available && modalities?.watch?.video_url);
}

/**
 * Check if content has readable text
 */
export function hasReadableContent(modalities?: SmartContentModalities | null): boolean {
  return !!(modalities?.read?.available && modalities?.read?.text);
}

/**
 * Check if content has listenable audio
 */
export function hasListenableContent(modalities?: SmartContentModalities | null): boolean {
  return !!(modalities?.listen?.available && modalities?.listen?.audio_url);
}

/**
 * Check if content has interactive agent
 */
export function hasInteractiveContent(modalities?: SmartContentModalities | null): boolean {
  return !!(modalities?.interact?.available && modalities?.interact?.agent_id);
}

/**
 * Check if content has external link
 */
export function hasLinkContent(modalities?: SmartContentModalities | null): boolean {
  return !!(modalities?.link?.available && modalities?.link?.url);
}

/**
 * Get available actions based on modalities
 */
export function getAvailableActions(modalities?: SmartContentModalities | null): SmartContentAction[] {
  const actions: SmartContentAction[] = [];
  
  if (hasReadableContent(modalities)) actions.push('read');
  if (hasPlayableContent(modalities)) actions.push('watch');
  if (hasListenableContent(modalities)) actions.push('listen');
  if (hasInteractiveContent(modalities)) actions.push('interact');
  if (hasLinkContent(modalities)) actions.push('link');
  
  return actions;
}

/**
 * Get primary action for content (first available)
 */
export function getPrimaryAction(modalities?: SmartContentModalities | null): SmartContentAction | null {
  // Priority: watch > read > listen > interact > link
  if (hasPlayableContent(modalities)) return 'watch';
  if (hasReadableContent(modalities)) return 'read';
  if (hasListenableContent(modalities)) return 'listen';
  if (hasInteractiveContent(modalities)) return 'interact';
  if (hasLinkContent(modalities)) return 'link';
  return null;
}

/**
 * Get rendering contract for a variant
 */
export function getVariantContract(variant: SmartContentVariant): SmartContentActionsContract {
  return VARIANT_CONTRACTS[variant] || VARIANT_CONTRACTS.standard;
}

/**
 * Determine which actions to display based on variant and modalities
 */
export function getDisplayActions(
  variant: SmartContentVariant,
  modalities?: SmartContentModalities | null,
  options?: {
    isOwned?: boolean;
    showExpand?: boolean;
    showShare?: boolean;
  }
): SmartContentAction[] {
  const contract = getVariantContract(variant);
  const actions: SmartContentAction[] = [];
  
  // Add modality-based actions
  if (contract.showModalities) {
    const available = getAvailableActions(modalities);
    actions.push(...available.slice(0, contract.maxModalityIcons));
  }
  
  // Add contextual actions
  if (contract.showExpand || options?.showExpand) actions.push('expand');
  if (contract.showShare || options?.showShare) actions.push('share');
  if (contract.showBookmark) actions.push('bookmark');
  if (contract.showPurchase && !options?.isOwned) actions.push('purchase');
  
  return actions;
}
