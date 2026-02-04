/**
 * useKnytBalance Hook
 * 
 * Fetches and manages KNYT balance for a persona
 */

import { useState, useEffect, useCallback } from 'react';

export interface KnytBalance {
  dvnKnyt: number;
  evmKnyt?: number;
  totalKnyt: number;
  spendableKnyt: number;
  evmAddress?: string;
  updatedAt?: string;
}

export interface UseKnytBalanceReturn {
  balance: KnytBalance | null;
  spendableBalance: number;
  loading: boolean;
  error: string | null;
  refreshBalance: () => Promise<void>;
}

export function useKnytBalance(personaId?: string): UseKnytBalanceReturn {
  const [balance, setBalance] = useState<KnytBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshBalance = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    if (!personaId) {
      setError('Persona ID is required');
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch(`/api/wallet/knyt/balance?personaId=${encodeURIComponent(personaId)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const dvn = data.dvnKnyt || 0;
      const evm = data.evmKnyt || 0;
      setBalance({
        dvnKnyt: dvn,
        evmKnyt: data.evmKnyt,
        totalKnyt: data.totalKnyt || dvn + evm,
        spendableKnyt: data.spendableKnyt || dvn,
        evmAddress: data.evmAddress,
        updatedAt: data.updatedAt,
      });
    } catch (error) {
      console.error('Error fetching KNYT balance:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch balance');
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  return {
    balance,
    spendableBalance: balance?.spendableKnyt ?? balance?.dvnKnyt ?? 0,
    loading,
    error,
    refreshBalance,
  };
}
