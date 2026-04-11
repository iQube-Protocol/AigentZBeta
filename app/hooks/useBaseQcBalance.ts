/**
 * useBaseQcBalance Hook
 *
 * Fetches the deferred/DVN Q¢ balance for a persona from qc_balances (Supabase).
 * This is distinct from the on-chain EVM Q¢ (QCT) balance — it represents
 * custody amounts held off-chain pending settlement, analogous to dvnKnyt.
 */

import { useState, useEffect, useCallback } from 'react';

export interface BaseQcBalance {
  /** Off-chain deferred custody amount (qc_balances table) */
  dvnQc: number;
  currency: string;
}

export interface UseBaseQcBalanceReturn {
  balance: BaseQcBalance | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useBaseQcBalance(personaId?: string): UseBaseQcBalanceReturn {
  const [balance, setBalance] = useState<BaseQcBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!personaId) {
      setBalance(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/wallet/base-qc/balance?personaId=${encodeURIComponent(personaId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBalance({ dvnQc: data.balance || 0, currency: data.currency || 'base_qc' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch DVN Q¢ balance');
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { balance, loading, error, refresh };
}
