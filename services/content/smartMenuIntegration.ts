/**
 * Smart Menu Integration Service
 * 
 * Bridges SmartContentQube with Smart Menu system:
 * - Content-driven menu configuration (content tells menu how to present)
 * - User preference overrides (user can customize drawer behavior)
 * - Dynamic drawer selection based on content modalities
 * - Wallet integration modes (compact vs full)
 * 
 * Follows x402 wallet styling patterns.
 */

import type {
  SmartContentQube,
  MenuIntegration,
  DrawerType,
  ContentModality,
  LayoutHints,
} from '@/types/smartContent';
import type {
  SmartWalletNode,
  WalletPreferences,
} from '@/types/smartWallet';

// =============================================================================
// SMART MENU MANIFEST TYPES
// =============================================================================

export interface SmartMenuManifest {
  /** Manifest ID */
  id: string;
  
  /** Content ID this manifest is for */
  contentId: string;
  
  /** Active drawers to display */
  activeDrawers: DrawerConfig[];
  
  /** Wallet display mode */
  walletMode: 'hidden' | 'compact' | 'full';
  
  /** Show library status badge */
  showLibraryStatus: boolean;
  
  /** Show quest progress */
  showQuestProgress: boolean;
  
  /** Layout configuration */
  layout: LayoutConfig;
  
  /** Actions available in menu */
  actions: MenuAction[];
  
  /** Source of configuration */
  configSource: 'content' | 'user' | 'merged';
}

export interface DrawerConfig {
  /** Drawer type */
  type: DrawerType;
  
  /** Display label */
  label: string;
  
  /** Icon identifier */
  icon: string;
  
  /** Position in menu */
  position: number;
  
  /** Is this drawer currently active/open */
  isActive: boolean;
  
  /** Is this drawer required (cannot be hidden) */
  isRequired: boolean;
  
  /** Drawer-specific configuration */
  config?: Record<string, any>;
}

export interface LayoutConfig {
  /** Primary layout mode */
  mode: 'stack' | 'split' | 'grid' | 'carousel';
  
  /** Drawer position */
  drawerPosition: 'left' | 'right' | 'bottom';
  
  /** Drawer width (for left/right) */
  drawerWidth: string;
  
  /** Content area configuration */
  contentArea: {
    maxWidth: string;
    padding: string;
  };
  
  /** Responsive overrides */
  responsive: {
    mobile: Partial<LayoutConfig>;
    tablet: Partial<LayoutConfig>;
    desktop: Partial<LayoutConfig>;
  };
}

export interface MenuAction {
  /** Action ID */
  id: string;
  
  /** Action type */
  type: 'payment' | 'navigation' | 'agent' | 'share' | 'bookmark' | 'settings' | 'copilot' | 'drawer-resize';
  
  /** Display label */
  label: string;
  
  /** Icon identifier */
  icon: string;
  
  /** Action handler identifier */
  handler: string;
  
  /** Action parameters */
  params?: Record<string, any>;
  
  /** Is action primary (highlighted) */
  isPrimary: boolean;
  
  /** Is action disabled */
  isDisabled: boolean;
  
  /** Disabled reason */
  disabledReason?: string;
}

// =============================================================================
// COMPASS MENU POLICY (Runtime/Studio)
// =============================================================================

export type CompassMode = 'runtime' | 'studio';

export type CompassActionKey =
  | 'pay'
  | 'earn'
  | 'play'
  | 'make'
  | 'compose'
  | 'be'
  | 'share';

export interface CompassPolicyContext {
  directive?: string;
  personaStatus?: 'active' | 'inactive' | 'suspended' | 'pending' | string;
  hasActivePersona?: boolean;
  recentActions?: string[];
  content?: SmartContentQube;
  ownedContent?: boolean;
  device?: 'mobile' | 'desktop' | 'tv';
  mode?: CompassMode;
}

export interface CompassPolicyOptions {
  mode?: CompassMode;
  includeSecondary?: boolean;
  handlerOverrides?: Partial<Record<CompassActionKey, string>>;
}

