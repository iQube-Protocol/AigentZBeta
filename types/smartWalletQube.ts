/**
 * SmartWalletQube v0 Type Definitions
 * 
 * The wallet particle in the iQube architecture:
 * - Field = metaNet / BlakNet / QriptoNet network fabric
 * - Particles = iQubes (SmartContentQube, SmartWalletQube, AigentQube, etc.)
 * - Waves = relationships, flows, payments, entitlements, risk
 * - Nodes = apps, agents, and wallets – where flows converge
 * 
 * SmartWalletQube is the wallet-side twin of SmartContentQube.
 * It encapsulates:
 * - Identity/persona state (DIDQube)
 * - Balances (Qc, QOYN, QCT, KNYT across chains)
 * - Entitlements (episodes, issues, articles, bundles)
 * - Reward state (quests, pending/claimed rewards)
 * - Tasks (things the user can do to earn/advance)
 * - Payment capabilities (x402, DVN, remote custody, deferred minting)
 */

// =============================================================================
// CORE TYPES
// =============================================================================

/** Identity state levels (aligned with DIDQube) */
export type WalletIdentityState = 'anon' | 'pseudo' | 'semi' | 'full';

/** Supported blockchain networks */
export type ChainId = 
  | 'bitcoin' 
  | 'solana' 
  | 'ethereum' 
  | 'polygon' 
  | 'optimism' 
  | 'arbitrum' 
  | 'base' 
  | 'icp'
  | string;

/** Supported assets */
export type WalletAsset = 'Qc' | 'QOYN' | 'QCT' | 'KNYT' | string;

/** Entitlement categories */
export type EntitlementCategory = 
  | 'episode' 
  | 'issue' 
  | 'article' 
  | 'bundle' 
  | 'questItem' 
  | string;

/** Entitlement status */
export type EntitlementStatus = 'active' | 'expired' | 'pending' | 'locked';

/** How entitlement was acquired */
export type AcquisitionMethod = 
  | 'purchase' 
  | 'subscription' 
  | 'questReward' 
  | 'airdrop' 
  | 'admin';

/** Task status */
export type WalletTaskStatus = 'todo' | 'in-progress' | 'done' | 'expired';

/** Quest status */
export type WalletQuestStatus = 'ongoing' | 'complete' | 'failed';

/** DeFi position status */
export type DefiPositionStatus = 'open' | 'closed' | 'pending';

/** DeFi strategy status */
export type DefiStrategyStatus = 'idle' | 'running' | 'cooldown';

/** DeFi strategy category */
export type DefiStrategyCategory = 
  | 'yield' 
  | 'marketNeutral' 
  | 'directional' 
  | 'hedging' 
  | 'index';

/** Risk band levels */
export type RiskBand = 'low' | 'medium' | 'high' | 'experimental';

// =============================================================================
// BALANCE TYPES
// =============================================================================

export interface WalletBalance {
  /** Asset identifier (Qc, QOYN, QCT, KNYT, etc.) */
  asset: WalletAsset;
  
  /** Blockchain network */
  chain: ChainId;
  
  /** Amount as string to avoid float precision issues */
  amount: string;
  
  /** Display symbol (e.g., "Q¢", "KNYT") */
  symbol: string;
  
  /** Optional label (e.g., "Spending", "Rewards", "Creator Pool") */
  label?: string;
}

// =============================================================================
// ENTITLEMENT TYPES
// =============================================================================

export interface WalletEntitlement {
  /** Unique entitlement ID (e.g., "metaKnyts:episode:1") */
  entitlementId: string;
  
  /** Category of content */
  category: EntitlementCategory;
  
  /** Current status */
  status: EntitlementStatus;
  
  /** How this was acquired */
  acquiredVia: AcquisitionMethod;
  
  /** Transaction reference (x402 or RQH) */
  txRef?: string;
  
  /** Expiry date (null = permanent) */
  expiry?: string | null;
}

// =============================================================================
// REWARD TYPES
// =============================================================================

export interface WalletRewardState {
  /** Program/quest ID */
  programId: string;
  
  /** Progress (0-1) */
  progress: number;
  
  /** Pending reward (not yet claimed) */
  pendingReward?: {
    asset: WalletAsset;
    amount: string;
  };
  
  /** Claimed reward */
  claimedReward?: {
    asset: WalletAsset;
    amount: string;
    txRef?: string;
  };
}

// =============================================================================
// TASK & QUEST TYPES
// =============================================================================

export interface WalletTask {
  /** Task ID */
  taskId: string;
  
  /** Human-readable label */
  label: string;
  
  /** Current status */
  status: WalletTaskStatus;
  
  /** Related SmartContentQube ID */
  relatedContentId?: string;
  
  /** Reward preview */
  rewardPreview?: {
    asset: WalletAsset;
    amount: string;
  };
}

