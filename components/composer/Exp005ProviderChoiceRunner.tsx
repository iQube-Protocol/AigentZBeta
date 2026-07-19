"use client";

/**
 * EXP-005 — Provider-Choice Drill runner (PSE-2; CFS-018, inv.sovereignty.102).
 *
 * The claim: provider choice is a REAL, MEASURED sovereignty-bundle component.
 * The same constitutional battery (the five EXP-003 tasks, initialized arm)
 * is STRIPED across an operator-selected rotation of 2+ providers — task i
 * answers on providers[i % n] — and every verdict is CROSS-PROVIDER: the
 * judge is always the NEXT provider in the rotation, never the answerer.
 * A completed run = provider choice EXERCISED mid-battery without losing
 * constitutional operation → S2 (substitutable) measured as exercised.
 *
 * Honesty discipline (inherited from EXP-004):
 *   - A provider adapter erroring is recorded as that task's constitutional
 *     failure FOR THAT PROVIDER, shown plainly — never masked, never
 *     silently retried onto a different provider (a silent failover would
 *     corrupt the measurement). The server derives each step's provider
 *     from the rotation, so the client cannot re-route a failing task.
 *   - Quality deltas across providers are the degradation report — reported,
 *     never scored as failure.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Play, Shuffle, Upload } from "lucide-react";
import { experimentGet, experimentStep, recordRunLifecycle, lifecycleNote } from "./experimentStepFetch";
import { RequestPublishControl } from "./RequestPublishControl";

interface DrillTask {
  id: string;
  prompt: string;
}

interface ProviderInfo {
  id: string;
  available: boolean;
  models: { id: string; label: string }[];
}

interface TaskRow {
  taskId: string;
  answerProvider: string;
  judgeProvider: string;
  status: "pending" | "answering" | "judging" | "done" | "failed";
  error?: string;
  claimsTotal?: number;
  consistent?: number;
  contradicting?: number;
  citations?: number;
  outputTokens?: number | null;
}

// Bundle components a COMPLETED run measures (CFS-018 · pinned in
// services/experiments/exp005.ts and its canary). open-weight-participation
// is added when venice rides the rotation — participation, never the S3 rung.
const BUNDLE_BASE = [
  "provider-interchangeability",
  "provider-choice-exercised",
  "commercial-independence",
  "constitutional-operation",
];
const OPEN_WEIGHT_COMPONENT = "open-weight-participation";
const MIN_PROVIDERS = 2;

export default function Exp005ProviderChoiceRunner({ canRequestPublish = false }: { canRequestPublish?: boolean } = {}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<DrillTask[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [rotation, setRotation] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [ranRotation, setRanRotation] = useState<string[]>([]);
  const [publishState, setPublishState] = useState<string | null>(null);
  const [requestPublish, setRequestPublish] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await experimentGet("/api/experiments/exp005");
        setTasks(data.tasks as DrillTask[]);
        const provs = data.providers as ProviderInfo[];
        setProviders(provs);
        // Default rotation: the first two available adapters, in adapter order.
        setRotation(provs.filter((p) => p.available).slice(0, 2).map((p) => p.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load drill config");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Rotation membership toggles preserve selection ORDER (the stripe is
  // deterministic over this order — the operator sees exactly what will run).
  const toggleProvider = (id: string) => {
    setRotation((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const answerProviderFor = (i: number, rot: string[]) => rot[i % rot.length];
  const judgeProviderFor = (i: number, rot: string[]) => rot[(i + 1) % rot.length];

  const run = useCallback(async () => {
    const rot = [...rotation];
    setRunning(true);
    setPublishState(null);
    setRanRotation(rot);
    const nextRows: TaskRow[] = tasks.map((t, i) => ({
      taskId: t.id,
      answerProvider: answerProviderFor(i, rot),
      judgeProvider: judgeProviderFor(i, rot),
      status: "pending",
    }));
    setRows([...nextRows]);

    for (let i = 0; i < tasks.length; i += 1) {
      nextRows[i] = { ...nextRows[i], status: "answering" };
      setRows([...nextRows]);
      try {
        const answerData = await experimentStep("/api/experiments/exp005", {
          action: "answer",
          taskIndex: i,
          providers: rot,
        });
        const answer = answerData.result as Record<string, any>;
        nextRows[i] = { ...nextRows[i], status: "judging", outputTokens: answer.outputTokens ?? null };
        setRows([...nextRows]);
        const judgeData = await experimentStep("/api/experiments/exp005", {
          action: "judge",
          taskIndex: i,
          answer: answer.answer,
          providers: rot,
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
        // Constitutional failure on this task FOR THIS PROVIDER — the drill's
        // core datum. Never re-routed to a different provider.
        nextRows[i] = {
          ...nextRows[i],
          status: "failed",
          error: err instanceof Error ? err.message : "task failed",
        };
      }
      setRows([...nextRows]);
    }
    setRunning(false);
  }, [tasks, rotation]);

  const done = rows.length > 0 && !running && rows.every((r) => r.status === "done" || r.status === "failed");
  const completed = rows.filter((r) => r.status === "done").length;
  const total = rows.length;
  const constitutionalFailures = total - completed;
  const providersUsed = ranRotation.filter((p) => rows.some((r) => r.answerProvider === p));
  const switchHolds = done && constitutionalFailures === 0 && providersUsed.length >= MIN_PROVIDERS;
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
      const rung = switchHolds ? "s2-substitutable" : null;
      const bundleComponentsMeasured = switchHolds
        ? ranRotation.includes("venice")
          ? [...BUNDLE_BASE, OPEN_WEIGHT_COMPONENT]
          : BUNDLE_BASE
        : [];
      const perProvider: Record<string, { completed: number; total: number }> = {};
      for (const r of rows) {
        const bucket = (perProvider[r.answerProvider] ??= { completed: 0, total: 0 });
        bucket.total += 1;
        if (r.status === "done") bucket.completed += 1;
      }
      const switchIntegrity = {
        tasksTotal: total,
        tasksCompleted: completed,
        constitutionalFailures,
        providersUsed,
        perProvider,
        crossJudgePairs: rows.map((r) => ({
          taskId: r.taskId,
          answerProvider: r.answerProvider,
          judgeProvider: r.judgeProvider,
        })),
        completedAcrossProviders: switchHolds,
      };
      const aggregates = {
        providers: ranRotation,
        completed: `${completed}/${total}`,
        sovereigntyRung: rung,
        bundleComponentsMeasured,
        switchIntegrity,
        groundedPct: groundedPct ?? "n/a",
        contradictions,
        note: switchHolds
          ? "PSE-2 provider-choice drill: the identical constitutional battery striped across the rotation mid-run, every verdict cross-provider-judged, zero constitutional failures — provider choice EXERCISED (S2 substitutable, exercised not merely available; CFS-018). S3 (open-weight independence) remains EXP-004's claim. Quality deltas across providers are the degradation report — reported, never scored."
          : "PSE-2 provider-choice drill: constitutional failure(s) recorded — no rung and no bundle component claimed on an incomplete run. Failures are per-provider data, never masked or re-routed.",
      };
      const results = {
        experiment: "EXP-005",
        providers: ranRotation,
        claim:
          "PSE-2 (CFS-018, inv.sovereignty.102): provider choice is a real, measured sovereignty-bundle component — the platform hands the same constitutional battery across providers mid-run (cross-provider judged) and constitutional operation survives the switch.",
        tasks: rows,
        aggregates: {
          completed,
          total,
          sovereigntyRung: rung,
          bundleComponentsMeasured,
          switchIntegrity,
          groundedPct,
          contradictions,
        },
        ranAt: new Date().toISOString(),
      };
      const data = await experimentStep("/api/experiments/results", {
        experiment: "EXP-005",
        provider: ranRotation.join("+"),
        model: "provider-defaults",
        requestPublish: canRequestPublish && requestPublish,
        aggregates,
        results,
      });
      const publishedMsg = `published — sha256 ${(data.contentHash as string).slice(0, 12)}…`;
      setPublishState(publishedMsg);
      // Instruments ↔ institution (CFS-019): the run's canonical publication
      // advances the research object one legal step. Fire-and-forget.
      const lc = await recordRunLifecycle(
        "EXP-005",
        "results-published",
        `EXP-005 run published: rung=${rung ?? "none"} providers=${ranRotation.join("+")}`,
      );
      setPublishState(`${publishedMsg} · ${lifecycleNote(lc)}`);
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
        <h3 className="text-base font-semibold text-slate-100">EXP-005 — Provider-Choice Drill (PSE-2)</h3>
        <p className="text-sm text-slate-400 mt-1">
          The five grounded constitutional tasks, striped across a rotation of 2+ providers — task i
          answers on rotation[i % n], and every verdict is judged by the NEXT provider in the
          rotation (never the answerer). A completed run measures provider choice EXERCISED
          mid-battery (S2 substitutable, exercised; CFS-018) — constitutional operation survived the
          switch. A failing provider records an honest constitutional failure for that task on that
          provider; it is never silently re-routed. Quality deltas across providers are the
          degradation report — reported, never scored.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Shuffle className="h-4 w-4 text-slate-400" />
          Rotation
          {providers.map((p) => (
            <label
              key={p.id}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                rotation.includes(p.id)
                  ? "border-indigo-700 bg-indigo-950/50 text-indigo-200"
                  : "border-slate-700 bg-slate-900 text-slate-400"
              } ${!p.available ? "opacity-40" : ""}`}
              title={p.available ? `${p.id} — key configured` : `${p.id} — key NOT configured; selecting it records honest failures`}
            >
              <input
                type="checkbox"
                className="accent-indigo-600"
                checked={rotation.includes(p.id)}
                onChange={() => toggleProvider(p.id)}
                disabled={running}
              />
              {p.id}
              {rotation.includes(p.id) && (
                <span className="text-[10px] text-indigo-400">#{rotation.indexOf(p.id) + 1}</span>
              )}
            </label>
          ))}
        </div>
        <button
          onClick={run}
          disabled={running || tasks.length === 0 || rotation.length < MIN_PROVIDERS}
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-700 hover:bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          title={rotation.length < MIN_PROVIDERS ? `Select at least ${MIN_PROVIDERS} providers` : "Run the striped battery"}
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Switching…" : "Run provider-choice drill"}
        </button>
      </div>

      {rotation.length >= MIN_PROVIDERS && !running && rows.length === 0 && (
        <p className="text-xs text-slate-500">
          Stripe preview: {tasks.map((t, i) => `${t.id}→${answerProviderFor(i, rotation)} (judge ${judgeProviderFor(i, rotation)})`).join(" · ")}
        </p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-xs">
            <thead className="bg-slate-900/60 text-slate-400">
              <tr>
                <th className="px-2 py-1.5 text-left">Task</th>
                <th className="px-2 py-1.5 text-left">Answered by</th>
                <th className="px-2 py-1.5 text-left">Judged by</th>
                <th className="px-2 py-1.5 text-left">Status</th>
                <th className="px-2 py-1.5 text-right">Claims</th>
                <th className="px-2 py-1.5 text-right">Consistent</th>
                <th className="px-2 py-1.5 text-right">Contradicting</th>
                <th className="px-2 py-1.5 text-right">Citations</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {rows.map((r) => (
                <tr key={r.taskId} className="border-t border-slate-800">
                  <td className="px-2 py-1.5">{r.taskId}</td>
                  <td className="px-2 py-1.5 font-mono text-indigo-300">{r.answerProvider}</td>
                  <td className="px-2 py-1.5 font-mono text-sky-300">{r.judgeProvider}</td>
                  <td className={`px-2 py-1.5 ${r.status === "failed" ? "text-rose-400" : r.status === "done" ? "text-emerald-400" : "text-slate-400"}`}>
                    {r.status}{r.error ? ` — ${r.error.slice(0, 80)}` : ""}
                  </td>
                  <td className="px-2 py-1.5 text-right">{r.claimsTotal ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right">{r.consistent ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right">{r.contradicting ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right">{r.citations ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {done && (
        <div className={`rounded-lg border p-3 ${switchHolds ? "border-emerald-800 bg-emerald-950/30" : "border-rose-800 bg-rose-950/30"}`}>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Shuffle className={`h-4 w-4 ${switchHolds ? "text-emerald-400" : "text-rose-400"}`} />
            {switchHolds
              ? `Provider choice EXERCISED — ${completed}/${total} constitutional tasks completed across ${providersUsed.length} providers (${providersUsed.join(" → ")}), every verdict cross-provider-judged · S2 substitutable, exercised`
              : `Switch integrity FAILED — ${constitutionalFailures} constitutional failure(s) across ${ranRotation.join(" → ")} (no rung, no bundle component claimed)`}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Degradation report: grounded {groundedPct ?? "n/a"}% · contradictions {contradictions}.
            Per-provider quality deltas are reported, never scored. S3 (open-weight independence)
            remains EXP-004&apos;s claim{ranRotation.includes("venice") ? " — venice in the rotation carries open-weight-participation only" : ""}.
          </p>
          <button
            onClick={publish}
            disabled={publishState === "publishing"}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
          >
            <Upload className="h-3.5 w-3.5" />
            {publishState === "publishing"
              ? "Publishing…"
              : canRequestPublish
                ? requestPublish
                  ? "Submit for publication"
                  : "Save result"
                : "Publish canonically"}
          </button>
          {canRequestPublish && (
            <div className="mt-2">
              <RequestPublishControl requestPublish={requestPublish} onChange={setRequestPublish} disabled={publishState === "publishing"} />
            </div>
          )}
          {publishState && publishState !== "publishing" && (
            <p className="mt-1 text-xs text-slate-400">{publishState}</p>
          )}
        </div>
      )}
    </div>
  );
}