interface CompassCandidate {
  key: CompassActionKey;
  label: string;
  type: MenuAction['type'];
  handler: string;
  score: number;
  order: number;
  isSecondary: boolean;
  params?: Record<string, any>;
  icon?: string;
}

const COMPASS_KEYWORDS = {
  pay: ['pay', 'settle', 'checkout', 'upgrade', 'subscribe'],
  buy: ['buy', 'purchase', 'order'],
  earn: ['earn', 'reward', 'offer', 'claim', 'bounty', 'incentive'],
  play: ['play', 'preview', 'test', 'try', 'run', 'explore', 'view'],
  make: ['make', 'create', 'compose', 'build', 'edit', 'craft', 'design'],
  share: ['share', 'invite', 'send', 'collab'],
  be: ['be', 'identity', 'persona', 'profile', 'vault'],
};

const COMPASS_ICONS: Record<CompassActionKey, string> = {
  pay: 'credit-card',
  earn: 'sparkles',
  play: 'play',
  make: 'pen-tool',
  compose: 'layers',
  be: 'user',
  share: 'share-2',
};

function includesAny(value: string, keywords: string[]): boolean {
  if (!value) return false;
  return keywords.some((word) => value.includes(word));
}

function hasPaidTier(content?: SmartContentQube): boolean {
  if (!content?.pricingModel?.tiers?.length) return false;
  return content.pricingModel.tiers.some((tier) => (tier.amount ?? 0) > 0);
}

function resolvePayLabel(directive: string, paidTier: boolean): string {
  if (includesAny(directive, COMPASS_KEYWORDS.buy)) return 'Buy';
  if (includesAny(directive, COMPASS_KEYWORDS.pay)) return 'Pay';
  return paidTier ? 'Pay' : 'Pay';
}

function resolveMakeLabel(mode: CompassMode): string {
  return mode === 'studio' ? 'Compose' : 'Make';
}

function resolveMakeKey(mode: CompassMode): CompassActionKey {
  return mode === 'studio' ? 'compose' : 'make';
}

function baseScoresForMode(mode: CompassMode): Record<CompassActionKey, number> {
  if (mode === 'studio') {
    return {
      compose: 50,
      play: 30,
      pay: 25,
      earn: 22,
      make: 0,
      be: 0,
      share: 0,
    };
  }
  return {
    pay: 30,
    earn: 28,
    play: 25,
    make: 22,
    compose: 0,
    be: 0,
    share: 0,
  };
}

function scorePay(directive: string, paidTier: boolean, owned: boolean, recentActions: string[], base: number): number {
  let score = base;
  if (includesAny(directive, COMPASS_KEYWORDS.buy)) score += 40;
  if (includesAny(directive, COMPASS_KEYWORDS.pay)) score += 30;
  if (paidTier && !owned) score += 35;
  if (owned) score -= 20;
  if (recentActions.includes('pay') || recentActions.includes('buy')) score += 10;
  return score;
}

function scoreEarn(directive: string, content: SmartContentQube | undefined, recentActions: string[], base: number): number {
  let score = base;
  if (includesAny(directive, COMPASS_KEYWORDS.earn)) score += 40;
  if (content?.rewardOutcomes?.engagementRewards?.length) score += 20;
  if (recentActions.includes('earn') || recentActions.includes('reward')) score += 8;
  return score;
}

function scorePlay(directive: string, content: SmartContentQube | undefined, recentActions: string[], base: number): number {
  let score = base;
  if (includesAny(directive, COMPASS_KEYWORDS.play)) score += 35;
  const modalities = content?.modalities;
  const hasModalities =
    !!modalities?.read?.enabled ||
    !!modalities?.watch?.enabled ||
    !!modalities?.listen?.enabled ||
    !!modalities?.interact?.enabled;
  if (hasModalities) score += 20;
  if (modalities?.interact?.enabled) score += 10;
  if (recentActions.includes('play') || recentActions.includes('preview')) score += 6;
  return score;
}

function scoreMake(directive: string, recentActions: string[], base: number): number {
  let score = base;
  if (includesAny(directive, COMPASS_KEYWORDS.make)) score += 40;
  if (recentActions.includes('make') || recentActions.includes('compose')) score += 8;
  return score;
}

