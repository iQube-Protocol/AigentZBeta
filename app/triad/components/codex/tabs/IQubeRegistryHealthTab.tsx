'use client';

/**
 * IQubeRegistryHealthTab — operational health for the canonical registry.
 *
 * Stage 8 C13. Surfaces:
 *   - Per-source backfill status (calls GET /api/admin/registry/backfill
 *     ?source=<s> for each known source)
 *   - Action buttons to re-run backfill per source or all at once
 *   - Known gaps (toolQubeSource = 0 by design; orphan metas tagged
 *     legacy_test_fixture)
 *
 * Admin-only — the underlying routes are spine-gated.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw, Loader2, CheckCircle2, AlertCircle, Play } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

const SOURCES = [
  'triad_meta',
  'content_qube',
  'registry_asset',
  'code:aigentQubeSource',
  'code:toolQubeSource',
  'code:liquidui-template',
] as const;

type Source = (typeof SOURCES)[number];

interface VerifyResult {
  source: Source;
  source_row_count: number;
  map_row_count: number;
  ready: boolean;
  detail: string;
}

interface BackfillReport {
  source: Source;
  processed: number;
  inserted: number;
  skipped: number;
  errors: Array<{ source_id: string; error: string }>;
  duration_ms: number;
}

function cls(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export function IQubeRegistryHealthTab() {
  const [results, setResults] = useState<Record<Source, VerifyResult | null>>(
    () => Object.fromEntries(SOURCES.map((s) => [s, null])) as any,
  );
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState<Source | 'ALL' | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setActionResult(null);
    await Promise.all(
      SOURCES.map(async (src) => {
        try {
          const res = await personaFetch(
            `/api/admin/registry/backfill?source=${encodeURIComponent(src)}`,
            { cache: 'no-store' },
          );
          if (res.ok) {
            const body = (await res.json()) as VerifyResult;
            setResults((prev) => ({ ...prev, [src]: body }));
          } else {
            setResults((prev) => ({
              ...prev,
              [src]: {
                source: src,
                source_row_count: -1,
                map_row_count: -1,
                ready: false,
                detail: `verify failed: HTTP ${res.status}`,
              },
            }));
          }
        } catch (e) {
          setResults((prev) => ({
            ...prev,
            [src]: {
              source: src,
              source_row_count: -1,
              map_row_count: -1,
              ready: false,
              detail: `network: ${(e as Error).message}`,
            },
          }));
        }
      }),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runBackfill = useCallback(
    async (target: Source | 'ALL') => {
      setActionBusy(target);
      setActionResult(null);
      try {
        const url =
          target === 'ALL'
            ? `/api/admin/registry/backfill`
            : `/api/admin/registry/backfill?source=${encodeURIComponent(target)}`;
        const res = await personaFetch(url, { method: 'POST', cache: 'no-store' });
        if (res.ok) {
          const body = await res.json();
          const summary =
            target === 'ALL'
              ? `Backfilled all sources: ${body.total_inserted ?? 0} inserted, ${body.total_skipped ?? 0} skipped, ${body.total_errors ?? 0} errors.`
              : `${target}: ${(body as BackfillReport).inserted} inserted, ${(body as BackfillReport).skipped} skipped, ${(body as BackfillReport).errors?.length ?? 0} errors.`;
          setActionResult(summary);
          await refresh();
        } else {
          setActionResult(`Backfill failed: HTTP ${res.status}`);
        }
      } catch (e) {
        setActionResult(`Backfill error: ${(e as Error).message}`);
      } finally {
        setActionBusy(null);
      }
    },
    [refresh],
  );

  const allReady = SOURCES.every((s) => results[s]?.ready);
  const totalMap = SOURCES.reduce((n, s) => n + Math.max(0, results[s]?.map_row_count ?? 0), 0);
  const totalSource = SOURCES.reduce((n, s) => n + Math.max(0, results[s]?.source_row_count ?? 0), 0);

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-violet-400" />
            Registry Health
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Per-source backfill status. Each source must be{' '}
            <span className="text-emerald-400">ready</span> before its cartridge read paths flip to the canonical resolver
            (PRD v1.1 §B.3).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-slate-700/50 hover:bg-slate-700 text-slate-200 border border-slate-600 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh status
          </button>
          <button
            onClick={() => runBackfill('ALL')}
            disabled={actionBusy !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-violet-600/80 hover:bg-violet-600 text-white disabled:opacity-50"
          >
            {actionBusy === 'ALL' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Re-run all
          </button>
        </div>
      </header>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3 text-sm">
        <SummaryCard
          label="Total mapped"
          value={String(totalMap)}
          hint={`${totalSource} expected`}
          tone={allReady ? 'green' : 'amber'}
        />
        <SummaryCard
          label="Sources ready"
          value={`${SOURCES.filter((s) => results[s]?.ready).length} / ${SOURCES.length}`}
          tone={allReady ? 'green' : 'amber'}
        />
        <SummaryCard
          label="Plane status"
          value={allReady ? 'OPERATIONAL' : 'PARTIAL'}
          tone={allReady ? 'green' : 'amber'}
        />
      </div>

      {actionResult && (
        <div className="text-xs px-3 py-2 rounded-md bg-slate-800/50 border border-slate-700 text-slate-300">
          {actionResult}
        </div>
      )}

      {/* Per-source table */}
      <div className="border border-slate-700/50 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/40 text-slate-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2">Source</th>
              <th className="text-right px-3 py-2">Source rows</th>
              <th className="text-right px-3 py-2">Map rows</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Detail</th>
              <th className="text-right px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {SOURCES.map((src) => {
              const r = results[src];
              return (
                <tr key={src} className="hover:bg-slate-800/30">
                  <td className="px-3 py-2 font-mono text-xs text-slate-200">{src}</td>
                  <td className="px-3 py-2 text-right text-slate-300">
                    {r ? (r.source_row_count < 0 ? '—' : r.source_row_count) : '…'}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-300">
                    {r ? (r.map_row_count < 0 ? '—' : r.map_row_count) : '…'}
                  </td>
                  <td className="px-3 py-2">
                    {!r ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                    ) : r.ready ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-400 text-xs">
                        <AlertCircle className="w-3.5 h-3.5" />
                        not ready
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">{r?.detail ?? ''}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => runBackfill(src)}
                      disabled={actionBusy !== null}
                      className={cls(
                        'text-xs px-2 py-1 rounded',
                        actionBusy === src
                          ? 'bg-slate-700 text-slate-400'
                          : 'bg-slate-700/50 hover:bg-slate-700 text-slate-200',
                      )}
                    >
                      {actionBusy === src ? (
                        <Loader2 className="w-3 h-3 animate-spin inline" />
                      ) : (
                        'Re-run'
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Known notes */}
      <div className="text-xs text-slate-500 space-y-1.5 pt-2 border-t border-slate-800">
        <p>
          <strong className="text-slate-400">Expected gaps:</strong>{' '}
          <code>code:toolQubeSource</code> reports 0 source rows — openclawCore registry only initialises in the clawhack-group-agents
          runtime, not the Next.js server. Tools get DB-promoted in legibility fast-follow #3.
        </p>
        <p>
          <strong className="text-slate-400">Orphan metas (Stage 0 Finding F):</strong> 4 triad_meta rows are tagged{' '}
          <code>notes='legacy_test_fixture'</code> per operator confirmation. They appear in the map but don't link to{' '}
          <code>master_content_qubes</code>.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: 'green' | 'amber' | 'red';
}) {
  const toneClasses = {
    green: 'border-emerald-700/40 bg-emerald-900/20',
    amber: 'border-amber-700/40 bg-amber-900/20',
    red: 'border-rose-700/40 bg-rose-900/20',
  }[tone];
  return (
    <div className={cls('px-3 py-3 rounded-md border', toneClasses)}>
      <div className="text-xs text-slate-400 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold text-slate-100 mt-0.5">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}
