"use client";

/**
 * ExperimentDesignStagePanel — honest placeholder for a registered experiment
 * whose protocol is published but whose in-app runner is not built yet. Shows
 * the hypothesis + protocol reference so the experiment is VISIBLE and teed up
 * in the left panel (the operator can see what's next), without pretending it
 * can run. No fake run button — epistemic honesty (CLAUDE.md).
 */

import React from "react";
import { FlaskConical } from "lucide-react";

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
      </div>
    </div>
  );
}

export default ExperimentDesignStagePanel;