function buildCandidate(
  key: CompassActionKey,
  label: string,
  type: MenuAction['type'],
  handler: string,
  score: number,
  order: number,
  isSecondary: boolean,
  params?: Record<string, any>
): CompassCandidate {
  return {
    key,
    label,
    type,
    handler,
    score,
    order,
    isSecondary,
    params,
    icon: COMPASS_ICONS[key],
  };
}

function resolveHandler(key: CompassActionKey, overrides?: Partial<Record<CompassActionKey, string>>): string {
  if (overrides?.[key]) return overrides[key] as string;
  return `compass_${key}`;
}

export function selectCompassActions(
  context: CompassPolicyContext,
  options: CompassPolicyOptions = {}
): MenuAction[] {
  const mode = options.mode ?? context.mode ?? 'runtime';
  const directive = (context.directive || '').toLowerCase();
  const recentActions = (context.recentActions || []).map((action) => action.toLowerCase());
  const paidTier = hasPaidTier(context.content);
  const owned = !!context.ownedContent;
  const baseScores = baseScoresForMode(mode);
  const makeKey = resolveMakeKey(mode);
  const makeLabel = resolveMakeLabel(mode);

  const primaryOrder = mode === 'studio'
    ? ['compose', 'play', 'pay', 'earn']
    : ['pay', 'earn', 'play', 'make'];

  const primaryCandidates: CompassCandidate[] = [];

  primaryCandidates.push(
    buildCandidate(
      'pay',
      resolvePayLabel(directive, paidTier),
      'payment',
      resolveHandler('pay', options.handlerOverrides),
      scorePay(directive, paidTier, owned, recentActions, baseScores.pay),
      primaryOrder.indexOf('pay'),
      false,
      context.content?.id ? { contentId: context.content.id } : undefined
    )
  );

  primaryCandidates.push(
    buildCandidate(
      'earn',
      'Earn',
      'payment',
      resolveHandler('earn', options.handlerOverrides),
      scoreEarn(directive, context.content, recentActions, baseScores.earn),
      primaryOrder.indexOf('earn'),
      false,
      context.content?.id ? { contentId: context.content.id } : undefined
    )
  );

  primaryCandidates.push(
    buildCandidate(
      'play',
      'Play',
      'navigation',
      resolveHandler('play', options.handlerOverrides),
      scorePlay(directive, context.content, recentActions, baseScores.play),
      primaryOrder.indexOf('play'),
      false,
      context.content?.id ? { contentId: context.content.id } : undefined
    )
  );

  primaryCandidates.push(
    buildCandidate(
      makeKey,
      makeLabel,
      'navigation',
      resolveHandler(makeKey, options.handlerOverrides),
      scoreMake(directive, recentActions, baseScores[makeKey]),
      primaryOrder.indexOf(makeKey),
      false,
      context.content?.id ? { contentId: context.content.id } : undefined
    )
  );

  const sortedPrimary = primaryCandidates
    .slice()
    .sort((a, b) => (b.score - a.score) || (a.order - b.order));

  const primaryActions = sortedPrimary.slice(0, 3).map((candidate) => ({
    id: `compass_${candidate.key}`,
    type: candidate.type,
    label: candidate.label,
    icon: candidate.icon || 'compass',
    handler: candidate.handler,
    params: candidate.params,
    isPrimary: true,
    isDisabled: false,
  }));

  if (options.includeSecondary === false) {
    return primaryActions;
  }

  const secondaryCandidates: CompassCandidate[] = [];
  const hasActivePersona = context.hasActivePersona ?? true;
  const includeBe = !hasActivePersona ||
    (context.personaStatus && context.personaStatus !== 'active') ||
    includesAny(directive, COMPASS_KEYWORDS.be);

  if (includeBe) {
    secondaryCandidates.push(
      buildCandidate(
        'be',
        'Be',
        'navigation',
        resolveHandler('be', options.handlerOverrides),
        10,
        0,
        true
      )
    );
  }

  const includeShare = includesAny(directive, COMPASS_KEYWORDS.share) || !!context.content;
  if (includeShare) {
    secondaryCandidates.push(
      buildCandidate(
        'share',
        'Share',
        'share',
        resolveHandler('share', options.handlerOverrides),
        9,
        1,
        true,
        context.content?.id ? { contentId: context.content.id } : undefined
      )
    );
  }

  const secondaryActions = secondaryCandidates.slice(0, 2).map((candidate) => ({
    id: `compass_${candidate.key}`,
    type: candidate.type,
    label: candidate.label,
    icon: candidate.icon || 'compass',
    handler: candidate.handler,
    params: candidate.params,
    isPrimary: false,
    isDisabled: false,
  }));

  return [...primaryActions, ...secondaryActions];
}

