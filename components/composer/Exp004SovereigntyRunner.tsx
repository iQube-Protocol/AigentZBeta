"use client";

/**
 * EXP-004 — Sovereignty Drill runner (CFS-015 principle 4).
 *
 * Venice-only by construction: the step API pins the provider; this runner
 * offers only the venice model allowlist. The drill's two outputs:
 *   1. COMPLETION — did every constitutional task complete at all? (the
 *      sovereignty claim: constitutional operation shall not fail)
 *   2. DEGRADATION — groundedness/citations/tokens, reported for comparison
 *      against the frontier-provider EXP-003 record, never scored pass/fail.
 * Task failures are recorded honestly as constitutional failures — the one
 * thing the drill exists to detect.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Play, ShieldCheck, Upload } from "lucide-react";
import { experimentGet, experimentStep } from "./experimentStepFetch";

interface DrillTask {
  id: string;
  prompt: string;
}

interface TaskRow {
  taskId: string;
  status: "pending" | "answering" | "judging" | "done" | "failed";
  error?: string;
  claimsTotal?: number;
  consistent?: number;
  contradicting?: number;
  citations?: number;
  outputTokens?: number | null;
}

interface PackRow {
  status: "pending" | "running" | "done" | "failed";
  composedBy?: string;
  mechanism?: string;
  bindings?: number;
  error?: string;
}

export default function Exp004SovereigntyRunner() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<DrillTask[]>([]);
  const [packGoal, setPackGoal] = useState<string>("");
  const [veniceAvailable, setVeniceAvailable] = useState<boolean>(false);
  const [models, setModels] = useState<{ id: string; label: string }[]>([]);
  const [model, setModel] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [pack, setPack] = useState<PackRow>({ status: "pending" });
  const [publishState, setPublishState] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await experimentGet("/api/experiments/exp004");
        setTasks(data.tasks as DrillTask[]);
        setPackGoal((data.packTask as { goal: string }).goal);
        setVeniceAvailable(Boolean(data.providerAvailable));
        const m = data.models as { id: string; label: string }[];
        setModels(m);
        setModel(m[0]?.id ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load drill config");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const run = useCallback(async () => {
    setRunning(true);
    setPublishState(null);
    const nextRows: TaskRow[] = tasks.map((t) => ({ taskId: t.id, status: "pending" }));
    setRows([...nextRows]);
    setPack({ status: "pending" });

    for (let i = 0; i < tasks.length; i += 1) {
      nextRows[i] = { ...nextRows[i], status: "answering" };
      setRows([...nextRows]);
      try {
        const answerData = await experimentStep("/api/experiments/exp004", {
          action: "answer",
          taskIndex: i,
          model: model || undefined,
        });
        const answer = answerData.result as Record<string, any>;
        nextRows[i] = { ...nextRows[i], status: "judging", outputTokens: answer.outputTokens ?? null };
        setRows([...nextRows]);
        const judgeData = await experimentStep("/api/experiments/exp004", {
          action: "judge",
          taskIndex: i,
          answer: answer.answer,
          model: model || undefined,
        });
        const verdict = judgeData.result as Record<string, any>;
        nextRows[i] = {
          ...nextRows[i],
          status: "done",
          claimsTotal: verdict.claimsTotal,
          consistent: verdict.consistent,
          contradicting: verdict.contradicting,
          citations: verdict.citations,
        };
      } catch (err) {
        // Constitutional failure on this task — the drill's core datum.
        nextRows[i] = {
          ...nextRows[i],
          status: "failed",
          error: err instanceof Error ? err.message : "task failed",
        };
      }
      setRows([...nextRows]);
    }

    setPack({ status: "running" });
    try {
      const packData = await experimentStep("/api/experiments/exp004", { action: "pack" });
      const p = packData.result as Record<string, any>;
      setPack({
        status: "done",
        composedBy: p.composedBy,
        mechanism: p.mechanism,
        bindings: p.bindings,
      });
    } catch (err) {
      setPack({ status: "failed", error: err instanceof Error ? err.message : "pack task failed" });
    }
    setRunning(false);
  }, [tasks, model]);

  const done = rows.length > 0 && !running && rows.every((r) => r.status === "done" || r.status === "failed") && pack.status !== "pending" && pack.status !== "running";
  const completed = rows.filter((r) => r.status === "done").length + (pack.status === "done" ? 1 : 0);
  const total = rows.length + 1;
  const sovereigntyHolds = done && completed === total;
  const judged = rows.filter((r) => typeof r.claimsTotal === "number" && (r.claimsTotal ?? 0) > 0);
  const groundedPct =
    judged.length > 0
      ? Math.round(
          (judged.reduce((s, r) => s + (r.consistent ?? 0), 0) /
            judged.reduce((s, r) => s + (r.claimsTotal ?? 0), 0)) *
            1000,
        ) / 10
      : null;
  const contradictions = judged.reduce((s, r) => s + (r.contradicting ?? 0), 0);

  const publish = async () => {
    setPublishState("publishing");
    try {
      const results = {
        experiment: "EXP-004",
        provider: "venice",
        model: model || models[0]?.id || "venice-default",
        claim: "Sovereign Survivability (CFS-015 principle 4): constitutional operation continues on the open-weight provider alone; quality may degrade, constitutional operation shall not.",
        tasks: rows,
        packTask: pack,
        aggregates: { completed, total, sovereigntyHolds, groundedPct, contradictions },
        ranAt: new Date().toISOString(),
      };
      const data = await experimentStep("/api/experiments/results", {
        experiment: "EXP-004",
        provider: "venice",
        model: model || models[0]?.id || "venice-default",
        aggregates: {
          completed: `${completed}/${total}`,
          sovereigntyHolds,
          groundedPct: groundedPct ?? "n/a",
          contradictions,
          note: "degradation is reported vs the EXP-003 frontier record, never scored pass/fail",
        },
        results,
      });
      setPublishState(`published — sha256 ${(data.contentHash as string).slice(0, 12)}…`);
    } catch (err) {
      setPublishState(err instanceof Error ? err.message : "publish failed");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading drill battery…
      </div>
    );
  }
  if (error) return <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</div>;

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h3 className="text-base font-semibold text-slate-100">EXP-004 — Sovereignty Drill</h3>
        <p className="text-sm text-slate-400 mt-1">
          Venice-only by construction (the API pins the provider). Five grounded constitutional tasks
          + one implementation-pack generation. Completion is the sovereignty claim; groundedness and
          tokens are the degradation report against the EXP-003 frontier record.
        </p>
      </div>

      {!veniceAvailable && (
        <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-300">
          VENICE_API_KEY is not configured in this environment — every task will record an honest
          constitutional failure. That is the drill working, not broken; configure the key to test survivability.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-300">
          Venice model
          <select
            className="ml-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100 text-sm"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={running}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </label>
        <button
          onClick={run}
          disabled={running || tasks.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-700 hover:bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Drilling…" : "Run sovereignty drill"}
        </button>
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-xs">
            <thead className="bg-slate-900/60 text-slate-400">
              <tr>
                <th className="px-2 py-1.5 text-left">Task</th>
                <th className="px-2 py-1.5 text-left">Status</th>
                <th className="px-2 py-1.5 text-right">Claims</th>
                <th className="px-2 py-1.5 text-right">Consistent</th>
                <th className="px-2 py-1.5 text-right">Contradicting</th>
                <th className="px-2 py-1.5 text-right">Citations</th>
                <th className="px-2 py-1.5 text-right">Out tokens</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {rows.map((r) => (
                <tr key={r.taskId} className="border-t border-slate-800">
                  <td className="px-2 py-1.5">{r.taskId}</td>
                  <td className={`px-2 py-1.5 ${r.status === "failed" ? "text-rose-400" : r.status === "done" ? "text-emerald-400" : "text-slate-400"}`}>
                    {r.status}{r.error ? ` — ${r.error.slice(0, 80)}` : ""}
                  </td>
                  <td className="px-2 py-1.5 text-right">{r.claimsTotal ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right">{r.consistent ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right">{r.contradicting ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right">{r.citations ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right">{r.outputTokens ?? "—"}</td>
                </tr>
              ))}
              <tr className="border-t border-slate-800">
                <td className="px-2 py-1.5">{`task-6-implementation-pack`}</td>
                <td className={`px-2 py-1.5 ${pack.status === "failed" ? "text-rose-400" : pack.status === "done" ? "text-emerald-400" : "text-slate-400"}`}>
                  {pack.status}
                  {pack.status === "done" ? ` — composedBy=${pack.composedBy} mechanism=${pack.mechanism} bindings=${pack.bindings}` : ""}
                  {pack.error ? ` — ${pack.error.slice(0, 80)}` : ""}
                </td>
                <td className="px-2 py-1.5 text-right" colSpan={5}>
                  <span className="text-slate-500">{packGoal.slice(0, 70)}…</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {done && (
        <div className={`rounded-lg border p-3 ${sovereigntyHolds ? "border-emerald-800 bg-emerald-950/30" : "border-rose-800 bg-rose-950/30"}`}>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <ShieldCheck className={`h-4 w-4 ${sovereigntyHolds ? "text-emerald-400" : "text-rose-400"}`} />
            Sovereignty {sovereigntyHolds ? "HOLDS" : "FAILED"} — {completed}/{total} constitutional tasks completed on the open-weight provider alone
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Degradation report: grounded {groundedPct ?? "n/a"}% · contradictions {contradictions} — compare against
            the EXP-003 frontier record in the Results/Report tabs. Degradation is reported, never scored.
          </p>
          <button
            onClick={publish}
            disabled={publishState === "publishing"}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
          >
            <Upload className="h-3.5 w-3.5" />
            {publishState === "publishing" ? "Publishing…" : "Publish canonically"}
          </button>
          {publishState && publishState !== "publishing" && (
            <p className="mt-1 text-xs text-slate-400">{publishState}</p>
          )}
        </div>
      )}
    </div>
  );
}
