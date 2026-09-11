"use client";

/**
 * The Chrysalis Test — live (CFS-015 final acceptance test as an instrument).
 *
 * Renders the mechanically computed acceptance criteria with honest statuses:
 * `pending` is a first-class state (ratified capability not yet exercised),
 * `partial` means observably flowing but below the full claim. The tab is the
 * program's standing dashboard — Level 5 (Constitutionally Complete) is
 * reached when every criterion reads pass, and not before.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { experimentGet } from "./experimentStepFetch";

interface Criterion {
  id: string;
  title: string;
  status: "pass" | "partial" | "pending" | "fail";
  evidence: string;
}

const STATUS_CHIP: Record<Criterion["status"], string> = {
  pass: "bg-emerald-950/60 border-emerald-800 text-emerald-300",
  partial: "bg-indigo-950/60 border-indigo-800 text-indigo-300",
  pending: "bg-amber-950/60 border-amber-800 text-amber-300",
  fail: "bg-rose-950/60 border-rose-800 text-rose-300",
};

export default function ChrysalisTestTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [summary, setSummary] = useState<{ passed: number; partial: number; pending: number; failed: number; total: number } | null>(null);
  const [computedAt, setComputedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await experimentGet("/api/constitutional/chrysalis-test");
      setCriteria(data.criteria as Criterion[]);
      setSummary(data.summary as typeof summary);
      setComputedAt(data.computedAt as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to compute the Chrysalis Test");
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
            <ShieldCheck className="h-4 w-4 text-indigo-400" /> The Chrysalis Test — live
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            CFS-015&apos;s final acceptance test computed against the actual platform state. Honest
            statuses: <span className="text-amber-300">pending</span> is ratified-but-not-yet-exercised,
            never faked green. Constitutionally Complete = every criterion passes.
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
          <Loader2 className="h-4 w-4 animate-spin" /> Computing acceptance criteria…
        </div>
      )}
      {error && <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</div>}

      {summary && !loading && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 flex flex-wrap items-center gap-4 text-sm">
          <span className="text-slate-200 font-semibold">
            {summary.passed}/{summary.total} criteria pass
          </span>
          <span className="text-indigo-300">{summary.partial} partial</span>
          <span className="text-amber-300">{summary.pending} pending</span>
          <span className={summary.failed > 0 ? "text-rose-300" : "text-slate-500"}>{summary.failed} failed</span>
          {computedAt && <span className="ml-auto text-xs text-slate-600">computed {new Date(computedAt).toLocaleString()}</span>}
        </div>
      )}

      {!loading &&
        criteria.map((c) => (
          <div key={c.id} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-wide ${STATUS_CHIP[c.status]}`}>
                {c.status}
              </span>
              <span className="text-sm text-slate-200">{c.title}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{c.evidence}</p>
          </div>
        ))}
    </div>
  );
}
