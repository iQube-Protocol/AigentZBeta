import { useEffect, useState } from 'react';

export type SolanaDevnetStatus = {
  ok: boolean;
  network: 'devnet';
  endpoint: string;
  slot: number;
  blockHeight: number;
  address: string | null;
  balanceLamports: number | null;
  latestSig: string | null;
  at: string;
};

export function useSolanaDevnet(refreshMs = 30000) {
  const [data, setData] = useState<SolanaDevnetStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const r = await fetch('/api/ops/solana/devnet', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setData(j as SolanaDevnetStatus);
    } catch (e: any) {
      setError(e?.message || 'Failed to load Solana devnet');
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
