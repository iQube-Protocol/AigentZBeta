"use client";

/**
 * ExperimentDesignStagePanel — honest status for a registered experiment whose
 * protocol is published but which cannot yet be run as a faithful automated
 * in-app measurement. Instead of a generic "runner pending" (or a fabricated
 * run — forbidden: it would invent methodology and publish invented results
 * into the DVN-anchored canon), each experiment states its SPECIFIC blocker and
 * what unlocks it. The "Develop in Research Copilot" hand-off is the path to
 * close those gaps (author the dataset, operationalize the metric, etc.).
 *
 * Readiness facts below are grounded in the protocol docs (CRP-002 charter +
 * amendments; the EXP-P1/P2/P3 READMEs), not inferred.
 */

import React from "react";
import { FlaskConical, Sparkles } from "lucide-react";

type Readiness = { stage: string; blocker: string; unlock: string };

const READINESS: Record<string, Readiness> = {
  "EXP-007": {
    stage: "Design draft — not yet runnable",
    blocker:
      "No corpus/task dataset exists; the naive-RAG and production-KB baseline arms have no runner; and 'reasoning fidelity' + 'entropy/drift' are not yet operationalized (no rubric, no estimator).",
    unlock:
      "Author the EXP-007 corpus + define the fidelity rubric and the entropy/drift estimator, then wire the two retrieval baseline arms. Then a real four-arm runner can be built.",
  },
  "EXP-008": {
    stage: "Design draft — not yet runnable",
    blocker:
      "The protocol's scorer is blind HUMAN reviewers reconstructing the invariant seed set; the image modality has no in-app generator; and no seed dataset exists.",
    unlock:
      "Author the invariant seed set + a reviewer-reconstruction protocol (or ratify an LLM-judge substitute as a methodology change) and wire image generation.",
  },
  "EXP-P1": {
    stage: "Draft for sign-off — two-party protocol",
    blocker:
      "This is a pre-registered, externally-countersigned experiment: it requires Austin's freeze, and the held-out task set + expert-prose arm are authored OUTSIDE IRL by design. Self-generating them would void the experiment.",
    unlock:
      "Complete the external freeze/countersignature and receive the sealed task set + Arm D prose; then the gauntlet + bootstrap-CI runner can execute the frozen design.",
  },
  "EXP-P2": {
    stage: "Design draft v0.1 — not yet runnable",
    blocker:
      "No frozen Corpus vP2, no hash-committed extraction procedure, and no held-out task set. The 'same-corpus' control forbids improvising them, and 4 of the 5 structural-battery runners are unbuilt.",
    unlock:
      "Freeze the corpus, publish the extraction procedure, and seal the task set; then build the structural-battery runners (discovery/convergence, K* sweep, ablation, projection, graph metrics).",
  },
  "EXP-P3": {
    stage: "Closest to runnable — harness-ready",
    blocker:
      "The field-projection forecaster is already live, but there is no sealed ≥20-change ground-truth set and no baseline retrieval arm to compare against.",
    unlock:
      "Provide a sealed ≥20-change ground-truth set (affected invariants established before forecasting). The live field arm + a baseline retrieval arm + an F1 scorer can then run — this is the one candidate ready to build once the dataset exists.",
  },
};

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
  const readiness = READINESS[experimentId];

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
        <FlaskConical className="h-3.5 w-3.5" /> {readiness?.stage ?? "Design stage — protocol published, runner pending"}
      </div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
        <div className="text-sm font-semibold text-slate-100">{experimentId} · {family}</div>
        <p className="text-xs text-slate-400">{hypothesis}</p>
        {protocolRef && (
          <p className="text-[11px] text-slate-500">
            Protocol: <code className="font-mono text-slate-400">{protocolRef}</code>
          </p>
        )}

        {readiness ? (
          <div className="space-y-1.5 pt-1">
            <div className="rounded-md border border-rose-500/25 bg-rose-500/5 p-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-rose-300/80">Why it can't run yet</div>
              <p className="mt-0.5 text-[11px] text-slate-300">{readiness.blocker}</p>
            </div>
            <div className="rounded-md border border-emerald-500/25 bg-emerald-500/5 p-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300/80">What unlocks it</div>
              <p className="mt-0.5 text-[11px] text-slate-300">{readiness.unlock}</p>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">
            Registered and teed up in the series; the in-app runner is not built yet.
          </p>
        )}

        <p className="text-[11px] text-slate-500">
          A faithful runner is not fabricated here — building one requires the protocol&apos;s real dataset/metric (per the
          docs above). Develop those gaps in the Research Copilot, then the runner can be built for real.
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
