"use client";

/**
 * CCRL Research Copilot — Aigent Z as research narrator + proposer
 * (CFS-019 Phase C2 narration + C2.1 research proposal kinds).
 *
 * DCIR-conforming from birth (CFS-020): this surface is the second
 * instrumented seam after the Dev Command Center D1 reference. The copilot's
 * PRIMARY mandate is to observe and narrate the live lab state (experiment
 * lifecycles derived from the canonical record, series claims, hash-committed
 * results).
 *
 * C2.1 (ICE reuse): aigentZ can now also PROPOSE structured research objects —
 * experiment designs, protocol ratifications, findings, publication drafts —
 * as ```research_data fences (services/research/proposals.ts). Each arrives via
 * onStageProposals and renders as a pending approval card (preview-then-
 * approve, mirroring the Dev Command Center's PendingProposalCard). On Approve,
 * applyResearchProposal commits the object into in-memory research state at its
 * lifecycle entry (or advances one legal step); an illegal lifecycle transition
 * is REJECTED and surfaced, never silently committed. SUGGEST-ONLY: nothing
 * commits without approval.
 *
 * C2.2 (persistence + receipted approvals): the optimistic in-memory apply is
 * kept for instant UI, then the approved proposal POSTs to
 * /api/research/objects (personaFetch — spine routes need the Bearer token),
 * where the server RE-RUNS the pure apply against persisted state, enforces
 * the T2 guard, upserts into research_objects, and receipts through the ONE
 * lifecycle path (recordExperimentTransition / recordResearchObjectCreated —
 * `research_lifecycle_transition`, DVN-anchorable). Each working object shows
 * its persist state ("persisted ✓ receipt <prefix>" or an inline error with
 * the object retained in memory — honest state, no silent loss). On load,
 * persisted objects hydrate the working panel (persisted wins on id
 * collision), so refresh no longer loses state.
 *
 * Two-pane split mirroring DevCommandCenterTab, economically:
 *   LEFT  = aigentZ copilot (SmartTriadCopilotLayer, panel variant)
 *   RIGHT = pending proposals + compact live panel + working objects
 *
 * DCIR observe-mode discipline: events (tab opened, overview refreshed,
 * quick prompt selected, proposal approved/dismissed) ride a session-scoped
 * ring buffer and feed the next copilot turn via groundContext.recentEvents.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle, ChevronDown, ClipboardCheck, FlaskConical, Landmark, Loader2, Play, RefreshCw, ScrollText } from "lucide-react";
import { SmartTriadCopilotLayer, type CopilotStageProposal } from "@/components/smarttriad/copilot/SmartTriadCopilotLayer";
import { experimentGet } from "./experimentStepFetch";
import { personaFetch } from "@/utils/personaSpine";
import type {
  ExperimentLifecycleState,
  ResearchExperiment,
  ResearchFinding,
  ResearchPublication,
} from "@/types/research";
import {
  applyResearchProposal,
  createEmptyResearchState,
  researchProposalKindLabel,
  RESEARCH_PROPOSAL_EFFECT,
  type ResearchProposal,
  type ResearchProposalKind,
  type ResearchProposalState,
} from "@/services/research/proposals";
import {
  RESEARCH_LOOP_STAGE_ORDER,
  researchStageForExperiment,
  researchStageActionable,
  researchStageProposalKind,
  researchStageLabel,
  type ResearchLoopStage,
} from "@/services/research/researchLoop";
import {
  surfaceOpenedEvent,
  surfaceDataRefreshedEvent,
  surfacePromptSelectedEvent,
} from "@/services/dcir/eventStream";
import { useDcirSeam } from "@/services/dcir/useDcirSeam";

const SURFACE = "ccrl-research";

interface OverviewEntry {
  experiment: { id: string; layer: string; family: string; seriesId: string };
  lifecycle: string;
  publishedRuns: number;
  distinctProviders: number;
  latestRunAt: string | null;
}

interface SeriesEntry {
  id: string;
  name: string;
  claim: string;
  members: string[];
}

interface ResultRow {
  id: string;
  experiment: string;
  provider: string;
  model: string;
  contentHash: string;
  createdAt: string;
}

interface CCRLResearchCopilotTabProps {
  personaId?: string;
}

/** A pending proposal with a stable local key for list rendering. */
interface PendingResearchProposal {
  key: string;
  proposal: ResearchProposal;
  /** Set when a prior Approve was rejected as an illegal lifecycle transition. */
  rejection?: string;
}

// ─── C2.2 persistence (per-object persist state + hydration merge) ───────────

type ResearchObjectKind = "experiment" | "finding" | "publication";

interface PersistStatus {
  status: "saving" | "persisted" | "error";
  receiptId?: string | null;
  error?: string;
}

/** A row from GET /api/research/objects (the durable lab record). */
interface PersistedResearchObject {
  objectKind: ResearchObjectKind;
  objectId: string;
  payload: Record<string, unknown>;
  lifecycleState: string;
  receiptId?: string | null;
}

const persistKey = (kind: ResearchObjectKind, id: string) => `${kind}:${id}`;

/** Fold persisted rows into the in-memory state — persisted wins on id
 * collision (the server re-validated and stored it; session memory yields). */
