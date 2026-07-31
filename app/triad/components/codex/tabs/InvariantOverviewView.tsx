"use client";

/**
 * Invariant Overview — the analytical facet layer over the live substrate
 * (Chrysalis Foundation, CFS-001..014). Standing, Reach, and status
 * distributions faceted by namespace. Standing (validation-class) and Reach
 * (adoption-class) are computed and displayed separately, never conflated
 * (Law XII).
 *
 * Reads the same snapshot as the Browse view via loadAllInvariants(); all
 * facets are computed client-side from that one fetch (no per-facet round
 * trips). Purely presentational — no writes.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  NAMESPACES,
  STATUSES,
  NAMESPACE_COLOR,
  NAMESPACE_FILL,
  STATUS_COLOR,
  loadAllInvariants,
  type InvariantRow,
} from "./invariantViewShared";

interface NamespaceFacet {
  namespace: string;
  count: number;
  avgStanding: number;
  avgReach: number;
  maxStanding: number;
  maxReach: number;
  byStatus: Record<string, number>;
}

// Standing/Reach live on a 0..10 scale (CFS-001 §6). Five buckets of width 2.
const SCORE_BUCKETS = [
  { label: "0–2", min: 0, max: 2 },
  { label: "2–4", min: 2, max: 4 },
  { label: "4–6", min: 4, max: 6 },
  { label: "6–8", min: 6, max: 8 },
  { label: "8–10", min: 8, max: 10.01 },
];

function bucketize(values: number[]): number[] {
  return SCORE_BUCKETS.map((b) => values.filter((v) => v >= b.min && v < b.max).length);
}

export function InvariantOverviewView({
  onOpenInvariant,
}: {
  onOpenInvariant: (id: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<InvariantRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await loadAllInvariants();
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load invariants");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const facets = useMemo<NamespaceFacet[]>(() => {
    const map = new Map<string, InvariantRow[]>();
    for (const r of rows) {
      const arr = map.get(r.namespace) ?? [];
      arr.push(r);
      map.set(r.namespace, arr);
    }
    return NAMESPACES.filter((ns) => map.has(ns)).map((ns) => {
      const group = map.get(ns)!;
      const byStatus: Record<string, number> = {};
      for (const r of group) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      const standings = group.map((r) => r.standing);
      const reaches = group.map((r) => r.reach);
      return {
        namespace: ns,
        count: group.length,
        avgStanding: standings.reduce((a, b) => a + b, 0) / group.length,
        avgReach: reaches.reduce((a, b) => a + b, 0) / group.length,
        maxStanding: Math.max(...standings),
        maxReach: Math.max(...reaches),
        byStatus,
      };
    });
  }, [rows]);

  const standingBuckets = useMemo(() => bucketize(rows.map((r) => r.standing)), [rows]);
  const reachBuckets = useMemo(() => bucketize(rows.map((r) => r.reach)), [rows]);
  const maxBucket = Math.max(1, ...standingBuckets, ...reachBuckets);

  const statusTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const r of rows) t[r.status] = (t[r.status] ?? 0) + 1;
    return t;
  }, [rows]);

  const topByStanding = useMemo(
    () => [...rows].sort((a, b) => b.standing - a.standing).slice(0, 5),
    [rows],
  );
  const topByReach = useMemo(
    () => [...rows].sort((a, b) => b.reach - a.reach).slice(0, 5),
    [rows],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 py-10 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Computing facets…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">
        {error}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-500">
        No invariants in the substrate yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">
        Facets over {rows.length} invariants. Standing (validation-class confidence) and Reach
        (adoption) are shown as separate axes — orthogonal, never conflated (Law XII).
      </p>

      {/* Per-namespace facet cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {facets.map((f) => (
          <div key={f.namespace} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className={`rounded border px-2 py-0.5 text-xs ${NAMESPACE_COLOR[f.namespace] ?? ""}`}>
                {f.namespace}
              </span>
              <span className="text-sm text-slate-400">{f.count}</span>
            </div>

            <div className="space-y-2">
              <ScoreBar label="Avg Standing" value={f.avgStanding} tone="standing" />
              <ScoreBar label="Avg Reach" value={f.avgReach} tone="reach" />
            </div>

            {/* Status mini-strip */}
            <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              {STATUSES.filter((s) => f.byStatus[s]).map((s) => (
                <div
                  key={s}
                  className={statusFill(s)}
                  style={{ width: `${(f.byStatus[s] / f.count) * 100}%` }}
                  title={`${s}: ${f.byStatus[s]}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Histogram title="Standing distribution" buckets={standingBuckets} max={maxBucket} tone="standing" />
        <Histogram title="Reach distribution" buckets={reachBuckets} max={maxBucket} tone="reach" />
      </div>

      {/* Status totals */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 mb-2">Status distribution (whole substrate)</h4>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.filter((s) => statusTotals[s]).map((s) => (
            <span key={s} className={`rounded px-2 py-0.5 text-xs ${STATUS_COLOR[s] ?? ""}`}>
              {s} · {statusTotals[s]}
            </span>
          ))}
        </div>
      </div>

      {/* Leaderboards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Leaderboard title="Highest Standing" rows={topByStanding} scoreKey="standing" onOpen={onOpenInvariant} />
        <Leaderboard title="Highest Reach" rows={topByReach} scoreKey="reach" onOpen={onOpenInvariant} />
      </div>
    </div>
  );
}

function toneClass(tone: "standing" | "reach") {
  // Standing → emerald (validation earned — positive), Reach → cyan
  // (adoption). Constant positive hues, distinct so the two Law XII axes are
  // never visually confused; magnitude is carried by fill, not colour. Matches
  // the Browse/detail Dots palette (operator direction 2026-07-04: low
  // standing is YOUNG, not bad — never render earned evidence in red).
  return tone === "standing" ? "bg-emerald-500" : "bg-cyan-500";
}

function ScoreBar({ label, value, tone }: { label: string; value: number; tone: "standing" | "reach" }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-0.5">
        <span>{label}</span>
        <span className="text-slate-400">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full ${toneClass(tone)}`} style={{ width: `${(value / 10) * 100}%` }} />
      </div>
    </div>
  );
}

function Histogram({
  title,
  buckets,
  max,
  tone,
}: {
  title: string;
  buckets: number[];
  max: number;
  tone: "standing" | "reach";
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
      <h4 className="text-xs font-semibold text-slate-400 mb-3">{title}</h4>
      <div className="flex items-end gap-2 h-32">
        {buckets.map((count, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
            <span className="text-[10px] text-slate-500">{count}</span>
            <div
              className={`w-full rounded-t ${toneClass(tone)} transition-all`}
              style={{ height: `${(count / max) * 100}%`, minHeight: count > 0 ? "3px" : "0" }}
            />
            <span className="text-[10px] text-slate-600">{SCORE_BUCKETS[i].label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function statusFill(status: string): string {
  const m: Record<string, string> = {
    draft: "bg-slate-600",
    proposed: "bg-amber-500",
    validated: "bg-cyan-500",
    canonical: "bg-emerald-500",
    rejected: "bg-rose-500",
    deprecated: "bg-slate-700",
    superseded: "bg-slate-700",
  };
  return m[status] ?? "bg-slate-600";
}

function Leaderboard({
  title,
  rows,
  scoreKey,
  onOpen,
}: {
  title: string;
  rows: InvariantRow[];
  scoreKey: "standing" | "reach";
  onOpen: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
      <h4 className="text-xs font-semibold text-slate-400 mb-2">{title}</h4>
      <ol className="space-y-1.5">
        {rows.map((r, i) => (
          <li key={r.id}>
            <button
              onClick={() => onOpen(r.id)}
              className="w-full text-left flex items-start gap-2 rounded p-1.5 hover:bg-slate-800/60 transition"
            >
              <span className="text-xs text-slate-600 w-4 shrink-0">{i + 1}.</span>
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${NAMESPACE_FILL[r.namespace] ?? "bg-slate-500"}`} />
              <span className="text-xs text-slate-300 line-clamp-2 flex-1">{r.statement}</span>
              <span className="text-xs text-slate-400 tabular-nums shrink-0">{r[scoreKey].toFixed(1)}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
