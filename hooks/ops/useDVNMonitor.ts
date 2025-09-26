import { useCallback, useEffect, useRef, useState } from 'react';

export type DVNMessage = {
  id: string;
  source_chain?: number;
  destination_chain?: number;
  nonce?: number | string;
  sender?: string;
  timestamp?: number | string;
};

export type DVNQuery = {
  ok: boolean;
  message: DVNMessage | null;
  attestations: Array<{ validator: string; timestamp: number | string }>;
  at: string;
};

export function useDVNMonitor() {
  const [message, setMessage] = useState<DVNMessage | null>(null);
  const [attestations, setAttestations] = useState<Array<{ validator: string; timestamp: number | string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageId, setMessageId] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  const lastKeyRef = useRef<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const stop = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchStatus = useCallback(async (key: string) => {
    try {
      setLoading(true);
      const r = await fetch(`/api/ops/dvn/tx?id=${encodeURIComponent(key)}`, { cache: 'no-store' });
      const j = (await r.json()) as DVNQuery;
      if (!j.ok) throw new Error((j as any).error || 'Failed to query DVN');
      setMessage(j.message || null);
      setAttestations(j.attestations || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load DVN message');
    } finally {
      setLoading(false);
    }
  }, []);

  const monitor = useCallback(async (txHash: string, chainId: number, rpcUrl?: string) => {
    try {
      setLoading(true);
      setError(null);
      const r = await fetch('/api/ops/dvn/monitor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ txHash, chainId, rpcUrl }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || `HTTP ${r.status}`);
      const key = j.messageId as string;
      setMessageId(key);
      setTxHash(txHash);
      setChainId(chainId);
      lastKeyRef.current = key;
      await fetchStatus(key);
      if (!pollRef.current) {
        pollRef.current = setInterval(() => {
          if (lastKeyRef.current) fetchStatus(lastKeyRef.current);
        }, 5000);
      }
      // persist
      try {
        localStorage.setItem('dvn.messageId', key);
        localStorage.setItem('dvn.txHash', txHash);
        localStorage.setItem('dvn.chainId', String(chainId));
      } catch {}
      return { ok: true, messageId: key };
    } catch (e: any) {
      setError(e?.message || 'Failed to start monitor');
      return { ok: false, error: e?.message };
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  const query = useCallback(async (key: string) => {
    lastKeyRef.current = key;
    await fetchStatus(key);
    if (!pollRef.current) {
      pollRef.current = setInterval(() => {
        if (lastKeyRef.current) fetchStatus(lastKeyRef.current);
      }, 5000);
    }
  }, [fetchStatus]);

  useEffect(() => {
    // resume from localStorage
    try {
      const savedId = localStorage.getItem('dvn.messageId');
      const savedHash = localStorage.getItem('dvn.txHash');
      const savedChain = localStorage.getItem('dvn.chainId');
      if (savedId) {
        setMessageId(savedId);
        if (savedHash) setTxHash(savedHash);
        if (savedChain) setChainId(Number(savedChain));
        query(savedId);
      }
    } catch {}
    return stop;
  }, [query, stop]);

  const clear = useCallback(() => {
    stop();
    setMessage(null);
    setAttestations([]);
    setMessageId(null);
    setTxHash(null);
    setChainId(null);
    try {
      localStorage.removeItem('dvn.messageId');
      localStorage.removeItem('dvn.txHash');
      localStorage.removeItem('dvn.chainId');
    } catch {}
  }, [stop]);

  return {
    message,
    attestations,
    loading,
    error,
    messageId,
    txHash,
    chainId,
    monitor,
    query,
    stop,
    clear,
  };
}
