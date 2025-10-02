import { useEffect, useState } from 'react';

interface SyncStatusData {
  ok: boolean;
  syncStatus: string;
  severity: 'info' | 'warning' | 'critical';
  isSynchronized: boolean;
  isLegitimate?: boolean;
  drift: number;
  canisters: {
    proofOfState: {
      id: string;
      pendingCount: number;
    };
    dvn: {
      id: string;
      pendingCount: number;
    };
  };
  recommendations: string[];
  at: string;
  error?: string;
}

export function useSyncStatus(refreshMs = 30000) {
  const [data, setData] = useState<SyncStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const r = await fetch('/api/ops/sync/status', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      // Client-side augmentation: if a local DVN monitor is in progress but the
      // server reports 0 DVN pending, reflect a pending=1 locally to avoid cookies.
      try {
        const localMsgId = typeof window !== 'undefined' ? localStorage.getItem('dvn.messageId') : null;
        if (localMsgId && json?.canisters?.dvn) {
          const serverDvn = Number(json.canisters.dvn.pendingCount || 0);
          if (serverDvn === 0) {
            const posCount = Number(json?.canisters?.proofOfState?.pendingCount || 0);
            const dvnCount = 1; // reflect one local pending
            const isSynchronized = posCount === dvnCount;
            const drift = Math.abs(posCount - dvnCount);
            let syncStatus: string;
            let severity: 'info' | 'warning' | 'critical';
            let isLegitimate = false;
            if (isSynchronized) {
              syncStatus = 'synced';
              severity = 'info';
            } else {
              if (dvnCount > posCount && drift <= 5) {
                syncStatus = 'lifecycle-drift';
                severity = 'info';
                isLegitimate = true;
              } else if (drift <= 2) {
                syncStatus = 'minor-drift';
                severity = 'warning';
              } else {
                syncStatus = 'out-of-sync';
                severity = 'critical';
              }
            }
            const augmented: SyncStatusData = {
              ...json,
              isSynchronized,
              drift,
              syncStatus,
              severity,
              isLegitimate,
              canisters: {
                ...json.canisters,
                dvn: { ...json.canisters.dvn, pendingCount: dvnCount },
              },
            };
            setData(augmented);
            return;
          }
        }
      } catch {}
      setData(json);
    } catch (e: any) {
      setError(e?.message || 'Failed to load sync status');
    } finally {
      setLoading(false);
    }
  }

  async function repair(strategy = 'auto') {
    try {
      setError(null);
      const r = await fetch('/api/ops/sync/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy })
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const result = await r.json();
      
      // Refresh status after repair
      await load();
      
      return result;
    } catch (e: any) {
      const errorMsg = e?.message || 'Failed to repair sync';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }

  async function processLayerZero(action = 'process_pending', messageIds: string[] = []) {
    try {
      setError(null);
      const r = await fetch('/api/ops/layerzero/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, messageIds })
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const result = await r.json();
      
      // Refresh status after processing
      await load();
      
      return result;
    } catch (e: any) {
      const errorMsg = e?.message || 'Failed to process LayerZero messages';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, refreshMs);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { 
    data, 
    loading, 
    error, 
    refresh: load,
    repair,
    processLayerZero
  };
}
