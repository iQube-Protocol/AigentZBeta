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
import { Activity, RefreshCw, Loader2, CheckCircle2, AlertCircle, Play, Gauge, ShieldAlert } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

const SCORE_PRIMITIVES = ['ContentQube', 'ToolQube', 'AigentQube', 'DataQube', 'ClusterQube'] as const;
type ScorePrimitive = (typeof SCORE_PRIMITIVES)[number];

interface ScoreCoverage {
  primitive_type: string;
  total_iqubes: number;
  scored_iqubes: number;
  coverage_pct: number;
  with_overrides: number;
}

interface ScoreCoverageResponse {
  coverage: ScoreCoverage[];
  total_iqubes: number;
  total_scored: number;
  total_with_overrides: number;
}

interface ScoreBackfillReport {
  primitive_type: string;
  processed: number;
  populated: number;
  preserved_overrides: number;
  skipped: number;
  errors: Array<{ iqube_id: string; error: string }>;
  duration_ms: number;
}

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

  // Score backfill state — separate from the main backfill but lives in
  // the same tab for operator efficiency
  const [scoreCoverage, setScoreCoverage] = useState<ScoreCoverage[]>([]);
  const [scoreTotals, setScoreTotals] = useState<{ total: number; scored: number; overrides: number }>({
    total: 0,
    scored: 0,
    overrides: 0,
  });
  const [scoreLoading, setScoreLoading] = useState(true);
  const [scoreBusy, setScoreBusy] = useState<ScorePrimitive | 'ALL' | null>(null);
  const [scoreMessage, setScoreMessage] = useState<string | null>(null);

  const refreshScores = useCallback(async () => {
    setScoreLoading(true);
    try {
      const res = await personaFetch('/api/admin/registry/score-backfill', { cache: 'no-store' });
      if (res.ok) {
        const body = (await res.json()) as ScoreCoverageResponse;
        setScoreCoverage(Array.isArray(body.coverage) ? body.coverage : []);
        setScoreTotals({
          total: body.total_iqubes ?? 0,
          scored: body.total_scored ?? 0,
          overrides: body.total_with_overrides ?? 0,
        });
      }
    } catch (e) {
      // Best-effort — keep tab usable even if scores endpoint fails
      console.warn('[health] score coverage load failed', (e as Error).message);
    } finally {
      setScoreLoading(false);
    }
  }, []);

  const runScoreBackfill = useCallback(
    async (target: ScorePrimitive | 'ALL') => {
      setScoreBusy(target);
      setScoreMessage(null);
      try {
        const url =
          target === 'ALL'
            ? '/api/admin/registry/score-backfill'
            : `/api/admin/registry/score-backfill?source=${encodeURIComponent(target)}`;
        const res = await personaFetch(url, { method: 'POST', cache: 'no-store' });
        if (!res.ok) {
          setScoreMessage(`Score backfill failed: HTTP ${res.status}`);
          return;
        }
        const body = await res.json();
        if (target === 'ALL') {
          setScoreMessage(
            `Score backfill: ${body.total_populated ?? 0} populated, ${body.total_preserved_overrides ?? 0} overrides preserved, ${body.total_errors ?? 0} errors.`,
          );
        } else {
          const r = body as ScoreBackfillReport;
          setScoreMessage(
            `${target}: ${r.populated} populated, ${r.preserved_overrides} overrides preserved, ${r.errors?.length ?? 0} errors.`,
          );
        }
        await refreshScores();
      } catch (e) {
        setScoreMessage(`Network error: ${(e as Error).message}`);
      } finally {
        setScoreBusy(null);
      }
    },
    [refreshScores],
  );

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

  useEffect(() => {
    refreshScores();
  }, [refreshScores]);

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

      {/* Score data coverage section — 2026-05-31 backfill backlog */}
      <section className="pt-4 border-t border-slate-800 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Gauge className="w-4 h-4 text-violet-400" />
              Score Coverage
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Trust/Validation axes (sensitivity / accuracy / verifiability / risk) + derived (reliability / trust)
              per iQube. Backfill is idempotent + preserves any operator overrides.
            </p>
          </div>
          <button
            onClick={() => runScoreBackfill('ALL')}
            disabled={scoreBusy !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-violet-600/80 hover:bg-violet-600 text-white disabled:opacity-50"
          >
            {scoreBusy === 'ALL' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Re-derive all
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <SummaryCard label="Total iQubes" value={String(scoreTotals.total)} tone={'green'} />
          <SummaryCard
            label="Scored"
            value={`${scoreTotals.scored} / ${scoreTotals.total}`}
            hint={
              scoreTotals.total === 0
                ? '—'
                : `${Math.round((scoreTotals.scored / Math.max(scoreTotals.total, 1)) * 100)}%`
            }
            tone={
              scoreTotals.total === 0 || scoreTotals.scored === scoreTotals.total ? 'green' : 'amber'
            }
          />
          <SummaryCard
            label="Operator overrides"
            value={String(scoreTotals.overrides)}
            tone={'green'}
            hint="Preserved on re-run"
          />
        </div>

        {scoreMessage && (
          <div className="text-xs px-3 py-2 rounded-md bg-slate-800/50 border border-slate-700 text-slate-300">
            {scoreMessage}
          </div>
        )}

        <div className="border border-slate-700/50 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/40 text-slate-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2">Primitive</th>
                <th className="text-right px-3 py-2">Total</th>
                <th className="text-right px-3 py-2">Scored</th>
                <th className="text-right px-3 py-2">Coverage</th>
                <th className="text-right px-3 py-2">Overrides</th>
                <th className="text-right px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {SCORE_PRIMITIVES.map((p) => {
                const cov = scoreCoverage.find((c) => c.primitive_type === p);
                const total = cov?.total_iqubes ?? 0;
                const scored = cov?.scored_iqubes ?? 0;
                const pct = cov?.coverage_pct ?? 0;
                const isComplete = total > 0 && scored === total;
                return (
                  <tr key={p} className="hover:bg-slate-800/30">
                    <td className="px-3 py-2 text-slate-200">{p}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{total}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{scored}</td>
                    <td className="px-3 py-2 text-right">
                      {scoreLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin inline text-slate-500" />
                      ) : total === 0 ? (
                        <span className="text-xs text-slate-500">—</span>
                      ) : (
                        <span
                          className={cls(
                            'inline-block text-xs px-2 py-0.5 rounded',
                            isComplete
                              ? 'bg-emerald-700 text-emerald-100'
                              : pct >= 50
                                ? 'bg-amber-700 text-amber-100'
                                : 'bg-rose-700 text-rose-100',
                          )}
                        >
                          {pct}%
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-slate-400">
                      {cov?.with_overrides ? (
                        <span className="inline-flex items-center gap-1 text-violet-300">
                          <ShieldAlert className="w-3 h-3" />
                          {cov.with_overrides}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => runScoreBackfill(p)}
                        disabled={scoreBusy !== null}
                        className={cls(
                          'text-xs px-2 py-1 rounded',
                          scoreBusy === p
                            ? 'bg-slate-700 text-slate-400'
                            : 'bg-slate-700/50 hover:bg-slate-700 text-slate-200',
                        )}
                      >
                        {scoreBusy === p ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Re-derive'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-500">
          Each primitive has a derivation strategy (e.g. <code>content_qube_v1</code> from gating + lifecycle;{' '}
          <code>aigent_qube_v1</code> from governance trust_band + identifiability). Operator overrides on individual
          axes are sacred — re-runs preserve them. Per-axis override UI lands in the legacy <code>/registry</code>{' '}
          integration Phase B.
        </p>
      </section>

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
