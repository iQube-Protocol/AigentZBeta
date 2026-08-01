"use client";

/**
 * Independent Review — the Lab surface for IRL-REVIEW-001 (SPEC §12).
 *
 * Three views and no more: **New Review** (choose reviewers, preview the
 * redacted package, freeze and run) · **Review Queue** (running · completed ·
 * contested · awaiting resolution) · **Review Result** (agreement, contested
 * items, limitations, hashes, receipt, and the four governed resolutions).
 *
 * It lives INSIDE the experiments navigator rather than as a separate
 * destination, because the review is preparation for an experiment: the person
 * preparing it should not have to leave it to adjudicate its inputs.
 *
 * ── The three things this surface must not get wrong ───────────────────────
 *
 * 1. THE SAME-FAMILY GUARD IS THE SERVER'S. The `<select>` below disables
 *    same-family options, which is a courtesy — a direct POST ignores it
 *    entirely. The refusal that matters happens in the API. What the UI must
 *    guarantee is that its disabled set is DERIVED from the very family
 *    metadata the server enforces on (`/api/research/review/models`), so the
 *    dropdown and the rule can never disagree. There is no model list in this
 *    file.
 *
 * 2. THE PREVIEW IS THE PACKAGE. `preview.package` is the sealed object the
 *    reviewers receive, with `preview.packageHash` its recorded hash and
 *    `hashVerified` the server's recomputation of it. A human looks at this in
 *    order to trust what they cannot see; a second projection built for display
 *    would be the one thing that must not drift.
 *
 * 3. NO ACTION HERE WRITES TO THE CORPUS. Accept · revise · defer · reject
 *    record a governed resolution on the REVIEW. The response says so in data
 *    (`corpusWritten: false`, …) and this surface renders it, because "accept"
 *    is the word a reader will assume means admitted.
 *
 * Transport: `personaFetch` only. These routes resolve the caller through the
 * identity spine, and a raw `fetch` would 401 into an empty state that looks
 * exactly like "no reviews yet".
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Download, Eye, FlaskConical, Gem, Loader2, Lock, RefreshCw, ShieldCheck, User } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

// ── Server-shaped types (mirrors of the route payloads, not a second model) ──

interface SelectableModel {
  id: string;
  family: string | null;
  familyEvidence: string | null;
  offline: boolean;
  deprecationDate: string | null;
  selectable: boolean;
  unselectableReason: string | null;
}

interface DefaultPair {
  pairVersion: string;
  rationale: string;
  R1: { provider: string; modelId: string; declaredLineage: string };
  R2: { provider: string; modelId: string; declaredLineage: string };
}

interface QueueRow {
  reviewId: string;
  queueState: "planned" | "running" | "completed" | "contested" | "resolved";
  packageHash: string | null;
  reviewers: Array<{
    reviewerSlot: string;
    reviewerType: string;
    requestedModelId: string | null;
    resolvedModelId: string | null;
    modelFamily: string | null;
    humanReviewerRef: string | null;
  }>;
  subjectCount: number;
  contestedCount: number;
  agreedCount: number;
  action: string | null;
  updatedAt: string;
}

type SlotKind = "external-model" | "human";

const QUEUE_LABEL: Record<QueueRow["queueState"], string> = {
  planned: "Planned",
  running: "Running",
  completed: "Completed",
  contested: "Contested — awaiting resolution",
  resolved: "Resolved",
};

const QUEUE_TONE: Record<QueueRow["queueState"], string> = {
  planned: "text-slate-300",
  running: "text-blue-300",
  completed: "text-emerald-300",
  contested: "text-amber-300",
  resolved: "text-violet-300",
};

const ACTIONS = ["accept", "revise", "defer", "reject"] as const;
type Action = (typeof ACTIONS)[number];

// ── Slate house style. No white hairlines anywhere in this file. ────────────
const PANEL = "rounded-xl border border-slate-800 bg-slate-900/40 p-4";
const FIELD =
  "w-full rounded-lg border border-slate-800 bg-slate-900/40 px-2.5 py-1.5 text-xs text-slate-200 " +
  "focus:border-slate-700 focus:outline-none disabled:opacity-50";

/**
 * `reviewerMode` (2026-08-01, Validation Programme's Crystal Review stage):
 * hides the New Review tab (creating a review is Research Steward territory,
 * SPEC-IRL-WORKSPACE-001 §8) and the "Governed resolution" / "Preview a
 * freeze ceremony package" governance blocks in Review Result and Crystal
 * vP1. Queue/Result/Crystal read paths are unaffected by this flag — their
 * REACH is enforced server-side (requireReviewAccess/callerMayReadExperimentReview),
 * never by hiding UI alone. Default false: the operator's own mount inside
 * InvariantExperimentLab is byte-identical.
 */
