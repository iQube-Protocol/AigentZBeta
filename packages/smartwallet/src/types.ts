/**
 * SmartWallet Types
 * Shared wallet types for AgentiQ franchises
 */

export interface WalletAccount {
  address: string;
  chainId: number;
  balance?: string;
}

export interface WalletState {
  account: WalletAccount | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
}

export type WalletProvider = 'metamask' | 'walletconnect' | 'coinbase';

export interface WalletConfig {
  supportedChainIds?: number[];
  defaultChainId?: number;
  appName?: string;
}

export interface WalletActions {
  connect: (provider?: WalletProvider) => Promise<void>;
  disconnect: () => void;
  switchChain: (chainId: number) => Promise<void>;
}
