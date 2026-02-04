/**
 * SmartWalletQube Fixtures
 * 
 * Example wallet configurations for metaKnyts and Qriptopian users.
 * These serve as test data and reference implementations.
 */

import type { SmartWalletQube } from '@/types/smartWalletQube';

// =============================================================================
// METAKNYTS USER WALLET
// =============================================================================

/**
 * metaKnyts / Kn0w1 user wallet
 * 
 * Assumptions:
 * - App: metaKnyts
 * - Persona: metaKnyts
 * - DIDQube says this persona is semi-identifiable
 * - User has Qc, KNYT, and QOYN, plus entitlements to episodes & Codex
 * - x402 + deferred minting + canonical sales are supported
 */
export const metaKnytsWalletFixture: SmartWalletQube = {
  id: 'wq:metaknyts:tenant-main:persona-metaknyts:user-123',
  type: 'SmartWalletQube',
  appId: 'metaKnyts',
  tenantId: 'tenant-main',
  personaId: 'metaKnyts',
  did: 'did:iq:metaknyts:user-123:persona-metaknyts',
  kybeDid: 'did:iq:kybe:user-123',
  identityState: 'semi',

  balances: [
    {
      asset: 'Qc',
      chain: 'bitcoin',
      amount: '2100.00',
      symbol: 'Qc',
      label: 'Spending',
    },
    {
      asset: 'KNYT',
      chain: 'bitcoin',
      amount: '42.00',
      symbol: 'KNYT',
      label: 'Collector',
    },
    {
      asset: 'QOYN',
      chain: 'bitcoin',
      amount: '0.75',
      symbol: 'QOYN',
      label: 'Reserve',
    },
  ],

  entitlements: [
    {
      entitlementId: 'metaKnyts:episode:1',
      category: 'episode',
      status: 'active',
      acquiredVia: 'purchase',
      txRef: 'x402:btc:tx-001',
      expiry: null,
    },
    {
      entitlementId: 'metaKnyts:episode:2',
      category: 'episode',
      status: 'active',
      acquiredVia: 'questReward',
      txRef: 'rqh:reward:quest-001',
      expiry: null,
    },
    {
      entitlementId: 'metaKnyts:codex:volume-1',
      category: 'bundle',
      status: 'active',
      acquiredVia: 'subscription',
      txRef: 'x402:btc:sub-001',
      expiry: null,
    },
  ],

  rewards: [
    {
      programId: 'metaKnyts:quest:codex1',
      progress: 0.6,
      pendingReward: {
        asset: 'KNYT',
        amount: '3.00',
      },
      claimedReward: undefined,
    },
    {
      programId: 'metaKnyts:quest:reader-streak',
      progress: 1.0,
      pendingReward: undefined,
      claimedReward: {
        asset: 'QCT',
        amount: '100.00',
        txRef: 'x402:btc:reward-007',
      },
    },
  ],

  tasks: [
    {
      taskId: 'task:metaknyts:finish-ep3',
      label: 'Finish Episode 3',
      status: 'in-progress',
      relatedContentId: 'cq:metaknyts:episode:3',
      rewardPreview: {
        asset: 'KNYT',
        amount: '1.00',
      },
    },
    {
      taskId: 'task:metaknyts:read-cryptopian-penny',
      label: "Read 'The Penny is Dead' in The Qriptonian",
      status: 'todo',
      relatedContentId: 'cq:qriptopian:article:penny-is-dead',
      rewardPreview: {
        asset: 'QCT',
        amount: '50.00',
      },
    },
    {
      taskId: 'task:metaknyts:share-episode1',
      label: 'Share Episode 1 with a friend',
      status: 'done',
      relatedContentId: 'cq:metaknyts:episode:1',
      rewardPreview: undefined,
    },
  ],

  quests: [
    {
      questId: 'metaKnyts:quest:codex1',
      label: 'Unlock the First Codex Path',
      status: 'ongoing',
      steps: [
        {
          taskId: 'task:metaknyts:finish-ep1',
          label: 'Finish Episode 1',
          status: 'done',
          relatedContentId: 'cq:metaknyts:episode:1',
          rewardPreview: undefined,
        },
        {
          taskId: 'task:metaknyts:finish-ep2',
          label: 'Finish Episode 2',
          status: 'done',
          relatedContentId: 'cq:metaknyts:episode:2',
          rewardPreview: undefined,
        },
        {
          taskId: 'task:metaknyts:finish-ep3',
          label: 'Finish Episode 3',
          status: 'in-progress',
          relatedContentId: 'cq:metaknyts:episode:3',
          rewardPreview: {
            asset: 'KNYT',
            amount: '3.00',
          },
        },
      ],
    },
  ],

  paymentCapabilities: {
    canX402: true,
    supportedChains: [
      'bitcoin',
      'solana',
      'ethereum',
      'polygon',
      'optimism',
      'arbitrum',
      'base',
      'icp',
    ],
    supportedAssets: ['Qc', 'QOYN', 'QCT', 'KNYT'],
    supportsDeferredMint: true,
    supportsRemoteCustody: true,
    supportsCanonicalSales: true,
    defaultAsset: 'Qc',
  },

  layoutHints: {
    preferredOverviewModal: 'walletOverview',
    preferredTasksModal: 'walletTasksList',
    preferredEntitlementsModal: 'thumbnailRect',
    showPerPersonaTabs: true,
  },

  createdAt: '2025-12-01T12:00:00Z',
  updatedAt: '2025-12-04T09:00:00Z',
  _meta: {
    inferred: [],
  },
};