function mergePersistedObjects(
  prev: ResearchProposalState,
  rows: PersistedResearchObject[],
): ResearchProposalState {
  if (rows.length === 0) return prev;
  const experiments = [...prev.experiments];
  const findings = [...prev.findings];
  const publications = [...prev.publications];
  for (const row of rows) {
    if (row.objectKind === "experiment") {
      const entry = {
        experiment: row.payload as unknown as ResearchExperiment,
        lifecycle: row.lifecycleState as ExperimentLifecycleState,
      };
      const i = experiments.findIndex((e) => e.experiment.id === row.objectId);
      if (i >= 0) experiments[i] = entry;
      else experiments.push(entry);
    } else if (row.objectKind === "finding") {
      const entry = row.payload as unknown as ResearchFinding;
      const i = findings.findIndex((f) => f.id === row.objectId);
      if (i >= 0) findings[i] = entry;
      else findings.push(entry);
    } else if (row.objectKind === "publication") {
      const entry = row.payload as unknown as ResearchPublication;
      const i = publications.findIndex((p) => p.id === row.objectId);
      if (i >= 0) publications[i] = entry;
      else publications.push(entry);
    }
  }
  return { experiments, findings, publications, updatedAt: new Date().toISOString() };
}

/** The object a committed apply created/advanced — reference diff (untouched
 * entries keep their reference; changed ones are fresh objects). */
function committedObjectOf(
  prev: ResearchProposalState,
  next: ResearchProposalState,
  kind: ResearchProposalKind,
): { objectKind: ResearchObjectKind; objectId: string } | null {
  const effect = RESEARCH_PROPOSAL_EFFECT[kind];
  if (effect.object === "experiment") {
    const entry = next.experiments.find((e) => !prev.experiments.includes(e));
    return entry ? { objectKind: "experiment", objectId: entry.experiment.id } : null;
  }
  if (effect.object === "finding") {
    const entry = next.findings.find((f) => !prev.findings.includes(f));
    return entry ? { objectKind: "finding", objectId: entry.id } : null;
  }
  const entry = next.publications.find((p) => !prev.publications.includes(p));
  return entry ? { objectKind: "publication", objectId: entry.id } : null;
}

/** Honest per-object persist line: saving / persisted ✓ receipt <prefix> /
 * inline error (the object stays in session memory either way). */
function PersistLine({ status }: { status?: PersistStatus }) {
  if (!status) return null;
  if (status.status === "saving") {
    return <span className="text-[10px] text-slate-500">persisting…</span>;
  }
  if (status.status === "persisted") {
    return (
      <span className="text-[10px] text-emerald-400/80">
        persisted ✓{status.receiptId ? ` receipt ${status.receiptId.slice(0, 8)}` : ""}
        {status.error ? ` (${status.error})` : ""}
      </span>
    );
  }
  return (
    <span className="text-[10px] text-rose-400">
      not persisted — {status.error ?? "persist failed"} (kept in session memory)
    </span>
  );
}

// ─── Tolerant payload getters (mirror applyResearchProposal coercion) ────────

const pstr = (v: unknown): string => (typeof v === "string" ? v : "");
const pstrList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

function effectLine(kind: ResearchProposalKind): string {
  const e = RESEARCH_PROPOSAL_EFFECT[kind];
  if (e.action === "advance") return `advances experiment ${e.fromState} → ${e.toState} (lifecycle-legal)`;
  return `creates a ${e.object} at lifecycle ${e.entryState}`;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] text-amber-300/70 uppercase font-semibold mb-0.5">{label}</div>
      <div className="text-[11px] text-slate-200">{value}</div>
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-[10px] text-slate-500 italic">none</span>;
  return (
    <ul className="space-y-0.5">
      {items.map((it, i) => (
        <li key={i} className="text-[11px] text-slate-300 flex gap-1.5">
          <span className="text-slate-500 shrink-0">·</span>
          <span className="break-words">{it}</span>
        </li>
      ))}
    </ul>
  );
}

/** Per-kind full-content preview — review-then-approve is the flow. */
function ResearchProposalPreview({ proposal }: { proposal: ResearchProposal }) {
  const d = proposal.data;
  switch (proposal.kind) {
    case "experiment_proposal":
      return (
        <div className="space-y-2">
          <Field label="Experiment" value={<span className="font-mono">{pstr(d.id) || "(new id)"}</span>} />
          <div className="flex gap-4">
            <Field label="Layer" value={pstr(d.layer) || "I"} />
            <Field label="Series" value={pstr(d.seriesId) || "—"} />
          </div>
          <Field label="Family" value={pstr(d.family) || "—"} />
          <Field label="Hypothesis" value={pstr(d.hypothesis) || "—"} />
          <Field label="Protocol ref" value={<span className="font-mono text-[10px] text-slate-400 break-all">{pstr(d.protocolRef) || "—"}</span>} />
          <div>
            <div className="text-[10px] text-amber-300/70 uppercase font-semibold mb-0.5">Governing invariants</div>
            <Bullets items={pstrList(d.governingInvariants)} />
          </div>
        </div>
      );
    case "protocol_draft":
      return (
        <div className="space-y-2">
          <Field label="Experiment" value={<span className="font-mono">{pstr(d.experimentId) || "—"}</span>} />
          <Field label="Protocol ref" value={<span className="font-mono text-[10px] text-slate-400 break-all">{pstr(d.protocolRef) || "—"}</span>} />
          <Field label="Ratification evidence" value={pstr(d.evidence) || "—"} />
        </div>
      );
    case "finding":
      return (
        <div className="space-y-2">
          <Field label="From experiment" value={<span className="font-mono">{pstr(d.experimentId) || "—"}</span>} />
          <Field label="Claim" value={pstr(d.claim) || "—"} />
          <div>
            <div className="text-[10px] text-amber-300/70 uppercase font-semibold mb-0.5">Evidence refs (commitments)</div>
            <Bullets items={pstrList(d.evidenceRefs)} />
          </div>
          <div>
            <div className="text-[10px] text-amber-300/70 uppercase font-semibold mb-0.5">Governing invariants</div>
            <Bullets items={pstrList(d.governingInvariants)} />
          </div>
        </div>
      );
    case "publication_draft":
      return (
        <div className="space-y-2">
          <Field label="Title" value={pstr(d.title) || "—"} />
          <Field label="Kind" value={pstr(d.publicationKind) || "working"} />
          <div>
            <div className="text-[10px] text-amber-300/70 uppercase font-semibold mb-0.5">Source artifacts</div>
            <Bullets items={pstrList(d.sourceArtifacts)} />
          </div>
          <Field label="Abstract" value={pstr(d.abstract) || "—"} />
        </div>
      );
    default:
      return null;
  }
}

