/**
 * KNYT Ledger Types
 * 
 * Types for DVN KNYT (x402 ledger) and EVM KNYT (on-chain) operations.
 */

// =============================================================================
// KNYT TRANSACTION TYPES
// =============================================================================

/** Source of a KNYT transaction */
export type KnytTxSource =
  | 'paypal_purchase'      // User bought KNYT with PayPal
  | 'content_purchase'     // User spent KNYT on content (Codex, Scroll, etc.)
  | 'reward'               // User earned KNYT from quest/task completion
  | 'referral'             // User earned KNYT from referral
  | 'airdrop'              // Admin airdrop
  | 'admin_grant'          // Manual admin grant
  | 'admin_debit'          // Manual admin debit
  | 'deferred_claim'       // Redemption of a deferred claim
  | 'canonical_mint'       // Canonical EVM KNYT minting (Phase 3b)
  | 'transfer_in'          // Transfer from another persona (future)
  | 'transfer_out';        // Transfer to another persona (future)

/**
 * Minting mode for a KNYT issuance operation.
 *
 * - immediate  → credit the DVN KNYT ledger now (remote custody / default)
 * - deferred   → create an open claim the persona explicitly redeems
 * - canonical  → mint EVM KNYT on-chain (Phase 3b; requires minter role)
 */
export type KnytMintingMode = 'immediate' | 'deferred' | 'canonical';

/** Direction of a KNYT transaction */
export type KnytTxDirection = 'credit' | 'debit';

/** A single KNYT transaction record */
export interface KnytTransaction {
  id: string;
  personaId: string;
  amount: number;
  direction: KnytTxDirection;
  source: KnytTxSource;
  /** Related asset ID (e.g., codex entry, scroll, quest) */
  assetId?: string;
  /** Fiat amount if PayPal purchase */
  fiatAmount?: number;
  /** Fiat currency (e.g., 'USD') */
  fiatCurrency?: string;
  /** PayPal transaction ID if applicable */
  paypalTxId?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
  /** Timestamp */
  createdAt: string;
  /** DVN batch ID once submitted */
  dvnBatchId?: string;
  /** DVN submission timestamp */
  dvnSubmittedAt?: string;
}

// =============================================================================
// DVN BATCHING TYPES
// =============================================================================

/** A DVN KNYT event (single tx in a batch) */
export interface KnytDvnEvent {
  personaId: string;
  amount: number;
  direction: KnytTxDirection;
  source: KnytTxSource;
  assetId?: string;
  fiatAmount?: number;
  fiatCurrency?: string;
  txId: string;
  timestamp: number;
}

/** A batch of KNYT events for DVN submission */
export interface KnytDvnBatch {
  batchId: string;
  events: KnytDvnEvent[];
  createdAt: string;
  submittedAt?: string;
  dvnMessageId?: string;
  status: 'pending' | 'submitted' | 'confirmed' | 'failed';
}

/** DVN batch submission result */
export interface KnytDvnSubmitResult {
  success: boolean;
  batchId: string;
  dvnMessageId?: string;
  error?: string;
}

// =============================================================================
// KNYT BALANCE TYPES
// =============================================================================

/** KNYT balance for a persona */
export interface KnytBalance {
  personaId: string;
  /** DVN KNYT balance (x402 ledger) */
  dvnKnyt: number;
  /** EVM KNYT balance (on-chain, read-only in Phase 1) */
  evmKnyt?: number;
  /** EVM address for on-chain KNYT (if set) */
  evmAddress?: string;
  /** Last updated timestamp */
  updatedAt: string;
}

// =============================================================================
// SERVICE RESULT TYPES
// =============================================================================

/** Result of a credit/debit operation */
export interface KnytLedgerResult {
  success: boolean;
  transaction?: KnytTransaction;
  newBalance?: number;
  error?: string;
}

/** Result of a balance query */
export interface KnytBalanceResult {
  success: boolean;
  balance?: KnytBalance;
  error?: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/** KNYT ledger configuration */
export interface KnytLedgerConfig {
  /** Batch size for DVN submissions (default: 100) */
  dvnBatchSize: number;
  /** Batch flush interval in ms (default: 60000 = 1 minute) */
  dvnBatchFlushIntervalMs: number;
  /** KNYT ERC-20 contract address */
  knytContractAddress?: string;
  /** KNYT chain ID (numeric) */
  knytChainId?: number;
  /** KNYT USD rate for PayPal conversions */
  knytUsdRate: number;
  /** Discount for KNYT purchases (0-1, e.g., 0.1 = 10% discount) */
  knytDiscount: number;
  /** Premium for PayPal direct purchases (0-1, e.g., 0.2 = 20% premium) */
  paypalPremium: number;
}

/** Default configuration */
export const DEFAULT_KNYT_CONFIG: KnytLedgerConfig = {
  dvnBatchSize: 100,
  dvnBatchFlushIntervalMs: 60000,
  knytUsdRate: 0.10, // 1 KNYT = $0.10
  knytDiscount: 0.15, // 15% discount when paying with KNYT
  paypalPremium: 0.20, // 20% premium when paying with PayPal directly
};
