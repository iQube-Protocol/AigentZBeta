"use client";

import React from "react";
import { AlertTriangle, CheckCircle } from "lucide-react";
import type { StageProposal, StageProposalKind } from "@/services/devCommandCenter";

const PROPOSAL_KIND_LABEL: Record<StageProposalKind, string> = {
  intent: "Distilled Intent",
  context_pack: "Context Pack",
  gap_analysis: "Gap Report",
  consequence_canvas: "Consequence Canvas",
  implementation_brief: "Implementation Package",
  validation_report: "Validation Report",
};

function proposalPreviewLines(p: StageProposal): string[] {
  const d = p.data as Record<string, unknown>;
  const count = (v: unknown) => (Array.isArray(v) ? v.length : 0);
  switch (p.kind) {
    case "intent":
      return [
        typeof d.goal === "string" ? `Goal: ${d.goal}` : "",
        `${count(d.users)} user groups · ${count(d.desiredOutcomes)} outcomes · ${count(d.successCriteria)} success criteria · ${count(d.constraints)} constraints`,
      ].filter(Boolean);
    case "context_pack":
      return [`${count(d.items)} context items proposed`];
    case "gap_analysis":
      return [`${count(d.existing)} existing capabilities (reuse/extend) · ${count(d.missing)} to create`];
    case "consequence_canvas":
      return [
        `${count(d.shouldHappen)} should-happen · ${count(d.shouldNeverHappen)} must-never-happen`,
        typeof d.successState === "string" && d.successState ? `Success state: ${d.successState.slice(0, 140)}${d.successState.length > 140 ? "…" : ""}` : "",
      ].filter(Boolean);
    case "implementation_brief":
      return [typeof d.brief === "string" ? `Brief: ${d.brief.split("\n").find(l => l.trim()) ?? ""} (${d.brief.length.toLocaleString()} chars)` : ""];
    case "validation_report":
      return [`${count(d.items)} consequence checks · ${count(d.testingRequirements)} testing requirements`];
    default:
      return [];
  }
}

export function PendingProposalCard({ proposal, onApprove, onDismiss }: {
  proposal: StageProposal;
  onApprove: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="text-[10px] uppercase tracking-wide text-amber-300 font-semibold">
          Proposed by aigentZ — awaiting your approval
        </span>
      </div>
      <div className="text-xs font-semibold text-white">
        {PROPOSAL_KIND_LABEL[proposal.kind]}: {proposal.summary}
      </div>
      <div className="space-y-0.5">
        {proposalPreviewLines(proposal).map((line, i) => (
          <div key={i} className="text-[11px] text-slate-300">{line}</div>
        ))}
      </div>
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
