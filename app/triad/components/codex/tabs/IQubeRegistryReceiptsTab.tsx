'use client';

/**
 * IQubeRegistryReceiptsTab — DVN receipt browser.
 *
 * Stage 6 C26. Surfaces the unified receipts query API + the block
 * ledger. Two stacked sections:
 *   1. Filters + Receipts table (calls GET /api/registry/receipts)
 *   2. Recent Blocks table (calls GET /api/admin/registry/dvn-blocks)
 *
 * Authority: tab never decides access. Filters are query params; the
 * API enforces T0 omission + read-only behaviour.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Receipt,
  RefreshCw,
  Loader2,
  AlertCircle,
  Filter,
  Boxes,
  Hash,
  Play,
  CheckCircle2,
} from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

interface UnifiedReceipt {
  source: 'orchestration_events' | 'content_qube_dvn_receipts';
  receipt_id: string;
  iqube_id: string | null;
  cartridge_scope: string | null;
  actor_alias_commitment: string | null;
  cohort_id: string | null;
  receipt_mode: string | null;
  event_type: string | null;
  receipt_kind: string | null;
  created_at: string;
  block_id?: string | null;
  block_number?: number | null;
}

interface BlockRow {
  block_id: string;
  block_number: number;
  cartridge_scope: string;
  epoch: number;
  status: 'open' | 'sealed' | 'anchored' | 'failed';
  opened_at: string;
  sealed_at?: string | null;
  anchored_at?: string | null;
  receipt_count: number;
  batch_hash?: string | null;
}

function cls(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function fmtTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const STATUS_COLOR: Record<string, string> = {
  open: 'bg-amber-700 text-amber-100',
  sealed: 'bg-emerald-700 text-emerald-100',
  anchored: 'bg-violet-700 text-violet-100',
  failed: 'bg-rose-700 text-rose-100',
};

export function IQubeRegistryReceiptsTab() {
  const [filters, setFilters] = useState({
    iqube_id: '',
    cartridge: '',
    primitive_type: '',
    block: '',
    source: '',
  });

  const [receipts, setReceipts] = useState<UnifiedReceipt[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(true);
  const [receiptsError, setReceiptsError] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ orchestration: number; content_qube: number }>({
    orchestration: 0,
    content_qube: 0,
  });

  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(true);
  const [blocksError, setBlocksError] = useState<string | null>(null);
  const [sealBusy, setSealBusy] = useState(false);
  const [sealMsg, setSealMsg] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.iqube_id) p.set('iqube_id', filters.iqube_id);
    if (filters.cartridge) p.set('cartridge', filters.cartridge);
    if (filters.primitive_type) p.set('primitive_type', filters.primitive_type);
    if (filters.block) p.set('block', filters.block);
    if (filters.source) p.set('source', filters.source);
    p.set('limit', '50');
    return p.toString();
  }, [filters]);

  const loadReceipts = useCallback(async () => {
    setReceiptsLoading(true);
    setReceiptsError(null);
    try {
      const res = await personaFetch(`/api/registry/receipts?${queryString}`, { cache: 'no-store' });
      if (!res.ok) {
        setReceiptsError(`HTTP ${res.status}`);
        setReceipts([]);
        return;
      }
      const body = await res.json();
      setReceipts(Array.isArray(body?.receipts) ? body.receipts : []);
      setCounts(body?.sources ?? { orchestration: 0, content_qube: 0 });
    } catch (e) {
      setReceiptsError((e as Error).message || 'Network error');
      setReceipts([]);
    } finally {
      setReceiptsLoading(false);
    }
  }, [queryString]);

  const loadBlocks = useCallback(async () => {
    setBlocksLoading(true);
    setBlocksError(null);
    try {
      const res = await personaFetch('/api/admin/registry/dvn-blocks?limit=15', { cache: 'no-store' });
      if (!res.ok) {
        setBlocksError(`HTTP ${res.status}`);
        setBlocks([]);
        return;
      }
      const body = await res.json();
      setBlocks(Array.isArray(body?.blocks) ? body.blocks : []);
    } catch (e) {
      setBlocksError((e as Error).message || 'Network error');
      setBlocks([]);
    } finally {
      setBlocksLoading(false);
    }
  }, []);

  const sealAll = useCallback(async () => {
    setSealBusy(true);
    setSealMsg(null);
    try {
      const res = await personaFetch('/api/admin/registry/dvn-blocks?seal=all', {
        method: 'POST',
        cache: 'no-store',
      });
      if (!res.ok) {
        setSealMsg(`Seal failed: HTTP ${res.status}`);
      } else {
        const body = await res.json();
        setSealMsg(`Processed ${body.processed} scopes; ${body.sealed} sealed at threshold.`);
        await loadBlocks();
      }
    } catch (e) {
      setSealMsg(`Network error: ${(e as Error).message}`);
    } finally {
      setSealBusy(false);
    }
  }, [loadBlocks]);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);
  useEffect(() => {
    loadBlocks();
  }, [loadBlocks]);

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Receipt className="w-5 h-5 text-violet-400" />
          DVN Receipts
        </h2>
        <p className="text-sm text-slate-400">
          Cross-source receipt query + block ledger. Stage 6 wires orchestration_events to
          dvn_receipt_blocks on every emission; block analysis works without ordinal anchoring.
        </p>
      </header>

      {/* Filters */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wide">
          <Filter className="w-3.5 h-3.5" />
          Filters
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <input
            type="text"
            placeholder="iqube_id"
            value={filters.iqube_id}
            onChange={(e) => setFilters((f) => ({ ...f, iqube_id: e.target.value }))}
            className="text-xs px-2.5 py-1.5 bg-slate-800/50 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500"
          />
          <input
            type="text"
            placeholder="cartridge"
            value={filters.cartridge}
            onChange={(e) => setFilters((f) => ({ ...f, cartridge: e.target.value }))}
            className="text-xs px-2.5 py-1.5 bg-slate-800/50 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500"
          />
          <select
            value={filters.primitive_type}
            onChange={(e) => setFilters((f) => ({ ...f, primitive_type: e.target.value }))}
            className="text-xs px-2.5 py-1.5 bg-slate-800/50 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-slate-500"
          >
            <option value="">All primitives</option>
            <option value="ContentQube">ContentQube</option>
            <option value="ToolQube">ToolQube</option>
            <option value="AigentQube">AigentQube</option>
            <option value="DataQube">DataQube</option>
            <option value="ClusterQube">ClusterQube</option>
            <option value="ModelQube">ModelQube</option>
          </select>
          <input
            type="text"
            placeholder="block_id"
            value={filters.block}
            onChange={(e) => setFilters((f) => ({ ...f, block: e.target.value }))}
            className="text-xs px-2.5 py-1.5 bg-slate-800/50 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500"
          />
          <select
            value={filters.source}
            onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
            className="text-xs px-2.5 py-1.5 bg-slate-800/50 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-slate-500"
          >
            <option value="">Both sources</option>
            <option value="orchestration_events">orchestration_events</option>
            <option value="content_qube_dvn_receipts">content_qube_dvn_receipts</option>
          </select>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {counts.orchestration} orchestration · {counts.content_qube} content_qube ·{' '}
            <span className="text-slate-300">{receipts.length} shown</span>
          </div>
          <button
            onClick={loadReceipts}
            disabled={receiptsLoading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-slate-700/50 hover:bg-slate-700 text-slate-200 border border-slate-600 disabled:opacity-50"
          >
            {receiptsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Refresh
          </button>
        </div>
      </section>

      {/* Receipts table */}
      {receiptsError && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-rose-900/30 border border-rose-700/50 text-rose-200 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>{receiptsError}</div>
        </div>
      )}
      {!receiptsLoading && !receiptsError && receipts.length === 0 && (
        <div className="text-sm text-slate-500 py-6 text-center">
          No receipts match these filters.
        </div>
      )}
      {!receiptsLoading && receipts.length > 0 && (
        <div className="border border-slate-700/50 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-800/40 text-slate-400 uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2">Source</th>
                <th className="text-left px-3 py-2">Receipt</th>
                <th className="text-left px-3 py-2">iQube</th>
                <th className="text-left px-3 py-2">Kind</th>
                <th className="text-left px-3 py-2">Mode</th>
                <th className="text-left px-3 py-2">Cartridge</th>
                <th className="text-left px-3 py-2">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {receipts.map((r) => (
                <tr key={`${r.source}:${r.receipt_id}`} className="hover:bg-slate-800/30">
                  <td className="px-3 py-2">
                    <span
                      className={cls(
                        'inline-block px-2 py-0.5 rounded text-[10px]',
                        r.source === 'orchestration_events'
                          ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
                      )}
                    >
                      {r.source === 'orchestration_events' ? 'orch' : 'content'}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-300">{r.receipt_id.slice(0, 14)}…</td>
                  <td className="px-3 py-2 font-mono text-slate-400">
                    {r.iqube_id ? r.iqube_id.slice(0, 8) + '…' : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-300">{r.event_type || r.receipt_kind || '—'}</td>
                  <td className="px-3 py-2 text-slate-300">{r.receipt_mode || '—'}</td>
                  <td className="px-3 py-2 text-slate-400">{r.cartridge_scope || '—'}</td>
                  <td className="px-3 py-2 text-slate-400">{fmtTime(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Blocks section */}
      <section className="pt-4 border-t border-slate-800 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Boxes className="w-4 h-4 text-violet-400" />
              Recent Blocks
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Logical block ledger per cartridge scope. Sealer cadence default 1000 items or 1 hour
              (overridable via <code>registry_config</code>).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadBlocks}
              disabled={blocksLoading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-slate-700/50 hover:bg-slate-700 text-slate-200 border border-slate-600 disabled:opacity-50"
            >
              {blocksLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Refresh
            </button>
            <button
              onClick={sealAll}
              disabled={sealBusy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-violet-600/80 hover:bg-violet-600 text-white disabled:opacity-50"
            >
              {sealBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Seal at threshold
            </button>
          </div>
        </div>

        {sealMsg && (
          <div className="text-xs px-3 py-2 rounded-md bg-slate-800/50 border border-slate-700 text-slate-300">
            {sealMsg}
          </div>
        )}

        {blocksError && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-rose-900/30 border border-rose-700/50 text-rose-200 text-xs">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <div>{blocksError}</div>
          </div>
        )}

        {!blocksLoading && !blocksError && blocks.length === 0 && (
          <div className="text-sm text-slate-500 py-6 text-center">
            No blocks yet. First receipt-eligible emission opens block #1 for its scope.
          </div>
        )}

        {!blocksLoading && blocks.length > 0 && (
          <div className="border border-slate-700/50 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-800/40 text-slate-400 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2">Block</th>
                  <th className="text-left px-3 py-2">Scope</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-right px-3 py-2">Items</th>
                  <th className="text-left px-3 py-2">Batch hash</th>
                  <th className="text-left px-3 py-2">Opened</th>
                  <th className="text-left px-3 py-2">Sealed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {blocks.map((b) => (
                  <tr
                    key={b.block_id}
                    className="hover:bg-slate-800/30 cursor-pointer"
                    onClick={() => setFilters((f) => ({ ...f, block: b.block_id }))}
                    title="Click to filter receipts by this block"
                  >
                    <td className="px-3 py-2 font-mono text-slate-300">
                      <span className="inline-flex items-center gap-1">
                        <Hash className="w-3 h-3 text-slate-500" />
                        {b.block_number}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-300">{b.cartridge_scope}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cls(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]',
                          STATUS_COLOR[b.status] ?? 'bg-slate-700 text-slate-300',
                        )}
                      >
                        {b.status === 'sealed' && <CheckCircle2 className="w-3 h-3" />}
                        {b.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-300">{b.receipt_count}</td>
                    <td className="px-3 py-2 font-mono text-slate-400">
                      {b.batch_hash ? b.batch_hash.slice(0, 10) + '…' : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{fmtTime(b.opened_at)}</td>
                    <td className="px-3 py-2 text-slate-400">{fmtTime(b.sealed_at ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="text-xs text-slate-500 pt-2 border-t border-slate-800">
        DVN block model is Phase-1 — does not depend on Bitcoin ordinal inscription. The
        <code> inscription_id</code> + <code>inscription_chain</code> columns populate when the future Phase 3.4
        anchoring worker ships; until then sealed blocks are durable index entries. Click a block row above to
        filter the receipts table by that block.
      </div>
    </div>
  );
}