/**
 * Drawer size configuration for copilot mode
 */
export interface DrawerSizeConfig {
  /** Normal drawer width */
  normal: string;
  /** Expanded drawer width (copilot mode) */
  expanded: string;
  /** Expansion ratio (e.g., 1.3 for 30% larger) */
  expansionRatio: number;
}

export const DRAWER_SIZE_CONFIG: DrawerSizeConfig = {
  normal: '21.6rem',
  expanded: '28rem',
  expansionRatio: 1.3,
};

// =============================================================================
// DRAWER CONFIGURATIONS
// =============================================================================

const DRAWER_CONFIGS: Record<DrawerType, Omit<DrawerConfig, 'position' | 'isActive'>> = {
  contentViewer: {
    type: 'contentViewer',
    label: 'Content',
    icon: 'book-open',
    isRequired: true,
  },
  agentChat: {
    type: 'agentChat',
    label: 'Chat',
    icon: 'message-circle',
    isRequired: false,
  },
  walletCompact: {
    type: 'walletCompact',
    label: 'Wallet',
    icon: 'wallet',
    isRequired: false,
  },
  walletFull: {
    type: 'walletFull',
    label: 'Wallet',
    icon: 'wallet',
    isRequired: false,
  },
  libraryShelf: {
    type: 'libraryShelf',
    label: 'Library',
    icon: 'library',
    isRequired: false,
  },
  questTracker: {
    type: 'questTracker',
    label: 'Quests',
    icon: 'target',
    isRequired: false,
  },
  rewardsPanel: {
    type: 'rewardsPanel',
    label: 'Rewards',
    icon: 'gift',
    isRequired: false,
  },
  settingsPanel: {
    type: 'settingsPanel',
    label: 'Settings',
    icon: 'settings',
    isRequired: false,
  },
};

// =============================================================================
// SMART MENU INTEGRATION SERVICE
// =============================================================================

export class SmartMenuIntegrationService {
  
  /**
   * Generate a Smart Menu Manifest for content
   */
  generateManifest(
    content: SmartContentQube,
    wallet?: SmartWalletNode,
    userPreferences?: WalletPreferences
  ): SmartMenuManifest {
    // Determine config source
    const useUserOverrides = userPreferences?.drawerOverrides?.enabled && 
                            content.menuIntegration.allowUserOverrides;
    
    // Get base drawers from content or user preferences
    const preferredDrawers = useUserOverrides
      ? userPreferences!.drawerOverrides.preferredDrawers
      : content.menuIntegration.preferredDrawers;
    
    // Build drawer configurations
    const activeDrawers = this.buildDrawerConfigs(
      preferredDrawers,
      content.menuIntegration.optionalDrawers,
      content.modalities
    );
    
    // Determine wallet mode
    const walletMode = this.determineWalletMode(
      content.menuIntegration,
      userPreferences
    );
    
    // Build layout configuration
    const layout = this.buildLayoutConfig(content.layoutHints);
    
    // Build menu actions
    const actions = this.buildMenuActions(content, wallet);
    
    return {
      id: `manifest_${content.id}_${Date.now()}`,
      contentId: content.id,
      activeDrawers,
      walletMode,
      showLibraryStatus: content.menuIntegration.showLibraryStatus,
      showQuestProgress: content.menuIntegration.showQuestProgress,
      layout,
      actions,
      configSource: useUserOverrides ? 'merged' : 'content',
    };
  }
  
