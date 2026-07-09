"use client";

/**
 * The Homecoming Test — live (CFS-023 acceptance surface).
 *
 * Renders Constitutional Presence per delegate: the L0→L5 ladder computed
 * mechanically against the real platform tables. Honest statuses — `pending` is
 * a first-class state ("could not determine / not yet wired"), never faked
 * green. A delegate has come home when it climbs to L5 (operationally sovereign)
 * while remaining recognisably itself. The ladder is contiguous: a gap caps
 * presence at the last unbroken rung.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Home } from "lucide-react";
import { experimentGet } from "./experimentStepFetch";

type RungStatus = "reached" | "not-reached" | "pending";

interface RungAssessment {
  level: string;
  index: number;
  status: RungStatus;
  evidence: string;
}

interface DelegatePresence {
  delegate: string;
  agentClass: string;
  charterStatus: "concrete" | "archetype" | "conceptual";
  presenceLevel: string | null;
  presenceIndex: number;
  rungs: RungAssessment[];
}

interface Summary {
  total: number;
  present: number;
  reasoning: number;
  sovereign: number;
  conceptual: number;
}

const RUNG_DOT: Record<RungStatus, string> = {
  reached: "bg-emerald-500 border-emerald-400",
  "not-reached": "bg-slate-700 border-slate-600",
  pending: "bg-amber-500/70 border-amber-400 animate-pulse",
};

const CHARTER_CHIP: Record<DelegatePresence["charterStatus"], string> = {
  concrete: "bg-emerald-950/60 border-emerald-800 text-emerald-300",
  archetype: "bg-indigo-950/60 border-indigo-800 text-indigo-300",
  conceptual: "bg-slate-800/60 border-slate-700 text-slate-400",
};

const LADDER_LABEL: Record<string, string> = {
  card: "L0 · Card",
  knowledge: "L1 · Knowledge",
  reasoning: "L2 · Reasoning",
  studio: "L3 · Studio",
  development: "L4 · Development",
  sovereign: "L5 · Sovereign",
};

export default function HomecomingTestTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [delegates, setDelegates] = useState<DelegatePresence[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [computedAt, setComputedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await experimentGet("/api/constitutional/homecoming-test");
      setDelegates(data.delegates as DelegatePresence[]);
      setSummary(data.summary as Summary);
      setComputedAt(data.computedAt as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to compute the Homecoming Test");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Home className="h-4 w-4 text-indigo-400" /> The Homecoming Test — live
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Constitutional Presence per delegate (CFS-023), computed against the real platform state.
            The ladder is contiguous — a gap caps presence at the last unbroken rung.{" "}
            <span className="text-amber-300">pending</span> = could not determine, never faked green.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Recompute
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Computing constitutional presence…
        </div>
      )}
      {error && <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</div>}

      {summary && !loading && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 flex flex-wrap items-center gap-4 text-sm">
          <span className="text-slate-200 font-semibold">
            {summary.reasoning}/{summary.total} reasoning-connected (L2+)
          </span>
          <span className="text-emerald-300">{summary.sovereign} sovereign (L5)</span>
          <span className="text-slate-400">{summary.present} present (L0+)</span>
          <span className="text-slate-500">{summary.conceptual} conceptual</span>
          {computedAt && <span className="ml-auto text-xs text-slate-600">computed {new Date(computedAt).toLocaleString()}</span>}
        </div>
      )}

      {!loading &&
        delegates.map((d) => (
          <div key={d.delegate} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-100">{d.delegate}</span>
              <span className="text-xs text-slate-500">{d.agentClass}</span>
              <span className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-wide ${CHARTER_CHIP[d.charterStatus]}`}>
                {d.charterStatus}
              </span>
              <span className="ml-auto text-xs text-slate-400">
                {d.presenceLevel ? LADDER_LABEL[d.presenceLevel] ?? d.presenceLevel : "below L0"}
              </span>
            </div>
            {/* The ladder strip — one dot per rung, lit to the contiguous reached level. */}
            <div className="mt-2 flex items-center gap-2">
              {d.rungs.map((r) => (
                <div key={r.level} className="flex flex-col items-center gap-1" title={`${LADDER_LABEL[r.level] ?? r.level} — ${r.status}: ${r.evidence}`}>
                  <span className={`h-2.5 w-2.5 rounded-full border ${RUNG_DOT[r.status]}`} />
                  <span className="text-[9px] text-slate-600">L{r.index}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
