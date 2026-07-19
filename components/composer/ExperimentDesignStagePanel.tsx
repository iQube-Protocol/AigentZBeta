"use client";

/**
 * ExperimentDesignStagePanel — honest placeholder for a registered experiment
 * whose protocol is published but whose in-app runner is not built yet. Shows
 * the hypothesis + protocol reference so the experiment is VISIBLE and teed up
 * in the left panel (the operator can see what's next), without pretending it
 * can run. No fake run button — epistemic honesty (CLAUDE.md).
 */

import React from "react";
import { FlaskConical, Sparkles } from "lucide-react";

export function ExperimentDesignStagePanel({
  experimentId,
  family,
  hypothesis,
  protocolRef,
}: {
  experimentId: string;
  family: string;
  hypothesis: string;
  protocolRef?: string;
}) {
  // Flow this design-stage experiment into the IRL Research Copilot to develop
  // it into a constitutionally-compliant protocol (navigation + context hand-off,
  // not execution). The copilot listens for `irl:develop-experiment`.
  const developInCopilot = () => {
    try {
      window.dispatchEvent(new CustomEvent("irl:develop-experiment", { detail: { experimentId, family, hypothesis } }));
      window.dispatchEvent(new CustomEvent("codex:navigate-tab", { detail: { tab: "irl-research-copilot" } }));
    } catch {
      /* non-fatal */
    }
  };

  return (
    <div className="space-y-3">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200">
        <FlaskConical className="h-3.5 w-3.5" /> Design stage — protocol published, runner pending
      </div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
        <div className="text-sm font-semibold text-slate-100">{experimentId} · {family}</div>
        <p className="text-xs text-slate-400">{hypothesis}</p>
        {protocolRef && (
          <p className="text-[11px] text-slate-500">
            Protocol: <code className="font-mono text-slate-400">{protocolRef}</code>
          </p>
        )}
        <p className="text-[11px] text-slate-500">
          This experiment is registered and teed up in the series. The in-app runner is not built yet — it runs via the
          backend harness until then. It appears here so the pipeline of upcoming experiments is visible.
        </p>
        <button
          onClick={developInCopilot}
          className="inline-flex items-center gap-1.5 rounded-md border border-indigo-500/40 bg-indigo-500/15 px-2.5 py-1.5 text-xs font-semibold text-indigo-100 transition hover:bg-indigo-500/25"
          title="Hand this experiment to the IRL Research Copilot to develop it into a constitutionally-compliant protocol"
        >
          <Sparkles className="h-3.5 w-3.5" /> Develop in Research Copilot
        </button>
      </div>
    </div>
  );
}

export default ExperimentDesignStagePanel;
