/**
 * Copilot Context Service
 * 
 * Handles user context derivation, role inference, and domain routing
 * for the Codex Copilot system. Supports both metaKnyts and Qriptopian domains.
 * 
 * Context is derived from:
 * - Wallet data (balances, purchases, holdings)
 * - Persona data (DiDQube identity)
 * - User prompts (intent analysis)
 * - Interaction history
 */

import type {
  UserRole,
  UserRoleWeights,
  ContentDomain,
  DomainConfig,
  WalletContext,
  PersonaContext,
  IntentSignals,
  CopilotUserContext,
  CopilotResponseConfig,
  RoleContentMapping,
} from '@/types/copilotContext';

// ============================================================================
// Domain Configurations
// ============================================================================

const DOMAIN_CONFIGS: Record<ContentDomain, DomainConfig> = {
  metaKnyts: {
    domain: 'metaKnyts',
    persona: 'kn0w1',
    primaryColor: 'cyan',
    contentTypes: [
      'comic_page_portrait',
      'comic_cover_portrait',
      'character_portrait',
      'motion_comic_landscape',
      'lore_snippet',
      'terra_update',
    ],
    knowledgeBaseId: 'knyt-codex-kb',
    welcomeMessage: "Welcome to the KNYT Codex! I'm Kn0w1, your guide to the metaKnyts universe.",
  },
  qriptopian: {
    domain: 'qriptopian',
    persona: 'moneypenny',
    primaryColor: 'purple',
    contentTypes: [
      'article',
      'interview',
      'analysis',
      'tutorial',
      'case_study',
      'news_update',
    ],
    knowledgeBaseId: 'qriptopian-codex-kb',
    welcomeMessage: "Welcome to the Qriptopian Codex! I'm MoneyPenny, here to help you navigate the Quantum-Ready Internet.",
  },
};

// ============================================================================
// Role Content Mappings
// ============================================================================

const ROLE_CONTENT_MAPPINGS: Record<UserRole, RoleContentMapping> = {
  investor: {
    role: 'investor',
    contentPriorities: {
      episodes: 3,
      characters: 2,
      lore: 2,
      collectibles: 8,
      roadmap: 9,
      tokenomics: 10,
      partnerships: 8,
      technicalDocs: 4,
      creativeAssets: 3,
      communityEvents: 5,
    },
    preferredTemplates: ['knyt:drawer_grid_v1', 'knyt:quest_hud_hub_v1'],
    welcomeVariants: [
      "Welcome back! Let me show you the latest on your metaKnyts portfolio.",
      "Great to see you! Here's what's new in the metaKnyts ecosystem.",
      "Your investment dashboard is ready. What would you like to explore?",
    ],
    highlightMetrics: ['portfolio_value', 'nft_count', 'staking_rewards', 'market_trends'],
  },
  creative: {
    role: 'creative',
    contentPriorities: {
      episodes: 7,
      characters: 9,
      lore: 8,
      collectibles: 5,
      roadmap: 3,
      tokenomics: 2,
      partnerships: 4,
      technicalDocs: 3,
      creativeAssets: 10,
      communityEvents: 6,
    },
    preferredTemplates: ['knyt:dual_poster_stage_v1', 'knyt:drawer_grid_v1'],
    welcomeVariants: [
      "Welcome, creator! Ready to dive into the visual universe of metaKnyts?",
      "The creative vault awaits! What inspires you today?",
      "Let's explore the art and storytelling of the metaKnyts universe.",
    ],
    highlightMetrics: ['art_assets', 'character_designs', 'story_arcs', 'creative_tools'],
  },
  developer: {
    role: 'developer',
    contentPriorities: {
      episodes: 2,
      characters: 3,
      lore: 4,
      collectibles: 3,
      roadmap: 7,
      tokenomics: 5,
      partnerships: 4,
      technicalDocs: 10,
      creativeAssets: 2,
      communityEvents: 3,
    },
    preferredTemplates: ['knyt:drawer_grid_v1', 'knyt:quest_hud_hub_v1'],
    welcomeVariants: [
      "Welcome, builder! Ready to explore the technical side of metaKnyts?",
      "The developer docs are at your fingertips. What are you building?",
      "Let's dive into the APIs and integrations available to you.",
    ],
    highlightMetrics: ['api_endpoints', 'sdk_versions', 'integration_guides', 'code_samples'],
  },
  entrepreneur: {
    role: 'entrepreneur',
    contentPriorities: {
      episodes: 3,
      characters: 4,
      lore: 3,
      collectibles: 6,
      roadmap: 8,
      tokenomics: 7,
      partnerships: 10,
      technicalDocs: 5,
      creativeAssets: 4,
      communityEvents: 7,
    },
    preferredTemplates: ['knyt:quest_hud_hub_v1', 'knyt:drawer_grid_v1'],
    welcomeVariants: [
      "Welcome, visionary! Let's explore business opportunities in the metaKnyts ecosystem.",
      "Partnership possibilities await. What's your venture focus?",
      "Ready to discover how metaKnyts can amplify your business?",
    ],
    highlightMetrics: ['partnership_programs', 'revenue_share', 'licensing_options', 'market_reach'],
  },
  fan: {
    role: 'fan',
    contentPriorities: {
      episodes: 10,
      characters: 9,
      lore: 8,
      collectibles: 7,
      roadmap: 4,
      tokenomics: 2,
      partnerships: 2,
      technicalDocs: 1,
      creativeAssets: 6,
      communityEvents: 8,
    },
    preferredTemplates: ['knyt:dual_poster_stage_v1', 'knyt:motion_stage_v1', 'knyt:drawer_grid_v1'],
    welcomeVariants: [
      "Welcome to the Codex! Ready to dive deeper into the metaKnyts universe?",
      "The scrolls await! What story calls to you today?",
      "Let's explore the characters and adventures of metaKnyts together!",
    ],
    highlightMetrics: ['new_episodes', 'character_spotlights', 'community_events', 'collectible_drops'],
  },
};