function PendingResearchProposalCard({ entry, onApprove, onDismiss }: {
  entry: PendingResearchProposal;
  onApprove: () => void;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { proposal, rejection } = entry;
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="text-[10px] uppercase tracking-wide text-amber-300 font-semibold">
          Proposed by aigentZ — review, then approve
        </span>
      </div>
      <div className="text-xs font-semibold text-white">
        {researchProposalKindLabel(proposal.kind)}: {proposal.summary}
      </div>
      <div className="text-[11px] text-slate-300">On approve: {effectLine(proposal.kind)}</div>

      <div className={`rounded border border-amber-500/20 bg-slate-900/40 p-2 overflow-y-auto ${expanded ? "max-h-[60vh]" : "max-h-56"}`}>
        <ResearchProposalPreview proposal={proposal} />
      </div>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-1 text-[10px] text-amber-300/80 hover:text-amber-200 transition-colors"
      >
        <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        {expanded ? "Collapse preview" : "Expand preview"}
      </button>

      {rejection && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-300">
          Rejected — {rejection}. Ask aigentZ to revise, then approve the fresh card.
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onApprove}
          className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors font-semibold"
        >
          <CheckCircle className="w-3 h-3" />
          Approve
        </button>
        <button
          onClick={onDismiss}
          className="text-[10px] px-2.5 py-1 rounded bg-slate-700/40 text-slate-300 border border-slate-600/40 hover:bg-slate-700/70 transition-colors"
        >
          Dismiss
        </button>
        <span className="text-[10px] text-slate-500 ml-1">
          or ask aigentZ to refine it — a fresh card replaces this one
        </span>
      </div>
    </div>
  );
}

// ─── C3 research ICE loop — stage strip + Run-stage lab hand-off ─────────────

// The visible loop cadence (design → protocol → run → analyze → publish); the
// terminal `replicated` state is shown as an all-done badge, not a strip cell.
const LOOP_STRIP_STAGES = RESEARCH_LOOP_STAGE_ORDER.filter((s) => s !== "replicated");

/**
 * The Feedback Coordinator auto-turn text for a stage-advancing approval. Always
 * prefixed `[observed]` — the chat route treats an `[observed]` turn as an
 * observation-initiated proactive guide (short, not a recap). At the RUN stage
 * (run-in-lab) it points to the Experiment Lab and never asks for a fence;
 * otherwise it names the next stage's proposal kind.
 */
function researchAdvanceGuidance(experimentId: string, nextStage: ResearchLoopStage): string {
  const actionable = researchStageActionable(nextStage);
  if (actionable === "run-in-lab") {
    return `[observed] ${experimentId}'s protocol is ratified and the research loop advanced to the Run stage. The next step is to run ${experimentId} in the Experiment Lab (the EXP-001…005 runner tabs) — running is executed there, not by you. Point me to the lab; when results are in I'll help you record the finding.`;
  }
  if (actionable === "complete") {
    return `[observed] ${experimentId} reached the Replicated stage (runs on ≥2 providers). Guide me on what to consolidate or publish next.`;
  }
  const kind = researchStageProposalKind(nextStage);
  return `[observed] The proposal was approved and ${experimentId}'s research loop advanced to the ${nextStage} stage. Guide me to the next task${kind ? ` and, when ready, produce the ${kind} proposal` : ""}.`;
}

/** The staged loop strip for the active experiment — mirrors the derived
 * lifecycle strip visual, but over the ICE loop stages. Current stage is
 * violet-highlighted; past stages are emerald-done. */
