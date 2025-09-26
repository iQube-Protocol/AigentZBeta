import { useEffect, useState } from 'react';
import { getSepoliaStatus, type EvmStatus } from '@/services/ops/evmService';

export function useSepolia(refreshMs = 30000) {
  const [data, setData] = useState<EvmStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await getSepoliaStatus();
      setData(res);
    } catch (e: any) {
      setError(e?.message || 'Failed to load Sepolia');
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
