/**
 * WalletContext
 * Provides wallet state and actions to the application
 */

import { createContext, useCallback, useEffect, useState, ReactNode } from 'react';
import { BrowserProvider, formatEther } from 'ethers';
import type { WalletState, WalletActions, WalletConfig, WalletAccount } from './types';

export interface WalletContextValue extends WalletState, WalletActions {}

export const WalletContext = createContext<WalletContextValue | null>(null);

interface WalletProviderProps {
  children: ReactNode;
  config?: WalletConfig;
}

export function WalletProvider({ children, config = {} }: WalletProviderProps) {
  const [state, setState] = useState<WalletState>({
    account: null,
    isConnecting: false,
    isConnected: false,
    error: null,
  });

  // Check if MetaMask is installed
  const hasProvider = () => {
    return typeof window !== 'undefined' && 
           typeof window.ethereum !== 'undefined';
  };

  // Connect wallet
  const connect = useCallback(async () => {
    if (!hasProvider()) {
      setState(prev => ({
        ...prev,
        error: 'Please install MetaMask or another Web3 wallet',
      }));
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const provider = new BrowserProvider(window.ethereum);
      
      // Request account access
      const accounts = await provider.send('eth_requestAccounts', []);
      
      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const address = accounts[0];
      const network = await provider.getNetwork();
      const signer = await provider.getSigner();
      const balanceWei = await provider.getBalance(address);
      const balance = formatEther(balanceWei);

      const account: WalletAccount = {
        address,
        chainId: Number(network.chainId),
        balance,
      };

      setState({
        account,
        isConnecting: false,
        isConnected: true,
        error: null,
      });
    } catch (error: any) {
      console.error('Wallet connection error:', error);
      setState({
        account: null,
        isConnecting: false,
        isConnected: false,
        error: error.message || 'Failed to connect wallet',
      });
    }
  }, []);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    setState({
      account: null,
      isConnecting: false,
      isConnected: false,
      error: null,
    });
  }, []);

  // Switch chain
  const switchChain = useCallback(async (chainId: number) => {
    if (!hasProvider()) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });

      // Refresh account info after chain switch
      await connect();
    } catch (error: any) {
      console.error('Chain switch error:', error);
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to switch chain',
      }));
    }
  }, [connect]);

  // Listen for account changes
  useEffect(() => {
    if (!hasProvider()) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else if (accounts[0] !== state.account?.address) {
        connect();
      }
    };

    const handleChainChanged = () => {
      connect();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [connect, disconnect, state.account?.address]);

  // Auto-connect if previously connected
  useEffect(() => {
    const checkConnection = async () => {
      if (!hasProvider()) return;

      try {
        const provider = new BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_accounts', []);
        
        if (accounts.length > 0) {
          await connect();
        }
      } catch (error) {
        console.error('Auto-connect check failed:', error);
      }
    };

    checkConnection();
  }, [connect]);

  const value: WalletContextValue = {
    ...state,
    connect,
    disconnect,
    switchChain,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any;
  }
}
