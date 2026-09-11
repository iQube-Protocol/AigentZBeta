'use client';

/**
 * CanonicalMintPanel — Admin UI for triggering Phase 7B mint flows
 * (POST /api/admin/content-qube/mint-master and /mint-edition).
 *
 * v1 supports the master mint only. Edition mint adds in v2 because
 * it requires editionId, editionNumber, rarity and holderAddress per
 * row — needs a richer form than a single button.
 *
 * Placement:
 * - Currently mounted inside QriptopianAdminTab → KNYT Codex section.
 * - Will move into the iQube Registry surface when that workstream
 *   ships (see backlog doc 2026-05-29_canonical-mint-panel-registry-integration.md).
 *
 * Spine:
 * - All calls go via personaFetch so the Bearer token is attached
 *   (the routes are spine-gated and reject cookie-only fetches).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle, Coins, ExternalLink, RefreshCw } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

type Row = {
  id: string;
  series: string;
  title: string | null;
  content_kind: string;
  content_type: string;
  lifecycle_state: string;
  updated_at: string;
};

type MintResult =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'success'; tokenId: string; txHash: string }
  | { kind: 'skipped'; reason: string }
  | { kind: 'error'; message: string };

interface Props {
  /** Optional series filter. Defaults to all series. */
  series?: string;
  /** Default holder/owner address for new mints. The admin can override
   *  per row. Pre-filled with the protocol treasury / minter EOA in
   *  most deployments. */
  defaultOwnerAddress?: string;
}

const BASESCAN_TX = 'https://basescan.org/tx/';

