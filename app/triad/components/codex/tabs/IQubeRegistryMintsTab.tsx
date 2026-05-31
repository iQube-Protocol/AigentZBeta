'use client';

/**
 * IQubeRegistryMintsTab — Mints + Sagas administration.
 *
 * Stage 8 C14. Lifts the existing CanonicalMintPanel (shipped 2026-05-29
 * at commit `89adda9a`, docs `2026-05-29_canonical-mint-panel-registry-
 * integration.md`) into the iqube-registry cartridge per the backlog
 * doc's explicit plan: "Mount the panel in the Registry admin surface —
 * replace the per-cartridge tab integration with a Registry-level
 * 'Canonical Mint' section, scoped by series via the `series` prop."
 *
 * v1 supports the master mint flow (per CanonicalMintPanel v1 scope).
 * Edition mint (ERC-1155) + bulk mint + treasury-wallet selection +
 * mint-saga state surface (PRD v1.0 §7) land in subsequent commits as
 * Stage 5 mint saga work matures.
 *
 * The original mount in KnytCodexAdminTab remains active during the
 * 30-day observation window. Removal scheduled per the backlog doc
 * "remove the mount from KnytCodexAdminTab once Registry is live, to
 * avoid two operator surfaces firing the same on-chain action."
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Hammer, Info, Activity, RefreshCw, Loader2, CheckCircle2, AlertCircle, Clock, Play } from 'lucide-react';
import { CanonicalMintPanel } from '@/components/admin/CanonicalMintPanel';
import { personaFetch } from '@/utils/personaSpine';

interface SagaSnapshot {
  saga_id: string;
  iqube_id: string | null;
  current_state: string;
  retry_count: number;
  last_error: string | null;
  idempotency_keys: Record<string, unknown>;
  is_terminal: boolean;
  is_failure: boolean;
  is_pending: boolean;
  updated_at: string;
}

const STATE_COLOR: Record<string, string> = {
  MINT_COMPLETE: 'bg-emerald-700 text-emerald-100',
  mint_failed: 'bg-rose-700 text-rose-100',
  payload_upload_failed: 'bg-rose-700 text-rose-100',
  anchor_persist_failed: 'bg-rose-700 text-rose-100',
  anchor_pending: 'bg-amber-700 text-amber-100',
  receipt_pending: 'bg-amber-700 text-amber-100',
  card_publish_pending: 'bg-amber-700 text-amber-100',
};

function stateBadge(state: string): string {
  return STATE_COLOR[state] ?? 'bg-slate-700 text-slate-200';
}

function fmtTime(iso?: string): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

const SERIES_FILTERS: Array<{ id: string; label: string; defaultFor?: string }> = [
  { id: 'metaKnyts', label: 'metaKnyts (KNYT)' },
  { id: 'qriptopian', label: 'Qriptopian' },
  { id: 'metame', label: 'metaMe activations' },
  { id: 'mvl', label: 'Venture Lab (MVL)' },
  { id: 'marketa', label: 'Marketa' },
  { id: 'knyt', label: 'Order of Metayé' },
];

export function IQubeRegistryMintsTab() {
  const [series, setSeries] = useState<string>('metaKnyts');
  const [sagas, setSagas] = useState<SagaSnapshot[]>([]);
  const [sagasLoading, setSagasLoading] = useState(true);
  const [sagasError, setSagasError] = useState<string | null>(null);
  const [reconcileBusy, setReconcileBusy] = useState(false);
  const [reconcileMsg, setReconcileMsg] = useState<string | null>(null);

  const loadSagas = useCallback(async () => {
    setSagasLoading(true);
    setSagasError(null);
    try {
      const res = await personaFetch('/api/admin/registry/mint-sagas?limit=20', { cache: 'no-store' });
      if (!res.ok) {
        setSagasError(`HTTP ${res.status}`);
        setSagas([]);
        return;
      }
      const body = await res.json();
      setSagas(Array.isArray(body?.sagas) ? body.sagas : []);
    } catch (e) {
      setSagasError((e as Error).message || 'Network error');
      setSagas([]);
    } finally {
      setSagasLoading(false);
    }
  }, []);

  const reconcile = useCallback(async () => {
    setReconcileBusy(true);
    setReconcileMsg(null);
    try {
      const res = await personaFetch('/api/admin/registry/mint-sagas', { method: 'POST', cache: 'no-store' });
      if (res.ok) {
        const body = await res.json();
        setReconcileMsg(
          `Reconciled ${body.processed} pending sagas — ${body.advanced} advanced to terminal, ${body.still_pending} still pending, ${body.failed} failed.`,
        );
        await loadSagas();
      } else {
        setReconcileMsg(`Reconcile failed: HTTP ${res.status}`);
      }
    } catch (e) {
      setReconcileMsg(`Network error: ${(e as Error).message}`);
    } finally {
      setReconcileBusy(false);
    }
  }, [loadSagas]);

  useEffect(() => { loadSagas(); }, [loadSagas]);

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Hammer className="w-5 h-5 text-violet-400" />
          Mints + Sagas
        </h2>
        <p className="text-sm text-slate-400">
          Canonical mint operations + Stage 5 mint-saga state machine.
        </p>
      </header>

      {/* Series selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 uppercase tracking-wide mr-1">Series</span>
        {SERIES_FILTERS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSeries(s.id)}
            className={
              series === s.id
                ? 'text-xs px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-200 border border-violet-500/50'
                : 'text-xs px-2.5 py-1 rounded-full bg-slate-800/40 text-slate-400 border border-slate-700 hover:border-slate-600'
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Lifted panel */}
      <CanonicalMintPanel series={series} />

      {/* Stage 5 Saga Status section */}
      <section className="pt-4 border-t border-slate-800 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet-400" />
              Mint Sagas
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Stage 5 state machine. Sagas auto-start on canonization approval; operator can also start one via{' '}
              <code className="text-slate-300">POST /api/registry/iqube/[id]/mint</code>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadSagas}
              disabled={sagasLoading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-slate-700/50 hover:bg-slate-700 text-slate-200 border border-slate-600 disabled:opacity-50"
            >
              {sagasLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Refresh
            </button>
            <button
              onClick={reconcile}
              disabled={reconcileBusy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-violet-600/80 hover:bg-violet-600 text-white disabled:opacity-50"
            >
              {reconcileBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Reconcile pending
            </button>
          </div>
        </div>

        {reconcileMsg && (
          <div className="text-xs px-3 py-2 rounded-md bg-slate-800/50 border border-slate-700 text-slate-300">
            {reconcileMsg}
          </div>
        )}

        {sagasError && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-rose-900/30 border border-rose-700/50 text-rose-200 text-xs">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <div>{sagasError}</div>
          </div>
        )}

        {!sagasLoading && !sagasError && sagas.length === 0 && (
          <div className="text-sm text-slate-500 py-6 text-center">
            No mint sagas yet. The first canonization approval kicks one off automatically.
          </div>
        )}

        {!sagasLoading && !sagasError && sagas.length > 0 && (
          <div className="border border-slate-700/50 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-800/40 text-slate-400 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2">Saga</th>
                  <th className="text-left px-3 py-2">iQube</th>
                  <th className="text-left px-3 py-2">State</th>
                  <th className="text-right px-3 py-2">Retries</th>
                  <th className="text-left px-3 py-2">Updated</th>
                  <th className="text-left px-3 py-2">Last error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sagas.map((s) => (
                  <tr key={s.saga_id} className="hover:bg-slate-800/30">
                    <td className="px-3 py-2 font-mono text-slate-300">{s.saga_id.slice(0, 8)}…</td>
                    <td className="px-3 py-2 font-mono text-slate-400">{s.iqube_id ? s.iqube_id.slice(0, 8) + '…' : '—'}</td>
                    <td className="px-3 py-2">
                      <span className={'inline-flex items-center gap-1 px-2 py-0.5 rounded ' + stateBadge(s.current_state)}>
                        {s.is_terminal && <CheckCircle2 className="w-3 h-3" />}
                        {s.is_failure && <AlertCircle className="w-3 h-3" />}
                        {s.is_pending && <Clock className="w-3 h-3" />}
                        {s.current_state}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-300">{s.retry_count}</td>
                    <td className="px-3 py-2 text-slate-400">{fmtTime(s.updated_at)}</td>
                    <td className="px-3 py-2 text-rose-300 truncate max-w-xs">{s.last_error ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Provenance note */}
      <div className="text-xs text-slate-500 flex items-start gap-2 pt-2 border-t border-slate-800">
        <Info className="w-3.5 h-3.5 mt-0.5 text-slate-500 flex-shrink-0" />
        <p>
          CanonicalMintPanel above lifted from KnytCodexAdminTab per the 2026-05-29 backlog. Mint Sagas section
          surfaces Stage 5 state. DVN receipt emission (Stage 6) + card refresh (Stage 7) land as their stages
          mature; saga advances through their placeholder steps in the meantime so it always reaches MINT_COMPLETE.
        </p>
      </div>
    </div>
  );
}
