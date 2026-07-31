"use client";

import React from "react";
import { Layers, Play, Target, Package, FileSearch, AlertTriangle, CheckCircle } from "lucide-react";
import { LayoutShell } from "@/components/metame/welcome/layouts/LayoutShell";
import { PendingProposalCard } from "./PendingProposalCard";
import { canAdvance, buildImplementationPackage } from "@/services/devCommandCenter";
import type { DevLayoutProps, DevCapsuleId } from "./types";
import type { DevLoopStage } from "@/types/devCommandCenter";

const STAGES: { id: DevLoopStage; label: string; icon: typeof Target }[] = [
  { id: "intent_capture", label: "Intent", icon: Target },
  { id: "context_assembly", label: "Context", icon: Package },
  { id: "gap_analysis", label: "Gaps", icon: FileSearch },
  { id: "consequence_modeling", label: "Consequences", icon: AlertTriangle },
  { id: "implementation", label: "Implement", icon: Target },
  { id: "consequence_validation", label: "Validate", icon: CheckCircle },
  { id: "complete", label: "Complete", icon: CheckCircle },
];

function getStageIndex(stage: DevLoopStage): number {
  return STAGES.findIndex(s => s.id === stage);
}

export interface ProjectOverviewLayoutProps extends DevLayoutProps {
  onNavigateCapsule?: (id: DevCapsuleId) => void;
}

export function ProjectOverviewLayout({
  session,
  onDismiss,
  onAdvanceStage,
  pendingProposal,
  onApproveProposal,
  onDismissProposal,
  onNavigateCapsule,
}: ProjectOverviewLayoutProps) {
  const { intent, stage, contextPack, gapAnalysis, consequenceCanvas, validationReport, sessionId } = session;
  const stageIdx = getStageIndex(stage);
  const canAdvanceNow = canAdvance(session);
  const pkg = buildImplementationPackage(session);

  const body = (
    <div className="space-y-4">
      {pendingProposal && onApproveProposal && onDismissProposal && (
        <PendingProposalCard
          proposal={pendingProposal}
          onApprove={onApproveProposal}
          onDismiss={onDismissProposal}
        />
      )}

      {/* Active intent card */}
      {intent ? (
        <button
          type="button"
          onClick={() => onNavigateCapsule?.("intent")}
          className="w-full text-left p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/15 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{intent.goal}</div>
              <div className="text-[10px] text-slate-400 font-mono">{intent.intentId}</div>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
              intent.status === "refined" ? "bg-blue-500/20 text-white border-blue-500/30"
              : intent.status === "approved" ? "bg-green-500/20 text-white border-green-500/30"
              : "bg-slate-500/20 text-white border-slate-500/30"
            }`}>{intent.status}</span>
          </div>
        </button>
      ) : (
        <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/30 text-center">
          <div className="text-xs text-slate-400">No active intent — use &ldquo;New intent&rdquo; to start</div>
        </div>
      )}

      {/* Capability CTA chips — clickable, with data indicators */}
      <div className="space-y-1.5">
        <div className="text-[10px] text-slate-500 uppercase font-semibold px-1">Capabilities</div>
        <div className="grid grid-cols-2 gap-2">
          {([
            { id: "context" as DevCapsuleId, label: "Context Pack", icon: Package, hasData: contextPack !== null && contextPack.items.length > 0, summary: contextPack ? `${contextPack.items.length} items` : null, color: "purple" },
            { id: "gap-analysis" as DevCapsuleId, label: "Gap Analysis", icon: FileSearch, hasData: gapAnalysis !== null, summary: gapAnalysis ? `${gapAnalysis.existing.length} existing · ${gapAnalysis.missing.length} missing` : null, color: "emerald" },
            { id: "consequence-canvas" as DevCapsuleId, label: "Consequence Canvas", icon: AlertTriangle, hasData: consequenceCanvas !== null && consequenceCanvas.successState.length > 0, summary: consequenceCanvas ? `${consequenceCanvas.shouldHappen.length + consequenceCanvas.shouldNeverHappen.length} entries` : null, color: "amber" },
            { id: "validation" as DevCapsuleId, label: "Validation", icon: CheckCircle, hasData: validationReport !== null, summary: validationReport ? validationReport.overallVerdict : null, color: "green" },
          ]).map(cap => (
            <button
              key={cap.id}
              type="button"
              onClick={() => onNavigateCapsule?.(cap.id)}
              className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all text-left hover:ring-1 hover:ring-white/20 ${
                cap.hasData
                  ? `border-${cap.color}-500/30 bg-${cap.color}-500/10`
                  : "border-slate-700/30 bg-slate-800/30"
              }`}
            >
              <cap.icon className={`w-4 h-4 shrink-0 ${cap.hasData ? `text-${cap.color}-400` : "text-slate-500"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-white">{cap.label}</span>
                  {cap.hasData && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                </div>
                {cap.summary && <div className="text-[10px] text-slate-400">{cap.summary}</div>}
                {!cap.hasData && <div className="text-[10px] text-slate-500">Pending</div>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Stage progress */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-2 rounded bg-slate-800/40 border border-slate-700/30">
          <div className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Loop Stage</div>
          <div className="text-xs text-white">{STAGES[stageIdx]?.label} ({stageIdx + 1}/{STAGES.length})</div>
          {canAdvanceNow && <div className="text-[10px] text-emerald-400 mt-0.5">Ready to advance</div>}
        </div>
        <div className="p-2 rounded bg-slate-800/40 border border-slate-700/30">
          <div className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Priority</div>
          <div className="text-xs text-white">{intent?.priority ?? "—"}</div>
        </div>
        <div className="p-2 rounded bg-slate-800/40 border border-slate-700/30">
          <div className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Session</div>
          <div className="text-[10px] text-white font-mono truncate">{sessionId}</div>
        </div>
        <div className="p-2 rounded bg-slate-800/40 border border-slate-700/30">
          <div className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Package</div>
          <div className="text-xs text-white">{pkg ? <span className="text-emerald-300">Ready</span> : <span className="text-amber-300">Incomplete</span>}</div>
        </div>
      </div>

      {intent && (
        <div className="grid grid-cols-2 gap-3">
          <div className="p-2 rounded bg-slate-800/40 border border-slate-700/30">
            <div className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Ventures</div>
            {intent.relatedVentures.map(v => <div key={v} className="text-xs text-white">{v}</div>)}
          </div>
          <div className="p-2 rounded bg-slate-800/40 border border-slate-700/30">
            <div className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Cartridges</div>
            {intent.relatedCartridges.map(c => <div key={c} className="text-xs text-white font-mono">{c}</div>)}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <LayoutShell
      surfaceId="dev-project-overview"
      disTemplateId="dev-project-overview-layout-v1"
      headerIcon={<Layers className="w-4 h-4" />}
      headerEyebrow="Dev Command Center"
      headerTitle={intent ? intent.goal : "Project Overview"}
      headerActions={
        canAdvanceNow ? (
          <button
            onClick={onAdvanceStage}
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
          >
            <Play className="w-3 h-3" />
            Advance
          </button>
        ) : undefined
      }
      onDismiss={onDismiss}
      dismissLabel="Back to overview"
      body={body}
    />
  );
}
