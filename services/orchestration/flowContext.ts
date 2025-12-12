/**
 * FlowContext - Unified Context Model for Orchestration
 * 
 * The FlowContext is the shared state that all agents and orchestration
 * functions can read to understand:
 * - Where the user is (app, drawer, tab, content)
 * - Who they are (persona, identity state)
 * - What they have (wallet, entitlements, DeFi portfolio)
 * - What they're trying to do (inferred or explicit intent)
 * 
 * This enables the ARRIVE → ALIGN → ASSESS → ADAPT → ACT → ANCHOR pipeline.
 */

import type { SmartWalletQube, RiskBand } from '@/types/smartWalletQube';
import type { DrawerSet } from '@/types/smartDrawer';

// =============================================================================
// IDENTITY TYPES
// =============================================================================

/** Identity state levels (aligned with DIDQube) */
export type IdentityState = 'anon' | 'pseudo' | 'semi' | 'full';

// =============================================================================
// LOCATION CONTEXT
// =============================================================================

/** Application IDs */
export type AppId = 'metaKnyts' | 'Qriptopian' | 'MoneyPenny' | 'Platform' | string;

/** Agent IDs */
export type AgentId = 'Kn0w1' | 'MoneyPenny' | 'Nakamoto' | 'Copilot' | string;

/** Content categories */
export type ContentCategory = 
  | 'episode' 
  | 'article' 
  | 'strategy' 
  | 'tool' 
  | 'signal' 
  | 'codex'
  | string;

/** Content modalities */
export type ContentModality = 'read' | 'watch' | 'listen' | 'interact';

// =============================================================================
// INTENT TYPES
// =============================================================================

/** Inferred user goals */
export type InferredGoal = 
  | 'understand'   // Learning, exploring content
  | 'unlock'       // Purchasing, unlocking content
  | 'optimise'     // Improving portfolio, strategies
  | 'explore'      // Browsing, discovering
  | 'cashflow'     // Managing payments, transactions
  | 'simulate'     // Testing strategies in paper mode
  | 'allocate'     // Deploying capital to strategies
  | string;

// =============================================================================
// FLOW CONTEXT - MAIN INTERFACE
// =============================================================================

/**
 * FlowContext - The unified context for orchestration
 */
export interface FlowContext {
  /** Persona information */
  persona: {
    /** Persona ID (e.g., "Qripto", "metaKnyts", "DeFiTrader") */
    id: string;
    /** Current identity state */
    identityState: IdentityState;
    /** User ID (if available) */
    userId?: string;
    /** Tenant ID */
    tenantId?: string;
  };

  /** Location context - where the user is */
  location: {
    /** Current application */
    appId: AppId;
    /** Active agent (primary speaker) */
    activeAgentId: AgentId;
    /** Active drawer ID */
    activeDrawerId?: string;
    /** Active tab ID */
    activeTabId?: string;
  };

  /** Content context - what content is being viewed */
  content?: {
    /** SmartContentQube ID */
    smartContentId?: string;
    /** Content category */
    category?: ContentCategory;
    /** Content modality */
    modality?: ContentModality;
    /** Content title (for narrative) */
    title?: string;
    /** Related content IDs */
    relatedContentIds?: string[];
  };

  /** Wallet context - summarized wallet state */
  wallet?: {
    /** Wallet ID */
    walletId?: string;
    /** Short sentence summarizing key balances */
    balancesSummary?: string;
    /** Whether user has required funds for current action */
    hasRequiredFunds?: boolean;
    /** Content IDs user already owns */
    relevantEntitlements?: string[];
    /** Total balance in primary asset */
    primaryBalance?: string;
    /** Primary asset symbol */
    primaryAsset?: string;
  };

  /** DeFi context - for MoneyPenny flows */
  defi?: {
    /** Has open DeFi positions */
    hasOpenPositions?: boolean;
    /** Dominant risk band */
    dominantRiskBand?: RiskBand;
    /** Total portfolio value */
    portfolioValue?: string;
    /** Number of running strategies */
    runningStrategies?: number;
    /** Total unrealized P&L */
    unrealizedPnl?: string;
  };

  /** Intent context - what the user is trying to do */
  intent?: {
    /** Inferred goal based on context */
    inferredGoal?: InferredGoal;
    /** Explicit goal from user statement */
    explicitGoal?: string;
    /** Confidence in inferred goal (0-1) */
    confidence?: number;
  };

  /** Timestamp when context was built */
  timestamp?: string;
}

// =============================================================================
// CONTEXT BUILDER PARAMS
// =============================================================================

