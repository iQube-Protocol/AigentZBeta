import { useEffect, useState } from 'react';

interface OptimismSepoliaData {
  ok: boolean;
  blockNumber: number;
  txCount: number;
  latestTx: string | null;
  rpcUrl: string;
  explorerUrl: string;
  at: string;
  error?: string;
}

export function useOptimismSepolia(refreshMs = 30000) {
  const [data, setData] = useState<OptimismSepoliaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const r = await fetch('/api/ops/optimism/sepolia', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setData(json);
    } catch (e: any) {
      setError(e?.message || 'Failed to load Optimism Sepolia data');
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