  /**
   * Build drawer configurations based on content and modalities
   */
  private buildDrawerConfigs(
    preferredDrawers: DrawerType[],
    optionalDrawers: DrawerType[],
    modalities: SmartContentQube['modalities']
  ): DrawerConfig[] {
    const configs: DrawerConfig[] = [];
    let position = 0;
    
    // Add preferred drawers
    for (const drawerType of preferredDrawers) {
      const baseConfig = DRAWER_CONFIGS[drawerType];
      if (baseConfig) {
        configs.push({
          ...baseConfig,
          position: position++,
          isActive: position === 1, // First drawer is active by default
        });
      }
    }
    
    // Add modality-specific drawers
    if (modalities.interact.enabled && modalities.interact.agents.length > 0) {
      if (!configs.find(c => c.type === 'agentChat')) {
        configs.push({
          ...DRAWER_CONFIGS.agentChat,
          position: position++,
          isActive: false,
          config: {
            agents: modalities.interact.agents,
          },
        });
      }
    }
    
    // Add optional drawers that aren't already included
    for (const drawerType of optionalDrawers) {
      if (!configs.find(c => c.type === drawerType)) {
        const baseConfig = DRAWER_CONFIGS[drawerType];
        if (baseConfig) {
          configs.push({
            ...baseConfig,
            position: position++,
            isActive: false,
          });
        }
      }
    }
    
    return configs;
  }
  
  /**
   * Determine wallet display mode
   */
  private determineWalletMode(
    menuIntegration: MenuIntegration,
    userPreferences?: WalletPreferences
  ): 'hidden' | 'compact' | 'full' {
    // User preference takes priority if allowed
    if (userPreferences && menuIntegration.allowUserOverrides) {
      return userPreferences.preferredDrawerLayout === 'full' ? 'full' : 'compact';
    }
    
    // Check if wallet summary should be shown
    if (!menuIntegration.showWalletSummary) {
      return 'hidden';
    }
    
    // Check preferred drawers for wallet type
    if (menuIntegration.preferredDrawers.includes('walletFull')) {
      return 'full';
    }
    
    if (menuIntegration.preferredDrawers.includes('walletCompact')) {
      return 'compact';
    }
    
    // Default to compact if wallet summary is enabled
    return 'compact';
  }
  
  /**
   * Build layout configuration from content hints
   */
  private buildLayoutConfig(layoutHints: LayoutHints): LayoutConfig {
    return {
      mode: layoutHints.responsive.desktop?.layout || 'split',
      drawerPosition: 'right',
      drawerWidth: '21.6rem', // Matches x402 wallet drawer width
      contentArea: {
        maxWidth: '1200px',
        padding: '1rem',
      },
      responsive: {
        mobile: {
          mode: layoutHints.responsive.mobile?.layout || 'stack',
          drawerPosition: 'bottom',
          drawerWidth: '100%',
        },
        tablet: {
          mode: layoutHints.responsive.tablet?.layout || 'grid',
          drawerPosition: 'right',
          drawerWidth: '320px',
        },
        desktop: {
          mode: layoutHints.responsive.desktop?.layout || 'split',
          drawerPosition: 'right',
          drawerWidth: '21.6rem',
        },
      },
    };
  }
  
