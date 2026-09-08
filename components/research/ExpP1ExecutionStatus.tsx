"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, ClipboardCopy, FlaskConical, Loader2, ShieldAlert } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

/**
 * The two-mode EXP-P1 execution model surface (operator ruling, 2026-09-07:
 * "Update the experiment execution model so we can rehearse internally
 * without weakening the registered confirmatory protocol."). Standalone,
 * mounted unconditionally in both host surfaces — never gated on Track 2's
 * own slow programme composition — mirroring
 * `FreezeVP2InternalPilotAction.tsx`'s own pattern and rationale
 * (CI-2026-09-07-GOVERNED-ACT-ELIGIBILITY-INDEPENDENT-OF-SLOW-COMPOSITION-001).
 *
 * Reads/writes `GET`/`POST /api/research/crystal/[experimentId]/rehearsal`
 * only — never re-derives eligibility, the frozen substrate, or the
 * confirmatory blocker list client-side; every one of those is resolved
 * server-side from the REGISTERED protocol's own artifact ladder
 * (`deriveProtocolRatified`) and the frozen crystal's own lifecycle
 * (`latestFrozenCrystalArtifact`) — never a hardcoded generation number.
 *
 * Renders nothing until SOME crystal-version generation has ever been
 * frozen — before that there is nothing to rehearse and nothing yet to call
 * "blocked" (the pre-freeze state is already covered by
 * `FreezeVP2InternalPilotAction`'s own eligible/not-eligible phases).
 */

interface RehearsalEligibilityView {
  eligible: boolean;
  reason?: string;
  frozenCrystalArtifactId: string | null;
  frozenCrystalContentHash: string | null;
}

interface PastRehearsalRunView {
  id: string;
  frozenAt: string | null;
  taskSetId: string;
  taskSetProvenance: string;
  armIds: string[];
  taskCount: number;
  receiptId: string | null;
}

interface RehearsalArmResultView {
  armId: string;
  armLabel: string;
  availableInvariantIds: string[];
  selectedInvariantIds: string[];
  /** `null` whenever no model/runtime execution step exists to extract
   *  demonstrated evidence-of-use from — i.e. always, in this mechanical
   *  harness. Never rendered as if it were `selectedInvariantIds` — see the
   *  service-side type's own doc for the 2026-09-07 audit that caught this
   *  field silently duplicating selection instead of measuring use. */
  actuallyGroundedInvariantIds: string[] | null;
  scoreMetric: string;
  score: number;
}

interface RehearsalTaskResultView {
  taskId: string;
  taskKind: string;
  groundTruthInvariantIds: string[];
  scorable?: boolean;
  unscorableReason?: string | null;
  armResults: RehearsalArmResultView[];
}

interface RehearsalArmSummaryView {
  armId: string;
  armLabel: string;
  scoreMetric: string;
  meanScoreOverall: number | null;
  meanScoreRecall: number | null;
  meanScoreDerivation: number | null;
}

interface RehearsalRunSummaryView {
  taskCounts: { total: number; scored: number; unscorable: number };
  unscorableTaskIds: string[];
  perArm: RehearsalArmSummaryView[];
  frozenPopulationSize: number | null;
  armBAvailableSetSize: number | null;
  armBSelectedSetSize: number | null;
  armCFixedSliceSize: number | null;
  instrumentCaveat: string;
}

/** The FULL persisted execution-run record — the same shape the POST
 *  response's `run` field and `GET .../rehearsal?runId=`'s `run` field both
 *  return, so "copy as JSON" always exports the identical shape whether the
 *  run just completed or is a past one being looked up. Loosely typed
 *  (beyond the one field this component actually renders): the export is a
 *  verbatim `JSON.stringify` of whatever the server persisted, never a
 *  client-reconstructed subset. */
interface RehearsalRunFullView {
  taskResults: RehearsalTaskResultView[];
  [key: string]: unknown;
}

