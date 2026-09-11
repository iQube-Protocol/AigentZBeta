import { useEffect, useState, useCallback } from 'react';

interface BaseMainnetData {
  ok: boolean;
  network?: string;
  chainId?: number;
  blockNumber?: number;
  txCount?: number;
  latestTx?: string | null;
  rpcUrl?: string;
  explorerUrl?: string;
  contracts?: {
    qct?: string | null;
    qctReserve?: string | null;
  };
  at: string;
  error?: string;
}

export function useBaseMainnet(refreshMs = 30000) {
  const [data, setData] = useState<BaseMainnetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const r = await fetch('/api/ops/base/mainnet', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = (await r.json()) as BaseMainnetData;
      setData(json);
    } catch (e: any) {
      setError(e?.message || 'Failed to load Base mainnet data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, refreshMs);
    return () => clearInterval(id);
  }, [load, refreshMs]);

  return { data, loading, error, refresh: load };
}
