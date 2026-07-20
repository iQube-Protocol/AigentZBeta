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
import { experimentGet, experimentStep, recordRunLifecycle, lifecycleNote, publishStatePrefix } from "./experimentStepFetch";
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

// Auditable retry trail — one entry per (answer|judge) call attempt.
interface Attempt {
  step: "answer" | "judge";
  n: number;
  status: "ok" | "timed_out" | "error";
  error?: string;
}

// Honest five-class outcome taxonomy (operator + Aletheon, 2026-07-20):
//   completed               — answered + cross-judged, no constitutional defect
//   constitutionally_failed — answered + judged, but the answer failed the
//                             constitutional criterion (contradictions) — the
//                             ONLY class that counts against switch integrity
//   provider_unavailable    — answer-side infra: billing/credit, invalid key,
//                             4xx/5xx, outage (availability, not reasoning)
//   timed_out               — answer-side: envelope exceeded (performance)
//   judge_failed            — answer exists but the judge failed/timed out —
//                             inconclusive, scored as neither success nor failure
type TaskStatus =
  | "pending"
  | "answering"
  | "judging"
  | "completed"
  | "constitutionally_failed"
  | "provider_unavailable"
  | "timed_out"
  | "judge_failed";

interface TaskRow {
  taskId: string;
  answerProvider: string;
  judgeProvider: string;
  status: TaskStatus;
  attempts?: Attempt[];
  error?: string;
  claimsTotal?: number;
  consistent?: number;
  contradicting?: number;
  citations?: number;
  outputTokens?: number | null;
}

// A TIMEOUT (envelope exceeded) is a performance/deployability result; every
// other infra error (billing/credit, invalid/revoked key, 4xx/5xx, outage,
// network) is an availability result. Neither is a constitutional reasoning
// defect. Retry ONLY transient classes (timeout / 429 / 5xx / network), bounded
// to one retry against the SAME provider — never a re-route, never invalid-key /
// insufficient-credit / malformed-request / unsupported-model.
const isTimeout = (m: string) => /timed out|timeout|\baborted\b|envelope/i.test(m);
const isRetryable = (m: string) =>
  isTimeout(m) || /\b(429|5\d\d)\b|fetch failed|network|econn|socket hang up|temporarily/i.test(m);
const answerInfraOutcome = (m: string): "timed_out" | "provider_unavailable" =>
  isTimeout(m) ? "timed_out" : "provider_unavailable";
