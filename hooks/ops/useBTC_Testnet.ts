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
      
      // Persist successful testnet data to localStorage
      if (json.testnet?.ok && (json.testnet as any)?.blockHeight) {
        try {
          localStorage.setItem('btc_testnet_last_good', JSON.stringify({
            blockHeight: (json.testnet as any).blockHeight,
            at: json.testnet.at
          }));
        } catch {}
      }
      
      // If API failed but we have cached data, merge it
      if (!json.testnet?.ok && data?.ok === false) {
        try {
          const cached = localStorage.getItem('btc_testnet_last_good');
          if (cached) {
            const parsed = JSON.parse(cached);
            const cacheAge = Date.now() - new Date(parsed.at).getTime();
            // Use cached data if less than 10 minutes old
            if (cacheAge < 10 * 60 * 1000) {
              json.testnet = {
                ...json.testnet,
                blockHeight: parsed.blockHeight,
                details: `${json.testnet.details} (cached: ${Math.floor(cacheAge/1000)}s ago)`
              };
            }
          }
        } catch {}
      }
      
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
