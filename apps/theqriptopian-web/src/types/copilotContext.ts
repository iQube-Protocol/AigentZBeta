/**
 * Copilot Context Types
 * 
 * Defines user roles, context, and domain routing for the Codex Copilot system.
 * Supports both metaKnyts (KNYT Codex) and Qriptopian (Qriptopian Codex) domains.
 * 
 * User context is derived from:
 * - Wallet data (balances, purchases, holdings)
 * - Persona data (DiDQube identity)
 * - Interaction history
 * - Explicit role selection
 * 
 * Future phases will integrate KNYTQube and QriptoQube for richer context.
 */

// ============================================================================
// User Roles (Non-Mutually Exclusive)
// ============================================================================

/**
 * User roles that influence content selection and presentation.
 * Users can have multiple roles simultaneously.
 */
export type UserRole = 
  | 'investor'      // Interested in/has invested in metaKnyts or Qriptopian assets
  | 'creative'      // Artists, writers, content creators
  | 'developer'     // Technical builders, API users
  | 'entrepreneur'  // Business-focused, partnership-oriented
  | 'fan';          // Story enthusiasts, collectors, community members

/**
 * Role weights for users with multiple roles.
 * Higher weight = stronger influence on content selection.
 */
export interface UserRoleWeights {
  investor: number;      // 0-1
  creative: number;      // 0-1
  developer: number;     // 0-1
  entrepreneur: number;  // 0-1
  fan: number;           // 0-1
}

// ============================================================================
// Content Domain
// ============================================================================

/**
 * Content domains the copilot can route to.
 * Each domain has its own knowledge base and content mix.
 */
export type ContentDomain = 
  | 'metaKnyts'     // KNYT Codex - metaKnyts universe content
  | 'qriptopian';   // Qriptopian Codex - agentic magazine content

/**
 * Domain-specific configuration for copilot behavior.
 */
export interface DomainConfig {
  domain: ContentDomain;
  persona: 'kn0w1' | 'moneypenny';
  primaryColor: string;
  contentTypes: string[];
  knowledgeBaseId: string;
  welcomeMessage: string;
}

// ============================================================================
// User Context (Derived from Wallet + Persona)
// ============================================================================

/**
 * Wallet-derived context signals.
 */
export interface WalletContext {
  // Balance indicators
  hasKnytBalance: boolean;
  knytBalance: number;
  hasNFTHoldings: boolean;
  nftCount: number;
  
  // Purchase history signals
  hasPurchaseHistory: boolean;
  totalPurchases: number;
  lastPurchaseDate?: string;
  
  // Investment signals
  hasStakedAssets: boolean;
  stakedValue: number;
  
  // Engagement level
  engagementTier: 'new' | 'casual' | 'engaged' | 'power_user' | 'whale';
}

/**
 * Persona-derived context signals.
 */
export interface PersonaContext {
  personaId?: string;
  hasVerifiedIdentity: boolean;
  reputationScore?: number;
  
  // Role indicators from persona data
  declaredRoles?: UserRole[];
  
  // Preferences
  preferredContentTypes?: string[];
  preferredLanguage?: string;
  
  // Interaction history
  lastVisit?: string;
  visitCount: number;
  isFirstVisit: boolean;
}

/**
 * Intent signals derived from user prompt analysis.
 */
export interface IntentSignals {
  // Primary intent category
  primaryIntent: 'explore' | 'invest' | 'create' | 'build' | 'learn' | 'collect' | 'trade';
  
  // Specific action intent
  actionIntent?: string;
  
  // Content focus
  contentFocus?: 'characters' | 'episodes' | 'lore' | 'collectibles' | 'mechanics' | 'roadmap';
  
  // Urgency/depth
  depth: 'quick' | 'detailed' | 'comprehensive';
  
  // Confidence score
  confidence: number;
}

// ============================================================================
// Full User Context
// ============================================================================

/**
 * Complete user context for copilot decision-making.
 */
export interface CopilotUserContext {
  // Domain routing
  activeDomain: ContentDomain;
  
  // Role context
  roles: UserRole[];
  roleWeights: UserRoleWeights;
  primaryRole: UserRole;
  
  // Derived contexts
  wallet: WalletContext;
  persona: PersonaContext;
  
  // Current session
  sessionId: string;
  currentIntent?: IntentSignals;
  
  // Conversation state
  conversationTurn: number;
  lastUserMessage?: string;
  
  // Template/layout preferences
  preferredLayoutVariant?: string;
}

// ============================================================================
// Copilot Response Configuration
// ============================================================================

/**
 * Configuration for how the copilot should respond based on context.
 */
export interface CopilotResponseConfig {
  // Tone and style
  tone: 'formal' | 'friendly' | 'technical' | 'enthusiastic';
  verbosity: 'concise' | 'balanced' | 'detailed';
  
  // Content emphasis based on role
  contentEmphasis: {
    showInvestmentMetrics: boolean;
    showCreativeTools: boolean;
    showTechnicalDocs: boolean;
    showBusinessOpportunities: boolean;
    showStoryContent: boolean;
    showCollectibles: boolean;
  };
  
  // Template selection hints
  suggestedTemplate?: string;
  suggestedLayoutVariant?: string;
  
  // Follow-up suggestions
  suggestedFollowUps: string[];
}

// ============================================================================
// Role-Based Content Mapping
// ============================================================================

/**
 * Maps user roles to content priorities and presentation styles.
 */
export interface RoleContentMapping {
  role: UserRole;
  
  // Content priorities (higher = more prominent)
  contentPriorities: {
    episodes: number;
    characters: number;
    lore: number;
    collectibles: number;
    roadmap: number;
    tokenomics: number;
    partnerships: number;
    technicalDocs: number;
    creativeAssets: number;
    communityEvents: number;
  };
  
  // Preferred templates for this role
  preferredTemplates: string[];
  
  // Conversation starters
  welcomeVariants: string[];
  
  // Key metrics to highlight
  highlightMetrics: string[];
}

// ============================================================================
// Domain Knowledge Base Reference
// ============================================================================

/**
 * Reference to domain-specific knowledge bases.
 * Placeholder for future KNYTQube/QriptoQube integration.
 */
export interface DomainKnowledgeBase {
  domain: ContentDomain;
  
  // Content sources
  sources: {
    characters: boolean;
    episodes: boolean;
    lore: boolean;
    worldBuilding: boolean;
    tokenomics: boolean;
    roadmap: boolean;
    partnerships: boolean;
    technicalDocs: boolean;
  };
  
  // Future: Qube integration
  qubeIntegration?: {
    enabled: boolean;
    qubeType: 'KNYTQube' | 'QriptoQube';
    qubeId?: string;
  };
}

// ============================================================================
// Backlog Item: Detailed Context Definition
// ============================================================================

/**
 * BACKLOG: Define detailed user contexts for copilot inference.
 * 
 * This is a placeholder for the formal brief that will outline:
 * 1. How to derive roles from wallet/persona data
 * 2. How to weight roles based on interaction patterns
 * 3. How to map roles to content selection
 * 4. How to personalize responses based on context
 * 5. How to integrate KNYTQube/QriptoQube data
 * 
 * The copilot should understand that a formal brief is forthcoming
 * that will provide more detailed guidance on these processes.
 */
export const CONTEXT_DEFINITION_BACKLOG = {
  status: 'pending',
  description: 'Define detailed user contexts for copilot inference',
  dependencies: ['KNYTQube integration', 'QriptoQube integration'],
  notes: 'Formal brief in development - copilot should use current heuristics until brief is finalized'
};
