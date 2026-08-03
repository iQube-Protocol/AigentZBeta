import { useEffect, useState } from 'react';

interface BitcentTestnetData {
  ok: boolean;
  at: string;
  network: string;
  txHash: string;
  explorer: string | null;
  status: 'confirmed' | 'pending' | 'unknown';
  confirmations: number | null;
  blockHeight: number | null;
  /** Which explorer the reported confirmations/blockHeight came from —
   * 'blockstream' (primary) or 'mempool' (fallback, consulted only when the
   * primary can't resolve the tx). Null only when neither resolved it. */
  confirmationSource: 'blockstream' | 'mempool' | null;
  confirmationCheckedAt: string | null;
  /** Present only when both explorers answered AND disagreed on the
   * confirmation count — never silently merged into one number. */
  confirmationDivergence: { blockstream: number | null; mempool: number | null } | null;
  /** Surfaced, never collapsed into a bare "—": set when neither explorer
   * could resolve the transaction at all. */
  confirmationError: string | null;
  runeName: string | null;
  symbol: string | null;
  maxSupply: number | null;
  premine: number | null;
  initiallyActiveIssuance: number | null;
  governedReserve: number | null;
  premineCustodianAddress: string | null;
  /** Live premine balance, resolved from primary chain data (see
   * services/ops/bitcentBalance.ts) — never fabricated. false always carries
   * balanceUnresolvedReason; never render `balance` unless this is true. */
  balanceResolved: boolean;
  balance: number | null;
  balanceSource: 'blockstream' | 'mempool' | null;
  balanceCheckedAt: string | null;
  balanceOutputIndex: number | null;
  balanceUnresolvedReason: string | null;
  error?: string;
}

export function useBitcentTestnet(refreshMs = 30000) {
  const [data, setData] = useState<BitcentTestnetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const r = await fetch('/api/ops/bitcent/testnet', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setData(json);
    } catch (e: any) {
      setError(e?.message || 'Failed to load Bitcent testnet data');
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