export interface WalletQuest {
  /** Quest ID */
  questId: string;
  
  /** Human-readable label */
  label: string;
  
  /** Quest steps (tasks) */
  steps: WalletTask[];
  
  /** Current status */
  status: WalletQuestStatus;
}

// =============================================================================
// DEFI PORTFOLIO TYPES (MoneyPenny HFT/DeFi)
// =============================================================================

/** Individual DeFi position */
export interface DefiPosition {
  /** Unique position ID */
  positionId: string;
  
  /** Protocol name (e.g., "UniswapV3", "Lido", "Aave", "SafeYieldPool") */
  protocol: string;
  
  /** Blockchain network */
  chain: ChainId;
  
  /** Asset supplied/deposited */
  assetIn: WalletAsset;
  
  /** Asset exposed to (if different from assetIn) */
  assetOut?: WalletAsset;
  
  /** Amount deposited (string for precision) */
  amountIn: string;
  
  /** Current value in Qc/QCT equivalent */
  currentValue: string;
  
  /** Profit/Loss (realized + unrealized) */
  pnl?: string;
  
  /** Position status */
  status: DefiPositionStatus;
  
  /** Risk classification */
  riskBand?: RiskBand;
  
  /** APY/yield rate (as decimal, e.g., 0.05 for 5%) */
  apy?: number;
  
  /** Position opened timestamp */
  openedAt?: string;
  
  /** Position closed timestamp (if closed) */
  closedAt?: string;
}

/** DeFi strategy state */
export interface DefiStrategyState {
  /** Strategy ID (links to SmartContentQube strategy card) */
  strategyId: string;
  
  /** Human-readable label */
  label: string;
  
  /** Strategy category */
  category: DefiStrategyCategory;
  
  /** Current status */
  status: DefiStrategyStatus;
  
  /** Asset allocated to this strategy */
  allocatedAsset?: WalletAsset;
  
  /** Amount allocated */
  allocatedAmount?: string;
  
  /** Current value */
  currentValue?: string;
  
  /** Risk classification */
  riskBand?: RiskBand;
  
  /** Related SmartContentQube ID (strategy documentation) */
  relatedContentId?: string;
  
  /** Strategy description */
  description?: string;
  
  /** Target APY */
  targetApy?: number;
  
  /** Actual APY (realized) */
  actualApy?: number;
}

/** Asset exposure breakdown */
export interface AssetExposure {
  asset: WalletAsset;
  value: string;
  percentage?: number;
}

/** Risk band exposure breakdown */
export interface RiskExposure {
  band: RiskBand;
  value: string;
  percentage?: number;
}

/** DeFi risk summary */
export interface DefiRiskSummary {
  /** Total portfolio value in Qc/QCT equivalent */
  totalValue: string;
  
  /** Exposure by asset */
  exposureByAsset: AssetExposure[];
  
  /** Exposure by risk band */
  exposureByRiskBand: RiskExposure[];
  
  /** Overall risk score (0-100) */
  riskScore?: number;
  
  /** Dominant risk band */
  dominantRiskBand?: RiskBand;
}

/** Complete DeFi portfolio state */
export interface DefiPortfolioState {
  /** Open and closed positions */
  positions: DefiPosition[];
  
  /** Strategy allocations */
  strategies: DefiStrategyState[];
  
  /** Aggregated risk summary */
  riskSummary?: DefiRiskSummary;
  
  /** Total unrealized P&L */
  totalUnrealizedPnl?: string;
  
  /** Total realized P&L */
  totalRealizedPnl?: string;
  
  /** Last rebalance timestamp */
  lastRebalanceAt?: string;
}

// =============================================================================
// PAYMENT CAPABILITIES
// =============================================================================

export interface WalletPaymentCapabilities {
  /** x402 micropayments enabled */
  canX402: boolean;
  
  /** Supported blockchain networks */
  supportedChains: ChainId[];
  
  /** Supported assets */
  supportedAssets: WalletAsset[];
  
  /** Deferred minting capability */
  supportsDeferredMint?: boolean;
  
  /** Remote custody capability */
  supportsRemoteCustody?: boolean;
  
  /** Canonical sales capability */
  supportsCanonicalSales?: boolean;
  
  /** Default spending asset */
  defaultAsset?: WalletAsset;
}

// =============================================================================
// LAYOUT HINTS
// =============================================================================

export interface WalletLayoutHints {
  /** Preferred modal for wallet overview */
  preferredOverviewModal?: string;
  
  /** Preferred modal for tasks display */
  preferredTasksModal?: string;
  
  /** Preferred modal for entitlements display */
  preferredEntitlementsModal?: string;
  
  /** Show per-persona tabs in wallet UI */
  showPerPersonaTabs?: boolean;
}

// =============================================================================
// INFERRED FIELD TRACKING
// =============================================================================

