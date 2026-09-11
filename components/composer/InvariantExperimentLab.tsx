"use client";

/**
 * metaMe IRL — the Experiments surface of the Invariant Research Lab.
 *
 * A LEFT-HAND navigator grouped by section (2026-07-18):
 *   • Foundational Series — EXP-001 bundle evaluation, EXP-002 invariant-carried
 *     video, EXP-003 rediscovery savings, EXP-004 sovereignty, EXP-005 provider
 *     choice (+ the Video+Article skill runner).
 *   • Acceptance Tests — the constitutional acceptance tests (Chrysalis,
 *     Homecoming).
 *   • Outputs — the lab's produced artifacts: Results (canonical published
 *     results), Report (live → canonical → published lifecycle), Canonical
 *     Plates (composed constitutional assets). Grouped here alongside the
 *     experiments rather than as separate Laboratory tabs (operator direction).
 *
 * The lab's mission/hypothesis intro now lives on the Institution dashboard
 * (IRLDashboardTab) — this surface shows only a per-item overview above the
 * selected runner, so the page is the experiments, not a re-stated charter.
 *
 * Mounted in: /admin/studio/invariant-video, the AgentiQ cartridge's lab tab,
 * and the internal IRL cartridge's Laboratory group (label "Experiments",
 * adminOnly). Sidebar pattern mirrors AgentiqCartridgeTab (w-56 ↔ w-8 rail).
 */

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Beaker, ChevronLeft, ChevronRight, Clapperboard, FileText, FlaskConical, Home, Layers, Lock, MessageSquare, Scale, ShieldCheck, Sparkles } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { EXPERIMENT_REGISTRY } from "@/types/research";
import InvariantVideoExperimentRunner from "./InvariantVideoExperimentRunner";
import VideoArticleSkillRunner from "./VideoArticleSkillRunner";
import Exp001EvaluationRunner from "./Exp001EvaluationRunner";
import Exp003RediscoveryRunner from "./Exp003RediscoveryRunner";
import Exp004SovereigntyRunner from "./Exp004SovereigntyRunner";
import Exp005ProviderChoiceRunner from "./Exp005ProviderChoiceRunner";
import Exp006ProjectionRunner from "./Exp006ProjectionRunner";
import ExpP3CapabilityRunner from "./ExpP3CapabilityRunner";
import ExpP2UtilityRunner from "./ExpP2UtilityRunner";
import ExperimentDesignStagePanel from "./ExperimentDesignStagePanel";
import InstrumentValidationPanel from "./InstrumentValidationPanel";
import ChrysalisTestTab from "./ChrysalisTestTab";
import HomecomingTestTab from "./HomecomingTestTab";
import ExperimentResultsTab from "./ExperimentResultsTab";
import ExperimentReportTab from "./ExperimentReportTab";
import CanonicalPlatesTab from "./CanonicalPlatesTab";
import InvariantDiscoveryTab from "./InvariantDiscoveryTab";
import QubeTalkInboxTab from "./QubeTalkInboxTab";
import IndependentReviewPanel from "./IndependentReviewPanel";
import { Track2ProgrammePanel } from "@/components/research/Track2ProgrammePanel";
import { consumePendingTrack2Stage } from "@/services/research/track2DeepLinkIntent";
import type { Track2DeepLink } from "@/services/research/track2Programme";

/** Known tab ids plus dynamic `reg:<EXPERIMENT_ID>` entries from the registry
 *  completeness guard (any registered experiment not hand-mounted below is
 *  auto-surfaced so nothing falls through the gaps — operator 2026-07-19). */
type LabTab = string;

/** Registered experiments whose in-app runner isn't built yet — rendered as a
 *  design-stage panel (visible + teed up, honest about not-yet-runnable). The
 *  metadata comes from EXPERIMENT_REGISTRY so hypothesis text isn't duplicated. */
const DESIGN_STAGE_TAB_EXP: Partial<Record<LabTab, string>> = {
  entropy: "EXP-007",
  propagation: "EXP-008",
  vp1: "EXP-P1",
  // vp2 (EXP-011) + vp3 (EXP-012) have real harnesses — mounted below, not
  // design-stage panels. EXP-P2 / EXP-P3 / EXP-P4 have none, so the registry
  // completeness guard surfaces them from EXPERIMENT_REGISTRY metadata.
};

export interface LabEntry {
  id: LabTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** One-line overview shown above the runner — "what this tests / is". */
  blurb: string;
}