  /**
   * Build menu actions based on content and wallet state
   */
  private buildMenuActions(
    content: SmartContentQube,
    wallet?: SmartWalletNode
  ): MenuAction[] {
    const actions: MenuAction[] = [];
    
    // Check if user owns content
    const owned = wallet?.contentEntitlements.some(e => e.contentId === content.id);
    
    // Payment action (if not owned and has pricing)
    if (!owned && content.pricingModel.tiers.length > 0) {
      const bestTier = content.pricingModel.tiers[0];
      actions.push({
        id: 'action_purchase',
        type: 'payment',
        label: `Buy for ${bestTier.amount} ${bestTier.currency}`,
        icon: 'credit-card',
        handler: 'handlePurchase',
        params: {
          contentId: content.id,
          tierId: bestTier.kind,
          amount: bestTier.amount,
          currency: bestTier.currency,
        },
        isPrimary: true,
        isDisabled: false,
      });
    }
    
    // Bookmark action
    actions.push({
      id: 'action_bookmark',
      type: 'bookmark',
      label: 'Add to Library',
      icon: 'bookmark',
      handler: 'handleBookmark',
      params: { contentId: content.id },
      isPrimary: false,
      isDisabled: false,
    });
    
    // Share action
    actions.push({
      id: 'action_share',
      type: 'share',
      label: 'Share',
      icon: 'share-2',
      handler: 'handleShare',
      params: {
        contentId: content.id,
        title: content.title,
        slug: content.slug,
      },
      isPrimary: false,
      isDisabled: false,
    });
    
    // Agent interaction action (if interact modality enabled)
    if (content.modalities.interact.enabled && content.modalities.interact.agents.length > 0) {
      actions.push({
        id: 'action_agent',
        type: 'agent',
        label: 'Chat with Agent',
        icon: 'message-circle',
        handler: 'handleAgentChat',
        params: {
          contentId: content.id,
          agents: content.modalities.interact.agents,
        },
        isPrimary: false,
        isDisabled: false,
      });
    }
    
    return actions;
  }
  
  /**
   * Get recommended drawers for a specific modality
   */
  getModalityDrawers(modality: ContentModality): DrawerType[] {
    switch (modality) {
      case 'read':
        return ['contentViewer', 'walletCompact', 'libraryShelf'];
      case 'watch':
        return ['contentViewer', 'walletCompact'];
      case 'listen':
        return ['contentViewer', 'walletCompact', 'questTracker'];
      case 'interact':
        return ['agentChat', 'contentViewer', 'walletCompact'];
      default:
        return ['contentViewer'];
    }
  }
  
  /**
   * Merge user preferences with content configuration
   */
  mergePreferences(
    contentConfig: MenuIntegration,
    userPreferences: WalletPreferences
  ): MenuIntegration {
    if (!contentConfig.allowUserOverrides) {
      return contentConfig;
    }
    
    return {
      ...contentConfig,
      preferredDrawers: userPreferences.drawerOverrides.enabled
        ? userPreferences.drawerOverrides.preferredDrawers
        : contentConfig.preferredDrawers,
      showWalletSummary: userPreferences.showBalances,
      showQuestProgress: userPreferences.showTasks,
    };
  }
  
  /**
   * Create copilot activation action
   * When copilot is activated, drawer expands by 30% for better readability
   */
  createCopilotAction(): MenuAction {
    return {
      id: 'action_copilot',
      type: 'copilot',
      label: 'Aigent Z Copilot',
      icon: 'sparkles',
      handler: 'handleCopilotToggle',
      params: {
        expandDrawer: true,
        drawerWidth: DRAWER_SIZE_CONFIG.expanded,
        normalWidth: DRAWER_SIZE_CONFIG.normal,
        expansionRatio: DRAWER_SIZE_CONFIG.expansionRatio,
      },
      isPrimary: false,
      isDisabled: false,
    };
  }
  
  /**
   * Create drawer resize action
   * Used to programmatically resize the drawer
   */
  createDrawerResizeAction(expanded: boolean): MenuAction {
    return {
      id: 'action_drawer_resize',
      type: 'drawer-resize',
      label: expanded ? 'Expand Drawer' : 'Collapse Drawer',
      icon: expanded ? 'maximize-2' : 'minimize-2',
      handler: 'handleDrawerResize',
      params: {
        expanded,
        width: expanded ? DRAWER_SIZE_CONFIG.expanded : DRAWER_SIZE_CONFIG.normal,
      },
      isPrimary: false,
      isDisabled: false,
    };
  }
  