// =============================================================================
// QRIPTOPIAN INVESTOR WALLET
// =============================================================================

/**
 * Qriptopian / Investor persona wallet
 * 
 * Assumptions:
 * - App: Qriptopian
 * - Persona: Investor
 * - DIDQube says full identifiability (KYC'd persona)
 * - Strong focus on QCT/QOYN/real-yield entitlements + edu tasks
 */
export const qriptopianWalletFixture: SmartWalletQube = {
  id: 'wq:qriptopian:tenant-main:persona-investor:user-987',
  type: 'SmartWalletQube',
  appId: 'Qriptopian',
  tenantId: 'tenant-main',
  personaId: 'Investor',
  did: 'did:iq:qriptopian:user-987:persona-investor',
  kybeDid: 'did:iq:kybe:user-987',
  identityState: 'full',

  balances: [
    {
      asset: 'QCT',
      chain: 'bitcoin',
      amount: '10500.00',
      symbol: 'QCT',
      label: 'Micro-stable',
    },
    {
      asset: 'QOYN',
      chain: 'bitcoin',
      amount: '15.00',
      symbol: 'QOYN',
      label: 'Core Reserve',
    },
    {
      asset: 'Qc',
      chain: 'bitcoin',
      amount: '350.00',
      symbol: 'Qc',
      label: 'Reading Credits',
    },
  ],

  entitlements: [
    {
      entitlementId: 'Qriptopian:issue:1',
      category: 'issue',
      status: 'active',
      acquiredVia: 'purchase',
      txRef: 'x402:btc:tx-101',
      expiry: null,
    },
    {
      entitlementId: 'Qriptopian:article:penny-is-dead',
      category: 'article',
      status: 'active',
      acquiredVia: 'purchase',
      txRef: 'x402:btc:tx-102',
      expiry: null,
    },
    {
      entitlementId: 'Qriptopian:article:cryptosent-micropayments',
      category: 'article',
      status: 'active',
      acquiredVia: 'questReward',
      txRef: 'rqh:reward:micropayments-quest',
      expiry: null,
    },
  ],

  rewards: [
    {
      programId: 'Qriptopian:eduTrack:micropayments',
      progress: 0.8,
      pendingReward: {
        asset: 'QCT',
        amount: '500.00',
      },
      claimedReward: undefined,
    },
  ],

  tasks: [
    {
      taskId: 'task:qriptopian:read-penny-is-dead',
      label: "Read 'The Penny is Dead'",
      status: 'done',
      relatedContentId: 'cq:qriptopian:article:penny-is-dead',
      rewardPreview: undefined,
    },
    {
      taskId: 'task:qriptopian:read-cryptosent',
      label: "Read 'CryptoSent: the cent that makes sense'",
      status: 'in-progress',
      relatedContentId: 'cq:qriptopian:article:cryptosent-micropayments',
      rewardPreview: {
        asset: 'QCT',
        amount: '250.00',
      },
    },
    {
      taskId: 'task:qriptopian:simulate-micropayments',
      label: 'Run a micropayments simulation',
      status: 'todo',
      relatedContentId: 'cq:qriptopian:tool:micropayments-simulator',
      rewardPreview: {
        asset: 'QCT',
        amount: '250.00',
      },
    },
  ],

  quests: [
    {
      questId: 'Qriptopian:quest:micropayments-Series1',
      label: 'Master Micropayments – Series 1',
      status: 'ongoing',
      steps: [
        {
          taskId: 'task:qriptopian:read-penny-is-dead',
          label: "Read 'The Penny is Dead'",
          status: 'done',
          relatedContentId: 'cq:qriptopian:article:penny-is-dead',
          rewardPreview: undefined,
        },
        {
          taskId: 'task:qriptopian:read-cryptosent',
          label: "Read 'CryptoSent: the cent that makes sense'",
          status: 'in-progress',
          relatedContentId: 'cq:qriptopian:article:cryptosent-micropayments',
          rewardPreview: {
            asset: 'QCT',
            amount: '250.00',
          },
        },
        {
          taskId: 'task:qriptopian:simulate-micropayments',
          label: 'Run a micropayments simulation',
          status: 'todo',
          relatedContentId: 'cq:qriptopian:tool:micropayments-simulator',
          rewardPreview: {
            asset: 'QCT',
            amount: '250.00',
          },
        },
      ],
    },
  ],

  paymentCapabilities: {
    canX402: true,
    supportedChains: ['bitcoin', 'icp', 'ethereum', 'polygon'],
    supportedAssets: ['QCT', 'QOYN', 'Qc'],
    supportsDeferredMint: true,
    supportsRemoteCustody: true,
    supportsCanonicalSales: true,
    defaultAsset: 'QCT',
  },

  layoutHints: {
    preferredOverviewModal: 'walletOverview',
    preferredTasksModal: 'walletTasksList',
    preferredEntitlementsModal: 'thumbnailRect',
    showPerPersonaTabs: false,
  },

  createdAt: '2025-11-30T10:00:00Z',
  updatedAt: '2025-12-04T09:30:00Z',
  _meta: {
    inferred: [],
  },
};

