"use client";

/**
 * EXP-P2 utility runner — the three-arm FS reasoning-substrate experiment
 * (Aletheon 2026-07-21). For each task, runs cold / manual / discovered
 * (answer + blind quality judge), reports per-arm mean + both deltas
 * (discovered−cold: does curation help; discovered−manual: does DISCOVERY beat
 * hand-authoring). A separate ABLATION pass drops one earned root at a time and
 * measures degradation = full − ablated (positive ⇒ the root is causally
 * load-bearing, not merely recurrent). One LLM call per request (Lambda-safe);
 * the client sequences + accumulates.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Play, Layers, ShieldCheck, AlertTriangle } from "lucide-react";
import { experimentGet, experimentStep } from "./experimentStepFetch";

type Arm = "cold" | "manual" | "discovered";
const ARMS: Arm[] = ["cold", "manual", "discovered"];
const ARM_LABEL: Record<Arm, string> = { cold: "Cold", manual: "Manual baseline", discovered: "Earned (discovered)" };

interface Task { id: string; prompt: string; rubric: string }
interface Provider { id: string; available: boolean }
interface Judged { taskIndex: number; arm: Arm; score: number }
interface AblationScore { excludedIndex: number; taskIndex: number; score: number }

function mean(xs: number[]): number | null {
  return xs.length ? Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)) : null;
}

export default function ExpP2UtilityRunner() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [libraryCount, setLibraryCount] = useState(0);
  const [manualCount, setManualCount] = useState(0);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [provider, setProvider] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [judged, setJudged] = useState<Judged[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const [ablation, setAblation] = useState<AblationScore[]>([]);
  const [ablating, setAblating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await experimentGet("/api/experiments/exp-p2");
      setTasks((d.tasks as Task[]) ?? []);
      setLibraryCount(Number(d.libraryCount ?? 0));
      setManualCount(Number(d.manualBaselineCount ?? 0));
      setLibraryError((d.libraryError as string | null) ?? null);
      const provs = (d.providers as Provider[]) ?? [];
      setProviders(provs);
      setProvider((prev) => prev || provs.find((p) => p.available)?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const answerThenJudge = useCallback(
    async (taskIndex: number, arm: Arm, excludeIndex?: number): Promise<number | null> => {
      const ans = await experimentStep("/api/experiments/exp-p2", {
        action: "answer", provider, taskIndex, arm, ...(excludeIndex !== undefined ? { excludeIndex } : {}),
      });
      const j = await experimentStep("/api/experiments/exp-p2", {
        action: "judge", provider, taskIndex, answer: ans.answer,
      });
      const s = Number(j.score);
      return Number.isFinite(s) ? s : null;
    },
    [provider],
  );

  const runThreeArm = useCallback(async () => {
    if (!provider) return;
    setRunning(true); setError(null); setJudged([]);
    const acc: Judged[] = [];
    try {
      for (let t = 0; t < tasks.length; t++) {
        for (const arm of ARMS) {
          setProgress(`Task ${t + 1}/${tasks.length} · ${ARM_LABEL[arm]}`);
          const score = await answerThenJudge(t, arm);
          if (score !== null) { acc.push({ taskIndex: t, arm, score }); setJudged([...acc]); }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed");
    } finally {
      setRunning(false); setProgress(null);
    }
  }, [provider, tasks, answerThenJudge]);

  const runAblation = useCallback(async () => {
    if (!provider || libraryCount < 1) return;
    setAblating(true); setError(null); setAblation([]);
    const acc: AblationScore[] = [];
    try {
      for (let idx = 0; idx < libraryCount; idx++) {
        for (let t = 0; t < tasks.length; t++) {
          setProgress(`Ablation · drop root ${idx + 1}/${libraryCount} · task ${t + 1}/${tasks.length}`);
          const score = await answerThenJudge(t, "discovered", idx);
          if (score !== null) { acc.push({ excludedIndex: idx, taskIndex: t, score }); setAblation([...acc]); }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ablation failed");
    } finally {
      setAblating(false); setProgress(null);
    }
  }, [provider, tasks, libraryCount, answerThenJudge]);

  const agg = useMemo(() => {
    const per = (arm: Arm) => mean(judged.filter((j) => j.arm === arm).map((j) => j.score));
    const cold = per("cold"), manual = per("manual"), disc = per("discovered");
    return {
      cold, manual, disc,
      dVsCold: cold !== null && disc !== null ? Number((disc - cold).toFixed(2)) : null,
      dVsManual: manual !== null && disc !== null ? Number((disc - manual).toFixed(2)) : null,
    };
  }, [judged]);

  const fullDiscMean = agg.disc;
  const ablationRows = useMemo(() => {
    const byIdx = new Map<number, number[]>();
    for (const a of ablation) { const arr = byIdx.get(a.excludedIndex) ?? []; arr.push(a.score); byIdx.set(a.excludedIndex, arr); }
    return [...byIdx.entries()].sort((a, b) => a[0] - b[0]).map(([idx, scores]) => {
      const m = mean(scores);
      return { idx, ablatedMean: m, degradation: fullDiscMean !== null && m !== null ? Number((fullDiscMean - m).toFixed(2)) : null };
    });
  }, [ablation, fullDiscMean]);

  if (loading) return <div className="flex items-center gap-2 py-6 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading EXP-P2…</div>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">
        EXP-P2 — does the DISCOVERED invariant substrate have operational utility? Three arms per task
        (<span className="text-slate-200">cold</span> · <span className="text-slate-200">manual baseline</span> ·
        {" "}<span className="text-emerald-300">earned</span>), blind quality judge, plus root ablation.
      </p>

      {/* Preconditions */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2 text-[11px]">
        <span className="text-slate-400">Earned library:</span>
        <span className={libraryCount > 0 ? "text-emerald-300" : "text-amber-300"}>{libraryCount} invariants</span>
        <span className="text-slate-600">·</span>
        <span className="text-slate-400">Manual baseline:</span>
        <span className={manualCount > 0 ? "text-slate-200" : "text-amber-300"}>{manualCount}</span>
        {libraryCount === 0 && (
          <span className="basis-full inline-flex items-center gap-1 text-amber-400">
            <AlertTriangle className="h-3 w-3" /> Promote some discovered financial-services invariants (→ proposed) before the earned/ablation arms will run.
          </span>
        )}
        {libraryError && <span className="basis-full text-amber-400">{libraryError}</span>}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={provider} onChange={(e) => setProvider(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100">
          {providers.map((p) => <option key={p.id} value={p.id} disabled={!p.available}>{p.id}{p.available ? "" : " (no key)"}</option>)}
        </select>
        <button onClick={() => void runThreeArm()} disabled={running || ablating || !provider || tasks.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-700 px-3 py-1.5 text-xs text-white hover:bg-indigo-600 disabled:opacity-50">
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Run three-arm comparison
        </button>
        <button onClick={() => void runAblation()} disabled={running || ablating || !provider || libraryCount < 1}
          title="Expensive: re-runs the earned arm once per dropped root × per task"
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-500/20 disabled:opacity-50">
          {ablating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />} Run root ablation
        </button>
        {progress && <span className="text-[11px] text-slate-400">{progress}</span>}
      </div>
      {error && <p className="text-xs text-amber-400">{error}</p>}

      {/* Three-arm result */}
      {judged.length > 0 && (
        <div className="rounded-md border border-slate-800 bg-slate-950/50 p-3 space-y-2">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Mean quality (0–10), n={judged.length}</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {ARMS.map((arm) => {
              const v = arm === "cold" ? agg.cold : arm === "manual" ? agg.manual : agg.disc;
              return (
                <div key={arm} className="rounded-md border border-slate-800 bg-slate-900/40 p-2">
                  <div className="text-[10px] text-slate-500">{ARM_LABEL[arm]}</div>
                  <div className={`text-lg font-semibold ${arm === "discovered" ? "text-emerald-300" : "text-slate-200"}`}>{v ?? "—"}</div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-slate-500" /> earned − cold:{" "}
              <span className={(agg.dVsCold ?? 0) > 0 ? "text-emerald-300" : "text-slate-300"}>{agg.dVsCold ?? "—"}</span>
              <span className="text-slate-600">(does curation help?)</span>
            </span>
            <span className="inline-flex items-center gap-1">
              earned − manual:{" "}
              <span className={(agg.dVsManual ?? 0) > 0 ? "text-emerald-300" : "text-slate-300"}>{agg.dVsManual ?? "—"}</span>
              <span className="text-slate-600">(does discovery beat hand-authoring?)</span>
            </span>
          </div>
        </div>
      )}

      {/* Ablation result */}
      {ablationRows.length > 0 && (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
          <div className="text-[11px] uppercase tracking-wide text-amber-300/80">Root ablation — degradation when each root is removed (full earned mean {fullDiscMean ?? "—"})</div>
          <div className="space-y-1">
            {ablationRows.map((r) => (
              <div key={r.idx} className="flex items-center gap-2 text-[11px]">
                <span className="w-24 shrink-0 text-slate-400">drop [FS-{r.idx + 1}]</span>
                <span className="w-16 text-slate-300">{r.ablatedMean ?? "—"}</span>
                <div className="flex-1 h-2 rounded bg-slate-800 overflow-hidden">
                  <div className="h-full bg-amber-500/70" style={{ width: `${Math.max(0, Math.min(100, (r.degradation ?? 0) * 20))}%` }} />
                </div>
                <span className={`w-24 text-right ${(r.degradation ?? 0) > 0 ? "text-amber-300" : "text-slate-500"}`}>
                  {r.degradation !== null ? `${r.degradation > 0 ? "−" : ""}${Math.abs(r.degradation)} ${r.degradation > 0 ? "load-bearing" : ""}` : "—"}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-500">Positive degradation = removing that root lowered reasoning quality → the root is causally load-bearing, not merely recurrent.</p>
        </div>
      )}
    </div>
  );
}