function ResearchLoopStrip({ stage }: { stage: ResearchLoopStage }) {
  const curIdx = stage === "replicated" ? LOOP_STRIP_STAGES.length : LOOP_STRIP_STAGES.indexOf(stage);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {LOOP_STRIP_STAGES.map((s, i) => {
        const isCurrent = s === stage;
        const isPast = i < curIdx;
        return (
          <React.Fragment key={s}>
            {i > 0 && (
              <ArrowRight className={`h-3 w-3 shrink-0 ${isPast || isCurrent ? "text-emerald-400/40" : "text-slate-700"}`} />
            )}
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] border ${
                isCurrent
                  ? "bg-violet-500/20 text-violet-300 border-violet-500/40 font-semibold"
                  : isPast
                    ? "bg-emerald-500/10 text-emerald-300/70 border-emerald-500/20"
                    : "bg-slate-800/40 text-slate-600 border-slate-700/40"
              }`}
            >
              {researchStageLabel(s)}
            </span>
          </React.Fragment>
        );
      })}
      {stage === "replicated" && (
        <span className="ml-1 rounded px-1.5 py-0.5 text-[10px] bg-green-500/20 text-green-300 border border-green-500/40 font-semibold">
          Replicated
        </span>
      )}
    </div>
  );
}

/**
 * The Run-stage card — the CONSTITUTIONAL boundary made honest in the UI. The
 * research analog of the Dev Command Center's "execution stays human": running
 * is EXECUTED in the Experiment Lab (the EXP-001…005 runner tabs), never in the
 * copilot. The hand-off is now ONE CLICK via the cartridge-agnostic
 * `codex:navigate-tab` intra-cartridge nav seam (mirrors KNYT's
 * `knyt:navigate-tab`; the viewer listens and switches to `ccrl-experiment-lab`).
 * This is navigation, NOT execution — the copilot still never runs the
 * experiment; it just takes the operator to where they run it. The lab run
 * advances the lifecycle, which re-derives the loop to Analyze on the next
 * refresh (C2.2 hydration).
 */
function RunStageCard({ experimentId, lifecycle, onGoToLab }: { experimentId: string | null; lifecycle: ExperimentLifecycleState | null; onGoToLab: () => void }) {
  return (
    <div className="rounded-xl border border-indigo-700/50 bg-indigo-950/20 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Play className="h-4 w-4 text-indigo-300" />
        <h4 className="text-xs font-semibold text-slate-100">Run stage — hand off to the Experiment Lab</h4>
      </div>
      <p className="text-[11px] text-slate-300">
        {experimentId ? <span className="font-mono text-slate-200">{experimentId}</span> : "The active experiment"} is
        {lifecycle === "running" ? " running" : " ratified and ready to run"}. Running is EXECUTED in the{" "}
        <span className="text-indigo-300 font-semibold">Experiment Lab</span> (the EXP-001…005 runner tabs) — not here.
        Execution stays in the lab; the copilot never runs an experiment.
      </p>
      <button
        type="button"
        onClick={onGoToLab}
        className="inline-flex items-center gap-1.5 rounded border border-indigo-500/40 bg-indigo-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-100 hover:bg-indigo-500/25 hover:text-white transition"
      >
        <Play className="h-3 w-3" />
        Open the Experiment Lab{experimentId ? ` to run ${experimentId}` : ""}
      </button>
      <p className="text-[10px] text-slate-500">
        The run produces a canonical, hash-committed result that advances the experiment&apos;s lifecycle
        (running → evaluated → published). When results are in, refresh here and the loop moves to Analyze —
        I&apos;ll help you record the finding.
      </p>
    </div>
  );
}

export default function CCRLResearchCopilotTab({ personaId }: CCRLResearchCopilotTabProps) {
  const [overview, setOverview] = useState<OverviewEntry[] | null>(null);
  const [series, setSeries] = useState<SeriesEntry[]>([]);
  const [lifecycleOrder, setLifecycleOrder] = useState<string[]>([]);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ── DCIR observation seam (CFS-020) — observe-mode ONLY, adopted via the D4
  // universal substrate hook (useDcirSeam) rather than a hand-wired block: the
  // last named D4 follow-on (CFS-020 §142). Session-scoped ring buffer; the next
  // copilot turn reads the compacted tail via `groundObservation`. Surface-only
  // snapshot — behaviour-identical to the prior hand-wired seam (this surface's
  // stage/experiment were not threaded into the snapshot before, and are not now;
  // threading them is an optional micro-follow-on, not part of this swap).
  const { observe, groundObservation } = useDcirSeam({ surface: SURFACE });

  // ── C2.1 research proposals — SUGGEST-ONLY, operator-gated. Pending cards
  // await approval; committed objects live in in-memory research state,
  // persisted to research_objects on approve (C2.2). Nothing auto-commits.
  const [pending, setPending] = useState<PendingResearchProposal[]>([]);
  const [researchState, setResearchState] = useState<ResearchProposalState>(() => createEmptyResearchState());
  const proposalSeq = useRef(0);

  // ── C2.2 persistence — per-object persist state (keyed `${kind}:${id}`)
  // and honest degradation when the persisted record is unreachable.
  const [persistStatus, setPersistStatus] = useState<Record<string, PersistStatus>>({});
  const [hydrateError, setHydrateError] = useState<string | null>(null);

  // ── C3 research ICE loop — the ACTIVE experiment the loop is scoped to.
  // Null ⇒ the most-recently-touched working experiment (or none ⇒ Design). An
  // approval that creates/advances an experiment sets it active.
  const [activeExperimentId, setActiveExperimentId] = useState<string | null>(null);

  // ── C3 Feedback Coordinator (mirrors DevCommandCenterTab.autoPrompt): on a
  // stage-ADVANCING approval, mint ONE `[observed]` auto-turn so the copilot
  // proactively guides the next step. Never minted on dismissals; never from an
  // auto-turn (an auto-turn approves nothing).
  const [autoPrompt, setAutoPrompt] = useState<{ id: string; text: string } | null>(null);

  // Fired after each chat turn with the proposals the server extracted from
  // aigentZ's ```research_data fences. Append non-empty batches (a refine emits
  // a fresh full proposal — the operator approves/dismisses each). An empty
  // batch (a pure narrate turn) never wipes unreviewed cards.
  const onStageProposals = useCallback((incoming: CopilotStageProposal[]) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return;
    setPending(prev => [
      ...prev,
      ...incoming.map(p => ({
        key: `rp-${proposalSeq.current++}`,
        proposal: { kind: p.kind as ResearchProposalKind, summary: p.summary, data: p.data } as ResearchProposal,
      })),
    ]);
  }, []);

  // C2.2 — persist an approved proposal to the durable lab record. MUST ride
  // personaFetch (spine-resolving route — raw fetch silently 401s). Failure
  // surfaces inline on the working object; it stays in session memory.
  const persistApproved = useCallback(async (
    proposal: ResearchProposal,
    committed: { objectKind: ResearchObjectKind; objectId: string },
  ) => {
    const key = persistKey(committed.objectKind, committed.objectId);
    setPersistStatus(prev => ({ ...prev, [key]: { status: "saving" } }));
    try {
      const res = await personaFetch("/api/research/objects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: proposal.kind, proposal }),
      });
      const text = await res.text();
      let data: Record<string, unknown> | null = null;
      if (text.trim().length > 0) {
        try { data = JSON.parse(text) as Record<string, unknown>; } catch { /* non-JSON body — handled below */ }
      }
      if (!res.ok || !data || data.ok !== true) {
        const error =
          (data && typeof data.error === "string" && data.error) || `HTTP ${res.status}`;
        setPersistStatus(prev => ({ ...prev, [key]: { status: "error", error } }));
        return;
      }
      setPersistStatus(prev => ({
        ...prev,
        [key]: {
          status: "persisted",
          receiptId: typeof data.receiptId === "string" ? data.receiptId : null,
          ...(typeof data.receiptError === "string" ? { error: data.receiptError } : {}),
        },
      }));
    } catch (err) {
      setPersistStatus(prev => ({
        ...prev,
        [key]: { status: "error", error: err instanceof Error ? err.message : "persist failed" },
      }));
    }
  }, []);

  const approveProposal = useCallback((key: string) => {
    const entry = pending.find(e => e.key === key);
    if (!entry) return;
    const result = applyResearchProposal(researchState, entry.proposal);
    if (!result.committed) {
      // Illegal lifecycle transition — surface the reason IN PLACE, keep the
      // card, never commit (Content Capsule Containment: no orphan output).
      observe(surfacePromptSelectedEvent(SURFACE, `proposal rejected: ${researchProposalKindLabel(entry.proposal.kind)}`));
      setPending(prev => prev.map(e => (e.key === key ? { ...e, rejection: result.rejection } : e)));
      return;
    }
    // Optimistic in-memory apply (instant UI), then persist + receipt (C2.2).
    setResearchState(result.state);
    setPending(prev => prev.filter(e => e.key !== key));
    observe(surfacePromptSelectedEvent(SURFACE, `proposal approved: ${researchProposalKindLabel(entry.proposal.kind)} — ${entry.proposal.summary}`));
    const committed = committedObjectOf(researchState, result.state, entry.proposal.kind);
    if (committed) void persistApproved(entry.proposal, committed);

    // ── C3 flow-through (mirrors DCC handleApproveProposal): when the approval
    // advanced the ACTIVE experiment's lifecycle, advance the loop stage and
    // mint the Feedback Coordinator auto-turn guiding the next step. The active
    // experiment is the one just created/advanced (experiment proposals), else
    // the standing active one. Finding / publication approvals do NOT advance
    // the experiment lifecycle (analyze→publish is gated on a lab run reaching
    // `published`), so they mint no auto-turn — honest, not synthetic progress.
    const nextActiveId =
      committed?.objectKind === "experiment" ? committed.objectId : activeExperimentId;
    if (committed?.objectKind === "experiment") setActiveExperimentId(committed.objectId);
    if (nextActiveId) {
      const prevExp = researchState.experiments.find(e => e.experiment.id === nextActiveId) ?? null;
      const nextExp = result.state.experiments.find(e => e.experiment.id === nextActiveId) ?? null;
      const prevStage = researchStageForExperiment(prevExp);
      const nextStage = researchStageForExperiment(nextExp);
      if (RESEARCH_LOOP_STAGE_ORDER.indexOf(nextStage) > RESEARCH_LOOP_STAGE_ORDER.indexOf(prevStage)) {
        observe(surfacePromptSelectedEvent(SURFACE, `loop advanced: ${prevStage} → ${nextStage} (${nextActiveId})`));
        setAutoPrompt({
          id: `auto-research-${nextActiveId}-${nextStage}-${Date.now()}`,
          text: researchAdvanceGuidance(nextActiveId, nextStage),
        });
      }
    }
  }, [pending, researchState, activeExperimentId, observe, persistApproved]);

  const dismissProposal = useCallback((key: string) => {
    setPending(prev => prev.filter(e => e.key !== key));
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    let expCount = 0;
    let resultCount = 0;
    try {
      const data = await experimentGet("/api/research/overview");
      const entries = (data.experiments as OverviewEntry[]) ?? [];
      setOverview(entries);
      setSeries((data.series as SeriesEntry[]) ?? []);
      setLifecycleOrder((data.lifecycleOrder as string[]) ?? []);
      setOverviewError(null);
      expCount = entries.length;
    } catch (err) {
      // Degrade honestly — the copilot is told the overview is unavailable.
      setOverviewError(err instanceof Error ? err.message : "overview unavailable");
    }
    try {
      const data = await experimentGet("/api/experiments/results");
      const rows = (data.results as ResultRow[]) ?? [];
      setResults(rows);
      setResultsError(null);
      resultCount = rows.length;
    } catch (err) {
      setResultsError(err instanceof Error ? err.message : "results unavailable");
    }
    // C2.2 — hydrate the working panel from the persisted lab record so a
    // refresh no longer loses approved objects. Persisted wins on id
    // collision; an in-flight save is never clobbered by hydration.
    try {
      const data = await experimentGet("/api/research/objects");
      const rows = (data.objects as PersistedResearchObject[]) ?? [];
      setResearchState(prev => mergePersistedObjects(prev, rows));
      setPersistStatus(prev => {
        const next = { ...prev };
        for (const row of rows) {
          const key = persistKey(row.objectKind, row.objectId);
          if (next[key]?.status === "saving") continue;
          next[key] = { status: "persisted", receiptId: row.receiptId ?? null };
        }
        return next;
      });
      setHydrateError(null);
    } catch (err) {
      setHydrateError(err instanceof Error ? err.message : "persisted objects unavailable");
    }
    setRefreshing(false);
    observe(surfaceDataRefreshedEvent(SURFACE, `${expCount} experiments · ${resultCount} canonical results`));
  }, [observe]);

  const openedRef = useRef(false);
  useEffect(() => {
    if (!openedRef.current) {
      openedRef.current = true;
      observe(surfaceOpenedEvent(SURFACE));
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Run-stage hand-off (C3 loop tightening, 2026-07-07): one-click navigation to
  // the Experiment Lab tab via the cartridge-agnostic `codex:navigate-tab` seam
  // the viewer listens for (mirrors KNYT's `knyt:navigate-tab`). This is
  // NAVIGATION, not execution — running still happens in the lab; the copilot
  // never runs the experiment. Observed as a surface interaction.
  const goToExperimentLab = useCallback(() => {
    observe(surfacePromptSelectedEvent(SURFACE, 'run hand-off: opened the Experiment Lab'));
    try {
      window.dispatchEvent(new CustomEvent('codex:navigate-tab', { detail: { tab: 'ccrl-experiment-lab' } }));
    } catch { /* non-fatal — the honest pointer text still names the tab */ }
  }, [observe]);

  // ── C3 research ICE loop — the pool of experiments the loop can scope to.
  // Working objects (approved/persisted copilot proposals) override overview
  // (registry-derived) entries on id collision, matching the persisted-wins rule
  // used elsewhere. Every entry carries a lifecycle → a loop stage.
  const loopExperiments = useMemo(() => {
    const map = new Map<string, { id: string; family: string; lifecycle: ExperimentLifecycleState }>();
    for (const o of overview ?? []) {
      map.set(o.experiment.id, {
        id: o.experiment.id,
        family: o.experiment.family,
        lifecycle: o.lifecycle as ExperimentLifecycleState,
      });
    }
    for (const e of researchState.experiments) {
      map.set(e.experiment.id, { id: e.experiment.id, family: e.experiment.family, lifecycle: e.lifecycle });
    }
    return Array.from(map.values());
  }, [overview, researchState.experiments]);

  // The ACTIVE experiment: the operator's explicit pick, else the most-recently-
  // touched working object, else the last known experiment. Null ⇒ Design (no
  // experiment yet — the operator's first move is to design one).
  const activeExperiment = useMemo(() => {
    if (loopExperiments.length === 0) return null;
    const byId = activeExperimentId ? loopExperiments.find(e => e.id === activeExperimentId) : undefined;
    const lastWorkingId =
      researchState.experiments.length > 0
        ? researchState.experiments[researchState.experiments.length - 1].experiment.id
        : null;
    const lastWorking = lastWorkingId ? loopExperiments.find(e => e.id === lastWorkingId) : undefined;
    return byId ?? lastWorking ?? loopExperiments[loopExperiments.length - 1];
  }, [loopExperiments, activeExperimentId, researchState.experiments]);

  const activeStage: ResearchLoopStage = researchStageForExperiment(activeExperiment);

  // ── Ground context — the observed state the copilot narrates (T2-safe:
  // ids, families, lifecycle states, counts, hash prefixes — never bodies).
  const copilotGroundContext = useMemo(() => ({
    surface: SURFACE,
    lifecycleOrder,
    // C3 — the active experiment's ICE loop stage; the chat route narrows the
    // research instruction block to this stage's proposal kind (run → no kind).
    activeExperimentStage: activeStage,
    activeExperimentId: activeExperiment?.id ?? null,
    experiments: (overview ?? []).map(o => ({
      id: o.experiment.id,
      family: o.experiment.family,
      lifecycle: o.lifecycle,
      publishedRuns: o.publishedRuns,
      distinctProviders: o.distinctProviders,
    })),
    series: series.map(s => ({ id: s.id, name: s.name, claim: s.claim, members: s.members })),
    recentResults: (results ?? []).slice(0, 5).map(r => ({
      experiment: r.experiment,
      provider: r.provider,
      contentHashPrefix: r.contentHash.slice(0, 12),
      createdAt: r.createdAt,
    })),
    overviewError,
    resultsError,
    // DCIR observation seam (D4 useDcirSeam): recentEvents (last ~12 compacted)
    // + D2 stateSnapshot + observedPatterns, spread from the hook's memoized
    // ground observation. Observations the copilot may gently adapt to, NEVER
    // rules (CFS-020 §6). Session-scoped; nothing persists, nothing gates (§9).
    ...groundObservation,
  }), [overview, series, lifecycleOrder, results, overviewError, resultsError, groundObservation, activeStage, activeExperiment]);

  const quickPrompts = useMemo(() => [
    "Where does the research programme stand?",
    "Which experiments need runs?",
    "Summarize the latest canonical results",
    "What would advance the sovereignty gate?",
  ].map(label => ({
    label,
    prompt: label,
    onSelect: () => observe(surfacePromptSelectedEvent(SURFACE, label)),
  })), [observe]);

  return (
    <div className="h-[calc(100vh-96px)] flex flex-col lg:flex-row gap-2 px-2 pr-3 overflow-hidden">
      {/* ── LEFT: aigentZ research copilot ─────────────────────── */}
      <div className="lg:w-1/2 w-full h-full min-h-0 flex flex-col">
        <SmartTriadCopilotLayer
          isOpen
          variant="panel"
          quickPrompts={quickPrompts}
          promptPlaceholder="Ask aigentZ about the research programme, experiments, results…"
          agent={{ id: "aigent-z", name: "aigentZ" }}
          agentSubtitle="CCRL Research Laboratory · constitutional science"
          personaId={personaId}
          groundContext={copilotGroundContext}
          onStageProposals={onStageProposals}
          autoPrompt={autoPrompt}
          onClose={() => undefined}
        />
      </div>

      {/* ── RIGHT: live lab state (the observed panel) ─────────── */}
      <div className="lg:w-1/2 w-full h-full min-h-0 flex flex-col">
        <div className="shrink-0 flex items-center justify-between py-2 px-1">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-violet-300" />
            <h3 className="text-sm font-semibold text-slate-100">Live lab state (observed)</h3>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border border-slate-700/50 bg-slate-800/40 text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-1 pb-4 space-y-3">
          {/* C3 — the research ICE loop for the ACTIVE experiment. The stage is
              DERIVED from the experiment's lifecycle (design → protocol → run →
              analyze → publish). The Run stage hands off to the Experiment Lab —
              running is executed there, never in the copilot. */}
          <div className="rounded-xl border border-violet-800/50 bg-violet-950/20 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-violet-300" />
                <h4 className="text-xs font-semibold text-slate-100">
                  Research ICE loop{activeExperiment ? ` · ${activeExperiment.id}` : ""}
                </h4>
              </div>
              <span className="text-[10px] rounded px-1.5 py-0.5 bg-violet-500/20 text-violet-300 border border-violet-500/40">
                {researchStageLabel(activeStage)}
              </span>
            </div>
            <ResearchLoopStrip stage={activeStage} />
            {/* Active-experiment selector — the operator picks which experiment
                the loop is scoped to (default: most-recently-touched). */}
            {loopExperiments.length > 1 && (
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                <span className="text-[10px] text-slate-500 mr-1">Active:</span>
                {loopExperiments.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setActiveExperimentId(e.id)}
                    className={`rounded px-1.5 py-0.5 text-[10px] border transition-colors ${
                      activeExperiment?.id === e.id
                        ? "bg-violet-500/20 text-violet-200 border-violet-500/40 font-semibold"
                        : "bg-slate-800/40 text-slate-400 border-slate-700/40 hover:text-slate-200"
                    }`}
                  >
                    {e.id}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-slate-500">
              {researchStageActionable(activeStage) === "run-in-lab"
                ? "Run stage — execution stays in the Experiment Lab (see below)."
                : researchStageActionable(activeStage) === "complete"
                  ? "Replicated — the terminal stage; replication is a computed multi-provider signal, never asserted."
                  : `Ask aigentZ to produce the ${researchStageProposalKind(activeStage) ?? "next"} proposal for this stage; approve it here to advance.`}
            </p>
          </div>

          {/* C3 — Run stage lab hand-off (the constitutional boundary). */}
          {researchStageActionable(activeStage) === "run-in-lab" && (
            <RunStageCard
              experimentId={activeExperiment?.id ?? null}
              lifecycle={activeExperiment?.lifecycle ?? null}
              onGoToLab={goToExperimentLab}
            />
          )}

          {/* C2.1 — pending research proposals awaiting operator approval.
              Suggest-only; approval commits into working research state. */}
          {pending.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <ClipboardCheck className="h-4 w-4 text-amber-300" />
                <h4 className="text-xs font-semibold text-slate-100">
                  Pending proposals ({pending.length}) — review, then approve
                </h4>
              </div>
              {pending.map((entry) => (
                <PendingResearchProposalCard
                  key={entry.key}
                  entry={entry}
                  onApprove={() => approveProposal(entry.key)}
                  onDismiss={() => dismissProposal(entry.key)}
                />
              ))}
            </div>
          )}

          {/* Experiment lifecycle strips — derived, never asserted */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h4 className="text-xs font-semibold text-slate-100 mb-1">Experiment lifecycles (derived, never asserted)</h4>
            {overviewError && <p className="text-[11px] text-slate-500">{overviewError}</p>}
            {!overviewError && overview === null && (
              <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> loading…</div>
            )}
            {overview && overview.length === 0 && (
              <p className="text-[11px] text-slate-500">No experiments registered.</p>
            )}
            {overview && overview.length > 0 && (
              <div className="space-y-2 mt-2">
                {overview.map((o) => (
                  <div key={o.experiment.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="w-16 font-semibold text-slate-200">{o.experiment.id}</span>
                    <span className="w-40 text-slate-400">{o.experiment.family}</span>
                    <span className="flex items-center gap-1">
                      {lifecycleOrder.map((stage, i) => {
                        const reached = lifecycleOrder.indexOf(o.lifecycle) >= i;
                        return (
                          <span
                            key={stage}
                            title={stage}
                            className={`rounded px-1.5 py-0.5 text-[10px] border ${
                              stage === o.lifecycle
                                ? "bg-violet-500/20 text-violet-300 border-violet-500/40 font-semibold"
                                : reached
                                  ? "bg-emerald-500/10 text-emerald-300/70 border-emerald-500/20"
                                  : "bg-slate-800/40 text-slate-600 border-slate-700/40"
                            }`}
                          >
                            {stage}
                          </span>
                        );
                      })}
                    </span>
                    <span className="text-slate-500">
                      {o.publishedRuns} run{o.publishedRuns === 1 ? "" : "s"} · {o.distinctProviders} provider{o.distinctProviders === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Series claims */}
          {series.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <h4 className="text-xs font-semibold text-slate-100 mb-2">Series claims</h4>
              <div className="space-y-2">
                {series.map((s) => (
                  <div key={s.id} className="text-xs">
                    <span className="font-semibold text-slate-200">{s.id}</span>
                    <span className="text-slate-400"> — {s.name} ({s.members.join(", ")})</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">{s.claim}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent canonical results */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FlaskConical className="h-3.5 w-3.5 text-indigo-300" />
              <h4 className="text-xs font-semibold text-slate-100">Recent canonical results (hash-committed)</h4>
            </div>
            {resultsError && <p className="text-[11px] text-slate-500">{resultsError}</p>}
            {!resultsError && results === null && (
              <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> loading…</div>
            )}
            {results && results.length === 0 && (
              <p className="text-[11px] text-slate-500">No canonical results published yet.</p>
            )}
            {results && results.length > 0 && (
              <div className="space-y-1">
                {results.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-2 text-xs border-t border-slate-800 first:border-t-0 py-1">
                    <span className="w-16 font-semibold text-slate-200">{r.experiment}</span>
                    <span className="text-slate-400">{r.provider} · {r.model}</span>
                    <span className="font-mono text-slate-500">{r.contentHash.slice(0, 12)}…</span>
                    <span className="text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Working research objects — committed from approved proposals,
              persisted to research_objects + receipted on approve (C2.2). */}
          {(researchState.experiments.length > 0 ||
            researchState.findings.length > 0 ||
            researchState.publications.length > 0) && (
            <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ScrollText className="h-3.5 w-3.5 text-emerald-300" />
                <h4 className="text-xs font-semibold text-slate-100">Working research objects (approved · persisted)</h4>
              </div>
              <div className="space-y-2">
                {researchState.experiments.map((e) => (
                  <div key={`exp-${e.experiment.id}`} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-semibold text-slate-200">{e.experiment.id}</span>
                    <span className="text-slate-400">{e.experiment.family}</span>
                    <span className="rounded px-1.5 py-0.5 text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/40">{e.lifecycle}</span>
                    <PersistLine status={persistStatus[persistKey("experiment", e.experiment.id)]} />
                  </div>
                ))}
                {researchState.findings.map((f) => (
                  <div key={`find-${f.id}`} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono text-slate-300">{f.experimentId || "—"}</span>
                    <span className="text-slate-300 break-words flex-1 min-w-0">{f.claim}</span>
                    <span className="rounded px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40">{f.lifecycle}</span>
                    <PersistLine status={persistStatus[persistKey("finding", f.id)]} />
                  </div>
                ))}
                {researchState.publications.map((p) => (
                  <div key={`pub-${p.id}`} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-slate-200 break-words flex-1 min-w-0">{p.title}</span>
                    <span className="text-slate-500">{p.kind}</span>
                    <span className="rounded px-1.5 py-0.5 text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/40">{p.lifecycle}</span>
                    <PersistLine status={persistStatus[persistKey("publication", p.id)]} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Honest degradation — the persisted lab record is unreachable. */}
          {hydrateError && (
            <p className="text-[10px] text-rose-400/80 px-1">
              Persisted research objects unavailable — {hydrateError}. Approved objects stay in session
              memory until the record is reachable again.
            </p>
          )}

          {/* Honest scope note */}
          <p className="text-[10px] text-slate-600 px-1">
            CFS-019 C2 (narrate) + C2.1 (propose) + C2.2 (persist) + C3 (ICE loop): aigentZ narrates the live
            lab state and can propose structured research objects along the design → protocol → run → analyze →
            publish cadence. Proposals are suggest-only and lifecycle-legal — nothing commits without your
            approval; approved objects persist to the lab record and each approval is receipted
            (research_lifecycle_transition, DVN-anchorable). The Run stage hands off to the Experiment Lab —
            running is executed there, never in the copilot.
          </p>
        </div>
      </div>
    </div>
  );
}
