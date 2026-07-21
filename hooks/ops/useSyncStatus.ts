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
      
      // Auto-process via proper flow if drift > 0 and not legitimate
      if (json.drift > 0 && !json.isLegitimate && json.ok) {
        console.log(`Auto-processing triggered: drift=${json.drift}`);
        // Trigger repair which will batch → anchor → LayerZero (or just LayerZero for small drifts)
        repair('auto').then(result => {
          if (result.requiresLayerZero) {
            if (result.skipBatch) {
              console.log('Small drift, processing via LayerZero without batching...');
            } else {
              console.log('Batch and anchor complete, processing via LayerZero...');
            }
            // Now trigger LayerZero processing
            processLayerZero('process_pending').catch(err => {
              console.error('LayerZero processing failed:', err);
            });
          }
        }).catch(err => {
          console.error('Auto-processing failed:', err);
        });
      }
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
