import { useEffect, useState } from 'react';
import type { DVNStatus } from '@/services/ops/dvnService';

export function useDVN(refreshMs = 30000) {
  const [data, setData] = useState<DVNStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const r = await fetch('/api/ops/canisters/health', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setData(json.dvn as DVNStatus);
    } catch (e: any) {
      setError(e?.message || 'Failed to load DVN status');
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
