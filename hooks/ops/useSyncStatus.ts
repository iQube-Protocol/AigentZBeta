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
      setData(json);
      // NOTE: auto-repair-on-load removed. It recursed into an infinite loop
      // whenever drift persisted: load() auto-called repair('auto'), and
      // repair() ends by calling load() again — which re-triggered repair(),
      // and so on. Because repair often does NOT clear the drift immediately
      // (batch → anchor → LayerZero is eventual, and receipts can fail), the
      // cycle never terminated. Symptoms: the refresh state flickered
      // continuously (setLoading toggling every cycle) and the "Auto Repair"
      // button — disabled={syncStatus.loading} — was perpetually disabled so
      // clicks never registered. Repair is now strictly user-initiated via the
      // Auto Repair / Process-via-LayerZero buttons. If automated healing is
      // wanted, it needs a debounced, drift-changed-guarded background job —
      // not a call on every status poll.
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
