/**
 * Smart Wallet Node Type Definitions
 * 
 * Context-aware wallet that dynamically integrates with:
 * - Current persona and identity state
 * - Current content being viewed
 * - Active agent interactions
 * - Pricing snapshots and entitlements
 * - Tasks, quests, and rewards
 * 
 * Styling follows x402 wallet CSS patterns.
 * Integrates with RewardHub for reward tracking and distribution.
 */

import type { 
  PaymentCurrency, 
  IdentityState, 
  PricingKind,
  DrawerType 
} from './smartContent';

// =============================================================================
// PERSONA CONTEXT
// =============================================================================

export interface PersonaState {
  /** Persona ID */
  id: string;
  
  /** Display name */
  displayName: string;
  
  /** FIO handle */
  fioHandle?: string;
  
  /** Current identity state */
  identifiability: IdentityState;
  
  /** RQH reputation bucket (0-4) */
  reputationBucket: number;
  
  /** RQH reputation score (0-100) */
  reputationScore: number;
  
  /** World ID verification status */
  worldIdStatus: 'unverified' | 'verified_human' | 'agent_declared';
  
  /** Whether this is an AI agent persona */
  isAgent: boolean;
  
  /** App origin */
  appOrigin: string;
  
  /** Earned badges */
  badges?: string[];
}

export interface PersonaContext {
  /** Currently active persona ID */
  activePersonaId: string;
  
  /** Active persona details */
  activePersona: PersonaState;
  
  /** All available personas for this user */
  availablePersonas: PersonaState[];
  
  /** Whether persona switching is allowed in current context */
  switchingAllowed: boolean;
  
  /** Root DID (if disclosed) */
  rootDid?: string;
}

// =============================================================================
// BALANCE & ASSETS
// =============================================================================

export interface AssetBalance {
  /** Asset identifier */
  asset: PaymentCurrency;
  
  /** Chain ID (for multi-chain assets) */
  chainId?: number;
  
  /** Chain name */
  chainName?: string;
  
  /** Raw balance (in smallest unit) */
  rawBalance: string;
  
  /** Formatted balance (human readable) */
  formattedBalance: string;
  
  /** Decimals */
  decimals: number;
  
  /** USD equivalent (if available) */
  usdValue?: number;
  
  /** Last updated timestamp */
  lastUpdated: string;
}

export interface WalletBalances {
  /** Total Q¢ across all chains */
  totalQc: number;
  
  /** Individual asset balances */
  assets: AssetBalance[];
  
  /** Pending rewards (not yet distributed) */
  pendingRewards: number;
  
  /** Pending rewards asset */
  pendingRewardsAsset: PaymentCurrency;
  
  /** Last balance refresh */
  lastRefreshed: string;
}

// =============================================================================
// ENTITLEMENTS
// =============================================================================

export interface ContentEntitlement {
  /** Entitlement ID */
  id: string;
  
  /** Content ID this entitlement grants access to */
  contentId: string;
  
  /** Content title */
  contentTitle: string;
  
  /** Entitlement scope */
  scope: 'full' | 'preview' | 'rental' | 'subscription';
  
  /** How this entitlement was acquired */
  acquiredVia: 'purchase' | 'subscription' | 'rental' | 'gift' | 'reward' | 'free';
  
  /** Transaction hash (if purchased) */
  txHash?: string;
  
  /** Expiration date (null = permanent) */
  expiresAt: string | null;
  
  /** Usage count (for usage-limited entitlements) */
  usageCount?: number;
  
  /** Max usage (for usage-limited entitlements) */
  maxUsage?: number;
  
  /** Acquired date */
  acquiredAt: string;
}

// =============================================================================
// CONTENT CONTEXT
// =============================================================================

export interface PricingSnapshot {
  /** Whether user owns this content */
  owned: boolean;
  
  /** Current entitlement (if any) */
  entitlement?: ContentEntitlement;
  
  /** Best available offer */
  bestOffer?: {
    kind: PricingKind;
    amount: number;
    currency: PaymentCurrency;
    label: string;
  };
  
  /** All available pricing options */
  allOffers: Array<{
    kind: PricingKind;
    amount: number;
    currency: PaymentCurrency;
    label: string;
    covers: string[];
  }>;
  
  /** Free preview available */
  freePreviewAvailable: boolean;
  
  /** Free preview details */
  freePreview?: {
    panels?: number;
    paragraphs?: number;
    timeLimitSeconds?: number;
  };
  
  /** x402 payment template ID */
  x402TemplateId?: string;
}

export interface ContentContext {
  /** Current content ID being viewed */
  currentContentId: string | null;
  
  /** Current content title */
  currentContentTitle: string | null;
  
  /** Current modality being used */
  currentModality: 'read' | 'watch' | 'listen' | 'interact' | null;
  
  /** Pricing snapshot for current content */
  pricingSnapshot: PricingSnapshot | null;
  
