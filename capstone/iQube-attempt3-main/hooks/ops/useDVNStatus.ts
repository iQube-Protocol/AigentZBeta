import { useEffect, useState } from 'react';

interface DVNStatusData {
  ok: boolean;
  evmTx: string;
  icpReceipt: string;
  lockStatus: string;
  unlockHeight: string;
  pendingMessages: number;
  attestations: number;
  at: string;
  error?: string;
}

export function useDVNStatus(refreshMs = 30000) {
  const [data, setData] = useState<DVNStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const r = await fetch('/api/ops/dvn/status', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setData(json);
    } catch (e: any) {
      setError(e?.message || 'Failed to load DVN status data');
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