// ============================================================================
// Intent Analysis Keywords
// ============================================================================

const INTENT_KEYWORDS: Record<IntentSignals['primaryIntent'], string[]> = {
  explore: ['show', 'browse', 'discover', 'explore', 'what', 'tell me', 'learn about', 'see'],
  invest: ['invest', 'buy', 'purchase', 'stake', 'portfolio', 'value', 'price', 'roi', 'returns'],
  create: ['create', 'design', 'art', 'draw', 'write', 'story', 'character', 'concept'],
  build: ['build', 'develop', 'integrate', 'api', 'sdk', 'code', 'technical', 'documentation'],
  learn: ['how', 'why', 'explain', 'understand', 'guide', 'tutorial', 'help'],
  collect: ['collect', 'nft', 'rare', 'edition', 'mint', 'drop', 'cover', 'card'],
  trade: ['trade', 'sell', 'swap', 'exchange', 'market', 'listing', 'offer'],
};

const CONTENT_FOCUS_KEYWORDS: Record<NonNullable<IntentSignals['contentFocus']>, string[]> = {
  characters: ['character', 'hero', 'villain', 'knyt', 'who is', 'powers', 'abilities'],
  episodes: ['episode', 'issue', 'story', 'chapter', 'read', 'scroll', 'comic'],
  lore: ['lore', 'world', 'history', 'backstory', 'universe', 'realm', 'terra'],
  collectibles: ['collectible', 'nft', 'cover', 'rare', 'edition', 'mint', 'card'],
  mechanics: ['how does', 'mechanics', 'system', 'works', 'process', 'rules'],
  roadmap: ['roadmap', 'future', 'upcoming', 'planned', 'next', 'release'],
};

// ============================================================================
// Copilot Context Service Class
// ============================================================================

class CopilotContextService {
  private static instance: CopilotContextService;

  private constructor() {}

