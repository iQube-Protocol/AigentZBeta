"use client";

/**
 * IRL Research Copilot — Aigent Z as research narrator + proposer
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
import { AlertTriangle, ArrowRight, CheckCircle, ChevronDown, ClipboardCheck, FlaskConical, Landmark, Loader2, Lock, Play, RefreshCw, ScrollText, ShieldCheck, Target } from "lucide-react";
// Track 2 stage-status vocabulary, MIRRORED (not imported) from
// components/research/Track2ProgrammePanel.tsx's own STATUS_LABEL — that
// module exports only the Panel component, not its internals, and this is a
// presentation-only compact projection (a colored dot strip) of the SAME
// canonical Track2StageStatus union (services/research/track2Programme.ts),
// never a second derivation of stage status itself (inv.engineering.036/037).
const TRACK2_STATUS_LABEL: Record<string, string> = {
  complete: "complete",
  "partially-complete": "partially complete — eligible records processed",
  "in-progress": "in progress",
  "not-started": "not started",
  blocked: "blocked — no valid subset can proceed",
  unknown: "not observable from here",
};
const TRACK2_STATUS_DOT: Record<string, string> = {
  complete: "bg-emerald-400",
  "partially-complete": "bg-emerald-400/50",
  "in-progress": "bg-amber-300",
  "not-started": "bg-slate-600",
  blocked: "bg-rose-400",
  unknown: "bg-slate-500",
};
import { SmartTriadCopilotLayer, type CopilotStageProposal } from "@/components/smarttriad/copilot/SmartTriadCopilotLayer";
import { experimentGet } from "./experimentStepFetch";
import { personaFetch } from "@/utils/personaSpine";
// TYPE-ONLY import from the server orchestrator. `import type` is erased before
// bundling, so no server module reaches the client — and the alternative (a
// hand-copied interface here) would be a second shape that agrees with the
// server's only until one of them is edited (`inv.engineering.036`/`037`).
import type { ProgrammeRunResult, PendingGovernanceDecision } from "@/services/research/researchProgrammeOrchestrator";
// The SAME read-only projection Track2ProgrammePanel itself reads
// (GET /api/research/track2/[experimentId] -> loadTrack2ProgrammeState) —
// reused here so the objective's state is visible on OPEN, before the
// operator has run anything, rather than only after a POST /advance.
import type { Track2Programme, Track2DeepLink } from "@/services/research/track2Programme";
import { setPendingTrack2Stage } from "@/services/research/track2DeepLinkIntent";
/**
 * The trimmed shape this card needs from
 * `GET /api/research/track2/[experimentId]/provenance-cohort` — deliberately
 * NOT the full recommendations array Track2ProgrammePanel's own
 * ProvenanceCohortRatificationBoard renders; this card only needs the
 * counts/hash to offer ONE ratification act, and fetches this route
 * directly rather than depending on `pendingDecision`'s heavy composition
 * (2026-09-04 — the 15s-timeout decoupling fix).
 */
interface ProvenanceCohortView {
  experimentId: string;
  total: number;
  readyCount: number;
  exceptionCount: number;
  cohortHash: string;
  summary: string;
}
import { proceedToTrack2Stage } from "@/services/research/track2ProceedNavigation";
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
import { PROVENANCE_CLASSES, type ProvenanceClass } from "@/services/corpusScout/types";
import { partitionForExecution } from "@/services/corpusScout/executionAbsorption";
import { useDcirSeam } from "@/services/dcir/useDcirSeam";

const SURFACE = "irl-research";

interface OverviewEntry {
  experiment: { id: string; layer: string; family: string; seriesId: string };
  lifecycle: string;
  publishedRuns: number;
  distinctProviders: number;
  latestRunAt: string | null;
}

interface ArtifactProductionView {
  recentRecords: {
    artifactId: string; profile: string; consequenceClass: string; delegate: string;
    title: string; contentHashPrefix: string; receiptId: string | null; createdAt: string;
  }[];
  publications: { number: string; title: string; state: string }[];
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

interface IRLResearchCopilotTabProps {
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
    return `[observed] ${experimentId}'s protocol is ratified and the research loop advanced to the Run stage. The next step is to run ${experimentId} in metaMe IRL (the EXP-001…005 runner tabs) — running is executed there, not by you. Point me to the lab; when results are in I'll help you record the finding.`;
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
 * `knyt:navigate-tab`; the viewer listens and switches to `irl-experiment-lab`).
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
        <h4 className="text-xs font-semibold text-slate-100">Run stage — hand off to metaMe IRL</h4>
      </div>
      <p className="text-[11px] text-slate-300">
        {experimentId ? <span className="font-mono text-slate-200">{experimentId}</span> : "The active experiment"} is
        {lifecycle === "running" ? " running" : " ratified and ready to run"}. Running is EXECUTED in{" "}
        <span className="text-indigo-300 font-semibold">metaMe IRL</span> (the EXP-001…005 runner tabs) — not here.
        Execution stays in the lab; the copilot never runs an experiment.
      </p>
      <button
        type="button"
        onClick={onGoToLab}
        className="inline-flex items-center gap-1.5 rounded border border-indigo-500/40 bg-indigo-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-100 hover:bg-indigo-500/25 hover:text-white transition"
      >
        <Play className="h-3 w-3" />
        Open metaMe IRL{experimentId ? ` to run ${experimentId}` : ""}
      </button>
      <p className="text-[10px] text-slate-500">
        The run produces a canonical, hash-committed result that advances the experiment&apos;s lifecycle
        (running → evaluated → published). When results are in, refresh here and the loop moves to Analyze —
        I&apos;ll help you record the finding.
      </p>
      <p className="text-[10px] text-amber-400/80">
        Already ran it? The lifecycle derives from the CANONICAL record — publish the run&apos;s results from
        its runner tab (the Publish action) and this hand-off clears on the next refresh. An unpublished run
        does not exist constitutionally.
      </p>
    </div>
  );
}

// ─── OBJECTIVES — the copilot as the orchestration head ─────────────────────

/**
 * An OBJECTIVE is a named goal the copilot can drive end-to-end, with ONE
 * control. It is deliberately not a framework: there is exactly one member, and
 * a generic objectives engine built for one member would be the speculative
 * abstraction CLAUDE.md's change-sizing rule forbids. When a second objective
 * exists, THAT is when the shape earns generalisation.
 */
interface ResearchObjective {
  id: "prepare-crystal-v2";
  label: string;
  /** What the objective is, in the operator's register. */
  description: string;
  /** The experiment the objective is scoped to. Read from the surface that
   *  already mounts it — `InvariantExperimentLab` mounts
   *  `<Track2ProgrammePanel experimentId="EXP-P1" />` — never guessed. */
  experimentId: string;
}

const RESEARCH_OBJECTIVES: readonly ResearchObjective[] = [
  {
    id: "prepare-crystal-v2",
    label: "Prepare Crystal v2",
    description:
      "Drive the Track 2 programme toward a successor crystal: run every scientific and clerical act that can " +
      "safely proceed, isolate anomalous records locally, and stop at the first decision that is genuinely yours.",
    experimentId: "EXP-P1",
  },
];

/** One labelled count, for the population disclosure strip. */
function PopCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900/50 px-1.5 py-1">
      <div className="text-[9px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-[11px] font-semibold text-slate-200">{value}</div>
    </div>
  );
}

/**
 * THE OBJECTIVE CARD — one control, and the consolidated account of what it did.
 *
 * ── What this deliberately does NOT do ─────────────────────────────────────
 *
 * It does not re-render Track 2's detail. `components/research/
 * Track2ProgrammePanel.tsx` is the detailed surface and remains so; forking its
 * rendering here would be a second Track 2 UI (`inv.engineering.036`/`037`) and
 * the two would disagree the first time either changed. The card shows the RUN —
 * what advanced, what was withheld, what is now the operator's — and deep-links
 * to the Panel via the existing `codex:navigate-tab` seam for everything else.
 *
 * It also renders no per-act approve/dismiss cards. The operator's mandate is to
 * see *consolidated governance decisions and the final freeze*; surfacing every
 * machine act as something to confirm would reinstate exactly the interaction
 * cost the objective exists to remove. (The separate aigentZ proposal flow above
 * is untouched — it serves a different purpose.)
 */