/** The lab navigator, grouped. Grouping + per-item overviews are authored here —
 *  several entries have no EXPERIMENT_REGISTRY id, so it cannot be derived. */
/**
 * Exported (2026-08-01) so services/research/experimentSeriesGroups.ts can
 * derive the SAME series grouping for the steward invitation form's
 * experiment checkboxes — one authoritative section list, never a
 * hand-duplicated copy (inv.engineering.036).
 */
export const SECTIONS: { title: string; items: LabEntry[] }[] = [
  {
    // The upstream primitive sits FIRST — evidence → candidates feed every
    // series below it. Placed at the top so it's unmissable (operator 2026-07-20:
    // it was buried below the fold under Acceptance Tests). Admin-only via the
    // section filter (no experiment id).
    title: "Discovery",
    items: [
      { id: "discovery", label: "Invariant Discovery", icon: Sparkles, blurb: "CFS-048 · the upstream primitive — discover candidate invariants for a domain (Financial Services, constitutional arm) from evidence, then promote into the registry as proposed for validation." },
    ],
  },
  {
    title: "Foundational Series",
    items: [
      { id: "bundle", label: "EXP-001 · Bundle Evaluation", icon: Scale, blurb: "Semantic fidelity — does a KnowledgeQube's invariant bundle preserve meaning when a judge scores it against the source?" },
      { id: "video", label: "EXP-002 · Video", icon: Clapperboard, blurb: "Temporal fidelity — does an invariant-carried multi-segment video stay coherent across segments grounded in one field?" },
      { id: "video-article", label: "Video + Article", icon: Clapperboard, blurb: "The Video+Article skill — generate a video and its companion article from the same invariant grounding." },
      { id: "rediscovery", label: "EXP-003 · Rediscovery", icon: Beaker, blurb: "Computational efficiency — how much reasoning is saved when a task starts from initialized invariants vs cold rediscovery." },
      { id: "sovereignty", label: "EXP-004 · Sovereignty", icon: ShieldCheck, blurb: "Sovereignty — the same reasoning holds under a sovereign (self-hosted) provider, not only a frontier one." },
      { id: "provider-choice", label: "EXP-005 · Provider Choice", icon: ShieldCheck, blurb: "Provider choice — outcome stability across interchangeable model providers at equal grounding." },
    ],
  },
  {
    title: "Invariant Intelligence Series",
    items: [
      { id: "projection", label: "EXP-006 · Projection Fidelity", icon: FlaskConical, blurb: "Intent → invariant projection fidelity (Stage A) — predict the invariant set for an intent, score it against an independent reference (CIRS), classify the deltas." },
      { id: "entropy", label: "EXP-007 · Reasoning Entropy", icon: FlaskConical, blurb: "Reasoning entropy reduction — invariant-initialised reasoning vs a four-arm retrieval ladder (the honest bar is beating our own production KB)." },
      { id: "propagation", label: "EXP-008 · Cross-Modal Reuse", icon: FlaskConical, blurb: "Cross-modal invariant reuse — one invariant set propagates across modalities with high fidelity (blind reviewers reconstruct the set)." },
    ],
  },
  {
    title: "Instrument Validation (Stage 0)",
    items: [
      { id: "irv", label: "IRV-001 · Resolution Validation", icon: ShieldCheck, blurb: "Stage-0 calibration of the IRE against a Synthetic Expert Baseline — stability is the gate, coverage a reported proxy. Record run complete (2026-07-18)." },
      { id: "ipv", label: "IPV-001 · Projection Validation", icon: ShieldCheck, blurb: "Stage-0 reproducibility validation of the IPE on the frozen substrate — 100% reproducible record run (2026-07-18)." },
    ],
  },
  {
    // The four RESERVED core designations (operator, 2026-07-27). Only EXP-P1
    // has a harness; P2/P3 are design-stage and P4 is reserved, so they are
    // NOT hand-mounted here — the registry completeness guard below surfaces
    // them with text read straight from EXPERIMENT_REGISTRY. That is why the
    // Lab now shows the representation experiment for EXP-P3: there is no
    // hand-authored label left to go stale.
    title: "Validation Programme",
    items: [
      { id: "vp1", label: "EXP-P1 · Representation Gauntlet", icon: FlaskConical, blurb: "Representation & runtime gauntlet — the comparative programme experiment (design stage; runs via the backend harness)." },
      // IRL-REVIEW-001 sits IN the experiments navigator rather than as a
      // separate destination: the review is preparation for the experiment, and
      // whoever is preparing one should not have to leave it to adjudicate its
      // inputs. No experiment id — admin-only via the section filter, like the
      // other cross-cutting lab capabilities.
      { id: "independent-review", label: "Independent Review", icon: ShieldCheck, blurb: "IRL-REVIEW-001 · submit an experiment asset for independent single or dual adjudication — frozen blinded package, distinct model lineages, contested queue, review receipt. Review is evidence, never ratification." },
      // The guided Track 2 workflow sits beside the experiment it constitutes,
      // for the same reason Independent Review does: whoever is preparing
      // EXP-P1 should not have to leave it to run the acquisition programme.
      // The panel ROUTES to the existing capabilities — it re-implements none
      // of them — and is mounted here rather than existing unreachably, which
      // would make the whole workflow an inert mechanism.
      { id: "track2", label: "Track 2 Programme", icon: ShieldCheck, blurb: "Corpus acquisition → frozen crystal, in eleven stages. Each stage routes to the capability that already implements it; the guided controls here are the ones that had no front end — crystal assignment, artifact provisioning and the freeze act. Readiness remedies say what fixes each failing check." },
    ],
  },
  {
    // RENUMBERED 2026-07-27. These two harnesses implement the designs that
    // used to hold the P2 / P3 designations; the designations moved, the
    // harnesses did not. Binding them to EXP-011 / EXP-012 is what stops the
    // Lab presenting a legacy runner under a reassigned number — the exact
    // drift the operator caught ("EXP P3 is still showing the old experiment").
    title: "Structural & Capability Studies",
    items: [
      { id: "vp2", label: "EXP-011 · Structural Invariance", icon: FlaskConical, blurb: "Do discovered invariants have operational utility as a reasoning substrate? Three arms (cold · manual baseline · earned) + root ablation, representation-vs-representation on one corpus — the empirical test of inv.reasoning.323. Formerly EXP-P2." },
      { id: "vp3", label: "EXP-012 · Capability Validation", icon: FlaskConical, blurb: "Consequence engineering by field projection vs baseline retrieval — real harness; runs against a sealed ≥20-change ground-truth set. Formerly EXP-P3." },
    ],
  },
  {
    title: "Acceptance Tests",
    items: [
      { id: "chrysalis", label: "Chrysalis Test", icon: ShieldCheck, blurb: "Constitutional acceptance — the platform passes its own governed-execution acceptance criteria (Chrysalis)." },
      { id: "homecoming", label: "Homecoming Test", icon: Home, blurb: "Constitutional acceptance — the return-to-canon acceptance criteria (Homecoming)." },
    ],
  },
  {
    title: "Outputs",
    items: [
      { id: "results", label: "Results", icon: ShieldCheck, blurb: "Canonical published experiment results — content-hashed, receipted, and DVN-anchorable." },
      { id: "report", label: "Report", icon: FileText, blurb: "Experiment reports through their lifecycle — live drafts, canonical (DVN-minted) records, and published outputs." },
      { id: "plates", label: "Canonical Plates", icon: Layers, blurb: "Canonical plates — composed constitutional artifacts (assets) from the plate pipeline." },
    ],
  },
  {
    title: "Exchange",
    items: [
      { id: "qubetalk", label: "QubeTalk", icon: MessageSquare, blurb: "Personhood-bound peer exchange — message and share artifacts (with a rights envelope) to another principal by their Polity Public Reference. Confidential, principal-to-principal." },
    ],
  },
];

