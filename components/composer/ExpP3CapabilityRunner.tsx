"use client";

/**
 * EXP-P3 / D1 — Capability Validation runner. Two arms (field projection vs
 * baseline retrieval) over a SEALED ≥20-change ground-truth set, scored
 * precision/recall/F1. Real harness: the field arm is the live forecaster, the
 * baseline is matched-budget keyword retrieval. It only runs once a sealed set
 * exists — otherwise it shows an honest "awaiting dataset" state (no fabricated
 * numbers).
 */

import React, { useEffect, useState } from "react";
import { Loader2, Play, ShieldCheck, Lock } from "lucide-react";
import { experimentGet, experimentStep } from "./experimentStepFetch";

interface ArmScore { precision: number; recall: number; f1: number }
interface Aggregate {
  cases: number;
  fieldMeanF1: number; fieldMeanPrecision: number; fieldMeanRecall: number;
  baselineMeanF1: number; baselineMeanPrecision: number; baselineMeanRecall: number;
  f1Delta: number;
}
interface CaseResult { id: string; field: ArmScore; baseline: ArmScore }

const pct = (v: unknown) => (typeof v === "number" ? `${(v * 100).toFixed(1)}%` : "—");

export default function ExpP3CapabilityRunner({ canRequestPublish = false }: { canRequestPublish?: boolean } = {}) {
  void canRequestPublish;
  const [status, setStatus] = useState<{ datasetSealed: boolean; caseCount: number; minCases: number; note: string | null } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aggregate, setAggregate] = useState<Aggregate | null>(null);
  const [rows, setRows] = useState<CaseResult[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const d = await experimentGet("/api/experiments/exp-p3");
        setStatus({
          datasetSealed: Boolean(d.datasetSealed),
          caseCount: Number(d.caseCount ?? 0),
          minCases: Number(d.minCases ?? 20),
          note: (d.note as string | null) ?? null,
        });
      } catch { /* status stays null */ }
    })();
  }, []);

  const runnable = status?.datasetSealed && (status?.caseCount ?? 0) > 0;

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const data = await experimentStep("/api/experiments/exp-p3", {});
      setAggregate((data.aggregate as Aggregate) ?? null);
      setRows(((data.results as CaseResult[]) ?? []).slice(0, 60));
    } catch (err) {
      setError(err instanceof Error ? err.message : "run failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        Two arms answer a sealed ≥20-change ground-truth set: the <span className="text-indigo-300">field</span> arm
        projects each change into the invariant field (live forecaster), the <span className="text-slate-300">baseline</span> arm
        predicts the affected set by matched-budget keyword retrieval. Both scored precision/recall/F1 vs the sealed truth.
      </p>

      {status && !runnable && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-200">
            <Lock className="h-3.5 w-3.5" /> Awaiting sealed dataset
          </div>
          <p className="mt-1 text-[11px] text-slate-300">
            {status.caseCount} case(s) present · sealed: {String(status.datasetSealed)}. The harness is built and ready —
            it runs the moment a sealed set of ≥{status.minCases} changes exists.
          </p>
          {status.note && <p className="mt-1 text-[10px] text-slate-500">{status.note}</p>}
          <p className="mt-1 text-[10px] text-slate-500">
            Author + seal <code className="font-mono">services/experiments/exp-p3-changeset.json</code> (set{" "}
            <code className="font-mono">sealed: true</code>) — ground-truth the affected sets BEFORE forecasting.
          </p>
        </div>
      )}

      <button
        onClick={run}
        disabled={running || !runnable}
        className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
        title={runnable ? "Run both arms over the sealed change-set" : "No sealed dataset yet"}
      >
        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        {running ? "Running…" : "Run EXP-P3"}
      </button>

      {error && <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</div>}

      {aggregate && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <ShieldCheck className="h-4 w-4 text-emerald-300" /> Aggregate ({aggregate.cases} cases)
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border border-indigo-500/30 bg-indigo-500/10 p-2">
              <div className="text-[10px] uppercase tracking-wide text-indigo-300">Field arm</div>
              <div className="text-sm font-semibold text-slate-100">F1 {pct(aggregate.fieldMeanF1)}</div>
              <div className="text-[10px] text-slate-400">P {pct(aggregate.fieldMeanPrecision)} · R {pct(aggregate.fieldMeanRecall)}</div>
            </div>
            <div className="rounded-md border border-slate-700 bg-white/5 p-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Baseline arm</div>
              <div className="text-sm font-semibold text-slate-100">F1 {pct(aggregate.baselineMeanF1)}</div>
              <div className="text-[10px] text-slate-400">P {pct(aggregate.baselineMeanPrecision)} · R {pct(aggregate.baselineMeanRecall)}</div>
            </div>
          </div>
          <div className={`text-[11px] font-semibold ${aggregate.f1Delta > 0 ? "text-emerald-300" : "text-rose-300"}`}>
            Field − baseline F1 delta: {aggregate.f1Delta >= 0 ? "+" : ""}{pct(aggregate.f1Delta)}
            {aggregate.f1Delta > 0 ? " — field arm ahead" : " — no field advantage"}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-1">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px]">
              <span className="font-mono text-slate-400 shrink-0">{r.id}</span>
              <span className="text-indigo-300 shrink-0">field F1 {pct(r.field.f1)}</span>
              <span className="text-slate-400 shrink-0">baseline F1 {pct(r.baseline.f1)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