  static getInstance(): CopilotContextService {
    if (!CopilotContextService.instance) {
      CopilotContextService.instance = new CopilotContextService();
    }
    return CopilotContextService.instance;
  }

  // ==========================================================================
  // Domain Configuration
  // ==========================================================================

  getDomainConfig(domain: ContentDomain): DomainConfig {
    return DOMAIN_CONFIGS[domain];
  }

  getRoleMapping(role: UserRole): RoleContentMapping {
    return ROLE_CONTENT_MAPPINGS[role];
  }

  // ==========================================================================
  // Role Inference from Wallet Data
  // ==========================================================================

  inferRolesFromWallet(wallet: WalletContext): Partial<UserRoleWeights> {
    const weights: Partial<UserRoleWeights> = {};

    // Investor signals
    if (wallet.hasStakedAssets || wallet.stakedValue > 0) {
      weights.investor = 0.9;
    } else if (wallet.knytBalance > 1000 || wallet.nftCount > 5) {
      weights.investor = 0.7;
    } else if (wallet.hasPurchaseHistory) {
      weights.investor = 0.4;
    }

    // Fan signals (engagement-based)
    if (wallet.engagementTier === 'power_user' || wallet.engagementTier === 'whale') {
      weights.fan = 0.8;
    } else if (wallet.engagementTier === 'engaged') {
      weights.fan = 0.6;
    } else if (wallet.hasNFTHoldings) {
      weights.fan = 0.5;
    }

    return weights;
  }

  // ==========================================================================
  // Role Inference from Persona Data
  // ==========================================================================

  inferRolesFromPersona(persona: PersonaContext): Partial<UserRoleWeights> {
    const weights: Partial<UserRoleWeights> = {};

    // Use declared roles if available
    if (persona.declaredRoles?.length) {
      for (const role of persona.declaredRoles) {
        weights[role] = 0.9; // High confidence for declared roles
      }
    }

    // Adjust based on visit patterns
    if (persona.isFirstVisit) {
      // New users default to fan/explorer
      weights.fan = Math.max(weights.fan || 0, 0.6);
    } else if (persona.visitCount > 10) {
      // Frequent visitors likely engaged fans
      weights.fan = Math.max(weights.fan || 0, 0.7);
    }

    return weights;
  }

  // ==========================================================================
  // Intent Analysis from User Message
  // ==========================================================================

  analyzeIntent(message: string): IntentSignals {
    const lowerMessage = message.toLowerCase();
    
    // Determine primary intent
    let primaryIntent: IntentSignals['primaryIntent'] = 'explore';
    let maxScore = 0;

    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
      const score = keywords.filter(kw => lowerMessage.includes(kw)).length;
      if (score > maxScore) {
        maxScore = score;
        primaryIntent = intent as IntentSignals['primaryIntent'];
      }
    }

    // Determine content focus
    let contentFocus: IntentSignals['contentFocus'] | undefined;
    let focusScore = 0;

    for (const [focus, keywords] of Object.entries(CONTENT_FOCUS_KEYWORDS)) {
      const score = keywords.filter(kw => lowerMessage.includes(kw)).length;
      if (score > focusScore) {
        focusScore = score;
        contentFocus = focus as IntentSignals['contentFocus'];
      }
    }

    // Determine depth
    let depth: IntentSignals['depth'] = 'balanced';
    if (lowerMessage.includes('quick') || lowerMessage.includes('brief') || message.length < 30) {
      depth = 'quick';
    } else if (lowerMessage.includes('detail') || lowerMessage.includes('comprehensive') || lowerMessage.includes('everything')) {
      depth = 'comprehensive';
    }

    // Calculate confidence
    const confidence = Math.min(1, (maxScore + focusScore) / 4);

