import { useEffect, useState } from 'react';
import type { CrossChainStatus } from '@/services/ops/crossChainService';

export function useCrossChain(refreshMs = 30000) {
  const [data, setData] = useState<CrossChainStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const r = await fetch('/api/ops/crosschain/status', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      // Support both shapes for easy rollback:
      // - New (flattened): { ok, supportedChains, evmChains, nonEvmChains, ... }
      // - Old (nested): { ok, status: { ... }, at }
      const payload = (json && typeof json === 'object' && 'status' in json)
        ? (json.status as CrossChainStatus)
        : (json as CrossChainStatus);
      setData(payload);
    } catch (e: any) {
      setError(e?.message || 'Failed to load Cross-Chain status');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, refreshMs);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, loading, error, refresh: load };
}
