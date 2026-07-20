"use client";

/**
 * EXP-006 — Intent → Invariant Projection Fidelity (Stage A), the first of the
 * Invariant Intelligence Validation Series (IIVS · CRP-002). One admin run:
 * generate an independent CIRS reference, predict the invariant projection per
 * intent through the sovereign router, score fidelity, and classify the
 * Invariant Deltas. Runs, displays, and SAVES like every other experiment
 * runner: admins publish straight to canon; reviewers save privately or submit
 * for steward approval (operator report 2026-07-20 — a completed run had no way
 * to save and was lost on navigation).
 */

import React, { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { experimentStep } from "./experimentStepFetch";
import { ExperimentResultActions } from "./ExperimentResultActions";

interface DeltaRow {
  intent?: string;
  predicted?: string[];
  reference?: string[];
  overlap?: number;
  precision?: number;
  recall?: number;
  deltas?: Array<{ kind?: string; label?: string } | string>;
}
interface Aggregate {
  intents?: number;
  meanOverlap?: number;
  meanPrecision?: number;
  meanRecall?: number;
  deltaCount?: number;
  [k: string]: unknown;
}

const pct = (v: unknown) => (typeof v === "number" ? `${Math.round(v * 100)}%` : "—");

export default function Exp006ProjectionRunner({ canRequestPublish = false }: { canRequestPublish?: boolean } = {}) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aggregate, setAggregate] = useState<Aggregate | null>(null);
  const [rows, setRows] = useState<DeltaRow[]>([]);
  const [ranAt, setRanAt] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const data = await experimentStep("/api/experiments/irl-exp001", {});
      setAggregate((data.aggregate as Aggregate) ?? null);
      setRows(((data.results as DeltaRow[]) ?? []).slice(0, 40));
      setRanAt((data.at as string) ?? new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "run failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        Stage A predicts the invariant projection for each intent (sovereign, invariant-aware router), scores it against
        an independently generated reference set (CIRS), and classifies the Invariant Deltas. Admin run · not published
        here — canonical publication is a separate operator-ratified step.
      </p>

      <button
        onClick={run}
        disabled={running}
        className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        {running ? "Running Stage A…" : "Run Stage A"}
      </button>

      {error && <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</div>}

      {aggregate && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <div className="mb-2 text-xs font-semibold text-slate-200">
            Aggregate {ranAt ? `· ${new Date(ranAt).toLocaleString()}` : ""}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Intents", String(aggregate.intents ?? rows.length)],
              ["Mean overlap", pct(aggregate.meanOverlap)],
              ["Mean precision", pct(aggregate.meanPrecision)],
              ["Mean recall", pct(aggregate.meanRecall)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md bg-white/5 px-2.5 py-1.5">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">{k}</div>
                <div className="text-sm font-semibold text-slate-100">{v}</div>
              </div>
            ))}
          </div>
          {typeof aggregate.deltaCount === "number" && (
            <div className="mt-2 text-[11px] text-amber-300/80">{aggregate.deltaCount} Invariant Delta(s) classified — first-class WP0 data.</div>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-1">
          {rows.map((r, i) => (
            <div key={i} className="rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px]">
              <div className="truncate text-slate-300">{r.intent ?? `intent ${i + 1}`}</div>
              <div className="text-slate-500">
                overlap {pct(r.overlap)} · precision {pct(r.precision)} · recall {pct(r.recall)}
                {Array.isArray(r.deltas) && r.deltas.length > 0 ? ` · ${r.deltas.length} delta(s)` : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Save + copy — so a completed run survives navigation AND can be lifted
          out for offline analysis (per-intent predicted/reference/deltas).
          Shared global footer: admin → canon; reviewer → private or (opt-in)
          submitted for steward approval. Copy is client-only, always available. */}
      {aggregate && !running && (
        <ExperimentResultActions
          experiment="EXP-006"
          provider="sovereign-router"
          model="invariant-aware"
          canRequestPublish={canRequestPublish}
          aggregates={{
            intents: aggregate.intents ?? rows.length,
            meanOverlap: aggregate.meanOverlap,
            meanPrecision: aggregate.meanPrecision,
            meanRecall: aggregate.meanRecall,
            deltaCount: aggregate.deltaCount,
          }}
          results={{
            experiment: "EXP-006",
            claim:
              "IIVS Stage A (CRP-002): intent → invariant projection fidelity, predicted through the sovereign invariant-aware router and scored against an independently generated CIRS reference; Invariant Deltas classified as first-class WP0 data.",
            aggregate,
            rows,
            ranAt: ranAt ?? new Date().toISOString(),
          }}
          lifecycleSummary={`EXP-006 run published: intents=${aggregate.intents ?? rows.length} meanOverlap=${pct(aggregate.meanOverlap)} deltas=${aggregate.deltaCount ?? 0}`}
        />
      )}
    </div>
  );
}
