import { useEffect, useState } from 'react';
import type { ChainStatus, AnchorStatus } from '@/services/ops/btcService';

export function useBTC_Testnet(refreshMs = 30000) {
  const [data, setData] = useState<ChainStatus | null>(null);
  const [anchor, setAnchor] = useState<AnchorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const r = await fetch('/api/ops/btc/status', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setData(json.testnet as ChainStatus);
      if (json.anchor) setAnchor(json.anchor as AnchorStatus);
    } catch (e: any) {
      setError(e?.message || 'Failed to load BTC testnet');
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

  return { data, anchor, loading, error, refresh: load };
}
