"use client";

/**
 * EXP-003 — Rediscovery Savings runner (CFS-008 §2), front-end orchestration.
 *
 * Drives the benchmark step-by-step against /api/experiments/exp003 (one LLM
 * call per request — Lambda-safe), showing live progress: per task, the cold
 * arm, the initialized arm, then a judge pass on each. Aggregates mirror the
 * terminal harness exactly; results download as JSON for the experiment
 * record. Cross-provider runs are separate experiment instances.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, Play, Square } from "lucide-react";
import { experimentGet, experimentStep, recordRunLifecycle, lifecycleNote } from "./experimentStepFetch";
import { RequestPublishControl } from "./RequestPublishControl";

type Provider = "anthropic" | "openai" | "venice";

interface TaskMeta {
  id: string;
  prompt: string;
}

interface ArmResult {
  answer: string;
  inputTokens: number | null;
  outputTokens: number | null;
  model: string;
  citations: { totalCitations: number; distinctInvariantsCited: number };
  judge?: { claimsTotal: number; consistent: number; contradicting: number; outside: number; notes?: string };
}

interface TaskResult {
  taskId: string;
  cold?: ArmResult;
  initialized?: ArmResult;
}

export default function Exp003RediscoveryRunner({ canRequestPublish = false }: { canRequestPublish?: boolean } = {}) {
  const [tasks, setTasks] = useState<TaskMeta[]>([]);
  const [providers, setProviders] = useState<Record<string, boolean>>({});
  const [models, setModels] = useState<Record<string, { id: string; label: string }[]>>({});
  const [provider, setProvider] = useState<Provider>("venice");
  const [model, setModel] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TaskResult[]>([]);
  const [publishState, setPublishState] = useState<string | null>(null);
  const [requestPublish, setRequestPublish] = useState(false);
  const abortRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await experimentGet("/api/experiments/exp003");
        setTasks(data.tasks as TaskMeta[]);
        setProviders((data.providers as Record<string, boolean>) ?? {});
        setModels((data.models as Record<string, { id: string; label: string }[]>) ?? {});
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load config");
      }
    })();
  }, []);

  const step = useCallback(
    (body: Record<string, unknown>) => experimentStep("/api/experiments/exp003", body),
    [],
  );

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    abortRef.current = false;
    // Local accumulator mirrored into state after every arm so the table
    // fills live; rows exist from the start (arms land as they complete).
    const acc: TaskResult[] = tasks.map((t) => ({ taskId: t.id }));
    setResults(acc.map((r) => ({ ...r })));
    try {
      for (let i = 0; i < tasks.length; i++) {
        for (const arm of ["cold", "initialized"] as const) {
          if (abortRef.current) throw new Error("aborted by operator");
          setProgress(`${tasks[i].id} — ${arm} answer…`);
          const a = (await step({ action: "answer", provider, taskIndex: i, arm, ...(model ? { model } : {}) })) as Record<string, any>;
          if (abortRef.current) throw new Error("aborted by operator");
          setProgress(`${tasks[i].id} — judging ${arm}…`);
          const j = (await step({ action: "judge", provider, taskIndex: i, answer: a.answer, ...(model ? { model } : {}) })) as Record<string, any>;
          acc[i][arm] = {
            answer: a.answer,
            inputTokens: a.inputTokens,
            outputTokens: a.outputTokens,
            model: a.model,
            citations: a.citations,
            judge: j.verdict,
          };
          setResults(acc.map((r) => ({ ...r })));
        }
      }
      setProgress("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "run failed");
      setProgress("");
    } finally {
      setRunning(false);
    }
  }, [tasks, provider, model, step]);

  const sum = (arm: "cold" | "initialized", f: (a: ArmResult) => number) =>
    results.reduce((acc, r) => acc + (r[arm] ? f(r[arm] as ArmResult) : 0), 0);
  const groundedShare = (arm: "cold" | "initialized") => {
    const total = sum(arm, (a) => a.judge?.claimsTotal ?? 0);
    return total > 0 ? (sum(arm, (a) => a.judge?.consistent ?? 0) / total) * 100 : null;
  };


  const publish = async () => {
    setPublishState("publishing");
    try {
      const aggregates = {
        coldOutputTokens: sum("cold", (a) => a.outputTokens ?? 0),
        initializedOutputTokens: sum("initialized", (a) => a.outputTokens ?? 0),
        coldGroundedShare: groundedShare("cold"),
        initializedGroundedShare: groundedShare("initialized"),
        coldContradictions: sum("cold", (a) => a.judge?.contradicting ?? 0),
        initializedContradictions: sum("initialized", (a) => a.judge?.contradicting ?? 0),
      };
      const data = await experimentStep("/api/experiments/results", {
          experiment: "EXP-003",
          provider,
          model: model || "(provider default)",
          requestPublish: canRequestPublish && requestPublish,
          aggregates,
          results: { experiment: "EXP-003", provider, model: model || "(provider default)", results },
      });
      const publishedMsg = `published — sha256 ${String(data.contentHash).slice(0, 16)}… (receipt ${data.receiptStatus ?? "created"})`;
      setPublishState(publishedMsg);
      // Instruments ↔ institution (CFS-019): the run's canonical publication
      // advances the research object one legal step. Fire-and-forget.
      const lc = await recordRunLifecycle(
        "EXP-003",
        "results-published",
        `EXP-003 run published: provider=${provider}`,
      );
      setPublishState(`${publishedMsg} · ${lifecycleNote(lc)}`);
    } catch (err) {
      setPublishState(`publish failed: ${err instanceof Error ? err.message : "error"}`);
    }
  };

  const download = () => {
    const blob = new Blob(
      [JSON.stringify({ experiment: "EXP-003", provider, model: model || "(provider default)", ranAt: new Date().toISOString(), results }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exp003-results-${new Date().toISOString().slice(0, 10)}-${provider}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const complete =
    !running &&
    tasks.length > 0 &&
    results.length === tasks.length &&
    results.every((r) => r.cold?.judge && r.initialized?.judge);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        EXP-003 — Rediscovery Savings (CFS-008 §2): the same five fixed constitutional-design tasks
        answered cold vs initialized with the 18-invariant closure, judged for grounding. Runs
        step-by-step (~20 model calls); both arms and the judge use the SAME provider — cross-provider
        runs are separate experiment instances.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-300">
          Provider
          <select
            className="ml-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            value={provider}
            onChange={(e) => { setProvider(e.target.value as Provider); setModel(""); }}
            disabled={running}
          >
            {(["venice", "openai", "anthropic"] as Provider[]).map((p) => (
              <option key={p} value={p} disabled={providers[p] === false}>
                {p}{providers[p] === false ? " (no key)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Model
          <select
            className="ml-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={running}
          >
            <option value="">Provider default</option>
            {(models[provider] ?? []).map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </label>
        {!running ? (
          <button
            onClick={run}
            disabled={tasks.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" /> Run benchmark ({tasks.length} tasks · ~{tasks.length * 4} calls)
          </button>
        ) : (
          <button
            onClick={() => { abortRef.current = true; }}
            className="inline-flex items-center gap-1.5 rounded-md bg-rose-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-600"
          >
            <Square className="h-3.5 w-3.5" /> Abort
          </button>
        )}
        {complete && (
          <button
            onClick={download}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" /> Download results JSON
          </button>
        )}
        {complete && (
          <button
            onClick={publish}
            disabled={publishState === "publishing"}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {canRequestPublish ? (requestPublish ? "Submit for publication" : "Save result") : "Publish canonically"}
          </button>
        )}
      </div>
      {complete && canRequestPublish && (
        <RequestPublishControl requestPublish={requestPublish} onChange={setRequestPublish} disabled={publishState === "publishing"} />
      )}

      {running && (
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" /> {progress}
        </div>
      )}
      {publishState && (
        <div className="text-xs text-indigo-300">{publishState} — see the Results tab for the auditable record.</div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</div>
      )}

      {results.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80 text-xs text-slate-500">
              <tr>
                <th className="text-left px-3 py-2">Task</th>
                <th className="text-left px-3 py-2">Arm</th>
                <th className="text-right px-3 py-2">Out tokens</th>
                <th className="text-right px-3 py-2">Claims</th>
                <th className="text-right px-3 py-2">Consistent</th>
                <th className="text-right px-3 py-2">Contradicting</th>
                <th className="text-right px-3 py-2">Outside</th>
                <th className="text-right px-3 py-2">Cited</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {results.flatMap((r) =>
                (["cold", "initialized"] as const)
                  .filter((arm) => r[arm])
                  .map((arm) => {
                    const a = r[arm] as ArmResult;
                    return (
                      <tr key={`${r.taskId}:${arm}`}>
                        <td className="px-3 py-2 text-slate-300">{r.taskId}</td>
                        <td className={`px-3 py-2 ${arm === "initialized" ? "text-emerald-300" : "text-slate-400"}`}>{arm}</td>
                        <td className="px-3 py-2 text-right text-slate-300">{a.outputTokens ?? "—"}</td>
                        <td className="px-3 py-2 text-right text-slate-300">{a.judge?.claimsTotal ?? "…"}</td>
                        <td className="px-3 py-2 text-right text-emerald-300">{a.judge?.consistent ?? "…"}</td>
                        <td className="px-3 py-2 text-right text-rose-300">{a.judge?.contradicting ?? "…"}</td>
                        <td className="px-3 py-2 text-right text-amber-300">{a.judge?.outside ?? "…"}</td>
                        <td className="px-3 py-2 text-right text-cyan-300">{a.citations.distinctInvariantsCited}</td>
                      </tr>
                    );
                  }),
              )}
            </tbody>
          </table>
        </div>
      )}

      {complete && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-sm text-slate-300 space-y-1">
          <div className="text-xs font-semibold text-slate-400 mb-1">Aggregate (this run · provider={provider})</div>
          <div>
            cold: {sum("cold", (a) => a.outputTokens ?? 0)} output tokens · grounded{" "}
            {groundedShare("cold")?.toFixed(1) ?? "—"}% · contradictions {sum("cold", (a) => a.judge?.contradicting ?? 0)}
          </div>
          <div>
            initialized: {sum("initialized", (a) => a.outputTokens ?? 0)} output tokens · grounded{" "}
            {groundedShare("initialized")?.toFixed(1) ?? "—"}% · contradictions{" "}
            {sum("initialized", (a) => a.judge?.contradicting ?? 0)} · citations{" "}
            {sum("initialized", (a) => a.citations.distinctInvariantsCited)}
          </div>
        </div>
      )}
    </div>
  );
}