/** Foundational item → experiment id, for per-invitation scoping. Items with
 *  no experiment id (e.g. the Video+Article skill) ride with their series. */
const ITEM_EXPERIMENT: Partial<Record<LabTab, string>> = {
  bundle: "EXP-001",
  video: "EXP-002",
  "video-article": "EXP-002",
  rediscovery: "EXP-003",
  sovereignty: "EXP-004",
  "provider-choice": "EXP-005",
  projection: "EXP-006",
  entropy: "EXP-007",
  propagation: "EXP-008",
  irv: "IRV-001",
  ipv: "IPV-001",
  vp1: "EXP-P1",
  // Added 2026-08-27 (review finding): without an entry here, the scoped-
  // access filter (`sections` useMemo below) treats `track2` as carrying NO
  // experiment id and drops it for every non-admin caller, including a
  // reviewer explicitly granted EXP-P1 access — the exact Austin/external-
  // review workstream this tab exists to serve.
  track2: "EXP-P1",
  // The harnesses behind these two implement the RENUMBERED designs (2026-07-27).
  // A P-slot must never be bound to a legacy harness: the designation moved, the
  // implementation did not.
  vp2: "EXP-011",
  vp3: "EXP-012",
};

/** Tab id → experiment id, including dynamic `reg:<id>` guard entries. */
export function expIdForTab(id: LabTab): string | undefined {
  return ITEM_EXPERIMENT[id] ?? (id.startsWith("reg:") ? id.slice(4) : undefined);
}

