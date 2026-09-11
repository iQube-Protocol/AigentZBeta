/**
 * useQctBaseMainnetBalance Hook
 *
 * Fetches the LIVE on-chain QriptoCENT (Base Q¢) balance from the deployed
 * Base MAINNET contract (chain 8453) for a given EVM address, via
 * /api/wallet/qct/base-mainnet-balance -> services/wallet/qctCanonicalService.
 *
 * Distinct from:
 *   - useBaseQcBalance    — off-chain deferred/DVN Q¢ custody ledger (qc_balances)
 *   - useBalances().qctBase — Base SEPOLIA (testnet) on-chain balance
 *
 * `configured === false` means NEXT_PUBLIC_QCT_BASE_MAINNET is not set in
 * this environment — render a "pending" state, never a silent zero.
 */

import { useState, useEffect, useCallback } from 'react';

export interface QctBaseMainnetBalance {
  balance: string;
  balanceFormatted: string;
  contractAddress: string;
}

export interface UseQctBaseMainnetBalanceReturn {
  balance: QctBaseMainnetBalance | null;
  configured: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useQctBaseMainnetBalance(evmAddress?: string): UseQctBaseMainnetBalanceReturn {
  const [balance, setBalance] = useState<QctBaseMainnetBalance | null>(null);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!evmAddress) {
      setBalance(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/wallet/qct/base-mainnet-balance?address=${encodeURIComponent(evmAddress)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const isConfigured = data.configured !== false;
      setConfigured(isConfigured);
      if (!isConfigured || !data.balanceFormatted) {
        setBalance(null);
      } else {
        setBalance({
          balance: data.balance,
          balanceFormatted: data.balanceFormatted,
          contractAddress: data.contractAddress,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Base Q¢ mainnet balance');
    } finally {
      setLoading(false);
    }
  }, [evmAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { balance, configured, loading, error, refresh };
}
