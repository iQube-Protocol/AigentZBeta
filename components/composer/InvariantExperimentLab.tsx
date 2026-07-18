"use client";

/**
 * metaMe IRL — the Invariant Research Lab (formerly "Experiment Lab").
 *
 * The lab bench for running the lab's instruments through the front end
 * (no terminal). Experiments are arranged as a LEFT-HAND navigator grouped by
 * series (five-space Laboratory IA, 2026-07-18 — Aletheon's "the left menu
 * becomes the experiment navigator"): the Foundational Validation Series
 * (EXP-001 KnowledgeQube bundle evaluation, EXP-002 invariant-carried video,
 * EXP-003 rediscovery savings, EXP-004 sovereignty, EXP-005 provider choice)
 * and the constitutional acceptance tests (Chrysalis Test, Homecoming Test).
 *
 * The OUTPUT surfaces (Results, Report, Canonical Plates) are no longer inside
 * the lab — they are their own second-level Laboratory tabs in the internal
 * IRL cartridge (irl-results / irl-report / irl-plates), so the navigator here
 * holds only the actual experiments and tests.
 *
 * Mounted in: /admin/studio/invariant-video (direct link, kept for bookmark
 * stability), the AgentiQ cartridge's metaMe IRL tab, and the internal IRL
 * cartridge's Laboratory group (irl-experiment-lab, adminOnly).
 *
 * Sidebar pattern mirrors AgentiqCartridgeTab (w-56 ↔ w-8 collapsible rail).
 */

import React, { Suspense, useState } from "react";
import { Beaker, ChevronLeft, ChevronRight, Clapperboard, Home, Scale, ShieldCheck } from "lucide-react";
import InvariantVideoExperimentRunner from "./InvariantVideoExperimentRunner";
import VideoArticleSkillRunner from "./VideoArticleSkillRunner";
import Exp001EvaluationRunner from "./Exp001EvaluationRunner";
import Exp003RediscoveryRunner from "./Exp003RediscoveryRunner";
import Exp004SovereigntyRunner from "./Exp004SovereigntyRunner";
import Exp005ProviderChoiceRunner from "./Exp005ProviderChoiceRunner";
import ChrysalisTestTab from "./ChrysalisTestTab";
import HomecomingTestTab from "./HomecomingTestTab";

type LabTab = "bundle" | "video" | "video-article" | "rediscovery" | "sovereignty" | "provider-choice" | "chrysalis" | "homecoming";

interface LabEntry {
  id: LabTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** The experiment navigator, grouped by series. Grouping is authored here —
 *  several entries (Video+Article, the acceptance tests) have no
 *  EXPERIMENT_REGISTRY id, so it cannot be derived from types/research.ts. */
const SECTIONS: { title: string; items: LabEntry[] }[] = [
  {
    title: "Foundational Series",
    items: [
      { id: "bundle", label: "EXP-001 · Bundle Evaluation", icon: Scale },
      { id: "video", label: "EXP-002 · Video", icon: Clapperboard },
      { id: "video-article", label: "Video + Article", icon: Clapperboard },
      { id: "rediscovery", label: "EXP-003 · Rediscovery", icon: Beaker },
      { id: "sovereignty", label: "EXP-004 · Sovereignty", icon: ShieldCheck },
      { id: "provider-choice", label: "EXP-005 · Provider Choice", icon: ShieldCheck },
    ],
  },
  {
    title: "Acceptance Tests",
    items: [
      { id: "chrysalis", label: "Chrysalis Test", icon: ShieldCheck },
      { id: "homecoming", label: "Homecoming Test", icon: Home },
    ],
  },
];

export default function InvariantExperimentLab({ density }: { density?: "narrow" | "wide" } = {}) {
  const [tab, setTab] = useState<LabTab>("video");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(density === "narrow");

  return (
    <div className="flex h-full overflow-hidden">
      {/* Experiment navigator (left) — mirrors the AgentiqCartridgeTab sidebar */}
      <div
        className={`flex-shrink-0 border-r border-slate-800 bg-slate-900/40 overflow-y-auto transition-all duration-200 ${
          sidebarCollapsed ? "w-8" : "w-56"
        }`}
      >
        {sidebarCollapsed ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <button
              onClick={() => setSidebarCollapsed(false)}
              title="Expand experiment navigator"
              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            {SECTIONS.flatMap((s) => s.items).map((item) => {
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
              {SECTIONS.map((section) => (
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

      {/* Selected experiment (right) */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-100">metaMe IRL — Invariant Research Lab</h2>
          <p className="text-sm text-slate-400 mt-1">
            The lab bench of metaMe IRL. It hosts the Foundational Validation Series — orthogonal
            validations of the same primitive: semantic fidelity (EXP-001), temporal fidelity (EXP-002),
            computational efficiency (EXP-003), sovereignty (EXP-004), provider choice (EXP-005) — and
            the constitutional acceptance tests (Chrysalis, Homecoming). Every run is a separate
            experiment instance — record provider/model with each result; never merge cross-model rows.
            Results, Report, and Canonical Plates live as their own Laboratory tabs.
          </p>
        </div>

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
        {tab === "bundle" && <Exp001EvaluationRunner />}
        {tab === "rediscovery" && <Exp003RediscoveryRunner />}
        {tab === "sovereignty" && <Exp004SovereigntyRunner />}
        {tab === "provider-choice" && <Exp005ProviderChoiceRunner />}
        {tab === "chrysalis" && <ChrysalisTestTab />}
        {tab === "homecoming" && <HomecomingTestTab />}
      </div>
    </div>
  );
}
