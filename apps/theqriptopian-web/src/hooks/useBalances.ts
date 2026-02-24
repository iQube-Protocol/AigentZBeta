/**
 * useBalances - Hook for fetching real blockchain balances
 */
import { useState, useEffect, useCallback } from 'react';

interface BalanceAddresses {
  sepolia?: `0x${string}`;
  arb?: `0x${string}`;
  btc?: string;
  base?: `0x${string}`;
}

interface Balances {
  qctSep?: string;
  qctSepDecimals?: number;
  qctArb?: string;
  qctArbDecimals?: number;
  qctBase?: string;
  qctBaseDecimals?: number;
  usdcSep?: string;
  usdcSepDecimals?: number;
  btcQcent?: string;
  isLoading: boolean;
  error?: string;
  refetch: () => Promise<void>;
}

export function useBalances(addresses: BalanceAddresses): Balances {
  const [balances, setBalances] = useState<Omit<Balances, 'refetch'>>({
    isLoading: true,
  });

  const fetchBalances = useCallback(async () => {
    if (!addresses.arb && !addresses.sepolia && !addresses.base) {
      setBalances({ isLoading: false });
      return;
    }

    setBalances(prev => ({ ...prev, isLoading: true, error: undefined }));

    try {
      const apiBase = import.meta.env.VITE_AIGENT_API_URL || '';
      const params = new URLSearchParams();
      if (addresses.arb) params.set('arb', addresses.arb);
      if (addresses.sepolia) params.set('sepolia', addresses.sepolia);
      if (addresses.base) params.set('base', addresses.base);
      if (addresses.btc) params.set('btc', addresses.btc);

      const response = await fetch(`${apiBase}/api/wallet/balances?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch balances');
      }

      const data = await response.json();
      
      setBalances({
        qctSep: data.qctSep || '0',
        qctSepDecimals: data.qctSepDecimals || 18,
        qctArb: data.qctArb || '0',
        qctArbDecimals: data.qctArbDecimals || 18,
        qctBase: data.qctBase || '0',
        qctBaseDecimals: data.qctBaseDecimals || 18,
        usdcSep: data.usdcSep || '0',
        usdcSepDecimals: data.usdcSepDecimals || 6,
        btcQcent: data.btcQcent || '0',
        isLoading: false,
      });
    } catch (err) {
      console.error('[useBalances] Error:', err);
      setBalances({
        qctSep: '0',
        qctSepDecimals: 18,
        qctArb: '0',
        qctArbDecimals: 18,
        qctBase: '0',
        qctBaseDecimals: 18,
        usdcSep: '0',
        usdcSepDecimals: 6,
        btcQcent: '0',
        isLoading: false,
        error: (err as Error).message,
      });
    }
  }, [addresses.arb, addresses.sepolia, addresses.base, addresses.btc]);

  useEffect(() => {
    fetchBalances();
    // Refresh every 30 seconds
    const interval = setInterval(fetchBalances, 30000);
    return () => clearInterval(interval);
  }, [fetchBalances]);

  return { ...balances, refetch: fetchBalances };
}

export default useBalances;
