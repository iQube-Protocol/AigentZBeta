/**
 * SmartWallet Types
 * Shared wallet types for AgentiQ franchises
 * Supports Q¢ (QriptoCENT), QCT, QOYN, KNYT tokens
 */

// Token balances for iQube ecosystem
export interface TokenBalances {
  /** Q¢ (QriptoCENT) - micro-value token */
  qc: string;
  /** QCT - utility token */
  qct: string;
  /** QOYN - governance token */
  qoyn: string;
  /** KNYT - knowledge token */
  knyt: string;
  /** Native chain token (ETH, MATIC, etc.) */
  native: string;
}

export interface WalletAccount {
  address: string;
  chainId: number;
  balance?: string;
  /** iQube token balances */
  tokens?: TokenBalances;
  /** ENS or other name service */
  ensName?: string;
}

export interface WalletState {
  account: WalletAccount | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  /** Token loading state */
  isLoadingTokens: boolean;
}

export type WalletProviderType = 'metamask' | 'walletconnect' | 'coinbase';

export interface WalletConfig {
  supportedChainIds?: number[];
  defaultChainId?: number;
  appName?: string;
  /** Q¢ token contract address */
  qcTokenAddress?: string;
  /** QCT token contract address */
  qctTokenAddress?: string;
  /** Enable mock balances for development */
  useMockBalances?: boolean;
}

export interface WalletActions {
  connect: (provider?: WalletProviderType) => Promise<void>;
  disconnect: () => void;
  switchChain: (chainId: number) => Promise<void>;
  /** Refresh token balances */
  refreshBalances: () => Promise<void>;
}

// WalletQube - iQube protocol wallet primitive
export interface WalletQube {
  qubeId: string;
  qubeType: 'walletQube';
  protocolVersion: string;
  createdAt: string;
  updatedAt: string;
  /** Wallet address */
  address: string;
  /** Associated user/agent ID */
  ownerId?: string;
  /** Token balances snapshot */
  balances: TokenBalances;
  /** Transaction history (recent) */
  recentTransactions?: WalletTransaction[];
  /** Reputation score from RQH */
  reputation?: number;
  /** Subscription tier */
  subscriptionTier?: 'free' | 'basic' | 'pro' | 'enterprise';
}

export interface WalletTransaction {
  id: string;
  type: 'send' | 'receive' | 'earn' | 'spend';
  token: 'qc' | 'qct' | 'qoyn' | 'knyt' | 'native';
  amount: string;
  timestamp: string;
  description?: string;
  contentId?: string; // If related to content access
}
