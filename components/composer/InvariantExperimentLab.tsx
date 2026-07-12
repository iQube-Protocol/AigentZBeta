"use client";

/**
 * metaMe IRL — the Invariant Research Lab (formerly "Experiment Lab").
 *
 * One tabbed surface for running the lab's instruments through the front end
 * (no terminal): the Foundational Validation Series (EXP-001 KnowledgeQube
 * bundle evaluation, EXP-002 invariant-carried video, EXP-003 rediscovery
 * savings, EXP-004 sovereignty, EXP-005 provider choice), plus the constitutional
 * acceptance tests (Chrysalis Test, Homecoming Test). Mounted in two places:
 * /admin/studio/invariant-video (direct link, route kept for bookmark stability)
 * and the AgentiQ cartridge's metaMe IRL tab (multi-cartridge viewer).
 */

import React, { Suspense, useState } from "react";
import { Beaker, Clapperboard, FileText, Home, Layers, Scale, ShieldCheck } from "lucide-react";
import CanonicalPlatesTab from "./CanonicalPlatesTab";
import InvariantVideoExperimentRunner from "./InvariantVideoExperimentRunner";
import Exp001EvaluationRunner from "./Exp001EvaluationRunner";
import Exp003RediscoveryRunner from "./Exp003RediscoveryRunner";
import ExperimentResultsTab from "./ExperimentResultsTab";
import ExperimentReportTab from "./ExperimentReportTab";
import Exp004SovereigntyRunner from "./Exp004SovereigntyRunner";
import Exp005ProviderChoiceRunner from "./Exp005ProviderChoiceRunner";
import ChrysalisTestTab from "./ChrysalisTestTab";
import HomecomingTestTab from "./HomecomingTestTab";

type LabTab = "video" | "bundle" | "rediscovery" | "sovereignty" | "provider-choice" | "results" | "report" | "plates" | "chrysalis" | "homecoming";

const TABS: { id: LabTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "video", label: "EXP-002 · Video", icon: Clapperboard },
  { id: "bundle", label: "EXP-001 · Bundle Evaluation", icon: Scale },
  { id: "rediscovery", label: "EXP-003 · Rediscovery", icon: Beaker },
  { id: "sovereignty", label: "EXP-004 · Sovereignty", icon: ShieldCheck },
  { id: "provider-choice", label: "EXP-005 · Provider Choice", icon: ShieldCheck },
  { id: "results", label: "Results · Canonical", icon: ShieldCheck },
  { id: "report", label: "Report", icon: FileText },
  { id: "plates", label: "Canonical Plates", icon: Layers },
  { id: "chrysalis", label: "Chrysalis Test", icon: ShieldCheck },
  { id: "homecoming", label: "Homecoming Test", icon: Home },
];

export default function InvariantExperimentLab() {
  const [tab, setTab] = useState<LabTab>("video");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">metaMe IRL — Invariant Research Lab</h2>
        <p className="text-sm text-slate-400 mt-1">
          The lab bench of metaMe IRL. It hosts the Foundational Validation Series — orthogonal
          validations of the same primitive: semantic fidelity (EXP-001), temporal fidelity (EXP-002),
          computational efficiency (EXP-003), sovereignty (EXP-004), provider choice (EXP-005) — and
          the constitutional acceptance tests (Chrysalis, Homecoming). Every run is a separate
          experiment instance — record provider/model with each result; never merge cross-model rows.
        </p>
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/50 p-1 w-fit">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                tab === t.id
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Keep all three mounted-on-demand; each holds its own run state. */}
      {tab === "video" && (
        <Suspense fallback={null}>
          <InvariantVideoExperimentRunner />
        </Suspense>
      )}
      {tab === "bundle" && <Exp001EvaluationRunner />}
      {tab === "rediscovery" && <Exp003RediscoveryRunner />}
      {tab === "sovereignty" && <Exp004SovereigntyRunner />}
      {tab === "provider-choice" && <Exp005ProviderChoiceRunner />}
      {tab === "results" && <ExperimentResultsTab />}
      {tab === "report" && <ExperimentReportTab />}
      {tab === "plates" && <CanonicalPlatesTab />}
      {tab === "chrysalis" && <ChrysalisTestTab />}
      {tab === "homecoming" && <HomecomingTestTab />}
    </div>
  );
}