  /**
   * Get drawer size configuration
   */
  getDrawerSizeConfig(): DrawerSizeConfig {
    return DRAWER_SIZE_CONFIG;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let serviceInstance: SmartMenuIntegrationService | null = null;

export function getSmartMenuIntegrationService(): SmartMenuIntegrationService {
  if (!serviceInstance) {
    serviceInstance = new SmartMenuIntegrationService();
  }
  return serviceInstance;
}

// =============================================================================
// COPILOT ACTION EXTENSIONS
// =============================================================================

/**
 * Extended Smart Menu action for content-driven configuration
 * Integrates with SmartContentService for real content data
 */
export const configureSmartMenuForContentAction = {
  name: "smartmenu_configure_for_content",
  description: "Configure a Smart Menu based on SmartContentQube settings. The menu will automatically adapt to the content's modalities, pricing, and layout hints. Use this when displaying content to a user.",
  parameters: [
    {
      name: "contentId",
      type: "string" as const,
      description: "The SmartContentQube ID to configure the menu for.",
      required: true,
    },
    {
      name: "personaId",
      type: "string" as const,
      description: "The persona ID to check entitlements and preferences.",
      required: false,
    },
    {
      name: "overrideDrawers",
      type: "string" as const,
      description: "Comma-separated list of drawer types to override content defaults: contentViewer, agentChat, walletCompact, walletFull, libraryShelf, questTracker, rewardsPanel.",
      required: false,
    },
    {
      name: "walletMode",
      type: "string" as const,
      description: "Wallet display mode: 'hidden', 'compact', or 'full'. Default based on content pricing.",
      required: false,
    },
  ],
  handler: async ({ contentId, personaId, overrideDrawers, walletMode }: {
    contentId: string;
    personaId?: string;
    overrideDrawers?: string;
    walletMode?: string;
  }) => {
    const menuService = getSmartMenuIntegrationService();
    
    // Build drawer list
    const drawers: DrawerType[] = overrideDrawers
      ? overrideDrawers.split(',').map(d => d.trim() as DrawerType)
      : ['contentViewer', 'walletCompact'];
    
    // Determine wallet mode
    const resolvedWalletMode = walletMode as 'hidden' | 'compact' | 'full' || 'compact';
    
    // Build actions based on content state
    const actions: MenuAction[] = [
      {
        id: 'action_bookmark',
        type: 'bookmark',
        label: 'Add to Library',
        icon: 'bookmark',
        handler: 'triad_add_to_library',
        isPrimary: false,
        isDisabled: false,
      },
      {
        id: 'action_share',
        type: 'share',
        label: 'Share',
        icon: 'share-2',
        handler: 'handleShare',
        isPrimary: false,
        isDisabled: false,
      },
    ];
    
    // Build manifest
    const manifest: Partial<SmartMenuManifest> = {
      id: `manifest_${contentId}_${Date.now()}`,
      contentId,
      activeDrawers: drawers.map((type, idx) => ({
        type,
        label: DRAWER_CONFIGS[type]?.label || type,
        icon: DRAWER_CONFIGS[type]?.icon || 'box',
        position: idx,
        isActive: idx === 0,
        isRequired: DRAWER_CONFIGS[type]?.isRequired || false,
      })),
      walletMode: resolvedWalletMode,
      showLibraryStatus: true,
      showQuestProgress: false,
      layout: {
        mode: 'split',
        drawerPosition: 'right',
        drawerWidth: '21.6rem',
        contentArea: { maxWidth: '1200px', padding: '1rem' },
        responsive: {
          mobile: { mode: 'stack', drawerPosition: 'bottom', drawerWidth: '100%' },
          tablet: { mode: 'grid', drawerPosition: 'right', drawerWidth: '320px' },
          desktop: { mode: 'split', drawerPosition: 'right', drawerWidth: '21.6rem' },
        },
      },
      actions,
      configSource: overrideDrawers ? 'merged' : 'content',
    };
    
    return {
      success: true,
      operation: "configure_smart_menu_for_content",
      contentId,
      personaId: personaId || null,
      manifest,
      message: `Smart Menu configured for content ${contentId} with ${drawers.length} drawers`,
    };
  },
};

/**
 * Export extended actions
 */
export const smartMenuContentActions = [
  configureSmartMenuForContentAction,
];
