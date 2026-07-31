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
import { Loader2, Play, BarChart3 } from "lucide-react";
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
interface ArmSummary {
  arm?: string;
  available?: boolean;
  reason?: string;
  meanPrecision?: number;
  meanRecall?: number;
  meanF1?: number;
}
interface Comparison {
  vocabularySize?: number;
  sovereign?: ArmSummary;
  random?: ArmSummary;
  keyword?: ArmSummary;
  semantic?: ArmSummary;
  [k: string]: unknown;
}
interface GradedTier { meanPrecision?: number; meanRecall?: number; meanF1?: number }
interface Graded {
  aggregate?: {
    exact?: GradedTier;
    normalized?: GradedTier;
    genuineMissingCount?: number;
    genuineRedundantCount?: number;
  };
  [k: string]: unknown;
}
interface Topology {
  available?: boolean;
  reason?: string;
  aggregate?: {
    meanStructural?: number;
    meanCausalCoverage?: number;
    meanMinimality?: number;
    meanProjectionFidelity?: number;
    deltaClasses?: { abstraction?: number; omission?: number; redundant?: number };
    graphConfirmedAbstractions?: number;
    embeddingAbstractions?: number;
  };
  [k: string]: unknown;
}

const pct = (v: unknown) => (typeof v === "number" ? `${Math.round(v * 100)}%` : "—");

