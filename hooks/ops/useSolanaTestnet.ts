import { useEffect, useState } from 'react';

export type SolanaTestnetStatus = {
  ok: boolean;
  cluster: 'testnet';
  blockHeight: number | string;
  latestBlockhash: string | null;
  rpcUrl: string;
  at: string;
  error?: string;
};

export function useSolanaTestnet(refreshMs = 30000) {
  const [data, setData] = useState<SolanaTestnetStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const r = await fetch('/api/ops/solana/testnet', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setData(j as SolanaTestnetStatus);
    } catch (e: any) {
      setError(e?.message || 'Failed to load Solana testnet');
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
