'use client';

/**
 * IQubeRegistryBrowseTab — list every iQube in the canonical registry.
 *
 * Stage 8 C13. PRD v1.1 §A.1 cartridge surface. Reads
 * GET /api/registry/iqube?expand=cartridge via personaFetch so the Bearer
 * token attaches (required because the spine reads from getActivePersona).
 *
 * Renders:
 *   - Filter chips by primitive_type (DataQube / ContentQube / ToolQube /
 *     ModelQube / AigentQube / ClusterQube)
 *   - Table-style row per iQube showing display_name, primitive, surface
 *     lifecycle, visibility, gating, cartridge bindings
 *   - Click a row → expand detail via resolveIQube(?projection=admin)
 *
 * Authority: never decides access; just renders what the resolver returns.
 * caller_owns / caller_can_read fields are populated by the cartridge
 * projection (resolver delegates to userOwnsAsset / evaluateAccess).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Database, Filter, ChevronRight, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

type Primitive = 'DataQube' | 'ContentQube' | 'ToolQube' | 'ModelQube' | 'AigentQube' | 'ClusterQube';

interface BrowseEntry {
  iqube_id: string;
  primitive_type: Primitive;
  tool_subtype?: string;
  display_name?: string;
  surface_lifecycle?: string;
  mint_status?: string;
  visibility_state?: string;
  gating?: string[];
  cartridge_bindings?: string[];
  caller_owns?: boolean;
}

interface AdminEntry extends BrowseEntry {
  internal_lifecycle?: string;
  creator?: { identity_state?: string; alias_commitment?: string };
  dvn_receipt_index?: { receipt_count?: number };
  version?: string;
  created_at?: string;
  updated_at?: string;
}

const PRIMITIVES: ReadonlyArray<Primitive> = [
  'ContentQube',
  'ToolQube',
  'AigentQube',
  'DataQube',
  'ClusterQube',
  'ModelQube',
];

const PRIMITIVE_COLOR: Record<Primitive, string> = {
  ContentQube: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  ToolQube: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  AigentQube: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  DataQube: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  ClusterQube: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  ModelQube: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

const LIFECYCLE_COLOR: Record<string, string> = {
  draft: 'bg-slate-700 text-slate-300',
  wip: 'bg-amber-700 text-amber-100',
  canonized: 'bg-emerald-700 text-emerald-100',
  deprecated: 'bg-slate-600 text-slate-200',
  archived: 'bg-slate-800 text-slate-400',
};

function classNames(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export function IQubeRegistryBrowseTab() {
  const [entries, setEntries] = useState<BrowseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Primitive | 'ALL'>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adminCache, setAdminCache] = useState<Record<string, AdminEntry>>({});
  const [adminLoading, setAdminLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = filter === 'ALL' ? '?expand=cartridge&limit=300' : `?expand=cartridge&primitive_type=${filter}&limit=300`;
      const res = await personaFetch(`/api/registry/iqube${qs}`, { cache: 'no-store' });
      if (!res.ok) {
        setError(`Registry list failed: HTTP ${res.status}`);
        setEntries([]);
        return;
      }
      const body = await res.json();
      setEntries(Array.isArray(body?.entries) ? body.entries : []);
    } catch (e) {
      setError((e as Error).message || 'Network error');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const expand = useCallback(async (iqubeId: string) => {
    if (expanded === iqubeId) {
      setExpanded(null);
      return;
    }
    setExpanded(iqubeId);
    if (adminCache[iqubeId]) return;
    setAdminLoading(iqubeId);
    try {
      const res = await personaFetch(`/api/registry/iqube/${encodeURIComponent(iqubeId)}?projection=admin`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const body = (await res.json()) as AdminEntry;
        setAdminCache((prev) => ({ ...prev, [iqubeId]: body }));
      }
    } finally {
      setAdminLoading(null);
    }
  }, [expanded, adminCache]);

  const counts = useMemo(() => {
    const c: Record<Primitive | 'ALL', number> = {
      ALL: entries.length,
      ContentQube: 0,
      ToolQube: 0,
      AigentQube: 0,
      DataQube: 0,
      ClusterQube: 0,
      ModelQube: 0,
    };
    for (const e of entries) {
      if (e.primitive_type) c[e.primitive_type] = (c[e.primitive_type] ?? 0) + 1;
    }
    return c;
  }, [entries]);

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Database className="w-5 h-5 text-violet-400" />
            Browse iQubes
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Canonical registry — every iQube resolved through{' '}
            <code className="text-violet-300">services/registry/resolver.ts</code>. Click a row to expand the admin projection.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-slate-700/50 hover:bg-slate-700 text-slate-200 border border-slate-600"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </header>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-slate-500" />
        <button
          onClick={() => setFilter('ALL')}
          className={classNames(
            'text-xs px-2.5 py-1 rounded-full border',
            filter === 'ALL'
              ? 'bg-violet-500/20 text-violet-200 border-violet-500/50'
              : 'bg-slate-800/40 text-slate-400 border-slate-700 hover:border-slate-600',
          )}
        >
          All <span className="opacity-70 ml-1">{counts.ALL}</span>
        </button>
        {PRIMITIVES.map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className={classNames(
              'text-xs px-2.5 py-1 rounded-full border',
              filter === p
                ? PRIMITIVE_COLOR[p]
                : 'bg-slate-800/40 text-slate-400 border-slate-700 hover:border-slate-600',
            )}
          >
            {p} <span className="opacity-70 ml-1">{counts[p]}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading registry…
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-rose-900/30 border border-rose-700/50 text-rose-200 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Couldn't load the registry</div>
            <div className="text-rose-300/80 mt-0.5">{error}</div>
            <div className="text-rose-300/60 mt-1 text-xs">
              If you're not signed in or missing admin rights, the spine returns 401/403.
            </div>
          </div>
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div className="text-sm text-slate-500 py-8 text-center">
          No iQubes for this filter. Run the backfill at{' '}
          <code>/api/admin/registry/backfill</code> if you expect rows.
        </div>
      )}

      {!loading && !error && entries.length > 0 && (
        <div className="border border-slate-700/50 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/40 text-slate-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2 w-8"></th>
                <th className="text-left px-3 py-2">iQube</th>
                <th className="text-left px-3 py-2">Primitive</th>
                <th className="text-left px-3 py-2">Lifecycle</th>
                <th className="text-left px-3 py-2">Visibility</th>
                <th className="text-left px-3 py-2">Gating</th>
                <th className="text-left px-3 py-2">Cartridges</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {entries.map((e) => {
                const isExpanded = expanded === e.iqube_id;
                const admin = adminCache[e.iqube_id];
                const isLoadingAdmin = adminLoading === e.iqube_id;
                return (
                  <React.Fragment key={e.iqube_id}>
                    <tr
                      onClick={() => expand(e.iqube_id)}
                      className="hover:bg-slate-800/30 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-2">
                        <ChevronRight
                          className={classNames(
                            'w-3.5 h-3.5 text-slate-500 transition-transform',
                            isExpanded && 'rotate-90',
                          )}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-100">{e.display_name || e.iqube_id.slice(0, 8)}</div>
                        <div className="text-xs text-slate-500 font-mono">{e.iqube_id}</div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={classNames(
                            'inline-block text-xs px-2 py-0.5 rounded border',
                            PRIMITIVE_COLOR[e.primitive_type],
                          )}
                        >
                          {e.primitive_type}
                          {e.tool_subtype ? ` · ${e.tool_subtype}` : ''}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={classNames(
                            'inline-block text-xs px-2 py-0.5 rounded',
                            LIFECYCLE_COLOR[e.surface_lifecycle ?? ''] ?? 'bg-slate-700 text-slate-300',
                          )}
                        >
                          {e.surface_lifecycle ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-300 text-xs">{e.visibility_state ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-300 text-xs">
                        {(e.gating ?? []).join(', ') || '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-400 text-xs">
                        {(e.cartridge_bindings ?? []).join(', ') || '—'}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-900/60">
                        <td colSpan={7} className="px-6 py-3 text-xs">
                          {isLoadingAdmin && (
                            <div className="flex items-center gap-2 text-slate-400">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Loading admin projection…
                            </div>
                          )}
                          {admin && (
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-slate-300">
                              <Field label="Internal lifecycle" value={admin.internal_lifecycle} />
                              <Field label="Mint status" value={admin.mint_status} />
                              <Field label="Version" value={admin.version} />
                              <Field
                                label="Creator identity"
                                value={admin.creator?.identity_state}
                              />
                              <Field
                                label="Receipt count"
                                value={String(admin.dvn_receipt_index?.receipt_count ?? 0)}
                              />
                              <Field label="Created" value={fmtTime(admin.created_at)} />
                              <Field label="Updated" value={fmtTime(admin.updated_at)} />
                              <Field label="Card URL" value={`/api/iqubes/${admin.iqube_id}/card`} mono />
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-slate-500 uppercase tracking-wide text-[10px]">{label}</span>
      <div className={classNames('text-slate-200', mono && 'font-mono text-[11px]')}>
        {value || '—'}
      </div>
    </div>
  );
}

function fmtTime(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