// ── Registry completeness guard (operator 2026-07-19) ────────────────────────
// Every experiment in EXPERIMENT_REGISTRY must surface in this panel. Any id
// not hand-mounted above is auto-added as a `reg:<id>` entry rendering a
// design-stage panel from its registry metadata — so a newly registered
// experiment can never silently fall through the gaps (the IRV/IPV omission
// this guard was born from).
{
  const mounted = new Set(Object.values(ITEM_EXPERIMENT));
  const unmounted = EXPERIMENT_REGISTRY.filter((e) => !mounted.has(e.id));
  if (unmounted.length > 0) {
    const idx = SECTIONS.findIndex((s) => s.title === "Acceptance Tests");
    SECTIONS.splice(idx < 0 ? SECTIONS.length : idx, 0, {
      title: "Registered — pending surface",
      items: unmounted.map((e) => ({
        id: `reg:${e.id}`,
        // SERIES view — the navigator is a list of experiments in sequence, so
        // it shows the PROGRAMME FOCUS where one exists (EXP-P1 · Reasoning
        // Compression) and falls back to the family/hypothesis class otherwise.
        // The protocol title belongs to the DETAIL panel, not to a list entry
        // (operator, 2026-07-27: focus and title are different truths and must
        // not be forced into one label).
        label: `${e.id} · ${e.programmeFocus ?? e.family}`,
        icon: FlaskConical,
        blurb: e.hypothesis.length > 160 ? `${e.hypothesis.slice(0, 160)}…` : e.hypothesis,
      })),
    });
  }
}

interface AccessInfo {
  isAdmin: boolean;
  access: "all" | "scoped" | "none";
  allowed: string[];
  allowedExperiments?: string[];  // Only experiment ids; workspaces filtered out
}