export interface InferredField {
  /** JSON path to the field */
  path: string;
  
  /** Original value (undefined if missing) */
  from: any;
  
  /** Inferred value */
  to: any;
  
  /** Reason for inference */
  reason: string;
}

// =============================================================================
// SMART WALLET QUBE - MAIN INTERFACE
// =============================================================================

export interface SmartWalletQube {
  /** Unique ID (e.g., "wq:metaknyts:tenant-main:persona-metaknyts:user-123") */
  id: string;
  
  /** Type discriminator */
  type: 'SmartWalletQube';
  
  /** Application context */
  appId: string;
  
  /** Tenant context */
  tenantId: string;
  
  /** Persona context */
  personaId: string;
  
  // --- Identity ---
  
  /** Active DID for this wallet view */
  did: string;
  
  /** Ultimate anchor (KybeDID) */
  kybeDid?: string;
  
  /** Current identity state */
  identityState: WalletIdentityState;
  
  // --- Core Wallet Data ---
  
  /** Balances across chains */
  balances: WalletBalance[];
  
  /** Content entitlements */
  entitlements: WalletEntitlement[];
  
  /** Reward states */
  rewards: WalletRewardState[];
  
  /** Active tasks */
  tasks: WalletTask[];
  
  /** Active quests */
  quests?: WalletQuest[];
  
  // --- DeFi Portfolio (MoneyPenny) ---
  
  /** DeFi portfolio state (positions, strategies, risk) */
  defiPortfolio?: DefiPortfolioState;
  
  // --- Capabilities ---
  
  /** Payment capabilities */
  paymentCapabilities: WalletPaymentCapabilities;
  
  /** Layout hints for SmartDrawer */
  layoutHints?: WalletLayoutHints;
  
  // --- Timestamps ---
  
  /** Created timestamp */
  createdAt: string;
  
  /** Last updated timestamp */
  updatedAt: string;
  
  // --- Metadata ---
  
  /** Inference and validation metadata */
  _meta?: {
    inferred?: InferredField[];
  };
}

// =============================================================================
// VALIDATION CONTEXT
// =============================================================================

export interface WalletValidationContext {
  /** Application ID */
  appId: string;
  
  /** Tenant ID */
  tenantId: string;
  
  /** Persona ID */
  personaId: string;
  
  /** DIDQube policy */
  didQubePolicy: {
    allowedIdentityStates: WalletIdentityState[];
    defaultIdentityState: WalletIdentityState;
  };
  
  /** DVN configuration */
  dvnConfig: {
    supportedChains: ChainId[];
    supportedAssets: WalletAsset[];
  };
  
  /** x402 configuration */
  x402Config: {
    canX402: boolean;
    supportsDeferredMint: boolean;
    supportsRemoteCustody: boolean;
    supportsCanonicalSales: boolean;
    defaultAsset?: WalletAsset;
  };
}

// =============================================================================
// NORMALIZATION RESULT
// =============================================================================

export interface NormalizedWalletResult {
  /** Normalized wallet qube */
  normalized: SmartWalletQube;
  
  /** List of inferred fields */
  inferred: InferredField[];
}

// =============================================================================
// VALIDATION RESULT
// =============================================================================

export interface WalletValidationResult {
  /** Validation errors (blocking) */
  errors: string[];
  
  /** Validation warnings (non-blocking) */
  warnings: string[];
  
  /** Is valid (no errors) */
  isValid: boolean;
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/** Create a new SmartWalletQube with minimal required fields */
export function createSmartWalletQube(
  partial: Partial<SmartWalletQube> & Pick<SmartWalletQube, 'id' | 'appId' | 'tenantId' | 'personaId' | 'did'>
): SmartWalletQube {
  const now = new Date().toISOString();
  return {
    type: 'SmartWalletQube',
    identityState: 'anon',
    balances: [],
    entitlements: [],
    rewards: [],
    tasks: [],
    quests: [],
    paymentCapabilities: {
      canX402: false,
      supportedChains: [],
      supportedAssets: [],
    },
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

/** Default validation context */
export const defaultWalletValidationContext: WalletValidationContext = {
  appId: 'default',
  tenantId: 'default',
  personaId: 'default',
  didQubePolicy: {
    allowedIdentityStates: ['anon', 'pseudo', 'semi', 'full'],
    defaultIdentityState: 'anon',
  },
  dvnConfig: {
    supportedChains: ['bitcoin', 'solana', 'ethereum', 'polygon', 'optimism', 'arbitrum', 'base', 'icp'],
    supportedAssets: ['Qc', 'QOYN', 'QCT', 'KNYT'],
  },
  x402Config: {
    canX402: true,
    supportsDeferredMint: true,
    supportsRemoteCustody: true,
    supportsCanonicalSales: true,
    defaultAsset: 'Qc',
  },
};