interface StatusView {
  eligibility: RehearsalEligibilityView;
  frozenSubstrateLabel: string | null;
  confirmatoryBlockers: string[];
  pastRehearsalRuns: PastRehearsalRunView[];
}

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "none" }
  | { kind: "ready"; data: StatusView };

/** Shared task-by-task, arm-by-arm rendering — used for BOTH the just-
 *  completed run (shown unconditionally) and an expanded past run (shown on
 *  demand), so the two surfaces can never drift into two different layouts
 *  for the same data. A task with `scorable === false` (no frozen invariant
 *  matched its keywords — nothing to score recall against) is flagged
 *  distinctly; its raw per-arm scores are still shown as diagnostics, never
 *  hidden, but the reader is told not to trust them as real recall. */
function TaskResultsList({ results }: { results: RehearsalTaskResultView[] }) {
  return (
    <>
      {results.map((task) => {
        const unscorable = task.scorable === false;
        return (
          <div key={task.taskId} className="mb-1.5 last:mb-0">
            <div className="text-slate-300">
              {task.taskId} <span className="text-slate-600">({task.taskKind})</span>
              {unscorable && (
                <span className="ml-1.5 rounded border border-amber-700/50 bg-amber-950/30 px-1 py-0.5 text-[10px] text-amber-300">
                  unscorable — diagnostics only
                </span>
              )}
            </div>
            {unscorable && task.unscorableReason && (
              <div className="ml-2 text-slate-600">{task.unscorableReason}</div>
            )}
            <div className="ml-2 grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-4">
              {task.armResults.map((a) => {
                const available = a.availableInvariantIds?.length ?? 0;
                const selected = a.selectedInvariantIds?.length ?? 0;
                // Usage is measured only once a real model/judge exists and
                // extracts what a generated answer actually cited — this
                // harness never does, so actuallyGroundedInvariantIds is
                // always null here. Gate the "N selected" annotation on
                // `selected` (the real, always-present count), never on the
                // usage field — a null usage field must never hide selection
                // data that IS present.
                return (
                  <div key={a.armId}>
                    <span className="text-slate-400">{a.armId} {a.armLabel}:</span>{" "}
                    <span className="text-slate-200">{Math.round(a.score * 100)}%</span>
                    {selected > 0 && (
                      <span className="text-slate-600">
                        {" "}
                        · {selected} selected{available !== selected ? ` (${available} available)` : ""}
                      </span>
                    )}
                    {a.actuallyGroundedInvariantIds !== null && (
                      <span className="text-emerald-400"> · {a.actuallyGroundedInvariantIds.length} demonstrably used</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

/** Compact aggregate view — item 6's "proper rehearsal summary": scored vs
 *  unscorable, per-arm means split recall/derivation, and the B/C set-size
 *  distinction, never a single blended number. Shown ABOVE the per-task
 *  list, never in place of it. */
function RunSummaryBlock({ summary }: { summary: RehearsalRunSummaryView }) {
  const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
  return (
    <div className="mb-2 rounded border border-slate-800 bg-slate-900/60 p-1.5 text-slate-400">
      <div>
        {summary.taskCounts.scored}/{summary.taskCounts.total} task(s) scored
        {summary.taskCounts.unscorable > 0 && (
          <span className="text-amber-300"> · {summary.taskCounts.unscorable} unscorable ({summary.unscorableTaskIds.join(", ")})</span>
        )}
      </div>
      <div className="mt-0.5">
        Arm B: {summary.armBSelectedSetSize ?? "—"} selected of {summary.armBAvailableSetSize ?? "—"} available · Arm C:{" "}
        {summary.armCFixedSliceSize ?? "—"} fixed · frozen population {summary.frozenPopulationSize ?? "—"}
      </div>
      <div className="mt-0.5 grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-4">
        {summary.perArm.map((a) => (
          <div key={a.armId}>
            <span className="text-slate-500">{a.armId}:</span> {pct(a.meanScoreOverall)}
            <span className="text-slate-600"> (recall {pct(a.meanScoreRecall)} · derivation {pct(a.meanScoreDerivation)})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Copies the full run record to the clipboard as pretty-printed JSON —
 *  never a client-reconstructed subset. Shared between the just-completed
 *  run and an expanded past run so the affordance behaves identically in
 *  both places. */
function CopyJsonButton({
  runId,
  copiedRunId,
  onCopy,
}: {
  runId: string;
  copiedRunId: string | null;
  onCopy: (runId: string) => void;
}) {
  const copied = copiedRunId === runId;
  return (
    <button
      type="button"
      onClick={() => onCopy(runId)}
      className="flex items-center gap-1 rounded border border-slate-700 px-1.5 py-0.5 text-slate-300 hover:bg-slate-800"
    >
      {copied ? <ClipboardCheck className="h-3 w-3 text-emerald-300" /> : <ClipboardCopy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy JSON"}
    </button>
  );
}

export function ExpP1ExecutionStatus({
  experimentId,
  personaId,
}: {
  experimentId: string;
  /** See `FreezeVP2InternalPilotAction`'s identical prop for the full
   *  rationale — threaded onto every fetch this component makes so it
   *  resolves the SAME persona the rest of the embed already resolved. */
  personaId?: string;
}) {
  const personaHintOpt = useMemo(() => (personaId ? { personaIdHint: personaId } : {}), [personaId]);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [refreshErr, setRefreshErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [runErr, setRunErr] = useState<string | null>(null);
  const [lastRunNote, setLastRunNote] = useState<string | null>(null);

  // "View results" — per-run detail (task-by-task, arm-by-arm scores),
  // fetched on demand and cached by run id so re-expanding an already-viewed
  // past run never re-fetches. `lastCompletedRunId` is deliberately SEPARATE
  // from the past-runs list's own `expandedRunId` toggle: the just-completed
  // run is shown unconditionally right below `lastRunNote` (see runRehearsal
  // below, whose POST response already carries taskResults — no second
  // round-trip needed), and once `load()` re-fetches and that same run
  // appears in `pastRehearsalRuns`, its list row starts from COLLAPSED
  // (never auto-expanded) — sharing one state between the two would render
  // the same detail twice the moment the list catches up.
  const [lastCompletedRunId, setLastCompletedRunId] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [runDetails, setRunDetails] = useState<Record<string, RehearsalRunFullView>>({});
  // The server-computed aggregate — see `summarizeRehearsalRun`
  // (services/research/expP1Rehearsal.ts). Never re-derived client-side;
  // cached by run id alongside `runDetails`, absent for a run fetched before
  // the server started returning it (renders no summary block, never a stale
  // client-computed one).
  const [runSummaries, setRunSummaries] = useState<Record<string, RehearsalRunSummaryView>>({});
  const [detailLoadingRunId, setDetailLoadingRunId] = useState<string | null>(null);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  // "Copy JSON" — transient per-run confirmation, cleared after ~1.5s or on
  // the next copy attempt (whichever comes first).
  const [copiedRunId, setCopiedRunId] = useState<string | null>(null);
  const [copyErr, setCopyErr] = useState<string | null>(null);
  // Progress while `runExecutionRehearsal` is stepping a start/step run
  // (2026-09-08 durability fix) — `null` when no execution rehearsal is
  // currently in flight. Shown instead of a single "busy" spinner so a long
  // multi-batch run gives the operator a live done/total count rather than
  // looking hung for however long the full run takes.
  const [execProgress, setExecProgress] = useState<{ doneCount: number; totalCount: number } | null>(null);

  const load = useCallback(async () => {
    setPhase((prev) => (prev.kind === "ready" ? prev : { kind: "loading" }));
    try {
      const res = await personaFetch(`/api/research/crystal/${encodeURIComponent(experimentId)}/rehearsal`, {
        cache: "no-store",
        ...personaHintOpt,
      });
      const body = await res.json().catch(() => null);
      if (!body?.requestSucceeded) {
        throw new Error(body?.error || `could not read the EXP-P1 execution status (HTTP ${res.status})`);
      }
      if (!body.eligibility?.frozenCrystalArtifactId) {
        setPhase({ kind: "none" });
        setRefreshErr(null);
        return;
      }
      setPhase({
        kind: "ready",
        data: {
          eligibility: body.eligibility,
          frozenSubstrateLabel: body.frozenSubstrateLabel ?? null,
          confirmatoryBlockers: Array.isArray(body.confirmatoryBlockers) ? body.confirmatoryBlockers : [],
          pastRehearsalRuns: Array.isArray(body.pastRehearsalRuns) ? body.pastRehearsalRuns : [],
        },
      });
      setRefreshErr(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "could not read the EXP-P1 execution status";
      setPhase((prev) => (prev.kind === "ready" ? prev : { kind: "error", message }));
      setRefreshErr(message);
    }
  }, [experimentId, personaHintOpt]);

  useEffect(() => {
    void load();
  }, [load]);

  const runRehearsal = useCallback(async (taskSetVersion: "v1" | "v2" | "v3") => {
    setBusy(true);
    setRunErr(null);
    setLastRunNote(null);
    try {
      const res = await personaFetch(`/api/research/crystal/${encodeURIComponent(experimentId)}/rehearsal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskSetVersion }),
        ...personaHintOpt,
      });
      const body = await res.json().catch(() => null);
      if (!body?.requestSucceeded) {
        throw new Error(body?.error || `the rehearsal run was refused (HTTP ${res.status})`);
      }
      const taskCount = Array.isArray(body.taskResults) ? body.taskResults.length : 0;
      setLastRunNote(`Rehearsal complete — ${taskCount} task(s) across arms A/B/C/D. ${body.note ?? ""}`.trim());
      if (typeof body.runId === "string" && body.run) {
        setRunDetails((prev) => ({ ...prev, [body.runId]: body.run }));
        if (body.summary) setRunSummaries((prev) => ({ ...prev, [body.runId]: body.summary }));
        setLastCompletedRunId(body.runId);
      }
      await load();
    } catch (e) {
      setRunErr(e instanceof Error ? e.message : "the rehearsal run was refused");
    } finally {
      setBusy(false);
    }
  }, [experimentId, load, personaHintOpt]);

  /** The genuine per-arm EXECUTION rehearsal (2026-09-07, start/step split
   *  2026-09-08) — a REAL pinned model call per arm/task against
   *  `/api/.../execution-rehearsal`, distinct from `runRehearsal`'s
   *  retrieval-only `/api/.../rehearsal`. Reuses the same status/detail
   *  state so the run appears in the identical "just completed" +
   *  past-runs surfaces — never a parallel UI for what is, structurally,
   *  still one `execution-run` artifact kind. Never auto-triggered: only
   *  this handler, only a click.
   *
   *  Durability (2026-09-08 incident fix): rather than holding one HTTP
   *  request open for the full run (which exceeded the hosting gateway's
   *  ~30s SSR ceiling and returned a 504 while the Lambda kept running),
   *  this now (1) POSTs `action: 'start'` — fast, creates the durable run
   *  identity, no model calls — then (2) repeatedly POSTs `action: 'step'`
   *  with that `runId`, each call bounded to one small batch of tasks, until
   *  the server reports `status: 'executed'`. Every step is a fresh,
   *  independent HTTP request well under any gateway ceiling; a dropped
   *  connection on any one step loses no work — the next step (or a fresh
   *  click of this same button, which is safe to call again since a prior
   *  in-progress run is resumed rather than duplicated — see the server's
   *  own idempotency guarantee) simply continues from the same run's
   *  persisted progress. */
  const runExecutionRehearsal = useCallback(async () => {
    setBusy(true);
    setRunErr(null);
    setLastRunNote(null);
    setExecProgress(null);
    try {
      const startRes = await personaFetch(`/api/research/crystal/${encodeURIComponent(experimentId)}/execution-rehearsal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", taskSetVersion: "v4" }),
        ...personaHintOpt,
      });
      const startBody = await startRes.json().catch(() => null);
      if (!startBody?.requestSucceeded) {
        throw new Error(startBody?.error || `the execution rehearsal could not be started (HTTP ${startRes.status})`);
      }
      const runId: string = startBody.runId;
      const totalTasks: number = startBody.totalTasks ?? 0;
      setExecProgress({ doneCount: startBody.doneCount ?? 0, totalCount: totalTasks });

      // Poll: each step advances one bounded batch and checkpoints. Loop
      // until the server reports the run fully executed. No client-side
      // cap on iterations — the server-side batch size bounds each request's
      // duration, not the number of requests this loop is willing to make.
      let status: string = "executing";
      let lastStepBody: any = null;
      while (status !== "executed") {
        const stepRes = await personaFetch(`/api/research/crystal/${encodeURIComponent(experimentId)}/execution-rehearsal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "step", runId, taskSetVersion: "v4" }),
          ...personaHintOpt,
        });
        const stepBody = await stepRes.json().catch(() => null);
        if (!stepBody?.requestSucceeded) {
          throw new Error(stepBody?.error || `an execution-rehearsal step was refused (HTTP ${stepRes.status})`);
        }
        lastStepBody = stepBody;
        status = stepBody.status;
        setExecProgress({ doneCount: stepBody.doneCount ?? 0, totalCount: stepBody.totalCount ?? totalTasks });
      }

      const body = lastStepBody;
      const taskCount = Array.isArray(body?.run?.taskResults) ? body.run.taskResults.length : (body?.doneCount ?? 0);
      setLastRunNote(`Execution rehearsal complete — ${taskCount} task(s), real per-arm model calls, across arms A/B/C/D. ${body?.note ?? ""}`.trim());
      if (body?.run) {
        setRunDetails((prev) => ({ ...prev, [runId]: body.run }));
        if (body.summary) setRunSummaries((prev) => ({ ...prev, [runId]: body.summary }));
        setLastCompletedRunId(runId);
      }
      await load();
    } catch (e) {
      setRunErr(e instanceof Error ? e.message : "the execution rehearsal was refused");
    } finally {
      setBusy(false);
      setExecProgress(null);
    }
  }, [experimentId, load, personaHintOpt]);

  const toggleRunDetails = useCallback(
    async (runId: string) => {
      if (expandedRunId === runId) {
        setExpandedRunId(null);
        return;
      }
      setExpandedRunId(runId);
      if (runDetails[runId]) return;
      setDetailLoadingRunId(runId);
      setDetailErr(null);
      try {
        const res = await personaFetch(
          `/api/research/crystal/${encodeURIComponent(experimentId)}/rehearsal?runId=${encodeURIComponent(runId)}`,
          { cache: "no-store", ...personaHintOpt },
        );
        const body = await res.json().catch(() => null);
        if (!body?.requestSucceeded) {
          throw new Error(body?.error || `could not read this run's results (HTTP ${res.status})`);
        }
        setRunDetails((prev) => ({ ...prev, [runId]: body.run ?? { taskResults: [] } }));
        if (body.summary) setRunSummaries((prev) => ({ ...prev, [runId]: body.summary }));
      } catch (e) {
        setDetailErr(e instanceof Error ? e.message : "could not read this run's results");
      } finally {
        setDetailLoadingRunId(null);
      }
    },
    [experimentId, expandedRunId, runDetails, personaHintOpt],
  );

  const copyRunJson = useCallback(async (runId: string) => {
    const detail = runDetails[runId];
    if (!detail) return;
    setCopyErr(null);
    try {
      await navigator.clipboard.writeText(JSON.stringify(detail, null, 2));
      setCopiedRunId(runId);
      setTimeout(() => setCopiedRunId((prev) => (prev === runId ? null : prev)), 1500);
    } catch (e) {
      setCopyErr(e instanceof Error ? e.message : "could not copy to the clipboard");
    }
  }, [runDetails]);

  if (phase.kind === "loading") {
    return (
      <div className="mt-2 flex items-center gap-2 rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px] text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" /> Reading the EXP-P1 execution status…
      </div>
    );
  }

  if (phase.kind === "error") {
    return (
      <div className="mt-2 space-y-1.5 rounded border border-rose-500/30 bg-rose-500/10 p-2 text-[11px] text-rose-200">
        <div>Could not read the EXP-P1 execution status — {phase.message}.</div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-rose-100 hover:bg-rose-500/20"
        >
          Retry
        </button>
      </div>
    );
  }

  if (phase.kind === "none") {
    return null;
  }

  const { data } = phase;
  const { eligibility } = data;

  return (
    <div className="mt-2 space-y-2 text-[11px]">
      {data.frozenSubstrateLabel && (
        <div className="rounded border border-slate-800 bg-slate-900/40 p-2 text-slate-300">
          Frozen substrate: <span className="font-medium text-slate-100">{data.frozenSubstrateLabel}</span>
        </div>
      )}

      {/* Internal rehearsal — READY / not eligible */}
      <div className="rounded border border-sky-900/50 bg-sky-950/10 p-2">
        <div className="flex items-center gap-1.5 font-medium text-sky-200">
          <FlaskConical className="h-3.5 w-3.5" />
          Internal rehearsal — {eligibility.eligible ? "READY" : "not eligible"}
        </div>
        {!eligibility.eligible && eligibility.reason && (
          <div className="mt-1 text-slate-500">{eligibility.reason}</div>
        )}
        {eligibility.eligible && (
          <>
            <div className="mt-1 text-slate-500">
              Exercises the real four-arm harness against the frozen substrate above.{" "}
              <span className="font-medium text-amber-300">
                INTERNAL / NON-CONFIRMATORY / NOT VALID SCIENTIFIC EVIDENCE
              </span>
              . Results may never be promoted into the confirmatory EXP-P1 result set.
            </div>
            {runErr && (
              <div className="mt-1.5 rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-200">{runErr}</div>
            )}
            {lastRunNote && (
              <div className="mt-1.5 rounded border border-emerald-900/50 bg-emerald-950/20 p-1.5 text-emerald-200">
                {lastRunNote}
              </div>
            )}
            {lastCompletedRunId && runDetails[lastCompletedRunId] && (
              <div className="mt-1.5 rounded border border-slate-800 bg-slate-950/60 p-1.5">
                <div className="mb-1 flex justify-end">
                  <CopyJsonButton runId={lastCompletedRunId} copiedRunId={copiedRunId} onCopy={copyRunJson} />
                </div>
                {runSummaries[lastCompletedRunId] && <RunSummaryBlock summary={runSummaries[lastCompletedRunId]} />}
                <TaskResultsList results={runDetails[lastCompletedRunId].taskResults} />
              </div>
            )}
            {copyErr && <div className="mt-1 text-rose-300">{copyErr}</div>}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button
                onClick={() => void runRehearsal("v1")}
                disabled={busy}
                className="flex items-center gap-1 rounded border border-sky-800 bg-sky-900/30 px-2.5 py-1 text-sky-200 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <FlaskConical className="h-3 w-3" />} Run EXP-P1
                internal rehearsal (6 tasks)
              </button>
              <button
                onClick={() => void runRehearsal("v2")}
                disabled={busy}
                title="Larger, balanced recall/derivation set — every keyword pre-verified to hit the frozen crystal (2026-09-07)"
                className="flex items-center gap-1 rounded border border-sky-800 bg-sky-900/30 px-2.5 py-1 text-sky-200 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <FlaskConical className="h-3 w-3" />} Run larger
                rehearsal (16 tasks)
              </button>
              <button
                onClick={() => void runRehearsal("v3")}
                disabled={busy}
                title="Unseen set for the corrected task-scoped Arm B selector — never the 16-task set the old selector was evaluated on (2026-09-07 Arm B selection-fidelity fix)"
                className="flex items-center gap-1 rounded border border-emerald-800 bg-emerald-900/30 px-2.5 py-1 text-emerald-200 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <FlaskConical className="h-3 w-3" />} Run unseen
                rehearsal — corrected Arm B (16 tasks)
              </button>
              <button
                onClick={() => void runExecutionRehearsal()}
                disabled={busy}
                title="INTERNAL / NON-CONFIRMATORY — real per-arm model execution (A/B/C/D) with structured-citation evidence-of-use, against an unseen 16-task set. Executes in small checkpointed batches (2026-09-08 durability fix) — safe to leave the page and come back; a click while one is already running resumes it rather than starting a duplicate. Never auto-run."
                className="flex items-center gap-1 rounded border border-amber-800 bg-amber-950/30 px-2.5 py-1 text-amber-200 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <FlaskConical className="h-3 w-3" />} Run EXP-P1
                execution rehearsal — unseen tasks
                {execProgress && ` (${execProgress.doneCount}/${execProgress.totalCount})`}
              </button>
            </div>
            {data.pastRehearsalRuns.length > 0 && (
              <div className="mt-2 space-y-1.5 border-t border-slate-800 pt-1.5 text-slate-500">
                {data.pastRehearsalRuns.slice(0, 3).map((r) => (
                  <div key={r.id}>
                    <div className="flex items-center justify-between gap-2">
                      <span>
                        {r.frozenAt ?? "—"} · {r.taskCount} task(s) · taskSet {r.taskSetProvenance} · arms {r.armIds.join(",")}
                      </span>
                      <button
                        type="button"
                        onClick={() => void toggleRunDetails(r.id)}
                        className="shrink-0 rounded border border-slate-700 px-1.5 py-0.5 text-slate-300 hover:bg-slate-800"
                      >
                        {expandedRunId === r.id ? "Hide results" : "View results"}
                      </button>
                    </div>
                    {expandedRunId === r.id && (
                      <div className="mt-1 rounded border border-slate-800 bg-slate-950/60 p-1.5">
                        {detailLoadingRunId === r.id && (
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Loader2 className="h-3 w-3 animate-spin" /> Reading this run's results…
                          </div>
                        )}
                        {detailErr && detailLoadingRunId !== r.id && !runDetails[r.id] && (
                          <div className="text-rose-300">{detailErr}</div>
                        )}
                        {runDetails[r.id] && (
                          <>
                            <div className="mb-1 flex justify-end">
                              <CopyJsonButton runId={r.id} copiedRunId={copiedRunId} onCopy={copyRunJson} />
                            </div>
                            {runSummaries[r.id] && <RunSummaryBlock summary={runSummaries[r.id]} />}
                            <TaskResultsList results={runDetails[r.id].taskResults} />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirmatory execution — BLOCKED */}
      <div className="rounded border border-rose-900/50 bg-rose-950/10 p-2">
        <div className="flex items-center gap-1.5 font-medium text-rose-200">
          <ShieldAlert className="h-3.5 w-3.5" />
          Confirmatory execution — BLOCKED
        </div>
        <ul className="mt-1 space-y-0.5 text-slate-400">
          {data.confirmatoryBlockers.map((b) => (
            <li key={b}>○ {b}</li>
          ))}
        </ul>
      </div>

      {refreshErr && <div className="text-amber-300/80">Last refresh could not confirm this is still current — {refreshErr}.</div>}
    </div>
  );
}