export default function InvariantExperimentLab({ density }: { density?: "narrow" | "wide" } = {}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(density === "narrow");
  const [accessInfo, setAccessInfo] = useState<AccessInfo | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await personaFetch("/api/experiments/access", { cache: "no-store" });
        const d = await res.json();
        if (d?.ok) {
          setAccessInfo({
            isAdmin: Boolean(d.isAdmin),
            access: d.access,
            allowed: d.allowed ?? [],
            allowedExperiments: d.allowedExperiments ?? d.allowed ?? [],  // Fall back to `allowed` if separate list not provided
          });
        } else {
          setAccessInfo({ isAdmin: false, access: "none", allowed: [], allowedExperiments: [] });
        }
      } catch {
        setAccessInfo({ isAdmin: false, access: "none", allowed: [], allowedExperiments: [] });
      }
    })();
  }, []);

  // Filter what this caller may see. Admins see everything. Paid/full access
  // sees the whole Foundational Series. A scoped reviewer sees only their
  // assigned experiments. Acceptance Tests + Outputs stay admin-only.
  const sections = useMemo(() => {
    if (!accessInfo) return SECTIONS; // optimistic until access resolves
    if (accessInfo.isAdmin) return SECTIONS;
    // Use allowedExperiments (workspace scopes filtered out) for experiment filtering
    const allowSet = new Set(accessInfo.allowedExperiments ?? accessInfo.allowed);
    const out: typeof SECTIONS = [];
    for (const section of SECTIONS) {
      // Keep only items that map to an assignable experiment. Items with no
      // experiment id (acceptance tests, reports, plates) stay admin-only.
      const items = section.items.filter((it) => {
        const exp = expIdForTab(it.id);
        if (!exp) return false;
        if (accessInfo.access === "all") return true;
        if (accessInfo.access === "scoped") return allowSet.has(exp);
        return false;
      });
      if (items.length > 0) out.push({ ...section, items });
    }
    return out;
  }, [accessInfo]);

  const allItems = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  // Reviewers/participants save results privately and may request public
  // publication (steward-approved). Admins publish straight to the canon, so
  // they never see the request-publish control.
  const canRequestPublish = Boolean(accessInfo && !accessInfo.isAdmin);
  /**
   * CANONICAL DEEP-LINK CONSUMPTION (2026-08-26, corrected 2026-08-27) — a
   * lazy `useState` initializer runs synchronously during this component's
   * FIRST render, before any effect and before the "keep tab within visible
   * items" effect below could ever override it. `consumePendingTrack2Stage()`
   * is called exactly ONCE (its own one-shot contract) and the FULL
   * `Track2DeepLink` it returns is reused for the default tab, the
   * experiment id and the anchor id the panel should open on — never called
   * twice (which would silently lose the deep-link to the second call), and
   * never narrowed to a subset of its fields (the 2026-08-27 review finding:
   * `experimentId`/`anchorId` were previously DISCARDED here and
   * reconstructed downstream instead of consumed).
   */
  const [initialTrack2Intent] = useState(() => consumePendingTrack2Stage());
  const [track2Intent, setTrack2Intent] = useState<Track2DeepLink | null>(initialTrack2Intent);
  const [tab, setTab] = useState<LabTab>(() => (initialTrack2Intent ? "track2" : "bundle"));

  /**
   * SAME-TAB RE-NAVIGATION (2026-08-30, "Copilot routes to EXP-001" fix).
   *
   * `consumePendingTrack2Stage()` above is a ONE-SHOT read that only ever
   * fires at this component's own first mount. `codex:navigate-tab` is a
   * documented no-op when the destination cartridge tab is ALREADY the
   * active one (`CodexPanelDynamic.tsx`'s `target !== activeTabSlug` guard),
   * which means this component is never remounted for a second Copilot
   * "Open {stage}" click made while the Experiment Lab tab is already open —
   * the freshly-written mailbox intent was silently dropped, and the lab
   * kept showing whatever `tab` it settled on at its FIRST mount (defaulting
   * to `"bundle"` → EXP-001, a wholly unrelated experiment). This listener
   * closes that gap: while already mounted, it reacts to the SAME
   * `codex:navigate-tab` dispatch `goToTrack2Stage` fires (synchronously
   * after writing the mailbox), re-consumes the mailbox, and applies the
   * deep-link itself — no remount required. The cross-tab case is untouched
   * and keeps working exactly as before via the lazy `useState` above.
   */
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const raw = (e as CustomEvent<{ tab?: string }>).detail?.tab;
      if (raw !== "irl-experiment-lab") return;
      const deepLink = consumePendingTrack2Stage();
      if (!deepLink) return; // already consumed by the initial-mount read, or no intent was ever written
      setTrack2Intent(deepLink);
      setTab("track2");
    };
    window.addEventListener("codex:navigate-tab", onNavigate);
    return () => window.removeEventListener("codex:navigate-tab", onNavigate);
  }, []);

  // Keep the selected tab within the visible set (a scoped reviewer's default
  // may be filtered out).
  useEffect(() => {
    if (allItems.length > 0 && !allItems.some((i) => i.id === tab)) {
      setTab(allItems[0].id);
    }
  }, [allItems, tab]);

  const active = allItems.find((i) => i.id === tab);

  // Non-admin with no research access → upsell instead of a broken runner.
  if (accessInfo && !accessInfo.isAdmin && accessInfo.access === "none") {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/15">
          <Lock className="h-6 w-6 text-violet-300" />
        </div>
        <h2 className="text-base font-semibold text-slate-100">Research access required</h2>
        <p className="mt-2 text-sm text-slate-400">
          Running experiments needs research access — either a Sovereign or Steward plan, or a reviewer invitation to a
          specific experiment. Read the lab and publications freely; unlock the runners to reproduce the series
          yourself.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Navigator (left) — mirrors the AgentiqCartridgeTab sidebar */}
      <div
        className={`flex-shrink-0 border-r border-slate-800 bg-slate-900/40 overflow-y-auto transition-all duration-200 ${
          sidebarCollapsed ? "w-8" : "w-56"
        }`}
      >
        {sidebarCollapsed ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <button
              onClick={() => setSidebarCollapsed(false)}
              title="Expand navigator"
              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            {allItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setTab(item.id);
                    setSidebarCollapsed(false);
                  }}
                  title={item.label}
                  className={`flex h-6 w-6 items-center justify-center rounded transition ${
                    tab === item.id ? "bg-blue-500/20 text-blue-200" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Experiments</h3>
              <button
                onClick={() => setSidebarCollapsed(true)}
                title="Collapse sidebar"
                className="flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-slate-800/60 hover:text-slate-300"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-3">
              {sections.map((section) => (
                <div key={section.title}>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {section.title}
                  </div>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setTab(item.id)}
                          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                            tab === item.id
                              ? "bg-blue-500/20 text-blue-200"
                              : "bg-white/5 text-slate-300 hover:bg-white/10"
                          }`}
                          title={item.blurb}
                        >
                          <Icon className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Selected item (right) — per-item overview + the runner */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Assigned-experiments checklist — a scoped reviewer's teed-up set (their
            invitation's allowed_experiments). Chips jump to each runner. */}
        {accessInfo && !accessInfo.isAdmin && accessInfo.access === "scoped" && allItems.length > 0 && (
          <div className="mb-4 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-200">
              Your assigned experiments ({allItems.length}) — teed up to run
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allItems.map((it) => (
                <button
                  key={it.id}
                  onClick={() => setTab(it.id)}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                    tab === it.id
                      ? "border-indigo-400 bg-indigo-500/25 text-indigo-100"
                      : "border-slate-700 bg-slate-900/40 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {expIdForTab(it.id) ?? it.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {active && (
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-100">{active.label}</h2>
            <p className="mt-1 text-xs text-slate-400 max-w-3xl">{active.blurb}</p>
          </div>
        )}

        {/* Each runner holds its own run state; switching unmounts (unchanged). */}
        {tab === "video" && (
          <Suspense fallback={null}>
            <InvariantVideoExperimentRunner />
          </Suspense>
        )}
        {tab === "video-article" && (
          <Suspense fallback={null}>
            <VideoArticleSkillRunner />
          </Suspense>
        )}
        {tab === "bundle" && <Exp001EvaluationRunner canRequestPublish={canRequestPublish} />}
        {tab === "rediscovery" && <Exp003RediscoveryRunner canRequestPublish={canRequestPublish} />}
        {tab === "sovereignty" && <Exp004SovereigntyRunner canRequestPublish={canRequestPublish} />}
        {tab === "provider-choice" && <Exp005ProviderChoiceRunner canRequestPublish={canRequestPublish} />}
        {tab === "projection" && <Exp006ProjectionRunner canRequestPublish={canRequestPublish} />}
        {tab === "vp2" && <ExpP2UtilityRunner />}
        {tab === "vp3" && <ExpP3CapabilityRunner canRequestPublish={canRequestPublish} />}
        {(tab === "irv" || tab === "ipv") && (() => {
          const expId = tab === "irv" ? "IRV-001" : "IPV-001";
          const reg = EXPERIMENT_REGISTRY.find((e) => e.id === expId);
          return (
            <InstrumentValidationPanel
              experimentId={expId}
              family={reg?.family ?? expId}
              hypothesis={reg?.hypothesis ?? ""}
              protocolRef={reg?.protocolRef}
              programmeFocus={reg?.programmeFocus}
            />
          );
        })()}
        {(DESIGN_STAGE_TAB_EXP[tab] || tab.startsWith("reg:")) && (() => {
          const expId = DESIGN_STAGE_TAB_EXP[tab] ?? tab.slice(4);
          const reg = EXPERIMENT_REGISTRY.find((e) => e.id === expId);
          return (
            <ExperimentDesignStagePanel
              experimentId={expId}
              family={reg?.family ?? expId}
              hypothesis={reg?.hypothesis ?? "Protocol published; see the registry."}
              protocolRef={reg?.protocolRef}
            />
          );
        })()}
        {tab === "chrysalis" && <ChrysalisTestTab />}
        {tab === "homecoming" && <HomecomingTestTab />}
        {tab === "results" && <ExperimentResultsTab />}
        {tab === "report" && <ExperimentReportTab />}
        {tab === "plates" && <CanonicalPlatesTab isAdmin={Boolean(accessInfo?.isAdmin)} />}
        {tab === "discovery" && <InvariantDiscoveryTab />}
        {tab === "qubetalk" && <QubeTalkInboxTab researchOnly />}
        {tab === "independent-review" && <IndependentReviewPanel />}
        {tab === "track2" && (
          <Track2ProgrammePanel
            key={track2Intent?.surfaceRef.anchorId ?? "track2-default"}
            experimentId={track2Intent?.experimentId ?? "EXP-P1"}
            initialAnchorId={track2Intent?.surfaceRef.anchorId}
          />
        )}
      </div>
    </div>
  );
}
