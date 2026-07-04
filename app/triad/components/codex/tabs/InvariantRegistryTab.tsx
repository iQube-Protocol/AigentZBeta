"use client";

/**
 * Invariant Registry — browsing UI over the live invariant substrate
 * (Chrysalis Foundation, CFS-001..014).
 *
 * Lists invariants with namespace/status/search filtering, Standing/Reach
 * (Law XII — orthogonal, never conflated) at a glance, and opens a detail
 * modal (contexts, edges, provenance) per invariant. This is the front-end
 * surface flagged as missing after Phases 1-3 shipped API-only.
 *
 * Fetches via personaFetch (Identity & Access Spine); reuses the generic
 * Pagination and ViewModeToggle from components/registry/ (both iQube-
 * agnostic). Does NOT reuse FilterSection (hardcoded to iQube business-model
 * vocabulary) — the filter bar here is invariant-specific and hand-rolled.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { Dots } from "@/components/iqube/scoreUtils";
import { Pagination } from "@/components/registry/Pagination";
import { ViewModeToggle, type ViewMode } from "@/components/registry/ViewModeToggle";
import { InvariantDetailModal } from "./InvariantDetailModal";

const NAMESPACES = [
  "constitutional",
  "reasoning",
  "engineering",
  "experience",
  "capability",
  "style",
  "narrative",
] as const;

const STATUSES = [
  "draft",
  "proposed",
  "validated",
  "canonical",
  "rejected",
  "deprecated",
  "superseded",
] as const;

type SortKey = "standing" | "reach" | "recent";

const NAMESPACE_COLOR: Record<string, string> = {
  constitutional: "bg-violet-950/60 text-violet-300 border-violet-800",
  reasoning: "bg-cyan-950/60 text-cyan-300 border-cyan-800",
  engineering: "bg-slate-800/60 text-slate-300 border-slate-700",
  experience: "bg-amber-950/60 text-amber-300 border-amber-800",
  capability: "bg-emerald-950/60 text-emerald-300 border-emerald-800",
  style: "bg-pink-950/60 text-pink-300 border-pink-800",
  narrative: "bg-indigo-950/60 text-indigo-300 border-indigo-800",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-slate-800 text-slate-400",
  proposed: "bg-amber-900/50 text-amber-300",
  validated: "bg-cyan-900/50 text-cyan-300",
  canonical: "bg-emerald-900/50 text-emerald-300",
  rejected: "bg-rose-900/50 text-rose-300",
  deprecated: "bg-slate-800/50 text-slate-500 line-through",
  superseded: "bg-slate-800/50 text-slate-500",
};

interface InvariantRow {
  id: string;
  seedId: string | null;
  statement: string;
  namespace: string;
  semanticType: string | null;
  status: string;
  confidence: number;
  standing: number;
  reach: number;
  createdAt: string;
}

const PAGE_SIZE = 24;

export function InvariantRegistryTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<InvariantRow[]>([]);

  const [namespace, setNamespace] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("standing");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "500" });
      if (namespace) params.set("namespace", namespace);
      if (status) params.set("status", status);
      if (search) params.set("q", search);
      const res = await personaFetch(`/api/invariants?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load invariants");
      setRows(data.invariants as InvariantRow[]);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invariants");
    } finally {
      setLoading(false);
    }
  }, [namespace, status, search]);

  useEffect(() => {
    load();
  }, [load]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (sort === "standing") copy.sort((a, b) => b.standing - a.standing);
    else if (sort === "reach") copy.sort((a, b) => b.reach - a.reach);
    else copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return copy;
  }, [rows, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    const byNamespace: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const r of rows) {
      byNamespace[r.namespace] = (byNamespace[r.namespace] ?? 0) + 1;
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    }
    return { byNamespace, byStatus, total: rows.length };
  }, [rows]);

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Invariant Registry</h2>
        <p className="text-sm text-slate-400 mt-1">
          The live constitutional substrate (CFS-001..014) — {stats.total} invariant
          {stats.total === 1 ? "" : "s"} across {Object.keys(stats.byNamespace).length} namespace
          {Object.keys(stats.byNamespace).length === 1 ? "" : "s"}. Standing (validated confidence)
          and Reach (adoption) are orthogonal and never conflated (Law XII).
        </p>
      </div>

      {stats.total > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {NAMESPACES.filter((ns) => stats.byNamespace[ns]).map((ns) => (
            <button
              key={ns}
              onClick={() => setNamespace(namespace === ns ? "" : ns)}
              className={`rounded border px-2 py-0.5 text-xs transition ${
                namespace === ns ? "ring-1 ring-white/40" : "opacity-80 hover:opacity-100"
              } ${NAMESPACE_COLOR[ns] ?? "bg-slate-800 text-slate-300 border-slate-700"}`}
            >
              {ns} · {stats.byNamespace[ns]}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search statements…"
            className="rounded-md border border-slate-700 bg-slate-900 pl-8 pr-3 py-1.5 text-sm text-slate-100 w-56"
          />
        </div>

        <select
          value={namespace}
          onChange={(e) => setNamespace(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-300"
        >
          <option value="">All namespaces</option>
          {NAMESPACES.map((ns) => (
            <option key={ns} value={ns}>
              {ns}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-300"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-300"
        >
          <option value="standing">Sort: Standing</option>
          <option value="reach">Sort: Reach</option>
          <option value="recent">Sort: Recently seeded</option>
        </select>

        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </div>

      {error && (
        <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading invariants…
        </div>
      )}

      {!loading && !error && sorted.length === 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-500">
          No invariants match this filter.
        </div>
      )}

      {!loading && !error && paged.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {paged.map((inv) => (
            <button
              key={inv.id}
              onClick={() => setSelectedId(inv.id)}
              className="text-left rounded-lg border border-slate-800 bg-slate-900/60 p-3 hover:border-slate-600 transition"
            >
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className={`rounded border px-1.5 py-0.5 text-[10px] ${NAMESPACE_COLOR[inv.namespace] ?? ""}`}>
                  {inv.namespace}
                </span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] ${STATUS_COLOR[inv.status] ?? ""}`}>
                  {inv.status}
                </span>
              </div>
              <p className="text-sm text-slate-200 line-clamp-3">{inv.statement}</p>
              <div className="mt-2 flex items-center gap-4">
                <Dots value={inv.standing / 10} kind="reliability" title="Standing" size="xs" />
                <Dots value={inv.reach / 10} kind="trust" title="Reach" size="xs" />
              </div>
            </button>
          ))}
        </div>
      )}

      {!loading && !error && paged.length > 0 && viewMode !== "grid" && (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80 text-xs text-slate-500">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Statement</th>
                <th className="text-left px-3 py-2 font-medium">Namespace</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Standing</th>
                <th className="text-left px-3 py-2 font-medium">Reach</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {paged.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => setSelectedId(inv.id)}
                  className="cursor-pointer hover:bg-slate-900/60 transition"
                >
                  <td className="px-3 py-2 text-slate-200 max-w-md truncate" title={inv.statement}>
                    {inv.statement}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] ${NAMESPACE_COLOR[inv.namespace] ?? ""}`}>
                      {inv.namespace}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${STATUS_COLOR[inv.status] ?? ""}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Dots value={inv.standing / 10} kind="reliability" title="Standing" size="xs" />
                  </td>
                  <td className="px-3 py-2">
                    <Dots value={inv.reach / 10} kind="trust" title="Reach" size="xs" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && sorted.length > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={sorted.length}
          limit={PAGE_SIZE}
          hasNextPage={page < totalPages}
          hasPrevPage={page > 1}
          onPageChange={setPage}
        />
      )}

      {selectedId && (
        <InvariantDetailModal invariantId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
