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

  /**
   * READ ONLY. Loads sync status and does nothing else.
   *
   * ── WHAT WAS REMOVED HERE, AND WHY (operator ruling, 2026-08-08) ────────
   *
   * This function used to trigger `repair('auto')` — and, through it,
   * `processLayerZero('process_pending')` — whenever it observed
   * `drift > 0 && !isLegitimate`. Because the effect below mounts a timer on
   * mount, MERELY OPENING /ops started reconciling the constitutional receipt
   * spine, and closing /ops stopped it. Observed live: 710 pending DVN
   * messages / drift 710 with the page closed, collapsing to 0 within minutes
   * of opening it.
   *
   * Worse than a poller: `repair()` and `processLayerZero()` each ended with
   * `await load()`, and `load()` re-triggered `repair()` — an unbounded mutual
   * recursion that drained the queue as fast as the network allowed (which is
   * why 710 cleared in ~7 minutes rather than the ~14 passes a 30s poll would
   * have made). The drain was an accidental side effect of a recursion bug,
   * never designed reconciliation. Those `await load()` calls are removed too.
   *
   * Liveness now belongs to /api/ops/sync/cron-tick, driven by
   * .github/workflows/dvn-reconciler.yml — the endpoint written for exactly
   * this purpose, which had never been given a scheduler.
   *
   * INVARIANT: Observability must not provide liveness. This console may
   * observe the spine and may MANUALLY stimulate recovery (the exported
   * `repair`/`processLayerZero` are retained for the operator's own buttons),
   * but closing it must have no effect on whether the spine operates.
   */
  async function load() {
    try {
      setLoading(true);
      setError(null);
      const r = await fetch('/api/ops/sync/status', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setData(json);
    } catch (e: any) {
      setError(e?.message || 'Failed to load sync status');
    } finally {
      setLoading(false);
    }
  }

  /**
   * MANUAL ONLY — invoked from an operator's explicit click (the Auto Repair
   * button in app/(shell)/ops/page.tsx), never from `load()`. See load()'s own
   * note for the browser-liveness defect this stopped being part of.
   *
   * The trailing `await load()` was removed: it re-entered `load()`, which used
   * to re-trigger this function, forming the unbounded recursion. Callers that
   * want a refreshed view after repairing call `refresh()` themselves — the
   * ops page's own handler already does.
   */
  async function repair(strategy = 'auto') {
    try {
      setError(null);
      const r = await fetch('/api/ops/sync/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy })
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e: any) {
      const errorMsg = e?.message || 'Failed to repair sync';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * MANUAL ONLY — invoked from an operator's explicit click (the "Process via
   * LayerZero" button), never from `load()`. Same removed `await load()` as
   * `repair()`; see that note.
   */
  async function processLayerZero(action = 'process_pending', messageIds: string[] = []) {
    try {
      setError(null);
      const r = await fetch('/api/ops/layerzero/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, messageIds })
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
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