const isConstitutionalDefect = (contradicting: number) => contradicting > 0;

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

  // One bounded, AUDITABLE retry on a transient error only. The retry hits the
  // SAME provider (the server derives it from taskIndex + rotation) — not a
  // silent failover, so the measurement stays honest — and gives a slow
  // provider (e.g. venice answering near the 25s envelope) a second chance.
  // Every attempt is recorded in `attempts` so the retry is visible in the
  // record. Non-transient errors (invalid key, credit, malformed) do NOT retry.
  const runStep = async (
    step: "answer" | "judge",
    payload: Record<string, unknown>,
    attempts: Attempt[],
  ): Promise<Record<string, unknown>> => {
    for (let n = 1; n <= 2; n += 1) {
      try {
        const data = await experimentStep("/api/experiments/exp005", payload);
        attempts.push({ step, n, status: "ok" });
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        attempts.push({ step, n, status: isTimeout(msg) ? "timed_out" : "error", error: msg });
        if (n === 2 || !isRetryable(msg)) throw err;
        await new Promise((r) => setTimeout(r, 1200));
      }
    }
    throw new Error("unreachable");
  };

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
      const attempts: Attempt[] = [];
      try {
        // ── Answer step. A failure here is ALWAYS answer-side infra (the answer
        // is just text; constitutional validity is decided by the judge). ──
        let answer: Record<string, any>;
        try {
          const answerData = await runStep("answer", { action: "answer", taskIndex: i, providers: rot }, attempts);
          answer = answerData.result as Record<string, any>;
        } catch (aerr) {
          const msg = aerr instanceof Error ? aerr.message : "answer failed";
          nextRows[i] = { ...nextRows[i], status: answerInfraOutcome(msg), error: msg, attempts: [...attempts] };
          setRows([...nextRows]);
          continue;
        }
        nextRows[i] = { ...nextRows[i], status: "judging", outputTokens: answer.outputTokens ?? null, attempts: [...attempts] };
        setRows([...nextRows]);

        // ── Judge step. The answer EXISTS; if the judge fails/times out the
        // task is inconclusive (judge_failed) — never scored as success/failure. ──
        let verdict: Record<string, any>;
        try {
          const judgeData = await runStep("judge", { action: "judge", taskIndex: i, answer: answer.answer, providers: rot }, attempts);
          verdict = judgeData.result as Record<string, any>;
        } catch (jerr) {
          const msg = jerr instanceof Error ? jerr.message : "judge failed";
          nextRows[i] = { ...nextRows[i], status: "judge_failed", error: msg, attempts: [...attempts] };
          setRows([...nextRows]);
          continue;
        }

        // ── Answered + judged. Constitutional validity from the verdict: any
        // claim CONTRADICTING the constitutional collection is a defect. ──
        const contradicting = (verdict.contradicting as number) ?? 0;
        nextRows[i] = {
          ...nextRows[i],
          status: isConstitutionalDefect(contradicting) ? "constitutionally_failed" : "completed",
          claimsTotal: verdict.claimsTotal,
          consistent: verdict.consistent,
          contradicting,
          citations: verdict.citations,
          attempts: [...attempts],
        };
      } catch (err) {
        // Defensive fallback — unexpected error outside the step wrappers.
        const msg = err instanceof Error ? err.message : "task failed";
        nextRows[i] = { ...nextRows[i], status: answerInfraOutcome(msg), error: msg, attempts: [...attempts] };
      }
      setRows([...nextRows]);
    }
    setRunning(false);
  }, [tasks, rotation]);

  const TERMINAL: TaskStatus[] = ["completed", "constitutionally_failed", "provider_unavailable", "timed_out", "judge_failed"];
  const done = rows.length > 0 && !running && rows.every((r) => TERMINAL.includes(r.status));
  const total = rows.length;
  const countOf = (s: TaskStatus) => rows.filter((r) => r.status === s).length;
  const cleanCompleted = countOf("completed");
  const constitutionalFailures = countOf("constitutionally_failed"); // the ONLY switch-integrity failure
  const timedOut = countOf("timed_out");
  const providerUnavailable = countOf("provider_unavailable");
  const judgeFailed = countOf("judge_failed");
  const answeredAndJudged = cleanCompleted + constitutionalFailures;
  const infraCount = timedOut + providerUnavailable + judgeFailed;
  const providersUsed = ranRotation.filter((p) => rows.some((r) => r.answerProvider === p));
  const providersInfra = Array.from(
    new Set(rows.filter((r) => r.status === "timed_out" || r.status === "provider_unavailable").map((r) => r.answerProvider)),
  );
  const cleanProviders = new Set(rows.filter((r) => r.status === "completed").map((r) => r.answerProvider));

  // Axis 1 — Constitutional portability: does VALID operation survive provider
  // substitution? Broken iff any completed answer was constitutionally defective.
  const portability: "held" | "broken" | "inconclusive" =
    constitutionalFailures > 0
      ? "broken"
      : cleanCompleted > 0 && cleanProviders.size >= MIN_PROVIDERS
        ? "held"
        : "inconclusive";

  // Axis 2 — Operational viability: can each provider complete its assigned ROLE
  // within the envelope? (A provider can be viable judging but not answering.)
  const viability: Record<string, { aOk: number; aFail: number; jOk: number; jFail: number }> = {};
  for (const r of rows) {
    const a = (viability[r.answerProvider] ??= { aOk: 0, aFail: 0, jOk: 0, jFail: 0 });
    if (r.status === "timed_out" || r.status === "provider_unavailable") a.aFail += 1;
    else a.aOk += 1; // answer succeeded (completed / constitutionally_failed / judge_failed)
    const answerSucceeded = r.status !== "timed_out" && r.status !== "provider_unavailable";
    if (r.judgeProvider && answerSucceeded) {
      const j = (viability[r.judgeProvider] ??= { aOk: 0, aFail: 0, jOk: 0, jFail: 0 });
      if (r.status === "judge_failed") j.jFail += 1;
      else j.jOk += 1;
    }
  }
  const viabilityNotes = Object.entries(viability).map(([p, v]) => {
    const roles: string[] = [];
    if (v.aOk + v.aFail > 0) roles.push(`answering ${v.aFail === 0 ? "✓" : `${v.aOk}/${v.aOk + v.aFail}`}`);
    if (v.jOk + v.jFail > 0) roles.push(`judging ${v.jFail === 0 ? "✓" : `${v.jOk}/${v.jOk + v.jFail}`}`);
    return `${p}: ${roles.join(", ")}`;
  });

  // Overall verdict — HELD only when every task completed cleanly across 2+
  // providers with no infra; a constitutional defect is the only true FAILURE;
  // infra (timeout/unavailable/judge-failed) with no defects is INCONCLUSIVE.
  const verdict: "held" | "constitutional_failure" | "inconclusive" =
    constitutionalFailures > 0
      ? "constitutional_failure"
      : done && infraCount === 0 && cleanCompleted === total && providersUsed.length >= MIN_PROVIDERS
        ? "held"
        : "inconclusive";
  const switchHolds = verdict === "held";
  const inconclusive = verdict === "inconclusive";
  const completed = answeredAndJudged; // kept for the existing groundedPct/perProvider math below
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
      // Per-provider, per-role viability (Axis 2) for the canonical record.
      const perProvider: Record<
        string,
        { answerOk: number; answerFail: number; judgeOk: number; judgeFail: number }
      > = {};
      for (const [p, v] of Object.entries(viability)) {
        perProvider[p] = { answerOk: v.aOk, answerFail: v.aFail, judgeOk: v.jOk, judgeFail: v.jFail };
      }
      const outcomeCounts = {
        completed: cleanCompleted,
        constitutionally_failed: constitutionalFailures,
        provider_unavailable: providerUnavailable,
        timed_out: timedOut,
        judge_failed: judgeFailed,
      };
      const switchIntegrity = {
        tasksTotal: total,
        tasksCompleted: answeredAndJudged, // answered AND judged
        cleanCompleted,
        constitutionalFailures, // the ONLY switch-integrity failure
        timedOut,
        providerUnavailable,
        judgeFailed,
        outcomeCounts,
        providersUsed,
        providersInfra, // answer-side timeout/unavailable
        perProvider,
        // Two independent axes (operator + Aletheon, 2026-07-20).
        constitutionalPortability: portability,
        operationalViability: perProvider,
        verdict,
        // Only real cross-provider judgments (answer+judge both rendered).
        crossJudgePairs: rows
          .filter((r) => r.status === "completed" || r.status === "constitutionally_failed")
          .map((r) => ({ taskId: r.taskId, answerProvider: r.answerProvider, judgeProvider: r.judgeProvider })),
        completedAcrossProviders: switchHolds,
      };
      const aggregates = {
        providers: ranRotation,
        completed: `${answeredAndJudged}/${total}`,
        verdict,
        constitutionalPortability: portability,
        outcomeCounts,
        sovereigntyRung: rung,
        bundleComponentsMeasured,
        switchIntegrity,
        groundedPct: groundedPct ?? "n/a",
        contradictions,
        note: switchHolds
          ? "PSE-2 provider-choice drill: the identical constitutional battery striped across the rotation mid-run, every verdict cross-provider-judged, zero constitutional failures — provider choice EXERCISED (S2 substitutable, exercised not merely available; CFS-018). S3 (open-weight independence) remains EXP-004's claim. Quality deltas across providers are the degradation report — reported, never scored."
          : inconclusive
            ? `PSE-2 provider-choice drill: INCONCLUSIVE — ${answeredAndJudged}/${total} answered+judged; ${timedOut} timed_out; ${providerUnavailable} provider_unavailable; ${judgeFailed} judge_failed; ${constitutionalFailures} constitutional failures among completed. Infra classes are honest non-results (NOT constitutional failures) — no rung claimed. Operational viability: ${viabilityNotes.join(" · ") || "n/a"}. Re-run when providers are reachable within the envelope.`
            : `PSE-2 provider-choice drill: CONSTITUTIONAL FAILURE — ${constitutionalFailures} answered+judged task(s) failed the constitutional criterion (contradictions present). Constitutional portability BROKEN. No rung, no bundle component claimed. Infra: ${timedOut} timed_out, ${providerUnavailable} unavailable, ${judgeFailed} judge_failed (reported separately, not counted as constitutional).`,
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
      const publishedMsg = `${publishStatePrefix(data.visibility)} — sha256 ${(data.contentHash as string).slice(0, 12)}…`;
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
          switch. Each task lands in one honest class: <span className="text-emerald-300">completed</span>,{" "}
          <span className="text-rose-300">constitutionally&nbsp;failed</span> (answered+judged but contradicts
          the collection — the ONLY switch-integrity failure), <span className="text-amber-300">timed&nbsp;out</span>{" "}
          / <span className="text-amber-300">provider&nbsp;unavailable</span> (infra — availability/performance, not
          reasoning), or <span className="text-amber-300">judge&nbsp;failed</span> (inconclusive). Transient errors get
          one visible retry against the SAME provider — never a silent re-route. Two axes are reported:
          constitutional portability and operational viability. Quality deltas are the degradation report —
          reported, never scored.
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
                  <td
                    className={`px-2 py-1.5 ${
                      r.status === "constitutionally_failed"
                        ? "text-rose-400"
                        : r.status === "timed_out" || r.status === "provider_unavailable" || r.status === "judge_failed"
                          ? "text-amber-400"
                          : r.status === "completed"
                            ? "text-emerald-400"
                            : "text-slate-400"
                    }`}
                  >
                    {r.status}
                    {(r.attempts?.length ?? 0) > 1 ? ` (${r.attempts!.length} attempts)` : ""}
                    {r.error ? ` — ${r.error.slice(0, 72)}` : ""}
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
        <div className={`rounded-lg border p-3 ${switchHolds ? "border-emerald-800 bg-emerald-950/30" : inconclusive ? "border-amber-800 bg-amber-950/30" : "border-rose-800 bg-rose-950/30"}`}>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Shuffle className={`h-4 w-4 ${switchHolds ? "text-emerald-400" : inconclusive ? "text-amber-400" : "text-rose-400"}`} />
            {switchHolds
              ? `Switch integrity HELD — ${cleanCompleted}/${total} tasks answered + cross-judged cleanly across ${providersUsed.length} providers (${providersUsed.join(" → ")}) · S2 substitutable, exercised`
              : inconclusive
                ? `Switch integrity INCONCLUSIVE — ${answeredAndJudged}/${total} answered+judged; ${timedOut} timed_out; ${providerUnavailable} provider_unavailable; ${judgeFailed} judge_failed; ${constitutionalFailures} constitutional failures among completed. Infra classes are honest non-results, not constitutional failures — no rung claimed.`
                : `Switch integrity: CONSTITUTIONAL FAILURE — ${constitutionalFailures} of ${answeredAndJudged} answered+judged task(s) contradicted the collection (constitutional portability BROKEN). ${infraCount > 0 ? `Plus ${timedOut} timed_out / ${providerUnavailable} unavailable / ${judgeFailed} judge_failed (infra, reported separately). ` : ""}No rung claimed.`}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            <span className="text-slate-300">Constitutional portability:</span>{" "}
            {portability === "held" ? "HELD" : portability === "broken" ? "BROKEN" : "INCONCLUSIVE"} —
            valid operation {portability === "held" ? "survived" : portability === "broken" ? "did NOT survive" : "not yet shown to survive"} provider substitution
            {cleanProviders.size > 0 ? ` (clean completions on ${cleanProviders.size} provider${cleanProviders.size > 1 ? "s" : ""})` : ""}.
          </p>
          {viabilityNotes.length > 0 && (
            <p className="mt-1 text-xs text-slate-400">
              <span className="text-slate-300">Operational viability</span> (can each provider fill its role within the runtime envelope): {viabilityNotes.join(" · ")}.
            </p>
          )}
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