// =============================================================================
// MONEYPENNY DEFI TRADER WALLET
// =============================================================================

/**
 * MoneyPenny / DeFi Trader persona wallet
 * 
 * Assumptions:
 * - App: MoneyPenny
 * - Persona: DeFiTrader
 * - DIDQube says semi-identifiable (KYC-light but not fully public)
 * - User has QCT (micro-stable), QOYN (reserve), Qc (spend)
 * - Has active DeFi portfolio with positions and strategies
 * - x402, DVN, deferred minting, canonical sales, remote custody all available
 */
export const moneyPennyWalletFixture: SmartWalletQube = {
  id: 'wq:staybull:tenant-main:persona-defitrader:user-555',
  type: 'SmartWalletQube',
  appId: 'StayBull',
  tenantId: 'tenant-main',
  personaId: 'DeFiTrader',
  did: 'did:iq:staybull:user-555:persona-defitrader',
  kybeDid: 'did:iq:kybe:user-555',
  identityState: 'semi',

  balances: [
    {
      asset: 'QCT',
      chain: 'bitcoin',
      amount: '25000.00',
      symbol: 'QCT',
      label: 'Micro-stable',
    },
    {
      asset: 'QOYN',
      chain: 'bitcoin',
      amount: '12.50',
      symbol: 'QOYN',
      label: 'Core Reserve',
    },
    {
      asset: 'Qc',
      chain: 'bitcoin',
      amount: '780.00',
      symbol: 'Qc',
      label: 'Spending',
    },
  ],

  entitlements: [
    {
      entitlementId: 'Qriptopian:issue:1',
      category: 'issue',
      status: 'active',
      acquiredVia: 'purchase',
      txRef: 'x402:btc:tx-201',
      expiry: null,
    },
    {
      entitlementId: 'metaKnyts:episode:1',
      category: 'episode',
      status: 'active',
      acquiredVia: 'questReward',
      txRef: 'rqh:reward:metaknyts-hft-onboarding',
      expiry: null,
    },
  ],

  rewards: [
    {
      programId: 'MoneyPenny:quest:safe-yield-starter',
      progress: 0.4,
      pendingReward: {
        asset: 'QCT',
        amount: '500.00',
      },
      claimedReward: undefined,
    },
  ],

  tasks: [
    {
      taskId: 'task:moneypenny:run-safe-yield-sim',
      label: 'Run Safe Yield strategy in simulation mode',
      status: 'in-progress',
      relatedContentId: 'cq:moneypenny:strategy:safe-yield',
      rewardPreview: {
        asset: 'QCT',
        amount: '100.00',
      },
    },
    {
      taskId: 'task:moneypenny:allocate-qct-to-safe-yield',
      label: 'Allocate 500 QCT to Safe Yield strategy',
      status: 'todo',
      relatedContentId: 'cq:moneypenny:strategy:safe-yield',
      rewardPreview: {
        asset: 'QCT',
        amount: '200.00',
      },
    },
    {
      taskId: 'task:moneypenny:read-cryptosent-article',
      label: "Read 'CryptoSent: the cent that makes sense'",
      status: 'todo',
      relatedContentId: 'cq:qriptopian:article:cryptosent-micropayments',
      rewardPreview: undefined,
    },
  ],

  quests: [
    {
      questId: 'MoneyPenny:quest:safe-yield-onboarding',
      label: 'Safe Yield Onboarding',
      status: 'ongoing',
      steps: [
        {
          taskId: 'task:moneypenny:read-cryptosent-article',
          label: "Read 'CryptoSent: the cent that makes sense'",
          status: 'todo',
          relatedContentId: 'cq:qriptopian:article:cryptosent-micropayments',
          rewardPreview: undefined,
        },
        {
          taskId: 'task:moneypenny:run-safe-yield-sim',
          label: 'Run Safe Yield strategy in simulation mode',
          status: 'in-progress',
          relatedContentId: 'cq:moneypenny:strategy:safe-yield',
          rewardPreview: {
            asset: 'QCT',
            amount: '100.00',
          },
        },
        {
          taskId: 'task:moneypenny:allocate-qct-to-safe-yield',
          label: 'Allocate 500 QCT to Safe Yield strategy',
          status: 'todo',
          relatedContentId: 'cq:moneypenny:strategy:safe-yield',
          rewardPreview: {
            asset: 'QCT',
            amount: '200.00',
          },
        },
      ],
    },
  ],

  defiPortfolio: {
    positions: [
      {
        positionId: 'pos:moneypenny:yield-curve-001',
        protocol: 'SafeYieldPool',
        chain: 'ethereum',
        assetIn: 'QCT',
        assetOut: 'QCT',
        amountIn: '5000.00',
        currentValue: '5035.00',
        pnl: '35.00',
        status: 'open',
        riskBand: 'low',
        apy: 0.042,
        openedAt: '2025-11-15T10:00:00Z',
      },
      {
        positionId: 'pos:moneypenny:market-neutral-eth-btc-001',
        protocol: 'BasisNeutral',
        chain: 'base',
        assetIn: 'QCT',
        assetOut: 'QCT',
        amountIn: '2000.00',
        currentValue: '1985.00',
        pnl: '-15.00',
        status: 'open',
        riskBand: 'medium',
        apy: 0.085,
        openedAt: '2025-11-20T14:30:00Z',
      },
    ],
    strategies: [
      {
        strategyId: 'strategy:moneypenny:safe-yield',
        label: 'Safe Yield (QCT pool ladder)',
        category: 'yield',
        status: 'running',
        allocatedAsset: 'QCT',
        allocatedAmount: '5000.00',
        currentValue: '5035.00',
        riskBand: 'low',
        relatedContentId: 'cq:moneypenny:strategy:safe-yield',
        description: 'Conservative yield strategy using QCT pool laddering across multiple protocols',
        targetApy: 0.04,
        actualApy: 0.042,
      },
      {
        strategyId: 'strategy:moneypenny:market-neutral-eth-btc',
        label: 'Market Neutral ETH/BTC Basis',
        category: 'marketNeutral',
        status: 'running',
        allocatedAsset: 'QCT',
        allocatedAmount: '2000.00',
        currentValue: '1985.00',
        riskBand: 'medium',
        relatedContentId: 'cq:moneypenny:strategy:market-neutral',
        description: 'Delta-neutral basis trade capturing funding rate differentials',
        targetApy: 0.10,
        actualApy: 0.085,
      },
      {
        strategyId: 'strategy:moneypenny:directional-btc',
        label: 'Directional BTC Accumulation',
        category: 'directional',
        status: 'idle',
        allocatedAsset: undefined,
        allocatedAmount: undefined,
        currentValue: undefined,
        riskBand: 'high',
        relatedContentId: 'cq:moneypenny:strategy:directional-btc',
        description: 'Trend-following BTC accumulation with dynamic position sizing',
        targetApy: 0.25,
      },
    ],
    riskSummary: {
      totalValue: '7020.00',
      exposureByAsset: [
        { asset: 'QCT', value: '7020.00', percentage: 1.0 },
      ],
      exposureByRiskBand: [
        { band: 'low', value: '5035.00', percentage: 0.717 },
        { band: 'medium', value: '1985.00', percentage: 0.283 },
        { band: 'high', value: '0.00', percentage: 0 },
        { band: 'experimental', value: '0.00', percentage: 0 },
      ],
      riskScore: 28,
      dominantRiskBand: 'low',
    },
    totalUnrealizedPnl: '20.00',
    totalRealizedPnl: '0.00',
    lastRebalanceAt: '2025-12-01T08:00:00Z',
  },

  paymentCapabilities: {
    canX402: true,
    supportedChains: ['bitcoin', 'ethereum', 'base', 'solana', 'icp'],
    supportedAssets: ['QCT', 'QOYN', 'Qc'],
    supportsDeferredMint: true,
    supportsRemoteCustody: true,
    supportsCanonicalSales: true,
    defaultAsset: 'QCT',
  },

  layoutHints: {
    preferredOverviewModal: 'walletOverview',
    preferredTasksModal: 'walletTasksList',
    preferredEntitlementsModal: 'thumbnailRect',
    showPerPersonaTabs: false,
  },

  createdAt: '2025-11-25T09:00:00Z',
  updatedAt: '2025-12-04T10:00:00Z',
  _meta: {
    inferred: [],
  },
};

// =============================================================================
// EMPTY/MINIMAL WALLET (for new users)
// =============================================================================

/**
 * Minimal wallet for a new user
 * Used as a starting point before normalization fills in defaults
 */
export const minimalWalletFixture: Partial<SmartWalletQube> = {
  id: 'wq:metaknyts:tenant-main:persona-new:user-new',
  appId: 'metaKnyts',
  tenantId: 'tenant-main',
  personaId: 'newUser',
  did: 'did:iq:metaknyts:user-new:persona-new',
  // All other fields will be inferred by normalizeSmartWalletQube
};

// =============================================================================
// ALL FIXTURES
// =============================================================================

export const walletFixtures = {
  metaKnyts: metaKnytsWalletFixture,
  qriptopian: qriptopianWalletFixture,
  moneyPenny: moneyPennyWalletFixture,
  minimal: minimalWalletFixture,
};

export default walletFixtures;