export default function IndependentReviewPanel({ reviewerMode = false }: { reviewerMode?: boolean } = {}) {
  const [view, setView] = useState<"new" | "queue" | "result" | "crystal">(reviewerMode ? "crystal" : "new");
  const [models, setModels] = useState<SelectableModel[] | null>(null);
  const [defaultPair, setDefaultPair] = useState<DefaultPair | null>(null);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);

  const [r1Kind, setR1Kind] = useState<SlotKind>("external-model");
  const [r2Kind, setR2Kind] = useState<SlotKind>("external-model");
  const [r1Model, setR1Model] = useState<string>("");
  const [r2Model, setR2Model] = useState<string>("");
  const [r1Human, setR1Human] = useState<string>("");
  const [r2Human, setR2Human] = useState<string>("");
  const [r1HumanDecisions, setR1HumanDecisions] = useState<string>("");
  const [r2HumanDecisions, setR2HumanDecisions] = useState<string>("");
  const [stewardRef, setStewardRef] = useState<string>("");

  const [busy, setBusy] = useState<null | "preview" | "run">(null);
  const [refusal, setRefusal] = useState<{ code?: string; message: string } | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const [queue, setQueue] = useState<QueueRow[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionOutcome, setActionOutcome] = useState<Record<string, unknown> | null>(null);

  // ── Catalogue ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await personaFetch("/api/research/review/models", { cache: "no-store" });
        const d = await res.json();
        if (d?.ok) {
          setModels(d.models as SelectableModel[]);
          setDefaultPair(d.defaultPair as DefaultPair);
          setR1Model(d.defaultPair?.R1?.modelId ?? "");
          setR2Model(d.defaultPair?.R2?.modelId ?? "");
        } else {
          setModels([]);
          setCatalogueError(d?.error ?? "the model catalogue could not be read");
        }
      } catch (e) {
        setModels([]);
        setCatalogueError(e instanceof Error ? e.message : "the model catalogue could not be read");
      }
    })();
  }, []);

  const loadQueue = useCallback(async () => {
    try {
      const res = await personaFetch("/api/research/review", { cache: "no-store" });
      const d = await res.json();
      setQueue(d?.ok ? (d.reviews as QueueRow[]) : []);
    } catch {
      setQueue([]);
    }
  }, []);

  useEffect(() => {
    if (view === "queue") void loadQueue();
  }, [view, loadQueue]);

  /**
   * The family each slot currently resolves to, read from the SERVER's
   * catalogue. This is the single input to the disabled-option logic below —
   * there is no second list, so the dropdown cannot offer a pair the server
   * would refuse, and cannot hide one it would accept.
   */
  const familyOf = useCallback(
    (modelId: string): string | null => models?.find((m) => m.id === modelId)?.family ?? null,
    [models],
  );

  const r1Family = r1Kind === "external-model" ? familyOf(r1Model) : null;
  const r2Family = r2Kind === "external-model" ? familyOf(r2Model) : null;
  const sameFamily = Boolean(r1Family && r2Family && r1Family === r2Family);

  const optionsFor = useCallback(
    (slot: "R1" | "R2"): Array<SelectableModel & { disabled: boolean; disabledReason: string | null }> => {
      const otherFamily = slot === "R1" ? r2Family : r1Family;
      return (models ?? []).map((m) => {
        const sameLineage = Boolean(m.family && otherFamily && m.family === otherFamily);
        return {
          ...m,
          disabled: !m.selectable || sameLineage,
          disabledReason: !m.selectable
            ? m.unselectableReason
            : sameLineage
              ? `same lineage as the other reviewer (${m.family}) — two instances of one family are not two reviewers`
              : null,
        };
      });
    },
    [models, r1Family, r2Family],
  );

  const submit = useCallback(
    async (mode: "preview" | "run") => {
      setBusy(mode);
      setRefusal(null);
      setResult(null);
      setActionOutcome(null);
      try {
        const res = await personaFetch("/api/research/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            version: "vP1",
            reviewers: {
              R1:
                r1Kind === "human"
                  ? { reviewerType: "human", humanReviewerRef: r1Human }
                  : { reviewerType: "external-model", modelId: r1Model },
              R2:
                r2Kind === "human"
                  ? { reviewerType: "human", humanReviewerRef: r2Human }
                  : { reviewerType: "external-model", modelId: r2Model },
            },
            stewardRef: stewardRef.trim() || undefined,
            humanDecisions: {
              ...(r1Kind === "human" && r1HumanDecisions.trim() ? { R1: r1HumanDecisions } : {}),
              ...(r2Kind === "human" && r2HumanDecisions.trim() ? { R2: r2HumanDecisions } : {}),
            },
          }),
        });
        const d = await res.json();
        if (!d?.ok) setRefusal({ code: d?.refusalCode, message: d?.error ?? "the review was refused" });
        else setResult(d as Record<string, unknown>);
      } catch (e) {
        setRefusal({ message: e instanceof Error ? e.message : "request failed" });
      } finally {
        setBusy(null);
      }
    },
    [r1Kind, r2Kind, r1Model, r2Model, r1Human, r2Human, r1HumanDecisions, r2HumanDecisions, stewardRef],
  );

  const openResult = useCallback(async (reviewId: string) => {
    setSelected(reviewId);
    setView("result");
    setDetail(null);
    setActionOutcome(null);
    try {
      const res = await personaFetch(`/api/research/review/${encodeURIComponent(reviewId)}`, { cache: "no-store" });
      const d = await res.json();
      setDetail(d?.ok ? (d as Record<string, unknown>) : null);
    } catch {
      setDetail(null);
    }
  }, []);

  const recordAction = useCallback(
    async (action: Action) => {
      if (!selected || !actionReason.trim()) return;
      try {
        const res = await personaFetch(`/api/research/review/${encodeURIComponent(selected)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reason: actionReason }),
        });
        const d = await res.json();
        setActionOutcome(d as Record<string, unknown>);
      } catch (e) {
        setActionOutcome({ ok: false, error: e instanceof Error ? e.message : "failed" });
      }
    },
    [selected, actionReason],
  );

  const preview = (result?.preview ?? detail?.preview) as
    | { packageId: string; packageHash: string; hashVerified: boolean; package: Record<string, unknown> }
    | null
    | undefined;

  // Supersession preserves evidence and removes authority to resolve the
  // superseded record (operator ruling 2026-07-31) — this disables the
  // client-side controls; app/api/research/review/[reviewId]/route.ts's
  // POST handler is the authoritative enforcement.
  const isSuperseded = Boolean((detail?.review as Record<string, unknown> | undefined)?.supersededBy);

  const previewSubjects = useMemo(() => {
    const subjects = (preview?.package?.subjects ?? []) as Array<Record<string, unknown>>;
    return subjects.slice(0, 5);
  }, [preview]);

  return (
    <div className="space-y-4">
      {/* View switch — three views, exactly as the spec allows */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["new", "New Review", FlaskConical],
            ["queue", "Review Queue", ClipboardList],
            ["result", "Review Result", ShieldCheck],
            ["crystal", "Crystal vP1", Gem],
          ] as const
        )
          .filter(([id]) => !(reviewerMode && id === "new"))
          .map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] transition ${
              view === id
                ? "border-blue-500/40 bg-blue-500/20 text-blue-100"
                : "border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60"
            }`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {/* ── NEW REVIEW ───────────────────────────────────────────────────── */}
      {view === "new" && !reviewerMode && (
        <div className="space-y-4">
          <div className={PANEL}>
            <div className="mb-2 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-100">Reviewers</h3>
            </div>
            <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
              Two reviewers of <span className="text-slate-200">different model families</span>. Shared hosting is an
              acceptable correlate; shared weights are not — two instances of one lineage check nothing, because a
              systematic bias appears in both and the second review confirms rather than tests. Either slot may be
              occupied by a human, who reviews the same frozen package with the same rubric and returns the same
              decision schema.
            </p>

            {catalogueError && (
              <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
                <AlertTriangle className="mr-1 inline h-3 w-3" />
                {catalogueError}
              </div>
            )}

            {defaultPair && (
              <div className="mb-3 rounded-lg border border-slate-800 bg-slate-900/40 p-2.5 text-[11px] text-slate-400">
                Ratified default pair <span className="text-slate-200">{defaultPair.pairVersion}</span> —{" "}
                <span className="text-slate-300">{defaultPair.R1.modelId}</span> ({defaultPair.R1.declaredLineage}) and{" "}
                <span className="text-slate-300">{defaultPair.R2.modelId}</span> ({defaultPair.R2.declaredLineage}).
                Changing either slot is a versioned pair amendment and is recorded as a change.
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {(["R1", "R2"] as const).map((slot) => {
                const kind = slot === "R1" ? r1Kind : r2Kind;
                const setKind = slot === "R1" ? setR1Kind : setR2Kind;
                const model = slot === "R1" ? r1Model : r2Model;
                const setModel = slot === "R1" ? setR1Model : setR2Model;
                const human = slot === "R1" ? r1Human : r2Human;
                const setHuman = slot === "R1" ? setR1Human : setR2Human;
                const humanDecisions = slot === "R1" ? r1HumanDecisions : r2HumanDecisions;
                const setHumanDecisions = slot === "R1" ? setR1HumanDecisions : setR2HumanDecisions;
                const family = slot === "R1" ? r1Family : r2Family;
                return (
                  <div key={slot} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-200">
                        {slot === "R1" ? "Reviewer 1 — complete package" : "Reviewer 2 — mandatory second review"}
                      </span>
                      {family && <span className="text-[10px] text-slate-500">family: {family}</span>}
                    </div>

                    <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Slot type</label>
                    <select
                      className={`${FIELD} mb-2`}
                      value={kind}
                      onChange={(e) => setKind(e.target.value as SlotKind)}
                    >
                      <option value="external-model">External model</option>
                      <option value="human">Human — Independent Review Steward</option>
                    </select>

                    {kind === "external-model" ? (
                      <>
                        <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Model</label>
                        <select
                          className={FIELD}
                          value={model}
                          disabled={!models || models.length === 0}
                          onChange={(e) => setModel(e.target.value)}
                        >
                          {(optionsFor(slot) ?? []).map((m) => (
                            <option key={m.id} value={m.id} disabled={m.disabled} title={m.disabledReason ?? undefined}>
                              {m.id}
                              {m.family ? ` · ${m.family}` : " · lineage unknown"}
                              {m.disabled ? " — unavailable" : ""}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <>
                        <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">
                          Steward reference
                        </label>
                        <input
                          className={`${FIELD} mb-2`}
                          value={human}
                          placeholder="steward reference (attributable)"
                          onChange={(e) => setHuman(e.target.value)}
                        />
                        <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">
                          Adjudication — same schema a model returns
                        </label>
                        <textarea
                          className={`${FIELD} h-24 font-mono`}
                          value={humanDecisions}
                          placeholder={'{"decisions":[{"subjectRef":"…","decision":"independent","reason":"…"}]}'}
                          onChange={(e) => setHumanDecisions(e.target.value)}
                        />
                        <p className="mt-1 flex items-start gap-1 text-[10px] leading-relaxed text-slate-500">
                          <User className="mt-0.5 h-3 w-3 flex-shrink-0" />
                          The steward reviews contested cases, private-source summaries, material exclusions and the
                          required sample. The role cannot edit source assets, grant Standing, or freeze anything.
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {sameFamily && (
              <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-[11px] text-rose-200">
                <AlertTriangle className="mr-1 inline h-3 w-3" />
                Both slots resolve to family <span className="font-semibold">{r1Family}</span>. The server will refuse
                this pair — the check is authoritative there, not here.
              </div>
            )}

            <div className="mt-3">
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">
                Independent Review Steward (optional — defaults to you, recorded as interim)
              </label>
              <input
                className={FIELD}
                value={stewardRef}
                placeholder="steward reference"
                onChange={(e) => setStewardRef(e.target.value)}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => void submit("preview")}
                disabled={busy !== null}
                className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-slate-800/60 disabled:opacity-50"
              >
                {busy === "preview" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                Freeze &amp; preview the redacted package
              </button>
              <button
                onClick={() => void submit("run")}
                disabled={busy !== null}
                className="flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/20 px-3 py-1.5 text-xs text-blue-100 transition hover:bg-blue-500/30 disabled:opacity-50"
              >
                {busy === "run" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
                Run the review
              </button>
              <span className="text-[10px] text-slate-500">
                Preview first — it is where blinding can be seen to have held before a run is committed to.
              </span>
            </div>
          </div>

          {refusal && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <Lock className="h-3.5 w-3.5" />
                Refused{refusal.code ? ` — ${refusal.code}` : ""}
              </div>
              <p className="leading-relaxed">{refusal.message}</p>
            </div>
          )}

          {result && <SummaryPanel result={result} />}

          {preview && (
            <div className={PANEL}>
              <div className="mb-2 flex items-center gap-2">
                <Eye className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-100">Redacted package — exactly what the reviewers receive</h3>
              </div>
              <div className="mb-3 grid gap-1 text-[11px] text-slate-400 sm:grid-cols-2">
                <div>
                  package <span className="font-mono text-slate-300">{preview.packageId}</span>
                </div>
                <div>
                  hash <span className="font-mono text-slate-300">{preview.packageHash?.slice(0, 24)}…</span>{" "}
                  {preview.hashVerified ? (
                    <span className="text-emerald-300">verified</span>
                  ) : (
                    <span className="text-rose-300">MISMATCH</span>
                  )}
                </div>
              </div>
              <div className="mb-2 rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Target statement</div>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  {String(preview.package?.targetDefinition ?? "")}
                </p>
              </div>
              <div className="mb-2 rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">The target is not</div>
                <ul className="list-disc pl-4 text-[11px] leading-relaxed text-slate-400">
                  {((preview.package?.nonTargets ?? []) as string[]).map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                First 5 of {(preview.package?.subjects as unknown[] | undefined)?.length ?? 0} rows
              </div>
              <div className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
                <pre className="overflow-x-auto text-[10px] leading-relaxed text-slate-400">
                  {JSON.stringify(previewSubjects, null, 2)}
                </pre>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                No current label, Standing, prior decision, desired count, arm allocation or expected result appears
                above — a package carrying any of them is refused at sealing, not filtered here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── REVIEW QUEUE ─────────────────────────────────────────────────── */}
      {view === "queue" && (
        <div className={PANEL}>
          <h3 className="mb-2 text-sm font-semibold text-slate-100">Review queue</h3>
          {queue === null && <div className="text-xs text-slate-400">Loading…</div>}
          {queue !== null && queue.length === 0 && (
            <div className="text-xs text-slate-400">No reviews yet. Start one from New Review.</div>
          )}
          <div className="space-y-2">
            {(queue ?? []).map((r) => (
              <button
                key={r.reviewId}
                onClick={() => void openResult(r.reviewId)}
                className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-left transition hover:bg-slate-800/60"
              >
                <div className="min-w-0">
                  <div className="truncate font-mono text-[11px] text-slate-200">{r.reviewId}</div>
                  <div className="text-[10px] text-slate-500">
                    {r.subjectCount} rows · {r.reviewers.map((a) => a.resolvedModelId ?? a.humanReviewerRef ?? "—").join(" / ")}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className={QUEUE_TONE[r.queueState]}>{QUEUE_LABEL[r.queueState]}</span>
                  {r.contestedCount > 0 && <span className="text-amber-300">{r.contestedCount} contested</span>}
                  {r.action && <span className="text-violet-300">{r.action}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── REVIEW RESULT ────────────────────────────────────────────────── */}
      {view === "result" && (
        <div className="space-y-4">
          {!selected && <div className={`${PANEL} text-xs text-slate-400`}>Pick a review from the queue.</div>}
          {selected && !detail && <div className={`${PANEL} text-xs text-slate-400`}>Loading {selected}…</div>}
          {detail && (
            <ResultPanel
              detail={detail}
              reviewId={selected}
              /* Remedy acceptance is the INTERNAL affordance (operator ruling,
                 2026-08-02). A reviewer opens the same modal and reads the same
                 evidence; only the form is withheld — and the route refuses a
                 reviewer grant outright, so this is presentation, not the gate. */
              canRemedy={!reviewerMode && !isSuperseded}
              onRemedied={() => selected && void openResult(selected)}
            />
          )}

          {detail && !reviewerMode && (
            <div className={PANEL}>
              <h3 className="mb-1 text-sm font-semibold text-slate-100">Governed resolution</h3>
              {isSuperseded ? (
                <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
                  This review is superseded — its actions are disabled. The row remains here for audit inspection
                  only.
                </p>
              ) : (
                <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
                  These record a resolution on the <span className="text-slate-200">review</span>. None writes to the
                  corpus, grants Standing, changes an asset&apos;s lifecycle, or freezes anything — accepting a review
                  accepts its findings as evidence. The freeze remains a separate governed act.
                </p>
              )}
              <input
                className={`${FIELD} mb-2`}
                value={actionReason}
                disabled={isSuperseded}
                placeholder="reason (required — an unexplained resolution is a stray click in the audit trail)"
                onChange={(e) => setActionReason(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {ACTIONS.map((a) => (
                  <button
                    key={a}
                    disabled={isSuperseded || !actionReason.trim()}
                    onClick={() => void recordAction(a)}
                    className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-1.5 text-xs capitalize text-slate-200 transition hover:bg-slate-800/60 disabled:opacity-40"
                  >
                    {a}
                  </button>
                ))}
              </div>
              {actionOutcome && (
                <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/40 p-2.5 text-[11px] text-slate-300">
                  <CheckCircle2 className="mr-1 inline h-3 w-3 text-emerald-300" />
                  {String(actionOutcome.effect ?? actionOutcome.error ?? "recorded")}
                  <div className="mt-1 text-[10px] text-slate-500">
                    corpus written: {String(actionOutcome.corpusWritten ?? false)} · Standing granted:{" "}
                    {String(actionOutcome.standingGranted ?? false)} · lifecycle changed:{" "}
                    {String(actionOutcome.lifecycleChanged ?? false)} · asset frozen:{" "}
                    {String(actionOutcome.assetFrozen ?? false)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── CRYSTAL vP1 — Readiness / Statistics / Freeze Recommendation ──── */}
      {view === "crystal" && <CrystalPanel reviewerMode={reviewerMode} />}
    </div>
  );
}

/**
 * Crystal vP1 — Readiness Report, Statistics ("birth certificate"), and
 * Freeze Recommendation (CFS-054). Read-only views plus a way to RUN the
 * checks (refresh) and PREVIEW a freeze-ceremony package. There is no
 * one-click freeze control anywhere in this component — ratifying a freeze
 * is a separate, explicit, operator-issued act outside this UI
 * (services/research/artifacts.ts::freezeArtifact), matching the
 * propose → review → explicit-confirm posture used elsewhere in this
 * session's Register-stage work. The preview button below builds a package
 * for review; it never calls that freeze function.
 */
function CrystalPanel({ reviewerMode = false }: { reviewerMode?: boolean } = {}) {
  const [experimentId] = useState("EXP-P1");
  const [domain, setDomain] = useState("constitutional-reasoning");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [operatorRef, setOperatorRef] = useState("");
  const [reviewerRef, setReviewerRef] = useState("");
  const [domainBoundary, setDomainBoundary] = useState("");
  const [rationaleText, setRationaleText] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewResult, setPreviewResult] = useState<Record<string, unknown> | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const runChecks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch(
        `/api/research/crystal/${encodeURIComponent(experimentId)}?domain=${encodeURIComponent(domain)}`,
        { cache: "no-store" },
      );
      const d = await res.json();
      if (!d?.ok) throw new Error(d?.error ?? `HTTP ${res.status}`);
      setData(d);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "the crystal report could not be run");
    } finally {
      setLoading(false);
    }
  }, [experimentId, domain]);

  useEffect(() => {
    void runChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runCeremonyPreview = useCallback(async () => {
    setPreviewBusy(true);
    setPreviewError(null);
    setPreviewResult(null);
    try {
      const res = await personaFetch(`/api/research/crystal/${encodeURIComponent(experimentId)}/freeze-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crystalDomain: domain,
          operatorRef,
          reviewerRef: reviewerRef || undefined,
          domainBoundary,
          freezeRationale: rationaleText,
          ratifiedAt: new Date().toISOString(),
        }),
      });
      const d = await res.json();
      if (!d?.ok) throw new Error(d?.error ?? `HTTP ${res.status}`);
      setPreviewResult(d);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "the freeze preview could not be built");
    } finally {
      setPreviewBusy(false);
    }
  }, [experimentId, domain, operatorRef, reviewerRef, domainBoundary, rationaleText]);

  /**
   * Download JSON for Agent — REPOINTED (operator ruling, 2026-08-02).
   *
   * PRIOR DEFECT: this dumped `data` — the raw Crystal Readiness API response
   * — on the reasoning that "the data an agent needs is exactly the data a
   * human reviewer is already looking at". That assumption is wrong, and the
   * operator demonstrated why: a human reviewer arrives already knowing who
   * they are, what they may do, and where to submit. An agent knows none of
   * that. The crystal report contains no reviewer role, no authority ceiling,
   * no prohibitions, no programme/protocol/submission URLs, no expected
   * output schema and no next action — so handing it over told the agent
   * only that the selected domain was empty.
   *
   * The real manifest already existed at
   * /api/journey/validation-programme/agent-package (VP Phase 2) and this
   * button simply never called it. It does now; the crystal report rides
   * INSIDE that package as one member, which is what it always should have
   * been.
   */
  const [agentPackageBusy, setAgentPackageBusy] = useState(false);
  const [agentPackageError, setAgentPackageError] = useState<string | null>(null);

  const downloadJsonForAgent = useCallback(async () => {
    setAgentPackageBusy(true);
    setAgentPackageError(null);
    try {
      const res = await personaFetch("/api/journey/validation-programme/agent-package", {
        cache: "no-store",
      });
      const raw = await res.text();
      if (!res.ok || !raw.trimStart().startsWith("{")) {
        setAgentPackageError(
          res.status === 403
            ? "Your reviewer access for this experiment could not be confirmed, so no agent package was produced."
            : "The agent package could not be produced right now.",
        );
        return;
      }
      const pkgJson = JSON.parse(raw) as Record<string, unknown>;

      // REFUSE TO HAND OVER AN EMPTY REVIEW (the defect this ruling caught).
      // The crystal report is authoritative about whether there is anything
      // to review; if it says no, the package must say so at the TOP rather
      // than burying it, so an agent — or an operator about to send this —
      // cannot mistake a successful download for a reviewable crystal.
      const crystalReady = Boolean(
        (data as { reviewPackageReady?: boolean } | null)?.reviewPackageReady,
      );
      const enriched = {
        ...pkgJson,
        reviewPackageReady: crystalReady,
        ...(crystalReady
          ? {}
          : {
              blockingNotice:
                `The crystal candidate for ${experimentId} in domain '${domain}' is not review-ready: ` +
                `readiness checks do not pass. Do not begin a review against this package — the ` +
                `crystal/domain selection needs correcting first.`,
            }),
        crystalReadiness: data ?? null,
      };

      const blob = new Blob([JSON.stringify(enriched, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `validation-programme-agent-package-${experimentId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setAgentPackageError("The agent package could not be produced right now.");
    } finally {
      setAgentPackageBusy(false);
    }
  }, [data, experimentId, domain]);

  const readiness = data?.readiness as { ok: boolean; checks: Array<{ name: string; passed: boolean; detail: string }> } | undefined;
  const statistics = data?.statistics as Record<string, unknown> | undefined;
  const recommendation = data?.recommendation as
    | { verdict: string; rationale: Array<{ id: string; label: string; satisfied: boolean; detail: string }>; remainingRisks: string[]; advisoryNote: string }
    | undefined;

  const pkg = previewResult?.package as
    | { packageHash: string; contentHash: string; eligibleForRatification: boolean; signatories: string[]; dvnAnchorRef: null }
    | undefined;

  return (
    <div className="space-y-4">
      <div className={PANEL}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Gem className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-100">Crystal vP1 — Readiness · Statistics · Freeze Recommendation</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void runChecks()}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/40 px-2.5 py-1 text-[11px] text-slate-300 transition hover:bg-slate-800/60 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              Run checks
            </button>
            <button
              onClick={() => void downloadJsonForAgent()}
              disabled={!data || agentPackageBusy}
              title="Download the Validation Programme agent package — reviewer role and authority, programme state, resource links, submission channel, expected output schema, prohibitions, and the crystal readiness report"
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/40 px-2.5 py-1 text-[11px] text-slate-300 transition hover:bg-slate-800/60 disabled:opacity-50"
            >
              {agentPackageBusy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              {agentPackageBusy ? "Building package…" : "Download JSON for Agent"}
            </button>
          </div>
        </div>
        {agentPackageError ? (
          <p className="mb-2 flex items-start gap-1.5 text-[11px] text-amber-300">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            {agentPackageError}
          </p>
        ) : null}
        {/* NOT-READY IS SAID OUT LOUD, HERE (operator ruling, 2026-08-02).
            The selected domain reporting zero invariants is the single most
            important fact on this panel — an agent package built against it
            tells a reviewer, accurately, that there is nothing to review. It
            must never be something an operator has to infer from a check
            list further down. */}
        {data && !(data as { reviewPackageReady?: boolean }).reviewPackageReady ? (
          <p className="mb-2 flex items-start gap-1.5 rounded border border-amber-900/40 bg-amber-950/20 p-2 text-[11px] leading-snug text-amber-200">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              This crystal candidate is <strong>not review-ready</strong> in domain{" "}
              <span className="font-mono">{domain}</span>. Any agent package built now will say so — check the
              crystal/domain selection before handing it to a reviewer.
            </span>
          </p>
        ) : null}
        <p className="mb-2 text-[11px] leading-relaxed text-slate-400">
          Preparing a crystal for freeze is engineering; freezing a crystal is a separate constitutional act the
          operator alone performs, outside this panel. Nothing here writes to the corpus or marks anything frozen.
        </p>
        <input
          className={FIELD}
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="crystal domain (e.g. constitutional-reasoning)"
        />
        {error && (
          <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-[11px] text-rose-200">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            {error}
          </div>
        )}
      </div>

      {recommendation && (
        <div className={PANEL}>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-100">Freeze Recommendation</h4>
            <span
              className={`rounded px-2 py-0.5 text-[11px] font-semibold border ${
                recommendation.verdict === "READY_FOR_FREEZE"
                  ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
                  : "text-amber-300 border-amber-500/40 bg-amber-500/10"
              }`}
            >
              {recommendation.verdict}
            </span>
          </div>
          <div className="space-y-1">
            {recommendation.rationale.map((r) => (
              <div key={r.id} className="flex items-start gap-1.5 text-[11px]">
                <span className={r.satisfied ? "text-emerald-300" : "text-rose-300"}>{r.satisfied ? "☑" : "☐"}</span>
                <span className="text-slate-300">{r.label}</span>
              </div>
            ))}
          </div>
          {recommendation.remainingRisks.length > 0 && (
            <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-amber-200">Remaining risks</div>
              <ul className="list-disc space-y-0.5 pl-4 text-[11px] leading-relaxed text-amber-100">
                {recommendation.remainingRisks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{recommendation.advisoryNote}</p>
        </div>
      )}

      {readiness && (
        <div className={PANEL}>
          <h4 className="mb-2 text-xs font-semibold text-slate-100">Crystal Readiness Report (9 checks)</h4>
          <div className="space-y-1.5">
            {readiness.checks.map((c) => (
              <div key={c.name} className="rounded-lg border border-slate-800 bg-slate-900/40 p-2">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className={c.passed ? "text-emerald-300" : "text-rose-300"}>{c.passed ? "PASS" : "FAIL"}</span>
                  <span className="font-mono text-slate-300">{c.name}</span>
                </div>
                <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">{c.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {statistics && (
        <div className={PANEL}>
          <h4 className="mb-2 text-xs font-semibold text-slate-100">Crystal Statistics — birth certificate</h4>
          <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-400 sm:grid-cols-3">
            {Object.entries(statistics)
              .filter(([k]) => !["computedAt", "externalSources", "standingDistribution", "coverageEstimate", "substrateError"].includes(k))
              .map(([k, v]) => (
                <div key={k}>
                  <span className="text-slate-500">{k}</span>{" "}
                  <span className="text-slate-200">{typeof v === "number" ? v.toFixed?.(3) ?? String(v) : String(v)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {!reviewerMode && (
      <div className={PANEL}>
        <h4 className="mb-1 text-xs font-semibold text-slate-100">Preview a freeze ceremony package</h4>
        <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
          Builds the package an operator would review before ratifying a freeze — identifier, content hash, corpus
          statistics, limitations, domain boundary, rationale. <span className="text-slate-200">This button never freezes anything.</span> Actual ratification happens outside this UI via the operator's own governed act.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input className={FIELD} value={operatorRef} onChange={(e) => setOperatorRef(e.target.value)} placeholder="operator reference (required)" />
          <input className={FIELD} value={reviewerRef} onChange={(e) => setReviewerRef(e.target.value)} placeholder="reviewer reference (optional)" />
        </div>
        <input
          className={`${FIELD} mt-2`}
          value={domainBoundary}
          onChange={(e) => setDomainBoundary(e.target.value)}
          placeholder="domain boundary — what this crystal covers, and does not (required)"
        />
        <input
          className={`${FIELD} mt-2`}
          value={rationaleText}
          onChange={(e) => setRationaleText(e.target.value)}
          placeholder="freeze rationale — why now (required)"
        />
        <button
          onClick={() => void runCeremonyPreview()}
          disabled={previewBusy || !operatorRef.trim() || !domainBoundary.trim() || !rationaleText.trim()}
          className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-slate-800/60 disabled:opacity-50"
        >
          {previewBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
          Preview package (no freeze)
        </button>

        {previewError && (
          <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-[11px] text-rose-200">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            {previewError}
          </div>
        )}

        {pkg && (
          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/40 p-2.5 text-[11px] text-slate-300">
            <div>
              content hash <span className="font-mono text-slate-200">{pkg.contentHash?.slice(0, 24)}…</span>
            </div>
            <div>signatories: {pkg.signatories?.join(", ") || "—"}</div>
            <div>
              eligible for ratification:{" "}
              <span className={pkg.eligibleForRatification ? "text-emerald-300" : "text-amber-300"}>
                {String(pkg.eligibleForRatification)}
              </span>
            </div>
            <div>DVN anchor: {String(pkg.dvnAnchorRef)} (populated only once the real freeze executes)</div>
            <div className="mt-1 text-[10px] text-slate-500">
              {String((previewResult as Record<string, unknown> | null)?.note ?? "")}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function SummaryPanel({ result }: { result: Record<string, unknown> }) {
  const s = (result.summary ?? {}) as Record<string, unknown>;
  const classC = (s.classC ?? {}) as Record<string, unknown>;
  const tally = result.tally as Record<string, number> | undefined;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-100">Package summary</h3>
      <div className="grid gap-1 text-[11px] text-slate-400 sm:grid-cols-2">
        <div>
          corpus rows <span className="text-slate-200">{String(s.corpusRowCount ?? "—")}</span>
        </div>
        <div>
          in boundary <span className="text-slate-200">{String(s.inBoundaryCount ?? "—")}</span> · outside{" "}
          <span className="text-slate-200">{String(s.outOfBoundaryCount ?? "—")}</span>
        </div>
        <div>
          rows enumerated individually <span className="text-slate-200">{String(s.individuallyEnumerated ?? "—")}</span>
        </div>
        <div>
          mechanically flagged <span className="text-slate-200">{String(s.mechanicallyFlagged ?? "—")}</span>
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/40 p-2.5 text-[11px] text-slate-400">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Class C block decision</div>
        <p className="text-slate-300">
          {String(classC.assessed ?? "—")} assessed under the block rule → {String(classC.admitted ?? "—")} admitted
          through the class decision → {String(classC.extracted ?? "—")} flagged for individual review
        </p>
        <p className="mt-1 text-[10px] text-slate-500">
          The extracted count is computed by running every exception rule over every row. A zero here would be an
          outcome, not a default.
        </p>
      </div>
      {tally && (
        <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
          <span className="text-emerald-300">{tally.agreed} agreed</span>
          <span className="text-amber-300">{tally.contested} contested</span>
          <span className="text-rose-300">{tally.rejected} rejected</span>
          <span className="text-slate-400">{tally.unknown} unknown (fails closed)</span>
        </div>
      )}
    </div>
  );
}

function ResultPanel({
  detail,
  reviewId,
  canRemedy,
  onRemedied,
}: {
  detail: Record<string, unknown>;
  reviewId: string | null;
  canRemedy: boolean;
  onRemedied: () => void;
}) {
  const review = (detail.review ?? {}) as Record<string, unknown>;
  const tally = (review.tally ?? {}) as Record<string, number>;
  const contested = (review.contested ?? []) as ContestedRow[];
  const [openRecord, setOpenRecord] = useState<ContestedRow | null>(null);
  const limitations = (review.limitations ?? []) as string[];
  const reviewers = (review.reviewers ?? []) as Array<Record<string, unknown>>;
  const supersededBy = review.supersededBy as string | null | undefined;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-mono text-xs text-slate-200">{String(review.reviewId ?? "")}</h3>
        <span className="text-[10px] text-slate-500">{String(review.queueState ?? "")}</span>
      </div>
      {supersededBy && (
        <div className="mb-3 rounded-lg border border-slate-600 bg-slate-800/60 p-2.5 text-[11px] text-slate-300">
          <p className="font-semibold uppercase tracking-wide text-slate-200">Superseded</p>
          <p className="mt-1">
            This {String(review.queueState ?? "")} review was replaced by{" "}
            <span className="font-mono text-slate-100">{supersededBy}</span>.
          </p>
          <p className="mt-1 text-slate-400">No governed resolution may be recorded against this row.</p>
        </div>
      )}
      <div className="mb-3 flex flex-wrap gap-3 text-[11px]">
        <span className="text-emerald-300">{tally.agreed ?? 0} agreed</span>
        <span className="text-amber-300">{tally.contested ?? 0} contested</span>
        <span className="text-rose-300">{tally.rejected ?? 0} rejected</span>
        <span className="text-slate-400">{tally.unknown ?? 0} unknown</span>
      </div>

      <div className="mb-3 space-y-1 text-[11px] text-slate-400">
        {reviewers.map((a) => (
          <div key={String(a.reviewerSlot)}>
            <span className="text-slate-300">{String(a.reviewerSlot)}</span>{" "}
            {a.reviewerType === "human" ? (
              <>human · {String(a.humanReviewerRef ?? "")}</>
            ) : (
              <>
                requested <span className="font-mono">{String(a.requestedModelId ?? "")}</span> → resolved{" "}
                <span className="font-mono">{String(a.resolvedModelId ?? "")}</span> · family{" "}
                {String(a.modelFamily ?? "unknown")}
              </>
            )}
          </div>
        ))}
      </div>

      {contested.length > 0 && (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-amber-200">
            Contested — excluded pending governed resolution
          </div>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {contested.map((c) => (
              <button
                key={String(c.subjectRef)}
                type="button"
                onClick={() => setOpenRecord(c)}
                className="flex w-full items-center justify-between gap-2 rounded border border-transparent px-1 py-0.5 text-left text-[11px] text-amber-100 transition hover:border-amber-500/30 hover:bg-amber-500/10"
              >
                <span>
                  <span className="font-mono">{String(c.subjectRef)}</span> — R1{" "}
                  <span className="font-semibold">{String(c.reviewer1Decision ?? "—")}</span> vs R2{" "}
                  <span className="font-semibold">{String(c.reviewer2Decision ?? "—")}</span>
                </span>
                <Eye className="h-3 w-3 shrink-0 text-amber-300/60" aria-hidden="true" />
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-amber-200/70">
            Both labels are carried verbatim. Nothing is averaged — a contested row is a fact about the evidence.
            Open a row to read both reviewers in full.
          </p>
        </div>
      )}

      {limitations.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Stated limitations</div>
          <ul className="list-disc pl-4 text-[11px] leading-relaxed text-slate-400">
            {limitations.slice(0, 12).map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}

      {openRecord && reviewId && (
        <ContestedRecordModal
          reviewId={reviewId}
          record={openRecord}
          canRemedy={canRemedy}
          onClose={() => setOpenRecord(null)}
          onRemedied={() => {
            setOpenRecord(null);
            onRemedied();
          }}
        />
      )}
    </div>
  );
}

// ── Record-level inspection and remedy (operator ruling, 2026-08-02) ─────────

/** A contested row as the detail route returns it, with both decisions attached. */
interface ContestedDecision {
  decision: string;
  reason: string;
  evidenceRefs?: string[];
  limitations?: string[];
  reviewedAt?: string;
  rawOutputRef?: string;
  outputHash?: string;
  reviewerRef?: string;
  confidence?: number;
}

interface ContestedRow {
  subjectRef: string;
  reviewer1Decision?: string;
  reviewer2Decision?: string;
  resolutionReason?: string;
  r1?: ContestedDecision | null;
  r2?: ContestedDecision | null;
}

/** One reviewer's side of the dispute, verbatim. */
function DecisionColumn({ slot, decision }: { slot: string; decision: ContestedDecision | null | undefined }) {
  if (!decision) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <div className="text-[10px] uppercase tracking-wide text-slate-500">{slot}</div>
        {/* Absent, not empty. A missing second pass is not a passing second
            pass — rendering it as a blank decision would read as agreement. */}
        <p className="mt-1 text-[11px] text-amber-300">No decision was returned for this subject.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">{slot}</span>
        <span className="font-mono text-[11px] font-semibold text-slate-100">{decision.decision}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300">{decision.reason}</p>
      {(decision.evidenceRefs ?? []).length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Evidence cited</div>
          <ul className="mt-0.5 list-disc pl-4 text-[10px] text-slate-400">
            {(decision.evidenceRefs ?? []).map((e, i) => (
              <li key={i} className="font-mono break-all">{e}</li>
            ))}
          </ul>
        </div>
      )}
      {(decision.limitations ?? []).length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Stated limitations</div>
          <ul className="mt-0.5 list-disc pl-4 text-[10px] text-slate-400">
            {(decision.limitations ?? []).map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-2 space-y-0.5 text-[10px] text-slate-500">
        {decision.reviewerRef && <div>by <span className="font-mono">{decision.reviewerRef}</span></div>}
        {decision.reviewedAt && <div>{decision.reviewedAt}</div>}
        {/* The commitment over the reviewer's raw output. This is what makes
            the decision above checkable rather than merely reported. */}
        {decision.outputHash && <div className="break-all">output {decision.outputHash}</div>}
        {decision.rawOutputRef && <div className="break-all">raw {decision.rawOutputRef}</div>}
        {typeof decision.confidence === "number" && (
          <div>
            self-reported confidence {decision.confidence} — carried, never combined
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The contested-record modal.
 *
 * READ for everyone who can reach the review; REMEDY only where `canRemedy`.
 * The remedy is deliberately not a free-text label field: the steward chooses
 * between the labels the reviewers actually returned, or defers. A third label
 * would be a new finding with no reviewer behind it, and the route refuses one
 * (`unsupported-operator-label`) whatever this form offers.
 */
function ContestedRecordModal({
  reviewId,
  record,
  canRemedy,
  onClose,
  onRemedied,
}: {
  reviewId: string;
  record: ContestedRow;
  canRemedy: boolean;
  onClose: () => void;
  onRemedied: () => void;
}) {
  const [choice, setChoice] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<{ code?: string; message: string } | null>(null);

  // Only labels a reviewer actually returned, de-duplicated. Derived from the
  // record — never a hardcoded rubric list, which would drift the moment the
  // rubric changed and would offer labels nobody in this dispute gave.
  const labels = useMemo(
    () =>
      [record.reviewer1Decision, record.reviewer2Decision].filter(
        (l, i, arr): l is string => typeof l === "string" && l.length > 0 && arr.indexOf(l) === i,
      ),
    [record.reviewer1Decision, record.reviewer2Decision],
  );

  const submit = useCallback(
    async (remedy: "adopt" | "defer") => {
      if (!reason.trim()) {
        setRefusal({ message: "State a reason — an unreasoned remedy is a stray click in the artifact." });
        return;
      }
      if (remedy === "adopt" && !choice) {
        setRefusal({ message: "Choose which reviewer's label stands, or defer." });
        return;
      }
      setBusy(true);
      setRefusal(null);
      try {
        const res = await personaFetch(
          `/api/research/review/${encodeURIComponent(reviewId)}/resolution`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subjectRef: record.subjectRef,
              remedy,
              ...(remedy === "adopt" ? { operatorDecision: choice } : {}),
              reason,
            }),
          },
        );
        const d = await res.json().catch(() => null);
        if (!d?.ok) {
          // The server's own words. A refusal explaining WHY the label was not
          // accepted is more useful than a generic failure, and paraphrasing it
          // would be inventing a reason the server did not give.
          setRefusal({ code: d?.refusalCode, message: d?.error ?? `the remedy was refused (HTTP ${res.status})` });
          return;
        }
        onRemedied();
      } catch (e) {
        setRefusal({ message: e instanceof Error ? e.message : "request failed" });
      } finally {
        setBusy(false);
      }
    },
    [reviewId, record.subjectRef, choice, reason, onRemedied],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Contested record ${record.subjectRef}`}
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/95 p-5 shadow-lg shadow-black/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-amber-300">Contested record</div>
            <h3 className="mt-0.5 break-all font-mono text-sm text-slate-100">{record.subjectRef}</h3>
            <p className="mt-1 text-[11px] text-slate-400">{record.resolutionReason ?? ""}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-900"
          >
            Close
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <DecisionColumn slot="Reviewer 1" decision={record.r1} />
          <DecisionColumn slot="Reviewer 2" decision={record.r2} />
        </div>

        {canRemedy ? (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <h4 className="text-xs font-semibold text-slate-100">Governed remedy</h4>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Ratify one of the labels above, or defer. A remedy resolves the dispute — it does not create a new
              finding, so no label the reviewers did not return is offered. It writes nothing to the corpus, grants
              no Standing, and freezes nothing.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {labels.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setChoice(l)}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] transition ${
                    choice === l
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                      : "border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-900"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Why this label stands (or why this row is deferred)"
              className={`${FIELD} mt-2 resize-y`}
            />
            {refusal && (
              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {refusal.code && <span className="font-mono">{refusal.code}: </span>}
                  {refusal.message}
                </span>
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !choice || !reason.trim()}
                onClick={() => void submit("adopt")}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-100 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Ratify {choice ?? "a label"}
              </button>
              <button
                type="button"
                disabled={busy || !reason.trim()}
                onClick={() => void submit("defer")}
                className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Defer this row
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
            This record is shown for inspection. Resolving a contested row is the Research Steward&apos;s act.
          </p>
        )}
      </div>
    </div>
  );
}
