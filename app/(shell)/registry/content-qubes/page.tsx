"use client";

/**
 * /registry/content-qubes — admin-gated browser for v_content_qube_registry.
 *
 * The point of this surface is operational verification: if the ContentQube
 * registry is to be the single source of truth for content inventory +
 * access, the operator must be able to load this page and see every row.
 * No persona filtering, no codex-tab plumbing — just the raw registry view.
 *
 * Data source: GET /api/registry/content-qube/browse?series=...&contentKind=...
 * Auth:        cartridgeFlags.isAdmin === true (enforced server-side).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

interface RegistryRow {
  id: string;
  series: string;
  content_kind: string;
  content_type: string;
  display_number: number | null;
  title: string | null;
  description: string | null;
  lifecycle_state: string;
  master_qube_id: string | null;
  media_asset_id: string | null;
  created_at: string;
  updated_at: string;
  gating_kind: string | null;
  required_sku: string[] | null;
  price_qc: number | null;
  min_identity_level: string | null;
  primary_storage_kind: string | null;
  primary_mime_type: string | null;
  primary_file_size_bytes: number | null;
  primary_content_state: string | null;
  storage_kinds: string[] | null;
  total_editions: number;
  issued_count: number;
  chain_minted_count: number;
  legendary_count: number;
  epic_count: number;
  rare_count: number;
  secret_black_rare_count: number;
  codex_slugs: string[] | null;
}

interface BrowseResponse {
  ok: boolean;
  data?: {
    rows: RegistryRow[];
    summary: {
      total_rows: number;
      by_series: Record<string, number>;
      by_content_type: Record<string, number>;
      by_lifecycle_state: Record<string, number>;
    };
  };
  error?: string;
  hint?: string | null;
  code?: string | null;
}

const SERIES_OPTIONS = ['all', 'metaKnyts', 'qriptopian'] as const;
const KIND_OPTIONS = ['all', 'episode', 'character', 'gn', 'powers_sheet', 'lore_scroll', 'bundle', 'other'] as const;

export default function ContentQubeRegistryPage() {
  const [series, setSeries]           = useState<typeof SERIES_OPTIONS[number]>('metaKnyts');
  const [contentKind, setContentKind] = useState<typeof KIND_OPTIONS[number]>('all');
  const [rows, setRows]               = useState<RegistryRow[] | null>(null);
  const [summary, setSummary]         = useState<BrowseResponse['data']['summary'] | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [errorHint, setErrorHint]     = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setErrorHint(null);

    const params = new URLSearchParams();
    if (series !== 'all')      params.set('series', series);
    if (contentKind !== 'all') params.set('contentKind', contentKind);

    fetch(`/api/registry/content-qube/browse?${params.toString()}`)
      .then((r) => r.json() as Promise<BrowseResponse>)
      .then((json) => {
        if (cancelled) return;
        if (!json.ok) {
          setError(json.error ?? 'request failed');
          setErrorHint(json.hint ?? null);
          setRows(null);
          setSummary(null);
          return;
        }
        setRows(json.data?.rows ?? []);
        setSummary(json.data?.summary ?? null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'fetch failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [series, contentKind, refreshTick]);

  const groupedSummary = useMemo(() => {
    if (!summary) return null;
    return {
      series:     Object.entries(summary.by_series).sort((a, b) => b[1] - a[1]),
      types:      Object.entries(summary.by_content_type).sort((a, b) => b[1] - a[1]),
      lifecycles: Object.entries(summary.by_lifecycle_state).sort((a, b) => b[1] - a[1]),
    };
  }, [summary]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <h1 className="text-3xl font-semibold text-white">ContentQube Registry</h1>
          <button
            type="button"
            onClick={() => setRefreshTick((t) => t + 1)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>
        <p className="text-sm text-slate-400">
          Admin view of <code className="px-1 py-0.5 bg-slate-800 rounded">v_content_qube_registry</code> &mdash; the authoritative read path for ContentQube inventory + access policy + storage + editions + cartridge bindings.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-300">
          Series:&nbsp;
          <select
            value={series}
            onChange={(e) => setSeries(e.target.value as typeof SERIES_OPTIONS[number])}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white"
          >
            {SERIES_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Kind:&nbsp;
          <select
            value={contentKind}
            onChange={(e) => setContentKind(e.target.value as typeof KIND_OPTIONS[number])}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white"
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-700/60 bg-red-950/30 p-3 text-sm">
          <p className="font-semibold text-red-300">Error: {error}</p>
          {errorHint && <p className="mt-1 text-red-200/80">{errorHint}</p>}
          <p className="mt-2 text-xs text-red-200/60">
            403 = your persona doesn't have cartridgeFlags.isAdmin. 401 = unauthenticated.
            Other errors are typically schema issues (e.g. v_content_qube_registry missing).
          </p>
        </div>
      )}

      {/* Summary */}
      {groupedSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SummaryCard title="By series"          rows={groupedSummary.series} />
          <SummaryCard title="By content_type"    rows={groupedSummary.types} />
          <SummaryCard title="By lifecycle_state" rows={groupedSummary.lifecycles} />
        </div>
      )}

      {/* Table */}
      {loading && !rows && (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading registry rows...
        </div>
      )}

      {rows && rows.length === 0 && !loading && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
          No rows match the current filter. If <code>metaKnyts</code> shows zero, the
          Phase 6 bridge migration <code>20260513030000_content_qubes_knyt_pilot</code> has not run.
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-xs">
            <thead className="bg-slate-900 text-slate-300">
              <tr>
                <Th>series</Th>
                <Th>kind</Th>
                <Th>content_type</Th>
                <Th>disp #</Th>
                <Th>title</Th>
                <Th>lifecycle</Th>
                <Th>gating</Th>
                <Th>storage</Th>
                <Th>state</Th>
                <Th>editions</Th>
                <Th>codex</Th>
                <Th>bridge id</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-900/50">
                  <Td>{r.series}</Td>
                  <Td>{r.content_kind}</Td>
                  <Td className="font-mono">{r.content_type}</Td>
                  <Td className="text-right">{r.display_number ?? '—'}</Td>
                  <Td className="max-w-[16rem] truncate" title={r.title ?? undefined}>{r.title ?? '—'}</Td>
                  <Td>
                    <LifecycleBadge state={r.lifecycle_state} />
                  </Td>
                  <Td>{r.gating_kind ?? '—'}</Td>
                  <Td className="font-mono text-[10px]">
                    {(r.storage_kinds ?? []).join(', ') || '—'}
                  </Td>
                  <Td>{r.primary_content_state ?? '—'}</Td>
                  <Td className="text-right whitespace-nowrap">
                    {r.issued_count}/{r.total_editions}
                    {r.chain_minted_count > 0 && (
                      <span className="text-emerald-400"> ·{r.chain_minted_count} ⛓</span>
                    )}
                  </Td>
                  <Td className="font-mono text-[10px]">{(r.codex_slugs ?? []).join(', ') || '—'}</Td>
                  <Td className="font-mono text-[10px] max-w-[10rem] truncate" title={r.master_qube_id ?? r.media_asset_id ?? undefined}>
                    {r.master_qube_id ?? r.media_asset_id ?? '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-2 py-1.5 text-left font-medium uppercase tracking-wide text-[10px]">{children}</th>;
}

function Td({ children, className = '', title }: { children: React.ReactNode; className?: string; title?: string }) {
  return <td className={`px-2 py-1 text-slate-200 ${className}`} title={title}>{children}</td>;
}

function SummaryCard({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-2">{title}</p>
      <div className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between text-xs">
            <span className="text-slate-300 truncate">{k}</span>
            <span className="font-mono text-slate-100">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const LIFECYCLE_COLORS: Record<string, string> = {
  draft:          'bg-slate-800 text-slate-400',
  semi_minted:    'bg-amber-900/40 text-amber-300',
  review_ready:   'bg-sky-900/40 text-sky-300',
  canon_pending:  'bg-violet-900/40 text-violet-300',
  canonized:      'bg-emerald-900/40 text-emerald-300',
  chain_minted:   'bg-teal-900/40 text-teal-300',
  superseded:     'bg-orange-900/40 text-orange-300',
  archived:       'bg-slate-900 text-slate-500',
};

function LifecycleBadge({ state }: { state: string }) {
  const cls = LIFECYCLE_COLORS[state] ?? 'bg-slate-800 text-slate-400';
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{state}</span>;
}
