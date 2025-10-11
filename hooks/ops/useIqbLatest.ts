import { useEffect, useState } from 'react';

export interface IqbLatestData {
  ok: boolean;
  chainId: number;
  txHash?: string;
  blockNumber?: number;
  timestamp?: number;
  rpcUrl?: string;
  at?: string;
  error?: string;
  missing?: string;
}

export function useIqbLatest(chainId: number, fallbackTxHash?: string, refreshMs = 30000) {
  const [data, setData] = useState<IqbLatestData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      
      // First, try to get latest transaction from Event Register (SoT)
      let txHashToUse = fallbackTxHash;
      try {
        const chainIdToName: Record<number, string> = {
          11155111: 'ethereum',
          80002: 'polygon',
          421614: 'arbitrum',
          11155420: 'optimism',
          84532: 'base',
        };
        const chainName = chainIdToName[chainId];
        if (chainName) {
          const registerRes = await fetch(`/api/qct/events/latest?chainId=${chainName}`, { cache: 'no-store' });
          if (registerRes.ok) {
            const registerData = await registerRes.json();
            if (registerData.ok && registerData.transaction?.txHash) {
              txHashToUse = registerData.transaction.txHash;
            }
          }
        }
      } catch (e) {
        console.warn('Event Register unavailable, using fallback:', e);
      }
      
      // Now fetch enriched data using the transaction hash
      const params = new URLSearchParams({ chainId: String(chainId) });
      if (txHashToUse && txHashToUse.startsWith('0x')) params.set('txHash', txHashToUse);
      const r = await fetch(`/api/ops/iqb/latest?${params.toString()}`, { cache: 'no-store' });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error || `HTTP ${r.status}`);
      setData(json);
    } catch (e: any) {
      setError(e?.message || 'Failed to load iQube latest');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, refreshMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId, fallbackTxHash]);

  return { data, loading, error, refresh: load };
}