function lifecycleBadge(state: string): { color: string; label: string } {
  switch (state) {
    case 'chain_minted':
      return { color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', label: 'CHAIN-MINTED' };
    case 'canonized':
      return { color: 'bg-teal-500/15 text-teal-300 border-teal-500/30', label: 'CANONIZED' };
    case 'canon_pending':
    case 'review_ready':
      return { color: 'bg-amber-500/15 text-amber-300 border-amber-500/30', label: state.toUpperCase().replace('_', '-') };
    case 'semi_minted':
      return { color: 'bg-violet-500/15 text-violet-300 border-violet-500/30', label: 'SEMI-MINTED' };
    case 'draft':
      return { color: 'bg-slate-500/15 text-slate-300 border-slate-500/30', label: 'DRAFT' };
    default:
      return { color: 'bg-slate-500/15 text-slate-400 border-slate-500/30', label: state.toUpperCase() };
  }
}

export function CanonicalMintPanel({ series, defaultOwnerAddress }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, MintResult>>({});
  const [ownerOverrides, setOwnerOverrides] = useState<Record<string, string>>({});
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (series) params.set('series', series);
      const res = await personaFetch(`/api/admin/content-qube/list?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || `HTTP ${res.status}`);
        setRows([]);
        return;
      }
      setRows(Array.isArray(json.rows) ? json.rows : []);
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [series]);

  useEffect(() => { void load(); }, [load]);

  const mintMaster = useCallback(async (row: Row) => {
    const ownerAddress = (ownerOverrides[row.id] || defaultOwnerAddress || '').trim();
    if (!/^0x[0-9a-f]{40}$/i.test(ownerAddress)) {
      setResults((r) => ({ ...r, [row.id]: { kind: 'error', message: 'Owner address required (0x-prefixed 40-hex)' } }));
      return;
    }
    setResults((r) => ({ ...r, [row.id]: { kind: 'pending' } }));
    try {
      const res = await personaFetch('/api/admin/content-qube/mint-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentQubeId: row.id, ownerAddress }),
      });
      const json = await res.json();
      if (!res.ok) {
        setResults((r) => ({ ...r, [row.id]: { kind: 'error', message: json.error || `HTTP ${res.status}` } }));
        return;
      }
      if (json.skipped) {
        setResults((r) => ({ ...r, [row.id]: { kind: 'skipped', reason: json.skipped } }));
        return;
      }
      setResults((r) => ({
        ...r,
        [row.id]: { kind: 'success', tokenId: json.tokenId, txHash: json.txHash },
      }));
      // Optimistic local update so the row badge flips immediately.
      setRows((rs) => rs.map((x) => (x.id === row.id ? { ...x, lifecycle_state: 'chain_minted' } : x)));
    } catch (e: unknown) {
      setResults((r) => ({ ...r, [row.id]: { kind: 'error', message: (e as Error)?.message || 'Request failed' } }));
    } finally {
      setConfirmingId(null);
    }
  }, [ownerOverrides, defaultOwnerAddress]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.lifecycle_state] = (c[r.lifecycle_state] || 0) + 1;
    return c;
  }, [rows]);

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-slate-900/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Canonical Mint Panel</h3>
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">Base mainnet</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Fires the on-chain ERC-721 master mint via{' '}
            <code className="rounded bg-slate-800 px-1">POST /api/admin/content-qube/mint-master</code>.{' '}
            Idempotent — rows already <span className="text-emerald-300">chain-minted</span> are protected by a 409 gate server-side.
            {' '}For now this UI ships master only; edition mint (ERC-1155) needs more form fields and lands in v2.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
            {Object.entries(counts).map(([state, n]) => {
              const { color, label } = lifecycleBadge(state);
              return (
                <span key={state} className={`rounded border px-1.5 py-0.5 ${color}`}>
                  {label} · {n}
                </span>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 rounded border border-white/10 bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Reload
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded border border-red-800/40 bg-red-950/20 p-2 text-xs text-red-400">{error}</div>
      )}

      <div className="overflow-x-auto rounded-lg border border-white/5 bg-slate-900/40">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/60 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Series</th>
              <th className="px-3 py-2">Kind</th>
              <th className="px-3 py-2">Lifecycle</th>
              <th className="px-3 py-2">Owner address</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && rows.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500"><Loader2 className="inline h-4 w-4 animate-spin" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No content_qubes rows in the filter.</td></tr>
            ) : (
              rows.map((row) => {
                const isMinted = row.lifecycle_state === 'chain_minted';
                const result = results[row.id] ?? { kind: 'idle' as const };
                const owner = ownerOverrides[row.id] ?? defaultOwnerAddress ?? '';
                const isPending = result.kind === 'pending';
                const badge = lifecycleBadge(row.lifecycle_state);
                return (
                  <tr key={row.id} className="hover:bg-slate-800/40">
                    <td className="px-3 py-2 text-slate-200 max-w-[200px] truncate" title={row.title || row.id}>
                      {row.title || <span className="text-slate-500">Untitled</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{row.series}</td>
                    <td className="px-3 py-2 text-slate-500">{row.content_kind}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] ${badge.color}`}>{badge.label}</span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={owner}
                        onChange={(e) => setOwnerOverrides((o) => ({ ...o, [row.id]: e.target.value }))}
                        placeholder="0x…"
                        className="w-[300px] rounded border border-slate-700 bg-slate-950/40 px-2 py-1 font-mono text-[10px] text-slate-300 placeholder:text-slate-600"
                        disabled={isPending || isMinted}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isMinted ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" /> Minted
                        </span>
                      ) : confirmingId === row.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void mintMaster(row)}
                            className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500"
                            disabled={isPending}
                          >
                            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Coins className="h-3 w-3" />}
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingId(null)}
                            className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
                            disabled={isPending}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingId(row.id)}
                          className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/20"
                          disabled={isPending}
                        >
                          <Coins className="h-3 w-3" /> Mint master
                        </button>
                      )}
                      {result.kind === 'success' && (
                        <a
                          href={`${BASESCAN_TX}${result.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300"
                          title={result.txHash}
                        >
                          tx <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                      {result.kind === 'skipped' && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-amber-400" title={result.reason}>
                          <AlertCircle className="h-2.5 w-2.5" /> {result.reason}
                        </span>
                      )}
                      {result.kind === 'error' && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-red-400" title={result.message}>
                          <AlertCircle className="h-2.5 w-2.5" /> error
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
