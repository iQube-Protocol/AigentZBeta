/**
 * useKnytBalance - Hook for fetching KNYT balance from DVN ledger
 */

import { useState, useEffect, useCallback } from 'react';

interface KnytBalance {
  dvnKnyt: number;
  evmKnyt?: number;
  totalKnyt: number;      // Combined DVN + EVM balance (display)
  spendableKnyt: number;  // DVN balance only (Tier 0 spendable, gas-free)
  evmAddress?: string;
  updatedAt: string;
}

interface UseKnytBalanceResult {
  balance: KnytBalance | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useKnytBalance(personaId: string | undefined): UseKnytBalanceResult {
  const [balance, setBalance] = useState<KnytBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!personaId) {
      console.log('[useKnytBalance] No personaId provided, skipping fetch');
      setBalance(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use the API base URL from env or default to relative path
      const apiBase = import.meta.env.VITE_AIGENT_API_URL || '';
      const url = `${apiBase}/api/wallet/knyt/balance?personaId=${personaId}`;
      console.log('[useKnytBalance] Fetching balance from:', url);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch KNYT balance');
      }

      const data = await response.json();
      console.log('[useKnytBalance] Response data:', data);
      const dvn = data.dvnKnyt || 0;
      const evm = data.evmKnyt || 0;
      setBalance({
        dvnKnyt: dvn,
        evmKnyt: data.evmKnyt,
        totalKnyt: data.totalKnyt || (dvn + evm),
        spendableKnyt: data.spendableKnyt || dvn, // DVN balance is spendable in Tier 0
        evmAddress: data.evmAddress,
        updatedAt: data.updatedAt || new Date().toISOString(),
      });
    } catch (err) {
      console.error('[useKnytBalance] Error:', err);
      setError((err as Error).message);
      // Set default balance on error
      setBalance({ dvnKnyt: 0, totalKnyt: 0, spendableKnyt: 0, updatedAt: new Date().toISOString() });
    } finally {
      setIsLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, isLoading, error, refetch: fetchBalance };
}
