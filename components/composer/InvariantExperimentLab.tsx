"use client";

/**
 * The Foundational Validation Series — Experiment Lab.
 *
 * One tabbed surface for running all three experiments through the front end
 * (no terminal): EXP-002 invariant-carried video (the original runner),
 * EXP-001 KnowledgeQube bundle evaluation, EXP-003 rediscovery savings.
 * Mounted in two places: /admin/studio/invariant-video (direct link) and the
 * AgentiQ cartridge's Experiment Lab tab (multi-cartridge viewer).
 */

import React, { Suspense, useState } from "react";
import { Beaker, Clapperboard, FileText, Scale, ShieldCheck } from "lucide-react";
import InvariantVideoExperimentRunner from "./InvariantVideoExperimentRunner";
import Exp001EvaluationRunner from "./Exp001EvaluationRunner";
import Exp003RediscoveryRunner from "./Exp003RediscoveryRunner";
import ExperimentResultsTab from "./ExperimentResultsTab";
import ExperimentReportTab from "./ExperimentReportTab";
import Exp004SovereigntyRunner from "./Exp004SovereigntyRunner";
import ChrysalisTestTab from "./ChrysalisTestTab";

type LabTab = "video" | "bundle" | "rediscovery" | "sovereignty" | "results" | "report" | "chrysalis";

const TABS: { id: LabTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "video", label: "EXP-002 · Video", icon: Clapperboard },
  { id: "bundle", label: "EXP-001 · Bundle Evaluation", icon: Scale },
  { id: "rediscovery", label: "EXP-003 · Rediscovery", icon: Beaker },
  { id: "sovereignty", label: "EXP-004 · Sovereignty", icon: ShieldCheck },
  { id: "results", label: "Results · Canonical", icon: ShieldCheck },
  { id: "report", label: "Report", icon: FileText },
  { id: "chrysalis", label: "Chrysalis Test", icon: ShieldCheck },
];

export default function InvariantExperimentLab() {
  const [tab, setTab] = useState<LabTab>("video");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Experiment Lab — Foundational Validation Series</h2>
        <p className="text-sm text-slate-400 mt-1">
          Three orthogonal validations of the same primitive: semantic fidelity (EXP-001), temporal
          fidelity (EXP-002), computational efficiency (EXP-003). Every run is a separate experiment
          instance — record provider/model with each result; never merge cross-model rows.
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
      {tab === "results" && <ExperimentResultsTab />}
      {tab === "report" && <ExperimentReportTab />}
      {tab === "chrysalis" && <ChrysalisTestTab />}
    </div>
  );
}