function ObjectiveCard({
  objective,
  run,
  programmePreview,
  pendingDecisionPreview,
  running,
  error,
  onRun,
  onOpenDetail,
  onProceed,
  proceeding,
  proceedError,
  onApproveAcquisition,
  acquisitionRunning,
  acquisitionError,
  acquisitionStatus,
  onReviewDecision,
  reviewBusyId,
  reviewError,
  onRunVerification,
  verificationRunning,
  verificationError,
  verificationStatus,
  onResolveDuplicates,
  admissionRunning,
  admissionError,
  admissionStatus,
  onAdmitEligible,
  admitRunning,
  admitError,
  admitStatus,
  admitProgress,
  admitProvenanceClass,
  onAdmitProvenanceClassChange,
  admitRationale,
  onAdmitRationaleChange,
  provenanceCohortPreview,
  onRatifyProvenanceCohort,
  provenanceRatifying,
  provenanceRatifyError,
  provenanceRatifyStatus,
  provenanceRationale,
  onProvenanceRationaleChange,
}: {
  objective: ResearchObjective;
  run: ProgrammeRunResult | null;
  /** The SAME read-only Track2Programme projection, loaded on mount (before
   *  any run) so "where are we" is visible on open, not only after "Run
   *  until you need me". Once a run completes, `run.programme` (re-read
   *  after the last act — the fresher truth) takes over. */
  programmePreview: Track2Programme | null;
  /** The SAME durability treatment as `programmePreview`, for the pending
   *  decision (2026-08-26): recomputed on every mount/refresh from the SAME
   *  authoritative read, so a pending human judgment survives navigate-away-
   *  and-back instead of only existing inside the ephemeral `run` state. */
  pendingDecisionPreview: PendingGovernanceDecision | null;
  running: boolean;
  error: string | null;
  onRun: () => void;
  onOpenDetail: () => void;
  /**
   * THE PROCEED SEQUENCE (2026-08-27 fix) — awaits a fresh `/advance` +
   * authoritative Track 2 read, THEN opens whatever stage that fresh read
   * names. Never navigates using `decision.deepLink` straight off this
   * card's own (possibly stale) props — see `track2ProceedNavigation.ts`'s
   * header for the exact staleness this closes.
   */
  onProceed: (decision: PendingGovernanceDecision) => void;
  /** True while a Proceed sequence (advance + refresh) is in flight for
   *  THIS card's decision. */
  proceeding: boolean;
  /** Set when the advance or the post-advance refresh failed — the card
   *  shows this INSTEAD of navigating on stale state, with a Retry. */
  proceedError: string | null;
  /**
   * "APPROVE TARGETED ACQUISITION" (2026-08-30) — the ONE Copilot
   * authorization that replaces manually operating Corpus Scout when the
   * `discover-sources` stop carries a `decision.acquisitionBrief`. Drives
   * approve → bounded run-step loop → continue the programme; never a bare
   * navigation. `onOpenDiscoverSources` stays available as the demoted
   * inspection/deep-link secondary action (`onProceed`, unchanged).
   */
  onApproveAcquisition: (decision: PendingGovernanceDecision) => void;
  acquisitionRunning: boolean;
  acquisitionError: string | null;
  acquisitionStatus: string | null;
  /**
   * REVIEW & PROMOTE (2026-08-30) — a per-candidate steward disposition,
   * calling the EXISTING canonical `promoteCandidate`/`rejectCandidate` path
   * (`POST /api/invariants/discovery`) directly — no new promotion or
   * rejection implementation. `action: 'inspect'` performs no write; it is
   * the demoted navigation-only affordance (`onProceed`, reused).
   */
  onReviewDecision: (decision: PendingGovernanceDecision, candidateId: string, action: 'promote' | 'reject') => void;
  /** The candidateId currently in flight, or `null` — disables every OTHER
   *  candidate's buttons too (one disposition at a time keeps the queue
   *  count and the server in lockstep). */
  reviewBusyId: string | null;
  reviewError: string | null;
  /**
   * "RUN INSTITUTION VERIFICATION" (2026-08-31, "targeted-acquisition
   * ratified-but-unverified dead end" repair) — the Copilot control for a
   * `decision.verificationTarget`: a deterministic, bounded, already-
   * Steward-authorised machine act (no new approval — the acquisition is
   * already granted). Drives the bounded verify-step loop, then continues
   * into discovery run-step + the programme in the SAME click where
   * eligible institutions resulted, mirroring `onApproveAcquisition`'s own
   * shape exactly but without a fresh approval call.
   */
  onRunVerification: (decision: PendingGovernanceDecision) => void;
  verificationRunning: boolean;
  verificationError: string | null;
  verificationStatus: string | null;
  /**
   * "RESOLVE DETERMINISTIC DUPLICATES" (2026-08-31, "Review & Admit
   * machine-preparation" repair) — the control for
   * `decision.duplicateResolutions`. Resolves every exact-duplicate group
   * whose quality signals already separate the copies, through the EXISTING
   * `resolve-duplicates` route — no new write path.
   */
  onResolveDuplicates: (decision: PendingGovernanceDecision) => void;
  admissionRunning: boolean;
  admissionError: string | null;
  admissionStatus: string | null;
  /**
   * "ADMIT ELIGIBLE SOURCES" (2026-09-01) — the cohort-level ratification
   * control for `decision.admissionQueue`'s eligible subset (`ready` /
   * `ready-with-warning`). One steward judgement (`admitProvenanceClass` +
   * `admitRationale`) covers the whole prepared cohort; the handler groups by
   * `reviewDecision` and drives bounded `bulk-review` batches through the
   * EXISTING route — never a second admission write path.
   */
  onAdmitEligible: (decision: PendingGovernanceDecision) => void;
  admitRunning: boolean;
  admitError: string | null;
  admitStatus: string | null;
  admitProgress: { current: number; total: number } | null;
  admitProvenanceClass: ProvenanceClass | "";
  onAdmitProvenanceClassChange: (v: ProvenanceClass | "") => void;
  admitRationale: string;
  onAdmitRationaleChange: (v: string) => void;
  /**
   * CLASSIFY PROVENANCE COHORT (2026-09-04) — fetched and ratified
   * independently of `decision`/`programme` above; see the state/callback
   * declarations' own doc comments for why. `null` until the mount-time
   * `refresh()` (or a post-ratification reload) determines this experiment's
   * classify-provenance stage is the pending one.
   */
  provenanceCohortPreview: ProvenanceCohortView | null;
  onRatifyProvenanceCohort: (experimentId: string) => void;
  provenanceRatifying: boolean;
  provenanceRatifyError: string | null;
  provenanceRatifyStatus: string | null;
  provenanceRationale: string;
  onProvenanceRationaleChange: (v: string) => void;
}) {
  const gate = run?.measurementLayerGate ?? null;
  const programme = run?.programme ?? programmePreview;
  /**
   * RECONCILIATION INVARIANT: a pending human gate remains the next act
   * until a receipt resolves it — recomputed from authoritative state on
   * EVERY render (mount, remount, post-run), never only while `run` (the
   * ephemeral POST result) happens to still be in memory. `run.pendingDecision`
   * is preferred when a run just completed (the freshest read); otherwise the
   * mount-time preview — itself re-derived from the SAME `firstPendingDecision`
   * function the run's own loop uses — takes over. Both can never disagree
   * about WHETHER a gate is pending (inv.engineering.036/037); this is a
   * freshness preference, not two competing derivations.
   */
  const decision = run?.pendingDecision ?? pendingDecisionPreview;

  // ADMISSION QUEUE COHORT SUMMARY (2026-08-31) — computed here, as plain
  // sequential locals rather than inside the JSX below, so the values stay
  // simply typed (never re-reading a possibly-`undefined` property through a
  // nested closure).
  const admissionQueue = decision?.admissionQueue ?? null;
  const admissionByClass = new Map<string, number>();
  if (admissionQueue) {
    for (const r of admissionQueue) admissionByClass.set(r.admissionClass, (admissionByClass.get(r.admissionClass) ?? 0) + 1);
  }
  const admissionManualReviewCount = admissionByClass.get("manual review required") ?? 0;
  const resolvableDuplicateGroups = (decision?.duplicateResolutions ?? []).filter(
    (p) => p.kind === "recommended-resolution-available",
  );
  const resolvableDuplicateAliasCount = resolvableDuplicateGroups.reduce((n, p) => n + p.aliasSourceIds.length, 0);
  // THE ELIGIBLE COHORT (2026-09-01) — every source `onAdmitEligible` would
  // cover. Mirrors `eligibleAdmissionCohortIds` (admissionPreparation.ts)
  // exactly (ready | ready-with-warning) — never a second filter definition.
  const eligibleAdmissionCount = (admissionQueue ?? []).filter(
    (r) => r.disposition === "ready" || r.disposition === "ready-with-warning",
  ).length;

  return (
    <div className="rounded-xl border border-sky-800/50 bg-sky-950/20 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <Target className="h-4 w-4 text-sky-300 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-slate-100">
              Objective · {objective.label}
              <span className="ml-1.5 font-mono text-[10px] text-slate-400">{objective.experimentId}</span>
            </h4>
            <p className="text-[10px] text-slate-400 mt-0.5">{objective.description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className="shrink-0 inline-flex items-center gap-1.5 rounded border border-sky-500/40 bg-sky-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-sky-100 hover:bg-sky-500/25 hover:text-white transition disabled:opacity-50"
        >
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          {running ? "Running…" : "Run until you need me"}
        </button>
      </div>

      {error && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-[10px] text-rose-300">
          The run could not be started — {error}. Nothing was executed.
        </div>
      )}

      {/* TRACK 2 — you are here. Real, live data (the SAME read-only projection
          Track2ProgrammePanel itself reads) that was previously visible only
          AFTER a run, and even then was fetched but never rendered (2026-08-26
          reconciliation: the operator could not see Track 2 state from the
          Copilot at all and had to operate its stage UI directly, which is
          exactly what this objective exists to eliminate). Renders as soon as
          the mount-time preview loads — before the first "Run until you need
          me" — then upgrades to `run.programme` (re-read after the last act)
          once a run completes. A compact PROJECTION of the same eleven-stage
          programme Track2ProgrammePanel renders in full — never a second
          implementation of stage derivation (inv.engineering.036/037).
          "IDE 2.0" (invariant discovery / reasoning-bearing structure) and
          "Crystal v2" (the compiled candidate + readiness + freeze prep) are
          not separate data models — they are what stages 3-6 and 8-11
          respectively DO; the dot strip below already covers both, so no
          fabricated status field or nonexistent navigation target is added
          for either. */}
      {programme && (
        <div className="rounded border border-slate-700 bg-slate-900/40 px-2 py-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
              Track 2 — you are here
            </span>
            <button
              type="button"
              onClick={onOpenDetail}
              className="text-[10px] text-sky-300/80 hover:text-sky-200 transition inline-flex items-center gap-1"
            >
              Inspect Track 2 <ArrowRight className="h-2.5 w-2.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {programme.stages.map((s) => (
              <span
                key={s.id}
                title={`${s.label} — ${TRACK2_STATUS_LABEL[s.status] ?? s.status}`}
                className={`inline-flex h-2 w-2 rounded-full ${TRACK2_STATUS_DOT[s.status] ?? "bg-slate-600"} ${
                  s.id === programme.currentStageId ? "ring-2 ring-sky-400/60 ring-offset-1 ring-offset-slate-900" : ""
                }`}
              />
            ))}
          </div>
          <div className="text-[10px] text-slate-300">
            {/*
             * PREFER THE PENDING DECISION'S STAGE, NEVER THE RAW
             * `currentStageId` SCALAR, FOR THIS HEADLINE
             * (RES-2026-09-01-TRACK2-FAIL-SOFT-SWALLOWED-001, §13's
             * architectural rule: distinguish the pending human decision
             * from the earliest-incomplete-stage bookkeeping value —
             * do not force both into one scalar's label).
             *
             * `programme.currentStageId` is `track2Programme.ts`'s "the
             * lowest-ordinal stage that is not complete" — it is NOT "the
             * stage the operator should look at". Stage 1 (Discover
             * Sources) is `not-started` whenever no NEW source was
             * discovered in the current acquisition round, even while
             * Stage 2 genuinely holds 18 sources awaiting a human
             * decision and Stages 3-8 are complete — so a headline built
             * from `currentStageId` alone reverts to "Discover Sources"
             * the instant Stage 1 isn't literally `complete`, regardless
             * of how much real, pending work sits downstream.
             *
             * `decision` (`pendingDecision`) is already the correct
             * signal for this: `firstPendingDecision` deliberately
             * excludes Stage 1 unless a real acquisition brief applies,
             * and names the actual human-gated stage — exactly "Review &
             * Admit — 18 source(s)" when that is the state. Falls back to
             * `currentStageId`'s label only when there is genuinely no
             * pending decision (every unblocked stage is complete, or the
             * only outstanding stage is machine-runnable).
             */}
            {decision?.stageLabel ?? programme.stages.find((s) => s.id === programme.currentStageId)?.label ?? programme.currentStageId}
          </div>
          {programme.nextActions.length > 0 && (
            <div className="space-y-0.5">
              <div className="text-[9px] uppercase tracking-wide text-slate-500">Next executable act(s)</div>
              {programme.nextActions.slice(0, 2).map((a, i) => (
                <div key={i} className="flex gap-1.5 text-[10px] text-slate-400">
                  <span className="text-slate-500 shrink-0">→</span>
                  <span className="break-words">{a}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* THE CONSOLIDATED DECISION — the one thing the operator is asked for.
          RECONCILIATION INVARIANT (2026-08-26): rendered from `decision`
          alone — present whenever an unblocked, non-complete, human-gated
          stage exists in the AUTHORITATIVE state, whether that came from a
          fresh run or from the mount-time preview. Deliberately OUTSIDE
          `{run && (...)}` below: before this fix, this card only existed
          while `run` (the ephemeral POST result) was still in memory, so
          navigating away and back made it vanish even though the underlying
          gate was still genuinely open — the operator saw only the compact
          dot-strip above, not the actionable judgment. It now survives
          navigate-away-and-back exactly like the dot-strip already did. */}

      {/* CLASSIFY PROVENANCE COHORT (2026-09-04) — the ONE decision surface
          the operator asked for, replacing "Record 1 of 55" one-at-a-time
          classification. Rendered whenever `provenanceCohortPreview` names
          THIS objective's experiment — independent of `decision` (see that
          state's own doc comment for why it is fetched separately, and the
          15s-timeout decoupling this exists to fix). Deliberately placed
          OUTSIDE the `decision`-block span below (a sibling, not nested) —
          it can be shown alongside, or independently of, whatever `decision`
          currently names, since the two are no longer the same read. */}
      {provenanceCohortPreview && provenanceCohortPreview.experimentId === objective.experimentId && (
        <div className="rounded border border-violet-500/40 bg-violet-500/10 px-2 py-2 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wide text-violet-300 font-semibold">
            Prepared — Classify Provenance · {provenanceCohortPreview.total} unclassified
          </div>
          <div className="space-y-0.5">
            {provenanceCohortPreview.readyCount > 0 && (
              <div className="text-[10px] text-slate-300 flex gap-1.5">
                <span className="text-slate-500 shrink-0">·</span>
                <span>
                  <span className="text-emerald-300">{provenanceCohortPreview.readyCount}</span> ready for cohort ratification
                </span>
              </div>
            )}
            {provenanceCohortPreview.exceptionCount > 0 && (
              <div className="text-[10px] text-slate-300 flex gap-1.5">
                <span className="text-slate-500 shrink-0">·</span>
                <span>
                  <span className="text-amber-300">{provenanceCohortPreview.exceptionCount}</span> isolated exception(s) — require individual review
                </span>
              </div>
            )}
          </div>

          {provenanceCohortPreview.readyCount > 0 && (
            <div className="rounded border border-emerald-700/40 bg-emerald-500/5 p-1.5 space-y-1">
              <input
                type="text"
                value={provenanceRationale}
                onChange={(e) => onProvenanceRationaleChange(e.target.value)}
                disabled={provenanceRatifying}
                placeholder="Rationale — recorded on every invariant classified"
                className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[10px] text-slate-200 placeholder:text-slate-600 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => onRatifyProvenanceCohort(provenanceCohortPreview.experimentId)}
                disabled={provenanceRatifying || !provenanceRationale.trim()}
                className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold text-emerald-50 hover:bg-emerald-500/30 transition disabled:opacity-50"
              >
                {provenanceRatifying ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                {provenanceRatifying ? (provenanceRatifyStatus ?? "Ratifying…") : "Ratify provenance cohort"}
              </button>
              {provenanceRatifyError && (
                <div className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-[10px] text-rose-300">
                  {provenanceRatifyError}
                  <button
                    type="button"
                    onClick={() => onRatifyProvenanceCohort(provenanceCohortPreview.experimentId)}
                    className="ml-1.5 underline decoration-rose-700 hover:text-rose-100"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onOpenDetail}
            className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-violet-300/70 hover:text-violet-200 transition"
          >
            <ArrowRight className="h-3 w-3" />
            Inspect individually
          </button>
        </div>
      )}

      {decision && decision.acquisitionBrief && (
        /* TARGETED ACQUISITION — the `discover-sources` stop rendered as a
           precise Copilot authorization (2026-08-30), not a navigation
           exercise. "Approve targeted acquisition" is the PRIMARY control;
           "Open Discover Sources" survives as a demoted secondary
           inspection/deep-link only. The plan shown is EXACTLY the brief
           the orchestrator already computed — never a second wording. */
        <div className="rounded border border-violet-500/40 bg-violet-500/10 px-2 py-2 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wide text-violet-300 font-semibold">
            Your judgment — {decision.stageLabel}
          </div>
          <div className="text-[11px] text-slate-200">
            Crystal v2 needs additional external evidence.
          </div>
          <div className="text-[10px] text-slate-300 space-y-0.5">
            <div>
              Target: ≥{decision.acquisitionBrief.requiredNetNewDistinctMembers} additional distinct member(s),
              subject to actual readiness · {decision.acquisitionBrief.missingNamespaces.length} currently
              unrepresented namespace(s)
              {decision.acquisitionBrief.missingNamespaces.length > 0
                ? `: ${decision.acquisitionBrief.missingNamespaces.join(", ")}`
                : ""}
            </div>
            {decision.acquisitionBrief.deficientRelationalStructures.length > 0 && (
              <div>
                Structure sought: {decision.acquisitionBrief.deficientRelationalStructures.join(", ")}
              </div>
            )}
            <div>
              Search boundary: ratified institutions/sources only
              {decision.acquisitionBrief.sourceAdmissibilityConstraints.length > 0
                ? ` · ${decision.acquisitionBrief.sourceAdmissibilityConstraints.join(", ")}`
                : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onApproveAcquisition(decision)}
            disabled={acquisitionRunning}
            className="mt-1 inline-flex items-center gap-1 rounded border border-violet-500/40 bg-violet-500/25 px-2 py-1 text-[10px] font-semibold text-violet-50 hover:bg-violet-500/35 transition disabled:opacity-50"
          >
            {acquisitionRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
            {acquisitionRunning ? (acquisitionStatus ?? "Working…") : "Approve targeted acquisition"}
          </button>
          {acquisitionError && (
            <div className="mt-1 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-[10px] text-rose-300">
              {acquisitionError}
              <button
                type="button"
                onClick={() => onApproveAcquisition(decision)}
                className="ml-1.5 underline decoration-rose-700 hover:text-rose-100"
              >
                Retry
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => onProceed(decision)}
            disabled={proceeding || acquisitionRunning}
            className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-violet-300/70 hover:text-violet-200 transition disabled:opacity-50"
          >
            {proceeding ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
            {proceeding ? "Confirming current state…" : "Open Discover Sources (inspect only)"}
          </button>
          {proceedError && (
            <div className="mt-1 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-[10px] text-rose-300">
              Could not confirm the current Track 2 state before opening it — {proceedError}.
              <button
                type="button"
                onClick={() => onProceed(decision)}
                className="ml-1.5 underline decoration-rose-700 hover:text-rose-100"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {/* REVIEW & PROMOTE — the `review-and-promote` stop rendered as one
          bounded review card per candidate (2026-08-30), not a navigation
          exercise. Each candidate's Promote/Reject calls the EXISTING
          canonical `promoteCandidate`/`rejectCandidate` path directly
          (`POST /api/invariants/discovery`) — no new promotion logic. The
          machine's `recommendation` is advisory only; both buttons stay
          enabled regardless of what it says. */}
      {decision && decision.reviewQueue && decision.reviewQueue.length > 0 && (
        <div className="rounded border border-violet-500/40 bg-violet-500/10 px-2 py-2 space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-violet-300 font-semibold">
            Your judgment — {decision.stageLabel} · {decision.reviewQueue.length} awaiting
          </div>
          {reviewError && (
            <div className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-[10px] text-rose-300">
              {reviewError}
            </div>
          )}
          <div className="space-y-2">
            {decision.reviewQueue.map((c) => {
              const busy = reviewBusyId === c.candidateId;
              const anyBusy = reviewBusyId !== null;
              const recColor =
                c.recommendation.action === "promote"
                  ? "text-emerald-300"
                  : c.recommendation.action === "reject"
                    ? "text-rose-300"
                    : "text-amber-300";
              return (
                <div key={c.candidateId} className="rounded border border-slate-700 bg-slate-900/50 p-2 space-y-1">
                  <div className="text-[11px] text-slate-100 break-words">{c.statement}</div>
                  <div className="text-[10px] text-slate-400 break-words">
                    Namespace: <span className="font-mono">{c.proposedNamespace}</span>
                    {c.subDomain ? ` · ${c.domain}/${c.subDomain}` : ` · ${c.domain}`}
                    {" · "}
                    {c.discoveryClass}
                    {c.abstractionLevel ? ` · ${c.abstractionLevel}` : ""}
                    {c.classification ? ` · classified: ${c.classification}` : ""}
                  </div>
                  {c.evidence.length > 0 && (
                    <div className="space-y-0.5">
                      {c.evidence.slice(0, 2).map((e) => (
                        <div key={e.id} className="text-[10px] text-slate-400 break-words">
                          <span className="text-slate-500">{e.sourceKind}</span> · {e.title}
                          {e.sourceRef ? ` (${e.sourceRef})` : ""}
                          {e.excerpt ? <span className="block text-slate-500 italic">“{e.excerpt.slice(0, 160)}{e.excerpt.length > 160 ? "…" : ""}”</span> : null}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400">
                    Confidence: {Math.round(c.confidence * 100)}%
                    {c.convergence ? ` · ${c.convergence.supportCount} converging source(s) (${c.convergence.tier})` : ""}
                    {c.recurrence ? ` · ${c.recurrence.recurrenceCount} domain(s) (${c.recurrence.tier})` : ""}
                  </div>
                  {c.duplicateWarning && (
                    <div className="text-[10px] text-amber-400/90">
                      ⚠ {c.duplicateWarning.exact ? "Exact duplicate" : `${Math.round(c.duplicateWarning.similarity * 100)}% overlap`} of
                      an existing invariant: “{c.duplicateWarning.existingStatement.slice(0, 120)}
                      {c.duplicateWarning.existingStatement.length > 120 ? "…" : ""}”
                    </div>
                  )}
                  <div className={`text-[10px] ${recColor}`}>
                    Recommendation: {c.recommendation.action} — {c.recommendation.reason}
                  </div>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => onReviewDecision(decision, c.candidateId, "promote")}
                      disabled={anyBusy}
                      className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-100 hover:bg-emerald-500/25 transition disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                      Promote
                    </button>
                    <button
                      type="button"
                      onClick={() => onReviewDecision(decision, c.candidateId, "reject")}
                      disabled={anyBusy}
                      className="inline-flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/15 px-2 py-1 text-[10px] font-semibold text-rose-100 hover:bg-rose-500/25 transition disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => onProceed(decision)}
                      disabled={anyBusy || proceeding}
                      className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:text-slate-100 transition disabled:opacity-50"
                    >
                      Exception / Inspect
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RUN INSTITUTION VERIFICATION — the `discover-sources` stop when
          acquisition is already approved but blocked on ratified-but-
          unverified institutions (2026-08-31). A deterministic, bounded,
          already-Steward-authorised machine act: the control below runs it
          directly rather than merely explaining it. "Open Discover Sources"
          is deliberately NOT the primary control here — a verification gate
          gets an executable act, never a diagnostic-only dead end. */}
      {decision && decision.verificationTarget && (
        <div className="rounded border border-violet-500/40 bg-violet-500/10 px-2 py-2 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wide text-violet-300 font-semibold">
            Your constitutional act — {decision.stageLabel}
          </div>
          <div className="text-[11px] text-slate-200">{decision.detail}</div>
          <button
            type="button"
            onClick={() => onRunVerification(decision)}
            disabled={verificationRunning}
            className="mt-1 inline-flex items-center gap-1 rounded border border-violet-500/40 bg-violet-500/25 px-2 py-1 text-[10px] font-semibold text-violet-50 hover:bg-violet-500/35 transition disabled:opacity-50"
          >
            {verificationRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
            {verificationRunning ? (verificationStatus ?? "Working…") : "Run institution verification"}
          </button>
          {verificationError && (
            <div className="mt-1 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-[10px] text-rose-300">
              {verificationError}
              <button
                type="button"
                onClick={() => onRunVerification(decision)}
                className="ml-1.5 underline decoration-rose-700 hover:text-rose-100"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {/* THE ADMISSION QUEUE — the `review-and-admit` stop rendered as a
          PREPARED cohort summary (2026-08-31, "Review & Admit
          machine-preparation" repair), never 18 raw, unprocessed rows with
          no CTA. `decision.admissionQueue` is the SAME
          `composeAdmissionRecommendation` computation "Prepare
          recommendations" already used, now run automatically by
          `loadTrack2ProgrammeState` on every read. Deterministic duplicates
          get an EXECUTABLE control here (no per-source human content); the
          rest (admission-class ratification, genuinely ambiguous
          duplicates) stays exactly where its full detail already lives —
          `RecommendationCohorts`/`DuplicateResolutionBoard` in the
          Experiment Lab's Corpus Scout queue — reached via "Open Review &
          Admit" below. This card summarizes; it does not re-implement that
          UI. */}
      {decision && admissionQueue && admissionQueue.length > 0 && (
        <div className="rounded border border-violet-500/40 bg-violet-500/10 px-2 py-2 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wide text-violet-300 font-semibold">
            Prepared — {decision.stageLabel} · {admissionQueue.length} source(s)
          </div>
          <div className="space-y-0.5">
            {[...admissionByClass.entries()].map(([cls, n]) => (
              <div key={cls} className="text-[10px] text-slate-300 flex gap-1.5">
                <span className="text-slate-500 shrink-0">·</span>
                <span>
                  {n} recommended → <span className={cls === "manual review required" ? "text-amber-300" : "text-emerald-300"}>{cls}</span>
                </span>
              </div>
            ))}
            {resolvableDuplicateAliasCount > 0 && (
              <div className="text-[10px] text-slate-300 flex gap-1.5">
                <span className="text-slate-500 shrink-0">·</span>
                <span>{resolvableDuplicateAliasCount} exact-duplicate alias(es) resolvable now — the signals already separate the copies</span>
              </div>
            )}
          </div>
          {resolvableDuplicateAliasCount > 0 && (
            <button
              type="button"
              onClick={() => onResolveDuplicates(decision)}
              disabled={admissionRunning}
              className="mt-1 inline-flex items-center gap-1 rounded border border-violet-500/40 bg-violet-500/25 px-2 py-1 text-[10px] font-semibold text-violet-50 hover:bg-violet-500/35 transition disabled:opacity-50"
            >
              {admissionRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
              {admissionRunning ? (admissionStatus ?? "Working…") : `Resolve ${resolvableDuplicateAliasCount} deterministic duplicate(s)`}
            </button>
          )}
          {admissionError && (
            <div className="mt-1 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-[10px] text-rose-300">
              {admissionError}
              <button
                type="button"
                onClick={() => onResolveDuplicates(decision)}
                className="ml-1.5 underline decoration-rose-700 hover:text-rose-100"
              >
                Retry
              </button>
            </div>
          )}
          <div className="text-[10px] text-slate-400">
            {admissionManualReviewCount > 0
              ? `${admissionManualReviewCount} of ${admissionQueue.length} need individual inspection — the rest carry a machine recommendation.`
              : "Every source carries a machine recommendation."}
          </div>

          {/* ADMIT ELIGIBLE SOURCES (2026-09-01) — the cohort-level
              ratification act: one steward judgement (provenance class +
              rationale) covers the whole eligible cohort; the handler
              batches through the EXISTING bulk-review route and continues
              the programme when done. The 6 manual-review exceptions above
              are never part of this cohort — `eligibleAdmissionCount`
              excludes them by construction. */}
          {eligibleAdmissionCount > 0 && (
            <div className="rounded border border-emerald-700/40 bg-emerald-500/5 p-1.5 space-y-1">
              <div className="text-[10px] text-emerald-200 font-medium">
                Admit {eligibleAdmissionCount} eligible source{eligibleAdmissionCount === 1 ? "" : "s"}
              </div>
              <div className="flex gap-1.5">
                <select
                  value={admitProvenanceClass}
                  onChange={(e) => onAdmitProvenanceClassChange(e.target.value as ProvenanceClass | "")}
                  disabled={admitRunning}
                  className="flex-1 rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[10px] text-slate-200 disabled:opacity-50"
                >
                  <option value="">Evidence provenance…</option>
                  {PROVENANCE_CLASSES.map((pc) => (
                    <option key={pc} value={pc}>{pc}</option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={admitRationale}
                onChange={(e) => onAdmitRationaleChange(e.target.value)}
                disabled={admitRunning}
                placeholder="Rationale — recorded on every source admitted"
                className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[10px] text-slate-200 placeholder:text-slate-600 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => onAdmitEligible(decision)}
                disabled={admitRunning || !admitProvenanceClass || !admitRationale.trim()}
                className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold text-emerald-50 hover:bg-emerald-500/30 transition disabled:opacity-50"
              >
                {admitRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                {admitRunning
                  ? admitProgress
                    ? `${admitStatus ?? "Admitting…"} (${admitProgress.current}/${admitProgress.total})`
                    : (admitStatus ?? "Admitting…")
                  : `Admit ${eligibleAdmissionCount} eligible source${eligibleAdmissionCount === 1 ? "" : "s"}`}
              </button>
              {admitError && (
                <div className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-[10px] text-rose-300">
                  {admitError}
                  <button
                    type="button"
                    onClick={() => onAdmitEligible(decision)}
                    className="ml-1.5 underline decoration-rose-700 hover:text-rose-100"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="text-[10px] text-slate-400">
            Inspect individually, or override a machine recommendation, in Review &amp; Admit.
          </div>
          <button
            type="button"
            onClick={() => onProceed(decision)}
            disabled={proceeding || admissionRunning || admitRunning}
            className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-violet-300/70 hover:text-violet-200 transition disabled:opacity-50"
          >
            {proceeding ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
            {proceeding ? "Confirming current state…" : "Open Review & Admit"}
          </button>
        </div>
      )}

      {decision && !decision.acquisitionBrief && !decision.verificationTarget && !(decision.reviewQueue && decision.reviewQueue.length > 0) && !(admissionQueue && admissionQueue.length > 0) && (
        <div className="rounded border border-violet-500/40 bg-violet-500/10 px-2 py-2 space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-violet-300 font-semibold">
            {decision.authority === "governance" ? "Your constitutional act" : "Your judgment"} — {decision.stageLabel}
          </div>
          <div className="text-[11px] text-slate-200">{decision.detail}</div>
          <div className="text-[10px] text-slate-400">Performed by: {decision.actor}</div>
          {decision.remedies.map((r, i) => (
            <div key={i} className="text-[10px] text-slate-300 flex gap-1.5">
              <span className="text-slate-500 shrink-0">·</span>
              <span className="break-words">{r}</span>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onProceed(decision)}
            disabled={proceeding}
            className="mt-1 inline-flex items-center gap-1 rounded border border-violet-500/40 bg-violet-500/15 px-2 py-1 text-[10px] font-semibold text-violet-100 hover:bg-violet-500/25 transition disabled:opacity-50"
          >
            {proceeding ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
            {proceeding ? "Confirming current state…" : `Open ${decision.stageLabel}`}
          </button>
          {/* SYNC ERROR — never navigate on stale state (2026-08-27 fix,
              required contract item 8): if advance or the post-advance
              Track 2 read failed, say so and offer Retry instead of opening
              whatever was last rendered. */}
          {proceedError && (
            <div className="mt-1 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-[10px] text-rose-300">
              Could not confirm the current Track 2 state before opening it — {proceedError}.
              <button
                type="button"
                onClick={() => onProceed(decision)}
                className="ml-1.5 underline decoration-rose-700 hover:text-rose-100"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {run && (
        <div className="space-y-2.5">
          {/* The one line that says what happened. Never describes a partial run
              as complete — `actExecution` is derived server-side. */}
          <div
            className={`rounded border px-2 py-1.5 text-[11px] ${
              run.actExecution === "partial" || run.actExecution === "failed"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                : "border-slate-700 bg-slate-900/50 text-slate-200"
            }`}
          >
            {run.headline}
          </div>

          {/* THE SEQUENCING GATE — always shown, open or closed, so a run report
              never conceals whether acquisition-class work was permitted. */}
          {gate && (
            <div
              className={`rounded border px-2 py-1.5 space-y-1 ${
                gate.satisfied
                  ? "border-emerald-700/50 bg-emerald-950/20"
                  : "border-slate-700 bg-slate-900/50"
              }`}
            >
              <div className="flex items-center gap-1.5">
                {gate.satisfied ? (
                  <ShieldCheck className="h-3 w-3 text-emerald-300" />
                ) : (
                  <Lock className="h-3 w-3 text-slate-400" />
                )}
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                  Measurement layer {gate.satisfied ? "hardened" : "not yet hardened"}
                  {gate.binding ? ` · ${gate.binding}` : ""}
                </span>
              </div>
              {gate.satisfied ? (
                <div className="text-[10px] text-slate-400 break-words">{gate.detail}</div>
              ) : (
                gate.gaps.map((g, i) => (
                  <div key={i} className="flex gap-1.5 text-[10px]">
                    <span className="text-slate-500">○</span>
                    <span className="text-slate-400 break-words">{g}</span>
                  </div>
                ))
              )}
              {!gate.satisfied && (
                <p className="text-[10px] text-slate-500">
                  New extraction and crystal construction stay withheld until both hold. This is an engineering
                  precondition, not a decision for you.
                </p>
              )}
            </div>
          )}

          {/* Acts executed — the capability each one called, verbatim. */}
          {run.acts.length > 0 && (
            <div className="space-y-1">
              {run.acts.map((a) => (
                <div key={a.actKind} className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className={a.ok ? "text-emerald-400" : "text-rose-400"}>{a.ok ? "✓" : "✕"}</span>
                  <span className="font-mono text-slate-300">{a.actKind}</span>
                  <span className="text-slate-400 break-words flex-1 min-w-0">{a.detail}</span>
                  {a.deferredRecordIds.length > 0 && (
                    <span className="text-amber-400/80">{a.deferredRecordIds.length} not reached</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* THE COUNTERWEIGHT — the full population, always, so isolation can
              never quietly narrow the corpus until readiness passes. */}
          <div>
            <div className="text-[9px] uppercase tracking-wide text-slate-500 mb-1">Population (disclosed)</div>
            <div className="grid grid-cols-4 gap-1">
              <PopCell label="Discovered" value={run.population.discovered} />
              <PopCell label="Admitted" value={run.population.admitted} />
              <PopCell label="Extracted" value={run.population.candidatesExtracted} />
              <PopCell label="Validated" value={run.population.validated} />
              <PopCell label="Assigned" value={run.population.assignedToCrystal} />
              <PopCell label="Warnings" value={run.population.excludedWithWarnings} />
              <PopCell label="Exceptions" value={run.population.exceptions} />
              <PopCell label="Refused" value={run.population.refused} />
            </div>
            {run.populationUnreadable.length > 0 && (
              <p className="text-[10px] text-amber-400/80 mt-1">
                Unreadable signal(s): {run.populationUnreadable.join("; ")} — a zero above may be an absence of
                data rather than a fact.
              </p>
            )}
          </div>

          {/* Isolated records — visible, never discarded, and never a blocker. */}
          {run.isolation.exceptions.length > 0 && (
            <div className="space-y-1">
              <div className="text-[9px] uppercase tracking-wide text-slate-500">
                Isolated locally ({run.isolation.exceptions.length}) — the run continued over the safe remainder
              </div>
              {run.isolation.exceptions.slice(0, 5).map((e) => (
                <div key={e.recordId} className="text-[10px] text-slate-400 break-words">
                  <span className="font-mono text-slate-500">{e.causeGroup}</span> · {e.recordLabel} — {e.cause}
                </div>
              ))}
              {run.isolation.exceptions.length > 5 && (
                <button
                  type="button"
                  onClick={onOpenDetail}
                  className="text-[10px] text-sky-300/80 hover:text-sky-200 transition"
                >
                  {run.isolation.exceptions.length - 5} more on the Track 2 exceptions surface →
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
            <span>{run.criticalPath.milestoneImpact}</span>
            {run.receipt.receiptId ? (
              <span className="text-emerald-400/80">receipted ✓ {run.receipt.receiptId.slice(0, 8)}</span>
            ) : (
              <span className="text-amber-400/80">run receipt not written — the acts above still happened</span>
            )}
          </div>

          {/* What the automation structurally cannot do, stated rather than trusted. */}
          <details className="text-[10px] text-slate-500">
            <summary className="cursor-pointer hover:text-slate-300 transition">
              What this run could not do ({run.guardrails.length})
            </summary>
            <ul className="mt-1 space-y-0.5">
              {run.guardrails.map((g, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="shrink-0">·</span>
                  <span className="break-words">{g}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

      {!run && !error && (
        <p className="text-[10px] text-slate-500">
          {programme
            ? "Not run yet — the state above is current. One click performs every act that can safely proceed and stops at the first decision that is genuinely yours — the freeze is always yours, and is never performed here."
            : "Not run yet. One click performs every act that can safely proceed and stops at the first decision that is genuinely yours — the freeze is always yours, and is never performed here."}
        </p>
      )}
    </div>
  );
}

export default function IRLResearchCopilotTab({ personaId }: IRLResearchCopilotTabProps) {
  const [overview, setOverview] = useState<OverviewEntry[] | null>(null);
  const [artifactProduction, setArtifactProduction] = useState<ArtifactProductionView | null>(null);
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

  // ── OBJECTIVE: Prepare Crystal v2 — the orchestration head's own state.
  // ONE run at a time, and the result of the LAST run. No polling and no
  // auto-invocation: the run is an explicit steward act, so nothing here may
  // start one on mount or on a state change.
  const [programmeRun, setProgrammeRun] = useState<ProgrammeRunResult | null>(null);
  const [programmeRunning, setProgrammeRunning] = useState(false);
  const [programmeError, setProgrammeError] = useState<string | null>(null);
  // ── THE PROCEED SEQUENCE (2026-08-27 fix) — separate from `programmeRunning`/
  // `programmeError` above: those track "Run until you need me" (the
  // objective's own act-execution loop); these track the pending-decision
  // CTA's own advance-then-refresh-then-navigate sequence
  // (`services/research/track2ProceedNavigation.ts`). Conflating the two
  // would make the Run button spin while the operator is only confirming
  // where to navigate, or vice versa.
  const [proceeding, setProceeding] = useState(false);
  const [proceedError, setProceedError] = useState<string | null>(null);
  // Read-only Track 2 state preview — loaded on mount/refresh (GET, no acts
  // executed) so the objective's "where are we" is visible on OPEN, not only
  // after the first "Run until you need me" (2026-08-26 reconciliation).
  // Distinct from `programmeRun` above: this never runs anything, so it is
  // safe to fetch on mount alongside overview/results, unlike the run itself.
  const [programmePreview, setProgrammePreview] = useState<Track2Programme | null>(null);
  // The outstanding human/governance gate, re-derived on the SAME read as
  // `programmePreview` above (2026-08-26 deep-link + durability fix). This is
  // what makes the pending judgment survive navigate-away-and-back: it is
  // recomputed from authoritative Track 2 state on every mount/refresh, never
  // held only in the ephemeral `programmeRun` (POST-only) state below.
  const [pendingDecisionPreview, setPendingDecisionPreview] = useState<PendingGovernanceDecision | null>(null);
  // ── "APPROVE TARGETED ACQUISITION" (2026-08-30) — separate from
  // `proceeding`/`proceedError` (the generic "Open <stage>" navigation
  // sequence): this tracks the approve → bounded run-step loop → continue
  // programme sequence, which performs real writes and real acquisition
  // acts, never just a navigation confirmation.
  const [acquisitionRunning, setAcquisitionRunning] = useState(false);
  const [acquisitionError, setAcquisitionError] = useState<string | null>(null);
  const [acquisitionStatus, setAcquisitionStatus] = useState<string | null>(null);
  // ── RUN INSTITUTION VERIFICATION (2026-08-31) — the SAME shape as the
  // acquisition trio above, for the bounded verify-step loop.
  const [verificationRunning, setVerificationRunning] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  // ── REVIEW & PROMOTE (2026-08-30) — per-candidate disposition state.
  // `reviewBusyId` is the candidateId currently in flight (or null); every
  // OTHER candidate's buttons disable too while one is in flight, so the
  // server-derived queue count and the UI never race.
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  // ── RESOLVE DETERMINISTIC DUPLICATES (2026-08-31, "Review & Admit
  // machine-preparation" repair) — the SAME shape as the verification trio
  // above, for the bounded (single-call, no external HTTP) duplicate-
  // resolution write.
  const [admissionRunning, setAdmissionRunning] = useState(false);
  const [admissionError, setAdmissionError] = useState<string | null>(null);
  const [admissionStatus, setAdmissionStatus] = useState<string | null>(null);
  // ── ADMIT ELIGIBLE SOURCES (2026-09-01) — the ONE cohort-level ratification
  // act (`onAdmitEligible` below), separate from `admissionRunning` (the
  // duplicate-resolution trio above) so the two controls never disable each
  // other. `admitProvenanceClass`/`admitRationale` are the ONE steward
  // judgement the whole eligible cohort shares — required before the button
  // enables, mirroring `BulkAdmissionControl`'s own `requiresProvenanceClass`
  // gate (Track2ProgrammePanel.tsx), never guessed or defaulted.
  const [admitRunning, setAdmitRunning] = useState(false);
  const [admitError, setAdmitError] = useState<string | null>(null);
  const [admitStatus, setAdmitStatus] = useState<string | null>(null);
  const [admitProgress, setAdmitProgress] = useState<{ current: number; total: number } | null>(null);
  const [admitProvenanceClass, setAdmitProvenanceClass] = useState<ProvenanceClass | "">("");
  const [admitRationale, setAdmitRationale] = useState("");

  // ── CLASSIFY PROVENANCE COHORT (2026-09-04) — the SAME "ONE decision
  // surface" pattern as ADMIT ELIGIBLE SOURCES above, but deliberately fetched
  // and ratified through its OWN lightweight
  // `/api/research/track2/[experimentId]/provenance-cohort` endpoint, never
  // through the heavy full `pendingDecision` composition — this is the fix
  // for the 15s programme-composition timeout that was blocking Stage 5's
  // action from even opening: the cohort's own identity (cohortHash) and
  // eligibility are cheap to derive on their own, so this card must not wait
  // on the full 11-stage Track 2 read model to finish. `provenanceCohortPreview`
  // is per-experiment (`Record<experimentId, ...>`) exactly like `programmePreview`
  // conceptually, but scoped to ONE objective's card at a time in practice
  // (RESEARCH_OBJECTIVES today has one Track 2 experiment).
  const [provenanceCohortPreview, setProvenanceCohortPreview] = useState<ProvenanceCohortView | null>(null);
  const [provenanceCohortLoading, setProvenanceCohortLoading] = useState(false);
  const [provenanceRationale, setProvenanceRationale] = useState("");
  const [provenanceRatifying, setProvenanceRatifying] = useState(false);
  const [provenanceRatifyError, setProvenanceRatifyError] = useState<string | null>(null);
  const [provenanceRatifyStatus, setProvenanceRatifyStatus] = useState<string | null>(null);

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
      setArtifactProduction((data.artifactProduction as ArtifactProductionView) ?? null);
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
    // Objective: Prepare Crystal v2 — the read-only Track 2 preview, one call
    // per registered objective's experimentId. `experimentGet` is not reused
    // here: this route answers `{ requestSucceeded, programme }`, not the
    // `{ ok }` shape `experimentGet` expects (services/research/track2Programme.ts's
    // own contract, GET /api/research/track2/[experimentId]) — never runs
    // anything, so it is safe alongside the other read-only calls above.
    for (const objective of RESEARCH_OBJECTIVES) {
      try {
        const res = await personaFetch(`/api/research/track2/${encodeURIComponent(objective.experimentId)}`, {
          cache: "no-store",
          ...(personaId ? { personaIdHint: personaId } : {}),
        });
        const data = (await res.json().catch(() => null)) as {
          requestSucceeded?: boolean;
          programme?: Track2Programme;
          pendingDecision?: PendingGovernanceDecision | null;
          unreadableSignals?: string[];
        } | null;
        // A GOOD FETCH CARRYING AN HONEST "I COULD NOT READ THIS" ANSWER IS
        // THE SAME CASE AS A FAILED FETCH (RES-2026-09-01-TRACK2-FAIL-SOFT-
        // SWALLOWED-001, applying the existing "never clear an already-loaded
        // preview" discipline below to a SECOND way a read can degrade). A
        // transient `corpus_candidate_sources`/`discovery_candidates` read
        // failure now correctly surfaces as `unreadableSignals` (never as a
        // false empty cohort — see `listCandidateSources`), but the pending
        // decision it feeds (e.g. "Review & Admit — 18 source(s)") would
        // still wrongly vanish for the duration of that failure if this
        // preview blindly adopted every 200 OK. A pending human judgment does
        // not evaporate on refresh merely because the NEXT read of it was
        // temporarily unreadable — so a read naming one of the signals this
        // preview depends on is treated exactly like a failed fetch: skipped,
        // never adopted, never clearing what is already shown.
        const unreadable = data?.unreadableSignals ?? [];
        const affectsThisPreview = unreadable.some(
          (s) => s.includes("corpus_candidate_sources") || s.includes("discovery_candidates") || s.includes("promoted cohort"),
        );
        if (res.ok && data?.requestSucceeded && data.programme && !affectsThisPreview) {
          setProgrammePreview(data.programme);
          // Unlike the programme dot-strip above, `pendingDecision` MUST be
          // allowed to become null here — that is exactly how a resolved
          // judgment (a receipt landed) stops being presented as "next"
          // (reconciliation invariant: a pending gate remains the next act
          // only until a receipt resolves it, never longer, never a stale
          // ghost). Recomputed from the SAME authoritative read as the
          // programme itself — never from a locally-cached decision.
          setPendingDecisionPreview(data.pendingDecision ?? null);
          // CLASSIFY PROVENANCE COHORT (2026-09-04) — fetched here, DIRECTLY
          // against its own lightweight route, ONLY when this stage is
          // actually the pending one — never as a standing dependency of the
          // heavy Track 2 read above (that read is what previously carried
          // the 15s timeout risk into this card's very presence). Inlined
          // rather than calling the separately-declared `loadProvenanceCohortPreview`
          // to avoid a forward-reference across this large component body.
          if (data.pendingDecision?.stageId === "classify-provenance") {
            try {
              const cohortRes = await personaFetch(
                `/api/research/track2/${encodeURIComponent(objective.experimentId)}/provenance-cohort`,
                { cache: "no-store", ...(personaId ? { personaIdHint: personaId } : {}) },
              );
              const cohortData = await cohortRes.json().catch(() => null) as {
                ok?: boolean; total?: number; readyCount?: number; exceptionCount?: number; cohortHash?: string; summary?: string;
              } | null;
              if (cohortRes.ok && cohortData?.ok) {
                setProvenanceCohortPreview({
                  experimentId: objective.experimentId,
                  total: cohortData.total ?? 0,
                  readyCount: cohortData.readyCount ?? 0,
                  exceptionCount: cohortData.exceptionCount ?? 0,
                  cohortHash: cohortData.cohortHash ?? "",
                  summary: cohortData.summary ?? "",
                });
              }
            } catch {
              /* best-effort — never blocks the rest of refresh */
            }
          }
        }
        // A failed preview never blocks the rest of refresh, and never clears
        // an already-loaded preview — an honest "could not confirm just now"
        // is preferable to the card flickering back to "not observed".
      } catch {
        /* preview is best-effort; the objective card degrades to "not run yet" */
      }
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
  }, [observe, personaId]);

  const openedRef = useRef(false);
  useEffect(() => {
    if (!openedRef.current) {
      openedRef.current = true;
      observe(surfaceOpenedEvent(SURFACE));
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Design-stage hand-off (2026-07-19): the Experiment Lab's design-stage panels
  // (EXP-007/008, EXP-P1..P3) can flow a not-yet-runnable experiment INTO the
  // copilot to be developed into a constitutionally-compliant protocol. The
  // panel dispatches `irl:develop-experiment` with the experiment context; the
  // copilot scopes to it and seeds the develop intent (observed, not asserted).
  useEffect(() => {
    const onDevelop = (e: Event) => {
      const d = (e as CustomEvent).detail as { experimentId?: string; family?: string; hypothesis?: string } | undefined;
      if (!d?.experimentId) return;
      setActiveExperimentId(d.experimentId);
      observe(surfacePromptSelectedEvent(
        SURFACE,
        `develop ${d.experimentId}${d.family ? ` (${d.family})` : ""} into a constitutionally-compliant experiment${d.hypothesis ? ` — hypothesis: ${d.hypothesis}` : ""}`,
      ));
    };
    window.addEventListener('irl:develop-experiment', onDevelop as EventListener);
    return () => window.removeEventListener('irl:develop-experiment', onDevelop as EventListener);
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
      window.dispatchEvent(new CustomEvent('codex:navigate-tab', { detail: { tab: 'irl-experiment-lab' } }));
    } catch { /* non-fatal — the honest pointer text still names the tab */ }
  }, [observe]);

  /**
   * CANONICAL DEEP-LINK NAVIGATION (2026-08-26) — opens the EXACT Track 2
   * stage a pending decision names, never the generic Experiment Lab.
   * Consumes `deepLink` verbatim (programme/experiment/stage/surfaceRef,
   * resolved server-side by `firstPendingDecision` /
   * `buildTrack2DeepLink`) — this function reconstructs nothing.
   *
   * `setPendingTrack2Stage` is called SYNCHRONOUSLY, before the
   * `codex:navigate-tab` dispatch that switches the cartridge tab and mounts
   * `InvariantExperimentLab` — see track2DeepLinkIntent.ts for why the intent
   * must be written before, not after, that mount.
   */
  const goToTrack2Stage = useCallback((deepLink: Track2DeepLink) => {
    observe(surfacePromptSelectedEvent(SURFACE, `run hand-off: opened ${deepLink.stageLabel} directly (Track 2 deep-link)`));
    setPendingTrack2Stage(deepLink);
    try {
      window.dispatchEvent(new CustomEvent('codex:navigate-tab', { detail: { tab: deepLink.surfaceRef.cartridgeTab } }));
    } catch { /* non-fatal — the honest pointer text still names the stage */ }
  }, [observe]);

  /**
   * "RUN UNTIL YOU NEED ME" — the objective's single control.
   *
   * MUST ride `personaFetch`: the advance route resolves the caller through the
   * spine, and raw `fetch` (or `authedFetchHeaders`) either 401s or silently
   * resolves the WRONG persona. `personaIdHint` is passed because this surface
   * has the active personaId to hand, so every read and write on it resolves the
   * same identity (CLAUDE.md, Identity & Access Spine).
   *
   * `experimentGet`'s wrapper is not reused here: it requires `ok === true` AND
   * throws on a non-2xx, which would discard the server's own honest account of
   * a partial run. A partial run is a RESULT, not an error.
   */
  const runProgramme = useCallback(async (experimentId: string) => {
    setProgrammeRunning(true);
    setProgrammeError(null);
    observe(surfacePromptSelectedEvent(SURFACE, `objective run started: prepare-crystal-v2 (${experimentId})`));
    try {
      const res = await personaFetch(
        `/api/research/programme/${encodeURIComponent(experimentId)}/advance`,
        { method: "POST", cache: "no-store", ...(personaId ? { personaIdHint: personaId } : {}) },
      );
      const text = await res.text();
      let data: Record<string, unknown> | null = null;
      if (text.trim().length > 0) {
        try { data = JSON.parse(text) as Record<string, unknown>; } catch { /* handled below */ }
      }
      if (!res.ok || !data || data.ok !== true) {
        const message =
          (data && typeof data.error === "string" && data.error) ||
          (text.trim().length === 0 ? `HTTP ${res.status} with empty body` : `HTTP ${res.status}`);
        setProgrammeError(message);
        setProgrammeRunning(false);
        return;
      }
      const run = data.run as ProgrammeRunResult;
      setProgrammeRun(run);
      observe(surfacePromptSelectedEvent(SURFACE, `objective run finished: ${run.headline}`));
      // The programme moved, so the observed lab state is now stale. Refresh
      // rather than patch — the substrate is the authority, not this component.
      void refresh();
    } catch (err) {
      setProgrammeError(err instanceof Error ? err.message : "the run could not be started");
    }
    setProgrammeRunning(false);
  }, [observe, personaId, refresh]);

  /**
   * "APPROVE TARGETED ACQUISITION" (2026-08-30, operator directive: "turn
   * Discover Sources into a precise Copilot authorization, not another
   * navigation exercise"). ONE steward click drives the whole authorized
   * sequence:
   *
   *   1. POST .../acquisition/approve — the ONE human act. Refused server-side
   *      (409) if nothing currently requires acquisition; that refusal
   *      surfaces here as an honest error, never silently swallowed.
   *   2. POST .../acquisition/run-step, repeated — EACH call is bounded to one
   *      ratified+verified institution (`runOneAcquisitionStep`), never an
   *      unbounded sweep. Stops the moment the server reports `done: true`
   *      (readiness satisfied OR every ratified institution attempted) —
   *      this loop is driven by the SERVER's own signal, never by assuming
   *      the brief's deficit count is a fixed quota. `MAX_CLIENT_STEPS` is a
   *      client-side backstop only, in case that signal is ever wrong; it is
   *      not the authority on when to stop.
   *   3. `runProgramme(experimentId)` — the SAME "Run until you need me" the
   *      objective's own button calls, so the programme continues with
   *      extract-candidates/validate-cohort over whatever was just admitted,
   *      and readiness is re-derived fresh rather than assumed satisfied.
   *
   * Never navigates to another page as its primary action (operator
   * requirement) — "Open Discover Sources" remains available separately,
   * unchanged, as `onProceed`/`proceedToDecision` already provide.
   */
  const MAX_CLIENT_ACQUISITION_STEPS = 40;

  /**
   * THE BOUNDED DISCOVERY LOOP — extracted (2026-08-31) so
   * `approveTargetedAcquisition` and `runInstitutionVerification` share the
   * exact same client-side driving logic for
   * `POST .../acquisition/run-step` rather than two copies. Driven by the
   * server's own `done` signal, never by assuming a fixed institution
   * count; `MAX_CLIENT_ACQUISITION_STEPS` is a client-side backstop only.
   */
  const runDiscoverySteps = useCallback(async (experimentIdForDecision: string, setStatus: (s: string) => void) => {
    for (let i = 0; i < MAX_CLIENT_ACQUISITION_STEPS; i++) {
      const stepRes = await personaFetch(
        `/api/research/programme/${encodeURIComponent(experimentIdForDecision)}/acquisition/run-step`,
        {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          ...(personaId ? { personaIdHint: personaId } : {}),
        },
      );
      const stepData = await stepRes.json().catch(() => null) as {
        ok?: boolean;
        error?: string;
        institution?: { institutionName: string } | null;
        exhausted?: boolean;
        readinessSatisfied?: boolean;
        done?: boolean;
      } | null;
      if (!stepRes.ok || !stepData || stepData.ok !== true) {
        throw new Error((stepData && typeof stepData.error === "string" && stepData.error) || `HTTP ${stepRes.status}`);
      }
      setStatus(
        stepData.institution
          ? `Discovering via ${stepData.institution.institutionName}…`
          : "No further ratified institution to attempt…",
      );
      observe(surfacePromptSelectedEvent(
        SURFACE,
        `acquisition step: ${stepData.institution?.institutionName ?? "none"} — exhausted=${stepData.exhausted}, readinessSatisfied=${stepData.readinessSatisfied}`,
      ));
      if (stepData.done) break;
    }
  }, [observe, personaId]);

  const approveTargetedAcquisition = useCallback(async (decision: PendingGovernanceDecision) => {
    const experimentIdForDecision = decision.deepLink.experimentId;
    setAcquisitionRunning(true);
    setAcquisitionError(null);
    setAcquisitionStatus("Approving targeted acquisition…");
    observe(surfacePromptSelectedEvent(SURFACE, `targeted acquisition approval requested (${experimentIdForDecision})`));
    try {
      const approveRes = await personaFetch(
        `/api/research/programme/${encodeURIComponent(experimentIdForDecision)}/acquisition/approve`,
        {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          ...(personaId ? { personaIdHint: personaId } : {}),
        },
      );
      const approveData = await approveRes.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!approveRes.ok || !approveData || approveData.ok !== true) {
        throw new Error((approveData && typeof approveData.error === "string" && approveData.error) || `HTTP ${approveRes.status}`);
      }
      observe(surfacePromptSelectedEvent(SURFACE, `targeted acquisition approved (${experimentIdForDecision})`));

      await runDiscoverySteps(experimentIdForDecision, setAcquisitionStatus);

      setAcquisitionStatus("Continuing the programme…");
      await runProgramme(experimentIdForDecision);
      setAcquisitionStatus(null);
    } catch (err) {
      setAcquisitionError(err instanceof Error ? err.message : "targeted acquisition failed");
      setAcquisitionStatus(null);
    }
    setAcquisitionRunning(false);
  }, [observe, personaId, runProgramme, runDiscoverySteps]);

  /**
   * "RUN INSTITUTION VERIFICATION" (2026-08-31, "targeted-acquisition
   * ratified-but-unverified dead end" repair). Traced from
   * `services/corpusScout/registryVerification.ts` before this was written:
   * `verifyInstitutionEntry` is a deterministic, bounded, already-Steward-
   * authorised machine act (no human judgement decides its outcome) — the
   * constitutional rule is that such an act is EXECUTED by "Run until you
   * need me", never left as a diagnostic-only dead end. No fresh approval is
   * requested here — `decision.verificationTarget` only appears when an
   * approval is ALREADY active, so this click drives:
   *
   *   1. POST .../acquisition/verify-step, repeated — EACH call performs
   *      EXACTLY ONE bounded phase (resolve-seed / discover-candidates /
   *      fetch-document[cursor]) for one institution
   *      (`runOneInstitutionVerificationStep` -> `runVerificationStep`,
   *      2026-08-31 "verification wall-clock granularity" repair — a live
   *      HTTP 504 on this exact route for BIS proved one-institution-per-
   *      call was not bounded enough, since one institution alone can chain
   *      resolve + discover + up to five document fetches). A `status:
   *      'in-progress'` response is a NORMAL step, not an error — the loop
   *      just calls again; nineteen institutions now legitimately take many
   *      more (individually fast) round-trips than before, hence the much
   *      larger client-side backstop below. Stops on the server's own
   *      `done: true` (nothing left with any outstanding verification
   *      work), never on a fixed institution count.
   *   2. `runDiscoverySteps` — the SAME bounded discovery loop
   *      `approveTargetedAcquisition` uses (no second implementation) —
   *      recomputing eligibility fresh; if verification made ≥1 institution
   *      eligible, discovery proceeds for it in this SAME bounded run.
   *   3. `runProgramme` — continues the programme exactly like the
   *      acquisition flow's own final step.
   */
  const MAX_CLIENT_VERIFICATION_STEPS = 400;
  const runInstitutionVerification = useCallback(async (decision: PendingGovernanceDecision) => {
    const experimentIdForDecision = decision.deepLink.experimentId;
    setVerificationRunning(true);
    setVerificationError(null);
    setVerificationStatus("Verifying ratified institutions…");
    observe(surfacePromptSelectedEvent(SURFACE, `institution verification requested (${experimentIdForDecision})`));
    try {
      for (let i = 0; i < MAX_CLIENT_VERIFICATION_STEPS; i++) {
        const stepRes = await personaFetch(
          `/api/research/programme/${encodeURIComponent(experimentIdForDecision)}/acquisition/verify-step`,
          {
            method: "POST",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
            ...(personaId ? { personaIdHint: personaId } : {}),
          },
        );
        const stepData = await stepRes.json().catch(() => null) as {
          ok?: boolean;
          error?: string;
          status?: string;
          institution?: { institutionName: string } | null;
          diagnostics?: { phase?: string; cursor?: number } | null;
          done?: boolean;
        } | null;
        if (!stepRes.ok || !stepData || stepData.ok !== true) {
          throw new Error((stepData && typeof stepData.error === "string" && stepData.error) || `HTTP ${stepRes.status}`);
        }
        setVerificationStatus(
          stepData.institution
            ? `Verifying ${stepData.institution.institutionName} — ${stepData.diagnostics?.phase ?? stepData.status}${typeof stepData.diagnostics?.cursor === "number" ? ` (${stepData.diagnostics.cursor})` : ""}…`
            : "No further ratified institution to verify…",
        );
        observe(surfacePromptSelectedEvent(
          SURFACE,
          `verification step: ${stepData.institution?.institutionName ?? "none"} — status=${stepData.status}, phase=${stepData.diagnostics?.phase ?? "n/a"}`,
        ));
        if (stepData.done) break;
      }

      setVerificationStatus("Checking for eligible institutions…");
      await runDiscoverySteps(experimentIdForDecision, setVerificationStatus);

      setVerificationStatus("Continuing the programme…");
      await runProgramme(experimentIdForDecision);
      setVerificationStatus(null);
    } catch (err) {
      setVerificationError(err instanceof Error ? err.message : "institution verification failed");
      setVerificationStatus(null);
    }
    setVerificationRunning(false);
  }, [observe, personaId, runProgramme, runDiscoverySteps]);

  /**
   * "RESOLVE DETERMINISTIC DUPLICATES" (2026-08-31, "Review & Admit
   * machine-preparation" repair) — the Copilot control for
   * `decision.duplicateResolutions`: exact-duplicate groups whose quality
   * signals already separate the copies (`kind:
   * 'recommended-resolution-available'`), so no per-source human judgement
   * about WHICH document this is exists to make. Drives the EXISTING
   * `POST /api/corpus-scout/candidates/resolve-duplicates` (non-dry-run, no
   * `groupKeys` filter — resolves every deterministic group in one call) —
   * never a second duplicate-resolution write path. One bounded write, then
   * `runProgramme` re-reads the authoritative state so the card reflects
   * what remains (which may now be nothing, or only genuinely ambiguous
   * groups and/or admission recommendations still awaiting ratification).
   */
  const resolveDeterministicDuplicates = useCallback(async (decision: PendingGovernanceDecision) => {
    const experimentIdForDecision = decision.deepLink.experimentId;
    const campaignDomain = decision.admissionDomain;
    if (!campaignDomain) {
      setAdmissionError("no acquisition domain was carried on this decision — cannot resolve duplicates");
      return;
    }
    setAdmissionRunning(true);
    setAdmissionError(null);
    setAdmissionStatus("Resolving deterministic duplicates…");
    observe(surfacePromptSelectedEvent(SURFACE, `resolve deterministic duplicates requested (${experimentIdForDecision})`));
    try {
      const res = await personaFetch(`/api/corpus-scout/candidates/resolve-duplicates`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignDomain, dryRun: false }),
        ...(personaId ? { personaIdHint: personaId } : {}),
      });
      const data = await res.json().catch(() => null) as { ok?: boolean; error?: string; resolved?: number } | null;
      if (!res.ok || !data || data.ok !== true) {
        throw new Error((data && typeof data.error === "string" && data.error) || `HTTP ${res.status}`);
      }
      setAdmissionStatus(`Resolved ${data.resolved ?? 0} duplicate alias(es) — continuing the programme…`);
      await runProgramme(experimentIdForDecision);
      setAdmissionStatus(null);
    } catch (err) {
      setAdmissionError(err instanceof Error ? err.message : "duplicate resolution failed");
      setAdmissionStatus(null);
    }
    setAdmissionRunning(false);
  }, [observe, personaId, runProgramme]);

  /**
   * "ADMIT ELIGIBLE SOURCES" (2026-09-01) — the cohort-level ratification act
   * requirement #3 asks for: the Steward approves the WHOLE machine-prepared
   * eligible cohort (`disposition: 'ready' | 'ready-with-warning'`) as ONE
   * judgement (one `provenanceClass` + one rationale), and this drives the
   * bounded execution to completion rather than deep-linking into Review &
   * Admit for 59 individual decisions.
   *
   * Reuses, never reimplements:
   *   - `admissionQueue`'s own `reviewDecision` per source (already computed
   *     by `composeAdmissionRecommendation` — never re-derived here). The
   *     eligible cohort is grouped by this value because
   *     `POST /api/corpus-scout/candidates/bulk-review` requires ONE shared
   *     decision per call ("every source in the batch is admitted under the
   *     SAME evidence-provenance class" — the route's own rule, unchanged).
   *   - `partitionForExecution` (`executionAbsorption.ts`) for the ≤25-source
   *     batching within each group — the SAME client-side absorption
   *     `BulkAdmissionControl` uses, not a second batching scheme.
   *   - `decision.admissionCohortHash` — echoed back as `expectedCohortHash`
   *     so the route refuses (fails closed) if the corpus moved since this
   *     cohort was prepared, rather than silently admitting a stale set.
   *   - `runProgramme` — the SAME "Run until you need me" continuation
   *     `resolveDeterministicDuplicates` above already uses, so Track 2 auto-
   *     advances past Stage 2 once nothing eligible remains.
   *
   * Isolation: groups are attempted INDEPENDENTLY — a failure partway through
   * one admissionClass group (e.g. 'general finance') never withholds
   * another ('EXP-P1 evidence') that has nothing to do with it. Within one
   * group, a batch failure stops THAT group (mirroring
   * `BulkAdmissionControl`'s own stop-on-first-failure — a partially-applied
   * group must never be reported as fully admitted). The 6 manual-review
   * exceptions are never included in any group — `disposition` already
   * excludes them upstream in `admissionQueue` itself.
   */
  const admitEligibleCohort = useCallback(async (decision: PendingGovernanceDecision) => {
    const campaignDomain = decision.admissionDomain;
    const queue = decision.admissionQueue ?? [];
    if (!campaignDomain) {
      setAdmitError("no acquisition domain was carried on this decision — cannot admit");
      return;
    }
    if (!admitProvenanceClass) {
      setAdmitError("choose an evidence provenance class before admitting — every source in this cohort is admitted under it");
      return;
    }
    if (!admitRationale.trim()) {
      setAdmitError("a rationale is required — it is recorded on every source admitted");
      return;
    }

    const eligible = queue.filter((r) => r.disposition === "ready" || r.disposition === "ready-with-warning");
    const groups = new Map<string, string[]>();
    for (const r of eligible) {
      if (!r.reviewDecision) continue; // Cannot occur for an eligible disposition, but never assumed.
      groups.set(r.reviewDecision, [...(groups.get(r.reviewDecision) ?? []), r.sourceId]);
    }
    if (groups.size === 0) {
      setAdmitError("no eligible source carries an admission decision — nothing to admit");
      return;
    }

    const groupPlans = [...groups.entries()].map(([reviewDecision, sourceIds]) => ({
      reviewDecision,
      batches: partitionForExecution(sourceIds),
    }));
    const totalBatches = groupPlans.reduce((n, g) => n + g.batches.length, 0);

    setAdmitRunning(true);
    setAdmitError(null);
    setAdmitStatus("Admitting eligible cohort…");
    setAdmitProgress({ current: 0, total: totalBatches });
    observe(surfacePromptSelectedEvent(SURFACE, `admit eligible cohort requested (${eligible.length} source(s), ${groupPlans.length} class(es))`));

    let batchesDone = 0;
    let admitted = 0;
    let staleCohort = false;
    const groupFailures: string[] = [];

    try {
      for (const group of groupPlans) {
        if (staleCohort) break;
        for (const batch of group.batches) {
          const res = await personaFetch(`/api/corpus-scout/candidates/bulk-review`, {
            method: "POST",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceIds: batch.sourceIds,
              decision: group.reviewDecision,
              notes: admitRationale.trim(),
              provenanceClass: admitProvenanceClass,
              dryRun: false,
              campaignDomain,
              expectedCohortHash: decision.admissionCohortHash,
            }),
            ...(personaId ? { personaIdHint: personaId } : {}),
          });
          const data = await res.json().catch(() => null) as {
            ok?: boolean; error?: string; detail?: string; written?: number;
          } | null;
          batchesDone += 1;
          setAdmitProgress({ current: batchesDone, total: totalBatches });
          if (!res.ok || !data || data.ok !== true) {
            if (data?.error === "recommendation-set-changed") {
              // THE PREPARED COHORT MOVED — fail closed on the WHOLE act, not
              // just this batch. A partial admission under a stale premise is
              // exactly the defect stale-cohort protection exists to prevent.
              staleCohort = true;
              setAdmitError(
                (data.detail as string | undefined) ??
                  "The prepared cohort has changed since it was shown. Refresh recommendations and reconfirm.",
              );
              break;
            }
            groupFailures.push(
              `${group.reviewDecision}: ${(data && typeof data.error === "string" && data.error) || `HTTP ${res.status}`}`,
            );
            break; // Stop THIS group; other groups still proceed.
          }
          admitted += data.written ?? 0;
        }
      }

      if (admitted > 0) {
        setAdmitStatus(
          `Admitted ${admitted} source(s)` +
            (groupFailures.length > 0 ? ` — ${groupFailures.length} class(es) stopped early: ${groupFailures.join("; ")}` : "") +
            " — continuing the programme…",
        );
        await runProgramme(decision.deepLink.experimentId);
      } else if (!staleCohort) {
        setAdmitError(groupFailures.join("; ") || "nothing was admitted");
      }
      if (admitted > 0 && groupFailures.length === 0 && !staleCohort) setAdmitStatus(null);
    } catch (err) {
      setAdmitError(err instanceof Error ? err.message : "cohort admission failed");
    }
    setAdmitProgress(null);
    setAdmitRunning(false);
  }, [observe, personaId, runProgramme, admitProvenanceClass, admitRationale]);

  /**
   * CLASSIFY PROVENANCE COHORT — read step (2026-09-04). Fetches
   * `GET /api/research/track2/[experimentId]/provenance-cohort` DIRECTLY —
   * never through `loadTrack2ProgrammeState`/`pendingDecision`. This is the
   * point of the fix: the operator reported clicking through from the
   * Copilot into "Record 1 of 55" one-at-a-time classification, with the
   * heavy full-composition read sometimes exceeding its safety budget along
   * the way. The provenance cohort's own identity (cohortHash) and
   * eligibility are cheap on their own — this card must not wait on the
   * full 11-stage Track 2 read model merely to show up.
   */
  const loadProvenanceCohortPreview = useCallback(async (experimentId: string) => {
    setProvenanceCohortLoading(true);
    try {
      const res = await personaFetch(`/api/research/track2/${encodeURIComponent(experimentId)}/provenance-cohort`, {
        cache: "no-store",
        ...(personaId ? { personaIdHint: personaId } : {}),
      });
      const data = await res.json().catch(() => null) as {
        ok?: boolean; total?: number; readyCount?: number; exceptionCount?: number; cohortHash?: string; summary?: string;
      } | null;
      if (res.ok && data?.ok) {
        setProvenanceCohortPreview({
          experimentId,
          total: data.total ?? 0,
          readyCount: data.readyCount ?? 0,
          exceptionCount: data.exceptionCount ?? 0,
          cohortHash: data.cohortHash ?? "",
          summary: data.summary ?? "",
        });
      }
      // A failed read is best-effort here too — never clears an already-shown
      // preview, mirroring every other preview fetch on this card.
    } catch {
      /* best-effort */
    }
    setProvenanceCohortLoading(false);
  }, [personaId]);

  /**
   * CLASSIFY PROVENANCE COHORT — the ONE ratification act ("Ratify provenance
   * cohort" button below), driving the SAME `POST .../provenance-cohort`
   * route Track2ProgrammePanel's `ProvenanceCohortRatificationBoard` uses —
   * never a second write path. `expectedCohortHash` is the exact hash the
   * last read showed, so the route fails closed (`recommendation-set-changed`)
   * if the cohort moved since — this component just re-reads and surfaces
   * that, exactly like `admitEligibleCohort`'s own stale-cohort handling
   * above. On success, continues the programme automatically via the SAME
   * `runProgramme` "Run until you need me" every other cohort act here uses,
   * so Validate/Relationships/Assignment proceed without a second click.
   */
  const ratifyProvenanceCohort = useCallback(async (experimentId: string) => {
    if (!provenanceCohortPreview || provenanceCohortPreview.experimentId !== experimentId) return;
    if (!provenanceRationale.trim()) {
      setProvenanceRatifyError("a rationale is required — it is recorded on every invariant classified");
      return;
    }
    setProvenanceRatifying(true);
    setProvenanceRatifyError(null);
    setProvenanceRatifyStatus("Ratifying provenance cohort…");
    observe(surfacePromptSelectedEvent(SURFACE, `ratify provenance cohort requested (${provenanceCohortPreview.readyCount} invariant(s))`));
    try {
      const res = await personaFetch(`/api/research/track2/${encodeURIComponent(experimentId)}/provenance-cohort`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun: false,
          rationale: provenanceRationale.trim(),
          expectedCohortHash: provenanceCohortPreview.cohortHash,
        }),
        ...(personaId ? { personaIdHint: personaId } : {}),
      });
      const data = await res.json().catch(() => null) as {
        ok?: boolean; error?: string; detail?: string; written?: number; failed?: number;
      } | null;
      if (data?.error === "recommendation-set-changed") {
        setProvenanceRatifyError(
          (data.detail as string | undefined) ?? "The prepared cohort has changed since it was shown. Refresh and reconfirm.",
        );
        await loadProvenanceCohortPreview(experimentId);
      } else if (!res.ok && !data?.ok) {
        setProvenanceRatifyError((data && typeof data.error === "string" && data.error) || `HTTP ${res.status}`);
      } else {
        setProvenanceRatifyStatus(`Classified ${data?.written ?? 0} invariant(s) — continuing the programme…`);
        setProvenanceRationale("");
        await loadProvenanceCohortPreview(experimentId);
        await runProgramme(experimentId);
        setProvenanceRatifyStatus(null);
      }
    } catch (err) {
      setProvenanceRatifyError(err instanceof Error ? err.message : "provenance cohort ratification failed");
    }
    setProvenanceRatifying(false);
  }, [observe, personaId, runProgramme, provenanceCohortPreview, provenanceRationale, loadProvenanceCohortPreview]);

  /**
   * REVIEW & PROMOTE — one steward disposition per click (2026-08-30,
   * "Review & Promote is a description, not a decision surface" fix).
   *
   *   1. POST /api/invariants/discovery { action, candidateId } — the EXACT
   *      canonical route `InvariantDiscoveryTab.tsx` itself calls for
   *      promote/reject (`promoteCandidate`/`rejectCandidate` server-side).
   *      No second promotion or rejection implementation.
   *   2. A fresh, direct GET /api/research/track2/[experimentId] — mirrors
   *      `proceedToDecision`'s own `readPendingDeepLink` step exactly, so
   *      this reads the SAME authoritative projection every other durable
   *      preview on this card reads, never a second derivation. The queue
   *      count this returns is what "2 awaiting → 1 → 0" is — recomputed
   *      fresh from `discovery_candidates`, never decremented client-side.
   *   3. When the fresh read shows NO further review-and-promote queue (all
   *      resolved, or the stage moved on) — automatically continue via the
   *      SAME `runProgramme` "Run until you need me" already uses. The
   *      operator never has to navigate back and manually restart it.
   */
  const submitReviewDecision = useCallback(async (
    decision: PendingGovernanceDecision,
    candidateId: string,
    action: "promote" | "reject",
  ) => {
    const experimentIdForDecision = decision.deepLink.experimentId;
    setReviewBusyId(candidateId);
    setReviewError(null);
    try {
      const res = await personaFetch("/api/invariants/discovery", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, candidateId }),
        ...(personaId ? { personaIdHint: personaId } : {}),
      });
      const data = await res.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data || data.ok !== true) {
        throw new Error((data && typeof data.error === "string" && data.error) || `HTTP ${res.status}`);
      }
      observe(surfacePromptSelectedEvent(SURFACE, `review-and-promote: ${action} candidate ${candidateId}`));

      const trackRes = await personaFetch(`/api/research/track2/${encodeURIComponent(experimentIdForDecision)}`, {
        cache: "no-store",
        ...(personaId ? { personaIdHint: personaId } : {}),
      });
      const trackData = await trackRes.json().catch(() => null) as {
        requestSucceeded?: boolean;
        programme?: Track2Programme;
        pendingDecision?: PendingGovernanceDecision | null;
      } | null;
      if (trackRes.ok && trackData?.requestSucceeded) {
        setProgrammePreview(trackData.programme ?? null);
        setPendingDecisionPreview(trackData.pendingDecision ?? null);
        const stillPending =
          trackData.pendingDecision?.stageId === "review-and-promote" &&
          (trackData.pendingDecision?.reviewQueue?.length ?? 0) > 0;
        if (!stillPending) {
          // All resolved (or the stage moved on) — resume automatically,
          // exactly the acceptance criterion: the operator never has to
          // navigate back and manually restart the programme.
          await runProgramme(experimentIdForDecision);
        }
      } else {
        setReviewError("the review decision was recorded, but the current Track 2 state could not be confirmed");
      }
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : `${action} failed`);
    }
    setReviewBusyId(null);
  }, [observe, personaId, runProgramme]);

  /**
   * THE PENDING-DECISION CTA's PROCEED SEQUENCE (2026-08-27 fix) —
   * `services/research/track2ProceedNavigation.ts`'s `proceedToTrack2Stage`
   * driven with real IO. Awaits a fresh `/advance` and a fresh authoritative
   * Track 2 GET BEFORE navigating, so the stage that opens is never the one
   * `decision` happened to name at click time — see that module's header for
   * the exact staleness this closes. Reuses `goToTrack2Stage`/
   * `goToExperimentLab` verbatim as the navigate/navigateGeneric
   * dependencies — this adds no second navigation mechanism.
   */
  const proceedToDecision = useCallback(async (decision: PendingGovernanceDecision) => {
    const experimentIdForDecision = decision.deepLink.experimentId;
    setProceeding(true);
    setProceedError(null);
    const outcome = await proceedToTrack2Stage({
      advance: async () => {
        const res = await personaFetch(
          `/api/research/programme/${encodeURIComponent(experimentIdForDecision)}/advance`,
          { method: "POST", cache: "no-store", ...(personaId ? { personaIdHint: personaId } : {}) },
        );
        const data = await res.json().catch(() => null) as { ok?: boolean; error?: string; run?: ProgrammeRunResult } | null;
        if (!res.ok || !data || data.ok !== true) {
          throw new Error((data && typeof data.error === "string" && data.error) || `HTTP ${res.status}`);
        }
        if (data.run) {
          setProgrammeRun(data.run);
          observe(surfacePromptSelectedEvent(SURFACE, `objective run finished: ${data.run.headline}`));
        }
      },
      readPendingDeepLink: async () => {
        const res = await personaFetch(`/api/research/track2/${encodeURIComponent(experimentIdForDecision)}`, {
          cache: "no-store",
          ...(personaId ? { personaIdHint: personaId } : {}),
        });
        const data = await res.json().catch(() => null) as {
          requestSucceeded?: boolean;
          programme?: Track2Programme;
          pendingDecision?: PendingGovernanceDecision | null;
        } | null;
        if (!res.ok || !data?.requestSucceeded) return undefined;
        // Fold the fresh read into the SAME preview state `refresh()` writes
        // — so the mini "you are here" panel and the decision card agree
        // with whatever this sequence just navigated on, rather than
        // reverting to whatever was there before the click.
        setProgrammePreview(data.programme ?? null);
        setPendingDecisionPreview(data.pendingDecision ?? null);
        return data.pendingDecision?.deepLink ?? null;
      },
      navigate: goToTrack2Stage,
      navigateGeneric: goToExperimentLab,
    });
    if (outcome.kind === 'advance-failed') setProceedError(outcome.error);
    else if (outcome.kind === 'refresh-failed') setProceedError('the current Track 2 state could not be confirmed');
    setProceeding(false);
  }, [observe, personaId, goToTrack2Stage, goToExperimentLab]);

  // ── C3 research ICE loop — the pool of experiments the loop can scope to.
  // Working objects (approved/persisted copilot proposals) override overview
  // (registry-derived) entries on id collision — BUT never downward. The
  // overview lifecycle is DERIVED from canonical results (published runs are
  // constitutional fact); a stale working object must not drag a published
  // experiment back to "designed"/"running". Same derived-floor clamp
  // `overviewWithPersistedLifecycle` applies server-side (the stuck-EXP-004
  // defect, live-drive 2026-07-14: publish landed in experiment_results, the
  // overview said 'published', and the session's old working object silently
  // overrode it back to pre-run — parking the loop on Run forever).
  const loopExperiments = useMemo(() => {
    const order = lifecycleOrder.length > 0 ? lifecycleOrder : ["designed", "protocol-ratified", "running", "evaluated", "published", "replicated"];
    const map = new Map<string, { id: string; family: string; lifecycle: ExperimentLifecycleState }>();
    for (const o of overview ?? []) {
      map.set(o.experiment.id, {
        id: o.experiment.id,
        family: o.experiment.family,
        lifecycle: o.lifecycle as ExperimentLifecycleState,
      });
    }
    for (const e of researchState.experiments) {
      const derived = map.get(e.experiment.id)?.lifecycle;
      const floorIdx = derived ? order.indexOf(derived) : -1;
      const workingIdx = order.indexOf(e.lifecycle);
      // Clamp UP to the derived floor: unknown states (idx -1) defer to the floor.
      const lifecycle =
        floorIdx >= 0 && (workingIdx < 0 || workingIdx < floorIdx)
          ? (derived as ExperimentLifecycleState)
          : e.lifecycle;
      map.set(e.experiment.id, { id: e.experiment.id, family: e.experiment.family, lifecycle });
    }
    return Array.from(map.values());
  }, [overview, researchState.experiments, lifecycleOrder]);

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
    // Default: the EARLIEST experiment whose lifecycle is still below
    // 'published' — the one that actually needs attention — never an
    // arbitrary pick that parks the loop on a stale hand-off. When every
    // experiment is published/replicated, rest on the most recent one
    // (the loop shows Analyze/Publish — complete, not a call to action).
    const order = lifecycleOrder.length > 0 ? lifecycleOrder : ["designed", "protocol-ratified", "running", "evaluated", "published", "replicated"];
    const needsAttention = loopExperiments.find(
      e => order.indexOf(e.lifecycle) >= 0 && order.indexOf(e.lifecycle) < order.indexOf("published"),
    );
    return byId ?? lastWorking ?? needsAttention ?? loopExperiments[loopExperiments.length - 1];
  }, [loopExperiments, activeExperimentId, researchState.experiments, lifecycleOrder]);

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
    // AR/CPS observation (operator direction 2026-07-13): the current state of
    // artifact production in this space — recent Artifact Runtime records +
    // the CPS publication register — so the copilot narrates production
    // reality, not just experiment lifecycles. Observed, never asserted.
    artifactProduction,
    // DCIR observation seam (D4 useDcirSeam): recentEvents (last ~12 compacted)
    // + D2 stateSnapshot + observedPatterns, spread from the hook's memoized
    // ground observation. Observations the copilot may gently adapt to, NEVER
    // rules (CFS-020 §6). Session-scoped; nothing persists, nothing gates (§9).
    ...groundObservation,
  }), [overview, series, lifecycleOrder, results, overviewError, resultsError, groundObservation, activeStage, activeExperiment, artifactProduction]);

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
          agentSubtitle="IRL Research Laboratory · constitutional science"
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
          {/* THE ORCHESTRATION HEAD — the objective and its single control. The
              detailed Track 2 surface stays in the Experiment Lab
              (Track2ProgrammePanel); this card shows the RUN and deep-links there. */}
          {RESEARCH_OBJECTIVES.map((objective) => (
            <ObjectiveCard
              key={objective.id}
              objective={objective}
              run={programmeRun}
              programmePreview={programmePreview}
              pendingDecisionPreview={pendingDecisionPreview}
              running={programmeRunning}
              error={programmeError}
              onRun={() => void runProgramme(objective.experimentId)}
              onOpenDetail={goToExperimentLab}
              onProceed={(decision) => void proceedToDecision(decision)}
              proceeding={proceeding}
              proceedError={proceedError}
              onApproveAcquisition={(decision) => void approveTargetedAcquisition(decision)}
              acquisitionRunning={acquisitionRunning}
              acquisitionError={acquisitionError}
              acquisitionStatus={acquisitionStatus}
              onReviewDecision={(decision, candidateId, action) => void submitReviewDecision(decision, candidateId, action)}
              reviewBusyId={reviewBusyId}
              reviewError={reviewError}
              onRunVerification={(decision) => void runInstitutionVerification(decision)}
              verificationRunning={verificationRunning}
              verificationError={verificationError}
              verificationStatus={verificationStatus}
              onResolveDuplicates={(decision) => void resolveDeterministicDuplicates(decision)}
              admissionRunning={admissionRunning}
              admissionError={admissionError}
              admissionStatus={admissionStatus}
              onAdmitEligible={(decision) => void admitEligibleCohort(decision)}
              admitRunning={admitRunning}
              admitError={admitError}
              admitStatus={admitStatus}
              admitProgress={admitProgress}
              admitProvenanceClass={admitProvenanceClass}
              onAdmitProvenanceClassChange={setAdmitProvenanceClass}
              admitRationale={admitRationale}
              onAdmitRationaleChange={setAdmitRationale}
              provenanceCohortPreview={provenanceCohortPreview}
              onRatifyProvenanceCohort={(experimentId) => void ratifyProvenanceCohort(experimentId)}
              provenanceRatifying={provenanceRatifying}
              provenanceRatifyError={provenanceRatifyError}
              provenanceRatifyStatus={provenanceRatifyStatus}
              provenanceRationale={provenanceRationale}
              onProvenanceRationaleChange={setProvenanceRationale}
            />
          ))}

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
                ? "Run stage — execution stays in metaMe IRL (see below)."
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

          {/* AR/CPS — artifact production in this space (observed, never asserted) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h4 className="text-xs font-semibold text-slate-100 mb-1">Artifact production (observed · AR/CPS)</h4>
            {!artifactProduction && <p className="text-[11px] text-slate-500">No production state available.</p>}
            {artifactProduction && (
              <div className="space-y-2 mt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {artifactProduction.publications.map((p) => (
                    <span
                      key={p.number}
                      title={p.title}
                      className={`rounded border px-1.5 py-0.5 text-[10px] ${
                        p.state === "published"
                          ? "border-emerald-600 bg-emerald-950/40 text-emerald-300"
                          : p.state === "produced"
                            ? "border-violet-600 bg-violet-950/40 text-violet-300"
                            : "border-slate-700 bg-slate-900/60 text-slate-400"
                      }`}
                    >
                      {p.number} · {p.state}
                    </span>
                  ))}
                </div>
                {artifactProduction.recentRecords.length === 0 && (
                  <p className="text-[11px] text-slate-500">No persisted artifact records yet (or migration pending).</p>
                )}
                {artifactProduction.recentRecords.slice(0, 5).map((r) => (
                  <div key={r.artifactId + r.createdAt} className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                        r.consequenceClass === "constitutional"
                          ? "border-emerald-600 bg-emerald-950/40 text-emerald-300"
                          : "border-amber-700 bg-amber-950/40 text-amber-300"
                      }`}
                    >
                      {r.consequenceClass}
                    </span>
                    <span className="text-slate-300">{r.title}</span>
                    <span className="text-slate-500">{r.profile} · {r.delegate} · {r.contentHashPrefix}…</span>
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
            (research_lifecycle_transition, DVN-anchorable). The Run stage hands off to metaMe IRL —
            running is executed there, never in the copilot.
          </p>
        </div>
      </div>
    </div>
  );
}