export interface BuildFlowContextParams {
  userId?: string;
  tenantId: string;
  appId: AppId;
  personaId: string;
  activeAgentId?: AgentId;
  smartContentId?: string;
  activeDrawerId?: string;
  activeTabId?: string;
  explicitGoal?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build a FlowContext from available data
 * This is a best-effort builder that populates what it can
 */
export function buildFlowContext(
  params: BuildFlowContextParams,
  wallet?: SmartWalletQube | null,
  drawerSet?: DrawerSet | null
): FlowContext {
  const context: FlowContext = {
    persona: {
      id: params.personaId,
      identityState: wallet?.identityState || 'anon',
      userId: params.userId,
      tenantId: params.tenantId,
    },
    location: {
      appId: params.appId,
      activeAgentId: params.activeAgentId || inferPrimaryAgent(params.appId),
      activeDrawerId: params.activeDrawerId,
      activeTabId: params.activeTabId,
    },
    timestamp: new Date().toISOString(),
  };

  // Add content context if available
  if (params.smartContentId) {
    context.content = {
      smartContentId: params.smartContentId,
      // Category and modality would be fetched from SmartContentQube
    };
  }

  // Add wallet context if available
  if (wallet) {
    context.wallet = {
      walletId: wallet.id,
      balancesSummary: buildBalancesSummary(wallet),
      relevantEntitlements: wallet.entitlements
        .filter(e => e.status === 'active')
        .map(e => e.entitlementId),
      primaryBalance: wallet.balances[0]?.amount,
      primaryAsset: wallet.balances[0]?.asset,
    };

    // Add DeFi context if available
    if (wallet.defiPortfolio) {
      const portfolio = wallet.defiPortfolio;
      context.defi = {
        hasOpenPositions: portfolio.positions.some(p => p.status === 'open'),
        dominantRiskBand: portfolio.riskSummary?.dominantRiskBand,
        portfolioValue: portfolio.riskSummary?.totalValue,
        runningStrategies: portfolio.strategies.filter(s => s.status === 'running').length,
        unrealizedPnl: portfolio.totalUnrealizedPnl,
      };
    }
  }

  // Add intent context
  if (params.explicitGoal) {
    context.intent = {
      explicitGoal: params.explicitGoal,
      inferredGoal: inferGoalFromExplicit(params.explicitGoal),
      confidence: 0.9,
    };
  } else {
    context.intent = {
      inferredGoal: inferGoalFromContext(context),
      confidence: 0.6,
    };
  }

  return context;
}

/**
 * Build a human-readable balances summary
 */
function buildBalancesSummary(wallet: SmartWalletQube): string {
  if (!wallet.balances || wallet.balances.length === 0) {
    return 'No balances available';
  }

  const parts = wallet.balances
    .slice(0, 3)
    .map(b => `${b.amount} ${b.symbol}`);

  if (wallet.balances.length > 3) {
    parts.push(`and ${wallet.balances.length - 3} more`);
  }

  return `You have ${parts.join(', ')}`;
}

/**
 * Infer primary agent based on app
 */
function inferPrimaryAgent(appId: AppId): AgentId {
  switch (appId) {
    case 'metaKnyts':
      return 'Kn0w1';
    case 'Qriptopian':
      return 'Copilot';
    case 'MoneyPenny':
      return 'MoneyPenny';
    default:
      return 'Copilot';
  }
}

/**
 * Infer goal from explicit user statement
 */
function inferGoalFromExplicit(goal: string): InferredGoal {
  const lower = goal.toLowerCase();
  
  if (lower.includes('understand') || lower.includes('learn') || lower.includes('explain')) {
    return 'understand';
  }
  if (lower.includes('unlock') || lower.includes('buy') || lower.includes('purchase')) {
    return 'unlock';
  }
  if (lower.includes('optimise') || lower.includes('optimize') || lower.includes('improve')) {
    return 'optimise';
  }
  if (lower.includes('explore') || lower.includes('browse') || lower.includes('discover')) {
    return 'explore';
  }
  if (lower.includes('pay') || lower.includes('send') || lower.includes('transfer')) {
    return 'cashflow';
  }
  if (lower.includes('simulate') || lower.includes('test') || lower.includes('paper')) {
    return 'simulate';
  }
  if (lower.includes('allocate') || lower.includes('deploy') || lower.includes('invest')) {
    return 'allocate';
  }
  
  return 'explore';
}

/**
 * Infer goal from context
 */
function inferGoalFromContext(context: FlowContext): InferredGoal {
  // MoneyPenny app suggests DeFi-related goals
  if (context.location.appId === 'MoneyPenny') {
    if (context.defi?.hasOpenPositions) {
      return 'optimise';
    }
    return 'explore';
  }

  // Content viewing suggests understanding
  if (context.content?.smartContentId) {
    return 'understand';
  }

  // Default to explore
  return 'explore';
}

/**
 * Create an empty/minimal FlowContext
 */
export function createEmptyFlowContext(appId: AppId = 'Platform'): FlowContext {
  return {
    persona: {
      id: 'anonymous',
      identityState: 'anon',
    },
    location: {
      appId,
      activeAgentId: 'Copilot',
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Merge partial updates into existing FlowContext
 */
export function updateFlowContext(
  existing: FlowContext,
  updates: Partial<FlowContext>
): FlowContext {
  return {
    ...existing,
    ...updates,
    persona: { ...existing.persona, ...updates.persona },
    location: { ...existing.location, ...updates.location },
    content: updates.content ? { ...existing.content, ...updates.content } : existing.content,
    wallet: updates.wallet ? { ...existing.wallet, ...updates.wallet } : existing.wallet,
    defi: updates.defi ? { ...existing.defi, ...updates.defi } : existing.defi,
    intent: updates.intent ? { ...existing.intent, ...updates.intent } : existing.intent,
    timestamp: new Date().toISOString(),
  };
}

export default {
  buildFlowContext,
  createEmptyFlowContext,
  updateFlowContext,
};
