/**
 * @agentiq/smartwallet
 * Shared wallet UI and logic for AgentiQ franchises
 */

export { WalletProvider, WalletContext } from './WalletContext';
export { useWallet } from './useWallet';
export { WalletButton } from './WalletButton';
export type {
  WalletAccount,
  WalletState,
  WalletProvider as WalletProviderType,
  WalletConfig,
  WalletActions,
} from './types';