  /** Progress in current content (0-100) */
  progressPercentage: number;
  
  /** Time spent on current content (seconds) */
  timeSpentSeconds: number;
  
  /** Series context (if part of series) */
  seriesContext?: {
    seriesId: string;
    seriesTitle: string;
    currentPosition: number;
    totalInSeries: number;
    completedCount: number;
  };
}

// =============================================================================
// AGENT CONTEXT
// =============================================================================

export interface AgentContext {
  /** Current agent ID (if interacting) */
  currentAgentId: string | null;
  
  /** Current agent name */
  currentAgentName: string | null;
  
  /** Agent interaction session ID */
  sessionId: string | null;
  
  /** Interaction start time */
  interactionStartedAt: string | null;
  
  /** Messages exchanged in session */
  messageCount: number;
  
  /** Agent capabilities available */
  capabilities: string[];
}

// =============================================================================
// TASKS & QUESTS
// =============================================================================

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired';

export interface WalletTask {
  /** Task ID */
  id: string;
  
  /** Task label */
  label: string;
  
  /** Task description */
  description?: string;
  
  /** Task type */
  type: 'content' | 'quest' | 'reward' | 'verification' | 'social' | 'custom';
  
  /** Current status */
  status: TaskStatus;
  
  /** Progress (0-100) */
  progress: number;
  
  /** Reward preview */
  rewardPreview?: {
    amount: number;
    asset: PaymentCurrency;
  };
  
  /** Related content ID */
  relatedContentId?: string;
  
  /** Related quest ID */
  relatedQuestId?: string;
  
  /** Due date */
  dueAt?: string;
  
  /** Created date */
  createdAt: string;
  
  /** Completed date */
  completedAt?: string;
}

export interface QuestProgress {
  /** Quest ID */
  questId: string;
  
  /** Quest title */
  questTitle: string;

  /** Quest group */
  group?: 'rewarded' | 'purchase';
  
  /** Current step */
  currentStep: number;
  
  /** Total steps */
  totalSteps: number;
  
  /** Completed steps */
  completedSteps: number[];
  
  /** Quest status */
  status: 'not_started' | 'in_progress' | 'completed' | 'abandoned';
  
  /** Total reward on completion */
  totalReward: {
    amount: number;
    asset: PaymentCurrency;
  };
  
  /** Earned so far */
  earnedSoFar: {
    amount: number;
    asset: PaymentCurrency;
  };

  /** Campaign phases (optional) */
  phases?: Array<{
    id: string;
    label: string;
    counterKey?: string;
    targetCount?: number;
  }>;

  /** Counters for phase progress (optional) */
  counters?: Record<string, number>;
  
  /** Started date */
  startedAt?: string;
  
  /** Completed date */
  completedAt?: string;
}

// =============================================================================
// REWARDS
// =============================================================================

export interface RecentReward {
  /** Reward ID */
  id: string;
  
  /** Amount */
  amount: number;
  
  /** Asset */
  asset: PaymentCurrency;
  
  /** Reason/trigger */
  reason: string;
  
  /** Related content ID */
  contentId?: string;
  
  /** Related quest ID */
  questId?: string;
  
  /** RewardHub proposal ID */
  proposalId?: string;
  
  /** Distribution status */
  status: 'proposed' | 'approved' | 'distributed' | 'pending';
  
  /** Transaction hash (if distributed) */
  txHash?: string;
  
  /** Earned date */
  earnedAt: string;
  
  /** Distributed date */
  distributedAt?: string;
}

export interface RewardsContext {
  /** Recent rewards (last 30 days) */
  recentRewards: RecentReward[];
  
  /** Total earned (all time) */
  totalEarned: {
    amount: number;
    asset: PaymentCurrency;
  };
  
  /** Earned this period (current month) */
  earnedThisPeriod: {
    amount: number;
    asset: PaymentCurrency;
    periodStart: string;
    periodEnd: string;
  };
  
  /** Pending distribution */
  pendingDistribution: {
    amount: number;
    asset: PaymentCurrency;
    proposalCount: number;
  };
  
  /** Reputation multiplier applied */
  reputationMultiplier: number;
}

// =============================================================================
// USER PREFERENCES
// =============================================================================

export interface WalletPreferences {
  /** Preferred drawer layout */
  preferredDrawerLayout: 'compact' | 'full';
  
  /** Show balances by default */
  showBalances: boolean;
  
  /** Show rewards by default */
  showRewards: boolean;
  
  /** Show tasks by default */
  showTasks: boolean;
  
  /** Default payment currency */
  defaultPaymentCurrency: PaymentCurrency;
  
  /** Auto-advance in sequences */
  autoAdvanceEnabled: boolean;
  
  /** Drawer overrides (user can override content's preferred drawers) */
  drawerOverrides: {
    enabled: boolean;
    preferredDrawers: DrawerType[];
  };
  
  /** Notification preferences */
  notifications: {
    rewardEarned: boolean;
    taskCompleted: boolean;
    contentUnlocked: boolean;
    lowBalance: boolean;
  };
}