    return {
      primaryIntent,
      contentFocus,
      depth,
      confidence,
    };
  }

  // ==========================================================================
  // Role Weight Inference from Intent
  // ==========================================================================

  inferRolesFromIntent(intent: IntentSignals): Partial<UserRoleWeights> {
    const weights: Partial<UserRoleWeights> = {};

    switch (intent.primaryIntent) {
      case 'invest':
      case 'trade':
        weights.investor = 0.8;
        break;
      case 'create':
        weights.creative = 0.8;
        break;
      case 'build':
        weights.developer = 0.8;
        break;
      case 'explore':
      case 'learn':
        weights.fan = 0.6;
        break;
      case 'collect':
        weights.fan = 0.5;
        weights.investor = 0.4;
        break;
    }

    // Adjust based on content focus
    if (intent.contentFocus === 'characters' || intent.contentFocus === 'episodes' || intent.contentFocus === 'lore') {
      weights.fan = Math.max(weights.fan || 0, 0.7);
    } else if (intent.contentFocus === 'mechanics' || intent.contentFocus === 'roadmap') {
      weights.developer = Math.max(weights.developer || 0, 0.5);
      weights.investor = Math.max(weights.investor || 0, 0.5);
    }

    return weights;
  }

  // ==========================================================================
  // Build Complete User Context
  // ==========================================================================

  buildUserContext(params: {
    domain: ContentDomain;
    wallet?: Partial<WalletContext>;
    persona?: Partial<PersonaContext>;
    message?: string;
    sessionId?: string;
    conversationTurn?: number;
  }): CopilotUserContext {
    // Default wallet context
    const wallet: WalletContext = {
      hasKnytBalance: false,
      knytBalance: 0,
      hasNFTHoldings: false,
      nftCount: 0,
      hasPurchaseHistory: false,
      totalPurchases: 0,
      hasStakedAssets: false,
      stakedValue: 0,
      engagementTier: 'new',
      ...params.wallet,
    };

    // Default persona context
    const persona: PersonaContext = {
      hasVerifiedIdentity: false,
      visitCount: 0,
      isFirstVisit: true,
      ...params.persona,
    };

    // Analyze intent if message provided
    const currentIntent = params.message ? this.analyzeIntent(params.message) : undefined;

    // Merge role weights from all sources
    const walletRoles = this.inferRolesFromWallet(wallet);
    const personaRoles = this.inferRolesFromPersona(persona);
    const intentRoles = currentIntent ? this.inferRolesFromIntent(currentIntent) : {};

    // Combine weights (average with priority to explicit signals)
    const roleWeights: UserRoleWeights = {
      investor: Math.max(walletRoles.investor || 0, personaRoles.investor || 0, intentRoles.investor || 0),
      creative: Math.max(walletRoles.creative || 0, personaRoles.creative || 0, intentRoles.creative || 0),
      developer: Math.max(walletRoles.developer || 0, personaRoles.developer || 0, intentRoles.developer || 0),
      entrepreneur: Math.max(walletRoles.entrepreneur || 0, personaRoles.entrepreneur || 0, intentRoles.entrepreneur || 0),
      fan: Math.max(walletRoles.fan || 0, personaRoles.fan || 0, intentRoles.fan || 0, 0.3), // Minimum fan weight
    };

    // Determine active roles (weight > 0.4)
    const roles: UserRole[] = (Object.entries(roleWeights) as [UserRole, number][])
      .filter(([_, weight]) => weight > 0.4)
      .map(([role]) => role);

    // If no roles meet threshold, default to fan
    if (roles.length === 0) {
      roles.push('fan');
    }

    // Determine primary role (highest weight)
    const primaryRole = (Object.entries(roleWeights) as [UserRole, number][])
      .sort((a, b) => b[1] - a[1])[0][0];

    return {
      activeDomain: params.domain,
      roles,
      roleWeights,
      primaryRole,
      wallet,
      persona,
      sessionId: params.sessionId || `session_${Date.now()}`,
      currentIntent,
      conversationTurn: params.conversationTurn || 0,
      lastUserMessage: params.message,
    };
  }

  // ==========================================================================
  // Generate Response Configuration
  // ==========================================================================

  generateResponseConfig(context: CopilotUserContext): CopilotResponseConfig {
    const roleMapping = this.getRoleMapping(context.primaryRole);

    // Determine tone based on role
    let tone: CopilotResponseConfig['tone'] = 'friendly';
    if (context.primaryRole === 'developer') {
      tone = 'technical';
    } else if (context.primaryRole === 'investor' || context.primaryRole === 'entrepreneur') {
      tone = 'formal';
    } else if (context.primaryRole === 'fan') {
      tone = 'enthusiastic';
    }

    // Determine verbosity based on intent depth
    let verbosity: CopilotResponseConfig['verbosity'] = 'balanced';
    if (context.currentIntent?.depth === 'quick') {
      verbosity = 'concise';
    } else if (context.currentIntent?.depth === 'comprehensive') {
      verbosity = 'detailed';
    }

    // Content emphasis based on roles
    const contentEmphasis = {
      showInvestmentMetrics: context.roleWeights.investor > 0.5,
      showCreativeTools: context.roleWeights.creative > 0.5,
      showTechnicalDocs: context.roleWeights.developer > 0.5,
      showBusinessOpportunities: context.roleWeights.entrepreneur > 0.5,
      showStoryContent: context.roleWeights.fan > 0.4,
      showCollectibles: context.roleWeights.investor > 0.3 || context.roleWeights.fan > 0.5,
    };

    // Suggested template based on role
    const suggestedTemplate = roleMapping.preferredTemplates[0];

    // Generate follow-up suggestions based on context
    const suggestedFollowUps = this.generateFollowUpSuggestions(context);

    return {
      tone,
      verbosity,
      contentEmphasis,
      suggestedTemplate,
      suggestedFollowUps,
    };
  }

  // ==========================================================================
  // Generate Follow-Up Suggestions
  // ==========================================================================

  private generateFollowUpSuggestions(context: CopilotUserContext): string[] {
    const suggestions: string[] = [];
    const roleMapping = this.getRoleMapping(context.primaryRole);

    // Add role-specific suggestions
    switch (context.primaryRole) {
      case 'investor':
        suggestions.push('Show me the latest collectible drops');
        suggestions.push('What are the staking rewards?');
        suggestions.push('Tell me about partnership opportunities');
        break;
      case 'creative':
        suggestions.push('Show me character concept art');
        suggestions.push('What creative tools are available?');
        suggestions.push('How can I contribute to the universe?');
        break;
      case 'developer':
        suggestions.push('Show me the API documentation');
        suggestions.push('What SDKs are available?');
        suggestions.push('How do I integrate with metaKnyts?');
        break;
      case 'entrepreneur':
        suggestions.push('What partnership programs exist?');
        suggestions.push('Tell me about licensing options');
        suggestions.push('How can I build on metaKnyts?');
        break;
      case 'fan':
      default:
        suggestions.push('Tell me about the main characters');
        suggestions.push('What episode should I start with?');
        suggestions.push('Show me the latest releases');
        break;
    }

    // Add content-focus specific suggestions
    if (context.currentIntent?.contentFocus === 'characters') {
      suggestions.push('Who are the most powerful KNYTs?');
    } else if (context.currentIntent?.contentFocus === 'episodes') {
      suggestions.push('What are the must-read episodes?');
    }

    return suggestions.slice(0, 3);
  }

  // ==========================================================================
  // Get Welcome Message for Context
  // ==========================================================================

  getWelcomeMessage(context: CopilotUserContext): string {
    const domainConfig = this.getDomainConfig(context.activeDomain);
    const roleMapping = this.getRoleMapping(context.primaryRole);

    // Use role-specific welcome if not first visit
    if (!context.persona.isFirstVisit && roleMapping.welcomeVariants.length > 0) {
      const variant = roleMapping.welcomeVariants[Math.floor(Math.random() * roleMapping.welcomeVariants.length)];
      return variant;
    }

    return domainConfig.welcomeMessage;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const copilotContextService = CopilotContextService.getInstance();

export function getCopilotContextService(): CopilotContextService {
  return CopilotContextService.getInstance();
}
