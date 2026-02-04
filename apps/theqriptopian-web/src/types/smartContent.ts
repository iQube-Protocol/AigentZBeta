/**
 * SmartContentQube Type Definitions (Minimal)
 * 
 * Copied from /types/smartContent.ts - only the types needed by smartWallet.ts
 */

// =============================================================================
// CORE ENUMS & TYPES
// =============================================================================

/** Identity state levels (aligned with DIDQube) */
export type IdentityState = 'anonymous' | 'pseudo' | 'semi' | 'full';

/** Pricing model kinds */
export type PricingKind = 
  | 'payPerPanel' 
  | 'payPerEpisode' 
  | 'payPerStream' 
  | 'payPerArticle'
  | 'payPerIssue'
  | 'payPerSeries'
  | 'subscription'
  | 'bundle'
  | 'free';

/** Payment currencies */
export type PaymentCurrency = 'QCT' | 'QOYN' | 'KNYT' | 'USDC' | 'ETH' | 'BTC' | 'sats';

/** Drawer types for menu integration */
export type DrawerType = 
  | 'contentViewer'
  | 'agentChat'
  | 'walletCompact'
  | 'walletFull'
  | 'libraryShelf'
  | 'questTracker'
  | 'rewardsPanel'
  | 'settingsPanel';