// =============================================================================
// SMART WALLET NODE - MAIN INTERFACE
// =============================================================================

export interface SmartWalletNode {
  /** Wallet node ID */
  id: string;
  
  /** Type discriminator */
  type: 'SmartWalletNode';
  
  // --- Persona Context ---
  personaContext: PersonaContext;
  
  // --- Balances ---
  balances: WalletBalances;
  
  // --- Entitlements ---
  contentEntitlements: ContentEntitlement[];
  
  // --- Content Context ---
  contentContext: ContentContext;
  
  // --- Agent Context ---
  agentContext: AgentContext;
  
  // --- Tasks ---
  tasks: WalletTask[];
  activeQuests: QuestProgress[];
  
  // --- Rewards ---
  rewardsContext: RewardsContext;
  
  // --- Preferences ---
  preferences: WalletPreferences;
  
  // --- Wallet Addresses ---
  walletAddresses: {
    evm?: `0x${string}`;
    btc?: string;
    fio?: string;
  };
  
  // --- Timestamps ---
  lastSyncedAt: string;
  
  // --- Connection Status ---
  connectionStatus: 'connected' | 'disconnected' | 'syncing';
}

// =============================================================================
// FACTORY DEFAULTS
// =============================================================================

export const defaultPersonaContext: PersonaContext = {
  activePersonaId: '',
  activePersona: {
    id: '',
    displayName: 'Anonymous',
    identifiability: 'anonymous',
    reputationBucket: 0,
    reputationScore: 0,
    worldIdStatus: 'unverified',
    isAgent: false,
    appOrigin: 'aigent-z',
  },
  availablePersonas: [],
  switchingAllowed: true,
};

export const defaultWalletBalances: WalletBalances = {
  totalQc: 0,
  assets: [],
  pendingRewards: 0,
  pendingRewardsAsset: 'QCT',
  lastRefreshed: new Date().toISOString(),
};

export const defaultContentContext: ContentContext = {
  currentContentId: null,
  currentContentTitle: null,
  currentModality: null,
  pricingSnapshot: null,
  progressPercentage: 0,
  timeSpentSeconds: 0,
};

export const defaultAgentContext: AgentContext = {
  currentAgentId: null,
  currentAgentName: null,
  sessionId: null,
  interactionStartedAt: null,
  messageCount: 0,
  capabilities: [],
};

export const defaultRewardsContext: RewardsContext = {
  recentRewards: [],
  totalEarned: { amount: 0, asset: 'QCT' },
  earnedThisPeriod: {
    amount: 0,
    asset: 'QCT',
    periodStart: new Date().toISOString(),
    periodEnd: new Date().toISOString(),
  },
  pendingDistribution: { amount: 0, asset: 'QCT', proposalCount: 0 },
  reputationMultiplier: 1.0,
};

export const defaultWalletPreferences: WalletPreferences = {
  preferredDrawerLayout: 'compact',
  showBalances: true,
  showRewards: true,
  showTasks: true,
  defaultPaymentCurrency: 'QCT',
  autoAdvanceEnabled: true,
  drawerOverrides: {
    enabled: false,
    preferredDrawers: [],
  },
  notifications: {
    rewardEarned: true,
    taskCompleted: true,
    contentUnlocked: true,
    lowBalance: true,
  },
};

/** Create a new SmartWalletNode with defaults */
export function createSmartWalletNode(
  partial: Partial<SmartWalletNode> & Pick<SmartWalletNode, 'id'>
): SmartWalletNode {
  const now = new Date().toISOString();
  return {
    type: 'SmartWalletNode',
    personaContext: defaultPersonaContext,
    balances: defaultWalletBalances,
    contentEntitlements: [],
    contentContext: defaultContentContext,
    agentContext: defaultAgentContext,
    tasks: [],
    activeQuests: [],
    rewardsContext: defaultRewardsContext,
    preferences: defaultWalletPreferences,
    walletAddresses: {},
    lastSyncedAt: now,
    connectionStatus: 'disconnected',
    ...partial,
  };
}

// =============================================================================
// WALLET ACTIONS
// =============================================================================

export interface WalletAction {
  type: 
    | 'switchPersona'
    | 'purchaseContent'
    | 'claimReward'
    | 'completeTask'
    | 'startQuest'
    | 'abandonQuest'
    | 'updatePreferences'
    | 'refreshBalances'
    | 'syncEntitlements';
  
  payload: Record<string, any>;
}

export interface PurchaseContentPayload {
  contentId: string;
  pricingKind: PricingKind;
  amount: number;
  currency: PaymentCurrency;
}

export interface ClaimRewardPayload {
  proposalId: string;
  recipientPersonaId: string;
}

export interface CompleteTaskPayload {
  taskId: string;
  proof?: string;
}

export interface StartQuestPayload {
  questId: string;
  personaId: string;
}
