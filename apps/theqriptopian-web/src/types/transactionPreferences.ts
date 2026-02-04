/**
 * Transaction Preferences Types
 * 
 * Defines the schema for user transaction preferences stored in
 * profiles.trading_preferences JSONB column.
 * 
 * Includes:
 * - Auto-execute thresholds for Copilot transactions
 * - Delivery mode preferences (custody, claim, canonical)
 * - Chain preferences
 */

// =============================================================================
// CONFIRMATION THRESHOLD SETTINGS
// =============================================================================

export interface AutoExecuteThreshold {
  /** Maximum Q¢ amount that can be auto-executed without confirmation */
  maxAmount: number;
  /** Whether auto-execute is enabled at all */
  enabled: boolean;
  /** Require 2FA for amounts above this threshold (0 = always require) */
  require2FAAbove: number;
  /** Trusted recipients that bypass confirmation (FIO handles or addresses) */
  trustedRecipients: string[];
}

// =============================================================================
// DELIVERY MODE PREFERENCES
// =============================================================================

export type DeliveryModePreference = 'canonical' | 'custody' | 'claim' | 'auto';

export interface DeliveryModeSettings {
  /** Default delivery mode for transactions */
  defaultMode: DeliveryModePreference;
  /** Prefer custody mode for amounts above this threshold */
  custodyAbove: number;
  /** Prefer deferred/claim mode for cross-chain transactions */
  preferDeferredForCrossChain: boolean;
}

// =============================================================================
// CHAIN PREFERENCES
// =============================================================================

export interface ChainPreference {
  /** Chain ID */
  chainId: number | string;
  /** Whether this chain is enabled for transactions */
  enabled: boolean;
  /** Priority order (lower = higher priority) */
  priority: number;
}

export interface ChainSettings {
  /** Default chain for outgoing transactions */
  defaultChainId: number;
  /** Preferred chains in order of preference */
  preferredChains: ChainPreference[];
  /** Allow transactions on inactive/coming-soon chains */
  allowInactiveChains: boolean;
}

// =============================================================================
// NOTIFICATION PREFERENCES
// =============================================================================

export interface TransactionNotifications {
  /** Notify on successful transactions */
  onSuccess: boolean;
  /** Notify on failed transactions */
  onFailure: boolean;
  /** Notify on incoming payments */
  onIncoming: boolean;
  /** Notify on payment request received */
  onRequestReceived: boolean;
  /** Notification channels */
  channels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
}

// =============================================================================
// COMPLETE TRANSACTION PREFERENCES
// =============================================================================

export interface TransactionPreferences {
  /** Auto-execute threshold settings */
  autoExecute: AutoExecuteThreshold;
  /** Delivery mode preferences */
  deliveryMode: DeliveryModeSettings;
  /** Chain preferences */
  chains: ChainSettings;
  /** Notification preferences */
  notifications: TransactionNotifications;
  /** Last updated timestamp */
  updatedAt: string;
}

// =============================================================================
// DEFAULT VALUES
// =============================================================================

export const DEFAULT_TRANSACTION_PREFERENCES: TransactionPreferences = {
  autoExecute: {
    maxAmount: 0, // Disabled by default - always require confirmation
    enabled: false,
    require2FAAbove: 0,
    trustedRecipients: [],
  },
  deliveryMode: {
    defaultMode: 'canonical',
    custodyAbove: 1000,
    preferDeferredForCrossChain: true,
  },
  chains: {
    defaultChainId: 421614, // Arbitrum Sepolia
    preferredChains: [
      { chainId: 421614, enabled: true, priority: 1 },  // Arbitrum
      { chainId: 84532, enabled: true, priority: 2 },   // Base
      { chainId: 80002, enabled: true, priority: 3 },   // Polygon
      { chainId: 11155420, enabled: true, priority: 4 }, // Optimism
      { chainId: 11155111, enabled: true, priority: 5 }, // Ethereum
    ],
    allowInactiveChains: false,
  },
  notifications: {
    onSuccess: true,
    onFailure: true,
    onIncoming: true,
    onRequestReceived: true,
    channels: {
      inApp: true,
      email: false,
      push: false,
    },
  },
  updatedAt: new Date().toISOString(),
};

// =============================================================================
// TRADING PREFERENCES (extends existing schema)
// =============================================================================

/**
 * Extended trading_preferences schema that includes transaction preferences
 * This is stored in profiles.trading_preferences JSONB column
 */
export interface TradingPreferences {
  /** Saved personas for quick switching */
  saved_personas?: Array<{
    id: string;
    name: string;
    fioHandle?: string;
    isAgent: boolean;
  }>;
  /** Transaction preferences */
  transactions?: TransactionPreferences;
  /** Other trading preferences can be added here */
  [key: string]: unknown;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a transaction amount can be auto-executed
 */
export function canAutoExecute(
  amount: number,
  recipient: string,
  preferences: TransactionPreferences
): { allowed: boolean; reason?: string } {
  if (!preferences.autoExecute.enabled) {
    return { allowed: false, reason: 'Auto-execute is disabled' };
  }
  
  if (amount > preferences.autoExecute.maxAmount) {
    return { 
      allowed: false, 
      reason: `Amount exceeds auto-execute threshold (${preferences.autoExecute.maxAmount} Q¢)` 
    };
  }
  
  // Check if recipient is trusted
  const isTrusted = preferences.autoExecute.trustedRecipients.some(
    tr => tr.toLowerCase() === recipient.toLowerCase()
  );
  
  if (isTrusted) {
    return { allowed: true };
  }
  
  // Not trusted but within threshold
  return { allowed: true };
}

/**
 * Determine if 2FA is required for a transaction
 */
export function requires2FA(
  amount: number,
  preferences: TransactionPreferences
): boolean {
  if (preferences.autoExecute.require2FAAbove === 0) {
    return true; // Always require 2FA
  }
  return amount > preferences.autoExecute.require2FAAbove;
}

/**
 * Get the recommended delivery mode for a transaction
 */
export function getRecommendedDeliveryMode(
  amount: number,
  isCrossChain: boolean,
  preferences: TransactionPreferences
): DeliveryModePreference {
  if (preferences.deliveryMode.defaultMode !== 'auto') {
    return preferences.deliveryMode.defaultMode;
  }
  
  // Auto mode logic
  if (isCrossChain && preferences.deliveryMode.preferDeferredForCrossChain) {
    return 'claim';
  }
  
  if (amount > preferences.deliveryMode.custodyAbove) {
    return 'custody';
  }
  
  return 'canonical';
}
