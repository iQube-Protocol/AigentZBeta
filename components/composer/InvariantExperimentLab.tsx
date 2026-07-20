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
import { Beaker, ChevronLeft, ChevronRight, Clapperboard, FileText, FlaskConical, Home, Layers, Lock, Scale, ShieldCheck } from "lucide-react";
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
import ExperimentDesignStagePanel from "./ExperimentDesignStagePanel";
import InstrumentValidationPanel from "./InstrumentValidationPanel";
import ChrysalisTestTab from "./ChrysalisTestTab";
import HomecomingTestTab from "./HomecomingTestTab";
import ExperimentResultsTab from "./ExperimentResultsTab";
import ExperimentReportTab from "./ExperimentReportTab";
import CanonicalPlatesTab from "./CanonicalPlatesTab";

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
  vp2: "EXP-P2",
  // vp3 (EXP-P3) has a real harness — mounted below, not a design-stage panel.
};

interface LabEntry {
  id: LabTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** One-line overview shown above the runner — "what this tests / is". */
  blurb: string;
}

/** The lab navigator, grouped. Grouping + per-item overviews are authored here —
 *  several entries have no EXPERIMENT_REGISTRY id, so it cannot be derived. */
const SECTIONS: { title: string; items: LabEntry[] }[] = [
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
    title: "Validation Programme",
    items: [
      { id: "vp1", label: "EXP-P1 · Representation Gauntlet", icon: FlaskConical, blurb: "Representation & runtime gauntlet — the comparative programme experiment (design stage; runs via the backend harness)." },
      { id: "vp2", label: "EXP-P2 · Projection Semantics", icon: FlaskConical, blurb: "Projection semantics — the second orthogonal-by-hypothesis-class programme experiment (design stage)." },
      { id: "vp3", label: "EXP-P3 · Capability Validation", icon: FlaskConical, blurb: "Consequence engineering by field projection vs baseline retrieval — real harness; runs against a sealed ≥20-change ground-truth set." },
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
  vp2: "EXP-P2",
  vp3: "EXP-P3",
};

/** Tab id → experiment id, including dynamic `reg:<id>` guard entries. */
function expIdForTab(id: LabTab): string | undefined {
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
        label: `${e.id} · ${e.family}`,
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
}

export default function InvariantExperimentLab({ density }: { density?: "narrow" | "wide" } = {}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(density === "narrow");
  const [accessInfo, setAccessInfo] = useState<AccessInfo | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await personaFetch("/api/experiments/access", { cache: "no-store" });
        const d = await res.json();
        if (d?.ok) setAccessInfo({ isAdmin: Boolean(d.isAdmin), access: d.access, allowed: d.allowed ?? [] });
        else setAccessInfo({ isAdmin: false, access: "none", allowed: [] });
      } catch {
        setAccessInfo({ isAdmin: false, access: "none", allowed: [] });
      }
    })();
  }, []);

  // Filter what this caller may see. Admins see everything. Paid/full access
  // sees the whole Foundational Series. A scoped reviewer sees only their
  // assigned experiments. Acceptance Tests + Outputs stay admin-only.
  const sections = useMemo(() => {
    if (!accessInfo) return SECTIONS; // optimistic until access resolves
    if (accessInfo.isAdmin) return SECTIONS;
    const allowSet = new Set(accessInfo.allowed);
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
  const [tab, setTab] = useState<LabTab>("bundle");

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
      </div>
    </div>
  );
}