export default function Exp006ProjectionRunner({ canRequestPublish = false }: { canRequestPublish?: boolean } = {}) {
  const [running, setRunning] = useState<false | "plain" | "baselines">(false);
  const [error, setError] = useState<string | null>(null);
  const [aggregate, setAggregate] = useState<Aggregate | null>(null);
  const [rows, setRows] = useState<DeltaRow[]>([]);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [graded, setGraded] = useState<Graded | null>(null);
  const [topology, setTopology] = useState<Topology | null>(null);
  const [ranAt, setRanAt] = useState<string | null>(null);

  const run = async (withBaselines: boolean) => {
    setRunning(withBaselines ? "baselines" : "plain");
    setError(null);
    try {
      // The embedding-heavy run computes baselines AND EXP-006A topology scoring
      // in one pass (both need embeddings); the plain run stays lexical + graded.
      const data = await experimentStep("/api/experiments/irl-exp001", withBaselines ? { baselines: true, topology: true } : {});
      setAggregate((data.aggregate as Aggregate) ?? null);
      setRows(((data.results as DeltaRow[]) ?? []).slice(0, 40));
      setComparison((data.comparison as Comparison) ?? null);
      setGraded((data.graded as Graded) ?? null);
      setTopology((data.topology as Topology) ?? null);
      setRanAt((data.at as string) ?? new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "run failed");
    } finally {
      setRunning(false);
    }
  };

  // Ordered arms for the comparator table — sovereign (system under test) first,
  // then the floor. Aletheon 2026-07-20: a fidelity number is only interpretable
  // against these comparators.
  const ARM_LABELS: Array<[keyof Comparison, string]> = [
    ["sovereign", "Sovereign router (under test)"],
    ["semantic", "Semantic retrieval"],
    ["keyword", "Keyword (lexical)"],
    ["random", "Random (chance floor)"],
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        Stage A predicts the invariant projection for each intent (sovereign, invariant-aware router), scores it against
        an independently generated reference set (CIRS), and classifies the Invariant Deltas. Admin run · not published
        here — canonical publication is a separate operator-ratified step.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => run(false)}
          disabled={running !== false}
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {running === "plain" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          {running === "plain" ? "Running Stage A…" : "Run Stage A"}
        </button>
        <button
          onClick={() => run(true)}
          disabled={running !== false}
          title="Run Stage A plus random / keyword / semantic comparator arms against the same reference — answers '43% compared to what?'"
          className="inline-flex items-center gap-1.5 rounded-md border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50"
        >
          {running === "baselines" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />}
          {running === "baselines" ? "Running + baselines + topology…" : "Run with baselines + topology (EXP-006A)"}
        </button>
      </div>

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

      {graded?.aggregate && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <div className="mb-2 text-xs font-semibold text-slate-200">
            Graded scoring — the same run at rising match tolerance
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-slate-500">
                  <th className="py-1 pr-3 text-left font-medium">Tier</th>
                  <th className="px-2 py-1 text-right font-medium">Precision</th>
                  <th className="px-2 py-1 text-right font-medium">Recall</th>
                  <th className="px-2 py-1 text-right font-medium">F1</th>
                </tr>
              </thead>
              <tbody>
                <tr className="text-slate-400">
                  <td className="py-1 pr-3">Exact (raw Stage-A baseline)</td>
                  <td className="px-2 py-1 text-right tabular-nums">{pct(graded.aggregate.exact?.meanPrecision)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{pct(graded.aggregate.exact?.meanRecall)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{pct(graded.aggregate.exact?.meanF1)}</td>
                </tr>
                <tr className="text-slate-100">
                  <td className="py-1 pr-3 font-semibold">Normalized (morphology + separators)</td>
                  <td className="px-2 py-1 text-right tabular-nums">{pct(graded.aggregate.normalized?.meanPrecision)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{pct(graded.aggregate.normalized?.meanRecall)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{pct(graded.aggregate.normalized?.meanF1)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[10px] text-slate-500">
            After folding morphological/separator variants (accessibility≈accessible, root_cause≈root-cause), genuine
            gaps: {graded.aggregate.genuineMissingCount ?? 0} missing · {graded.aggregate.genuineRedundantCount ?? 0} redundant.
            Exact is the unaltered published baseline; semantic-equivalence + subsumption tiers are the documented next step.
          </div>
        </div>
      )}

      {topology && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <div className="mb-2 text-xs font-semibold text-slate-200">EXP-006A — topology / abstraction-aware fidelity</div>
          {topology.available === false ? (
            <p className="text-[11px] text-amber-300/80">unavailable{topology.reason ? ` — ${topology.reason}` : ""} (needs an embedding provider)</p>
          ) : topology.aggregate ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Projection fidelity", pct(topology.aggregate.meanProjectionFidelity)],
                  ["Structural (lexical)", pct(topology.aggregate.meanStructural)],
                  ["Causal coverage", pct(topology.aggregate.meanCausalCoverage)],
                  ["Minimality", pct(topology.aggregate.meanMinimality)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-md bg-white/5 px-2.5 py-1.5">
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">{k}</div>
                    <div className="text-sm font-semibold text-slate-100">{v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-sky-300">
                  {topology.aggregate.deltaClasses?.abstraction ?? 0} abstraction
                  {" "}({topology.aggregate.graphConfirmedAbstractions ?? 0} graph-confirmed · {topology.aggregate.embeddingAbstractions ?? 0} embedding)
                </span>
                <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-rose-300">{topology.aggregate.deltaClasses?.omission ?? 0} omission</span>
                <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-slate-400">{topology.aggregate.deltaClasses?.redundant ?? 0} redundant</span>
              </div>
              <div className="mt-2 text-[10px] text-slate-500">
                Subsumption is graph-truth first (specializes/generalizes edges), embedding proxy where a label isn&apos;t a
                registry node. Genuine gaps = omissions; abstraction deltas are same-family, different-level — not failures.
              </div>
            </>
          ) : null}
        </div>
      )}

      {comparison && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <BarChart3 className="h-3.5 w-3.5 text-indigo-300" />
            Comparator arms — scored against the same CIRS reference
            {typeof comparison.vocabularySize === "number" && (
              <span className="font-normal text-slate-500">· field vocab {comparison.vocabularySize}</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-slate-500">
                  <th className="py-1 pr-3 text-left font-medium">Arm</th>
                  <th className="px-2 py-1 text-right font-medium">Precision</th>
                  <th className="px-2 py-1 text-right font-medium">Recall</th>
                  <th className="px-2 py-1 text-right font-medium">F1</th>
                </tr>
              </thead>
              <tbody>
                {ARM_LABELS.map(([key, label]) => {
                  const arm = comparison[key] as ArmSummary | undefined;
                  if (!arm) return null;
                  const isSovereign = key === "sovereign";
                  const unavailable = arm.available === false;
                  return (
                    <tr key={key} className={isSovereign ? "text-slate-100" : "text-slate-300"}>
                      <td className={`py-1 pr-3 ${isSovereign ? "font-semibold" : ""}`}>{label}</td>
                      {unavailable ? (
                        <td className="px-2 py-1 text-right text-slate-500" colSpan={3}>
                          unavailable{arm.reason ? ` — ${arm.reason}` : ""}
                        </td>
                      ) : (
                        <>
                          <td className="px-2 py-1 text-right tabular-nums">{pct(arm.meanPrecision)}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{pct(arm.meanRecall)}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{pct(arm.meanF1)}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[10px] text-slate-500">
            Baselines predict exactly k=|reference| labels from the shared field vocabulary (no arm sees the
            per-intent answer), so precision≈recall — a fair floor for the sovereign arm. Human baseline is a
            separate annotation pass (not run here).
          </div>
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
            ...(graded ? { graded } : {}),
            ...(topology ? { topology } : {}),
            ...(comparison ? { comparison } : {}),
            ranAt: ranAt ?? new Date().toISOString(),
          }}
          lifecycleSummary={`EXP-006 run published: intents=${aggregate.intents ?? rows.length} meanOverlap=${pct(aggregate.meanOverlap)} deltas=${aggregate.deltaCount ?? 0}`}
        />
      )}
    </div>
  );
}
