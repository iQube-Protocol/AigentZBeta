"use client";

/**
 * EXP-004 — Sovereignty Drill runner (PSE-1; CFS-015 principle 4, CFS-018).
 *
 * Operator correction (2026-07-07): the PSE series claim is that platform
 * sovereignty is a MEASURABLE BUNDLE (model, provider choice, commercial
 * independence, infrastructure). A run on ANY provider measures real bundle
 * components at a rung of the Sovereignty Scale — it is legitimate sovereignty
 * data, not "not a sovereignty claim." The runner offers two measurement runs:
 *   - Frontier run (chaingpt/openai) → measures S1/S2 (interchangeable /
 *     substitutable): provider interchangeability + commercial independence
 *     from any single vendor are real, measured bundle components.
 *   - Open-weight run (venice) → measures S3, the APEX: open-weight
 *     independence is the fullest expression, a distinct higher rung — not the
 *     gate for the experiment's validity or progress.
 * The drill's two outputs, at whichever rung:
 *   1. COMPLETION — did every constitutional task complete at all?
 *   2. DEGRADATION — groundedness/citations/tokens, reported for comparison
 *      against the frontier-provider EXP-003 record, never scored pass/fail.
 * Task failures are recorded honestly as constitutional failures — the one
 * thing the drill exists to detect. Publishing measurements at various rungs
 * and drawing a graded conclusion across them IS the experiment's purpose.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Play, ShieldCheck, Upload } from "lucide-react";
import { experimentGet, experimentStep, recordRunLifecycle, lifecycleNote } from "./experimentStepFetch";

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

interface RehearsalProviderInfo {
  id: string;
  available: boolean;
  models: { id: string; label: string }[];
}

interface PublishedRunRow {
  id: string;
  experiment: string;
  provider: string;
  model: string;
  contentHash: string;
  createdAt: string;
}

// Bundle components each run measures (CFS-018 · operator correction 2026-07-07).
const BUNDLE_FRONTIER = ["provider-interchangeability", "commercial-independence", "constitutional-operation"];
const BUNDLE_OPEN_WEIGHT = [...BUNDLE_FRONTIER, "open-weight-independence"];

export default function Exp004SovereigntyRunner() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<DrillTask[]>([]);
  const [packGoal, setPackGoal] = useState<string>("");
  const [veniceAvailable, setVeniceAvailable] = useState<boolean>(false);
  const [models, setModels] = useState<{ id: string; label: string }[]>([]);
  const [model, setModel] = useState<string>("");
  // Internal arm identifiers: 'sovereign' = the open-weight (venice, S3) run;
  // 'rehearsal' = a frontier substitute (S2) run. Both are legitimate
  // sovereignty-scale measurements — the labels below carry the honest framing.
  const [mode, setMode] = useState<"sovereign" | "rehearsal">("sovereign");
  const [rehearsalProviders, setRehearsalProviders] = useState<RehearsalProviderInfo[]>([]);
  const [rehearsalProvider, setRehearsalProvider] = useState<string>("chaingpt");
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [ranMode, setRanMode] = useState<"sovereign" | "rehearsal">("sovereign");
  const [pack, setPack] = useState<PackRow>({ status: "pending" });
  const [publishState, setPublishState] = useState<string | null>(null);
  // AR/CPS observer awareness (live-drive fix 2026-07-14): the runner OBSERVES
  // the canonical record on mount instead of pretending no run exists. Prior
  // runs live in `experiment_results` — an operator returning to this tab sees
  // what has already been published (a fresh unpublished run is still
  // session-local by design; persisting drill drafts is a named follow-on).
  const [publishedRuns, setPublishedRuns] = useState<PublishedRunRow[]>([]);
  const [publishedError, setPublishedError] = useState<string | null>(null);

  const refreshPublishedRuns = useCallback(async () => {
    try {
      const data = await experimentGet("/api/experiments/results");
      const rows = ((data.results as PublishedRunRow[]) ?? []).filter((r) => r.experiment === "EXP-004");
      setPublishedRuns(rows);
      setPublishedError(null);
    } catch (err) {
      setPublishedError(err instanceof Error ? err.message : "canonical record unavailable");
    }
  }, []);

  useEffect(() => {
    void refreshPublishedRuns();
  }, [refreshPublishedRuns]);

  useEffect(() => {
    (async () => {
      try {
        const data = await experimentGet("/api/experiments/exp004");
        setTasks(data.tasks as DrillTask[]);
        setPackGoal((data.packTask as { goal: string }).goal);
        const veniceOk = Boolean(data.providerAvailable);
        setVeniceAvailable(veniceOk);
        const m = data.models as { id: string; label: string }[];
        setModels(m);
        setModel(m[0]?.id ?? "");
        const reh = ((data.rehearsal as { providers?: RehearsalProviderInfo[] })?.providers ?? []).filter(
          (p) => p.available,
        );
        setRehearsalProviders(reh);
        // Operator convenience: venice credits pending → default straight into
        // the frontier run so the S2 measurement is one click.
        if (!veniceOk && reh.length > 0) {
          setMode("rehearsal");
          setRehearsalProvider(reh[0].id);
          setModel(reh[0].models[0]?.id ?? "");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load drill config");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeModels =
    mode === "rehearsal"
      ? rehearsalProviders.find((p) => p.id === rehearsalProvider)?.models ?? []
      : models;

  const switchMode = (next: "sovereign" | "rehearsal") => {
    setMode(next);
    if (next === "sovereign") {
      setModel(models[0]?.id ?? "");
    } else {
      const p = rehearsalProviders.find((r) => r.id === rehearsalProvider) ?? rehearsalProviders[0];
      if (p) {
        setRehearsalProvider(p.id);
        setModel(p.models[0]?.id ?? "");
      }
    }
  };

  const run = useCallback(async () => {
    setRunning(true);
    setPublishState(null);
    setRanMode(mode);
    const modeFields =
      mode === "rehearsal" ? { mode: "rehearsal", rehearsalProvider } : {};
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
          ...modeFields,
        });
        const answer = answerData.result as Record<string, any>;
        nextRows[i] = { ...nextRows[i], status: "judging", outputTokens: answer.outputTokens ?? null };
        setRows([...nextRows]);
        const judgeData = await experimentStep("/api/experiments/exp004", {
          action: "judge",
          taskIndex: i,
          answer: answer.answer,
          model: model || undefined,
          ...modeFields,
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
      const packData = await experimentStep("/api/experiments/exp004", { action: "pack", ...modeFields });
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
  }, [tasks, model, mode, rehearsalProvider]);

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
    const isFrontier = ranMode === "rehearsal";
    const publishProvider = isFrontier ? rehearsalProvider : "venice";
    const publishModel = model || activeModels[0]?.id || `${publishProvider}-default`;
    try {
      // Graded sovereignty-scale measurement (operator correction 2026-07-07;
      // apex recalibration 2026-07-09): every completed run is legitimate
      // sovereignty data. A completed frontier run measures S2 (substitutable);
      // a completed open-weight (venice) run measures S3 — open weights on
      // THIRD-PARTY hosting, NOT the apex. The model apex is S4 (self-hosted,
      // own infra, via the sovereignNode arm); the platform apex is S5
      // (sovereign platform, Chrysalis 3.0). No `rehearsal: true` flag and no
      // "not a sovereignty claim" framing — the rung + honest scope carry it.
      const rung = isFrontier
        ? completed === total
          ? "s2-substitutable"
          : null
        : sovereigntyHolds
          ? "s3-open-weight"
          : null;
      const bundleComponentsMeasured = isFrontier ? BUNDLE_FRONTIER : BUNDLE_OPEN_WEIGHT;
      const aggregates = isFrontier
        ? {
            provider: publishProvider,
            completed: `${completed}/${total}`,
            sovereigntyRung: rung,
            bundleComponentsMeasured,
            groundedPct: groundedPct ?? "n/a",
            contradictions,
            note: "S2 (substitutable) sovereignty-scale measurement on a frontier provider — provider interchangeability + commercial independence from any single vendor are real, measured bundle components (CFS-018). This does not reach S3 (open-weight independence, third-party hosted), and above it the S4 self-hosted model apex and S5 sovereign-platform apex are distinct higher rungs.",
          }
        : {
            provider: publishProvider,
            completed: `${completed}/${total}`,
            sovereigntyRung: rung,
            bundleComponentsMeasured,
            groundedPct: groundedPct ?? "n/a",
            contradictions,
            note: "S3 (open-weight, third-party hosted) sovereignty-scale measurement — constitutional operation continues on the open-weight provider alone; quality may degrade, constitutional operation shall not. Degradation is reported vs the EXP-003 frontier record, never scored pass/fail. S3 is not the apex: the model apex is S4 (self-hosted, own infra); the platform apex is S5 (sovereign platform, Chrysalis 3.0).",
          };
      const results = {
        experiment: "EXP-004",
        provider: publishProvider,
        model: publishModel,
        claim: isFrontier
          ? "PSE-1 frontier run: sovereignty measured at S2 (substitutable) on a frontier provider — provider interchangeability + commercial independence from any single vendor are real components of the sovereignty bundle (CFS-018). S3 (open-weight, third-party hosted) and the S4/S5 apex tiers are distinct higher rungs."
          : "Sovereign Survivability at S3 (open-weight, third-party hosted; CFS-015 principle 4): constitutional operation continues on the open-weight provider alone; quality may degrade, constitutional operation shall not. S3 is not the apex — S4 (self-hosted model) and S5 (sovereign platform) are the apex tiers.",
        tasks: rows,
        packTask: pack,
        aggregates: {
          completed,
          total,
          sovereigntyRung: rung,
          bundleComponentsMeasured,
          groundedPct,
          contradictions,
        },
        ranAt: new Date().toISOString(),
      };
      const data = await experimentStep("/api/experiments/results", {
        experiment: "EXP-004",
        provider: publishProvider,
        model: publishModel,
        aggregates,
        results,
      });
      const publishedMsg = `published — sha256 ${(data.contentHash as string).slice(0, 12)}…`;
      setPublishState(publishedMsg);
      void refreshPublishedRuns(); // the observed canonical record reflects the new run immediately
      // Instruments ↔ institution (CFS-019): the run's canonical publication
      // advances the research object one legal step. Fire-and-forget — a
      // lifecycle-recording failure never disturbs the published result.
      const lc = await recordRunLifecycle(
        "EXP-004",
        "results-published",
        `EXP-004 run published: rung=${rung ?? "none"} provider=${publishProvider}`,
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
        <h3 className="text-base font-semibold text-slate-100">EXP-004 — Sovereignty Drill (PSE-1)</h3>
        <p className="text-sm text-slate-400 mt-1">
          Five grounded constitutional tasks + one implementation-pack generation. Platform
          sovereignty is a measurable bundle (CFS-018): each run measures real bundle components at
          a rung of the Sovereignty Scale. The open-weight run (venice) measures S3 — open weights on
          third-party hosting, not the apex. The apex tiers are S4 (self-hosted: open-weight on our
          own decentralised infra) and S5 (sovereign platform; Chrysalis 3.0). A frontier run
          (chaingpt default, openai for full usage-token coverage) measures S2 (substitutable):
          provider interchangeability + commercial independence from any single vendor. Publishing
          measurements across rungs and concluding across them is the experiment's purpose.
        </p>
      </div>

      {(publishedRuns.length > 0 || publishedError) && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-300">
          <div className="font-semibold text-slate-200 mb-1">Canonical record (observed · AR/CPS)</div>
          {publishedError ? (
            <p className="text-slate-500">{publishedError}</p>
          ) : (
            <ul className="space-y-0.5">
              {publishedRuns.slice(0, 5).map((r) => (
                <li key={r.id} className="font-mono text-slate-400">
                  {r.provider} · {r.model} · sha256 {r.contentHash.slice(0, 12)}… ·{" "}
                  {new Date(r.createdAt).toLocaleString()}
                </li>
              ))}
              {publishedRuns.length > 5 && (
                <li className="text-slate-500">+ {publishedRuns.length - 5} earlier published run(s)</li>
              )}
            </ul>
          )}
          <p className="mt-1 text-slate-500">
            {publishedRuns.length > 0
              ? `${publishedRuns.length} published EXP-004 run(s) exist canonically — a fresh run below is a NEW measurement, not a re-do of these.`
              : null}
          </p>
        </div>
      )}

      {!veniceAvailable && mode === "sovereign" && (
        <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-300">
          VENICE_API_KEY is not configured in this environment — every task in the open-weight run
          will record an honest constitutional failure. Configure the key to measure S3 (open-weight,
          third-party hosted), or switch to a frontier run to measure S2 (substitutable) — a
          legitimate sovereignty-scale datum — meanwhile.
        </div>
      )}
      {mode === "rehearsal" && (
        <div className="rounded-lg border border-sky-800 bg-sky-950/40 p-3 text-sm text-sky-300">
          FRONTIER run — the identical battery runs on a substitute provider (openai reports usage
          tokens; chaingpt cannot). This is a legitimate{" "}
          <span className="font-semibold">sovereignty-scale measurement at S2 (substitutable)</span>:
          it demonstrates provider interchangeability + commercial independence from any single
          vendor — real components of the sovereignty bundle (CFS-018). It does not reach{" "}
          <span className="font-semibold">S3 (open-weight, third-party hosted)</span>, nor the S4/S5
          apex tiers — distinct higher rungs. The Chrysalis sovereignty criterion reads a completed run
          as <span className="font-mono">pass</span> on the measurable-bundle claim, naming the
          highest rung reached.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-md border border-slate-700 overflow-hidden text-xs">
          <button
            onClick={() => switchMode("sovereign")}
            disabled={running}
            className={`px-2.5 py-1.5 ${mode === "sovereign" ? "bg-indigo-700 text-white" : "bg-slate-900 text-slate-400 hover:text-slate-200"}`}
            title="Measures S3 — open-weight, third-party hosted. Venice is the platform's open-weight adapter. The apex is S4 (self-hosted, own infra)."
          >
            Open-weight run (S3 · venice)
          </button>
          <button
            onClick={() => switchMode("rehearsal")}
            disabled={running || rehearsalProviders.length === 0}
            className={`px-2.5 py-1.5 ${mode === "rehearsal" ? "bg-sky-700 text-white" : "bg-slate-900 text-slate-400 hover:text-slate-200"} disabled:opacity-40`}
            title={rehearsalProviders.length === 0 ? "No frontier provider key configured" : "Measures S2 (substitutable): provider interchangeability + commercial independence — real bundle components"}
          >
            Frontier run (S2 · substitutable)
          </button>
        </div>
        {mode === "rehearsal" && (
          <label className="text-sm text-slate-300">
            Provider
            <select
              className="ml-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100 text-sm"
              value={rehearsalProvider}
              onChange={(e) => {
                const id = e.target.value;
                setRehearsalProvider(id);
                const p = rehearsalProviders.find((r) => r.id === id);
                setModel(p?.models[0]?.id ?? "");
              }}
              disabled={running}
            >
              {rehearsalProviders.map((p) => (
                <option key={p.id} value={p.id}>{p.id}</option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm text-slate-300">
          {mode === "rehearsal" ? "Model" : "Venice model"}
          <select
            className="ml-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100 text-sm"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={running}
          >
            {activeModels.map((m) => (
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
          {running ? "Drilling…" : mode === "rehearsal" ? "Run frontier drill (S2)" : "Run open-weight drill (S3)"}
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

      {done && ranMode === "rehearsal" && (
        <div className={`rounded-lg border p-3 ${completed === total ? "border-sky-800 bg-sky-950/30" : "border-rose-800 bg-rose-950/30"}`}>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <ShieldCheck className={`h-4 w-4 ${completed === total ? "text-sky-400" : "text-rose-400"}`} />
            {completed === total
              ? `Sovereignty measured at S2 (substitutable) — ${completed}/${total} on ${rehearsalProvider} · provider-interchangeability + commercial-independence demonstrated · S3 open-weight (third-party hosted) pending`
              : `Run INCOMPLETE — ${completed}/${total} battery tasks completed on ${rehearsalProvider} (no rung claimed on failure)`}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Grounded {groundedPct ?? "n/a"}% · contradictions {contradictions}. Sovereignty is a
            measurable bundle graded by rung: this run measures S2 (substitutable) — real bundle
            components; the open-weight run (S3, third-party hosted) is a higher rung, and the S4
            self-hosted / S5 sovereign-platform apex tiers higher still.
          </p>
          <button
            onClick={publish}
            disabled={publishState === "publishing"}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
          >
            <Upload className="h-3.5 w-3.5" />
            {publishState === "publishing" ? "Publishing…" : "Publish canonically (S2)"}
          </button>
          {publishState && publishState !== "publishing" && (
            <p className="mt-1 text-xs text-slate-400">{publishState}</p>
          )}
        </div>
      )}
      {done && ranMode === "sovereign" && (
        <div className={`rounded-lg border p-3 ${sovereigntyHolds ? "border-emerald-800 bg-emerald-950/30" : "border-rose-800 bg-rose-950/30"}`}>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <ShieldCheck className={`h-4 w-4 ${sovereigntyHolds ? "text-emerald-400" : "text-rose-400"}`} />
            {sovereigntyHolds
              ? `Sovereignty HOLDS at S3 (open-weight) — ${completed}/${total} constitutional tasks completed on the open-weight provider alone`
              : `Sovereignty FAILED — ${completed}/${total} constitutional tasks completed on the open-weight provider alone`}
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
            {publishState === "publishing" ? "Publishing…" : "Publish canonically (S3)"}
          </button>
          {publishState && publishState !== "publishing" && (
            <p className="mt-1 text-xs text-slate-400">{publishState}</p>
          )}
        </div>
      )}
    </div>
  );
}
