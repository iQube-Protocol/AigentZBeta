"use client";

import React from "react";
import { FileSearch, Play } from "lucide-react";
import { LayoutShell } from "@/components/metame/welcome/layouts/LayoutShell";
import { PendingProposalCard } from "./PendingProposalCard";
import { canAdvance } from "@/services/devCommandCenter";
import type { DevLayoutProps } from "./types";

export function GapAnalysisLayout({
  session,
  onDismiss,
  onAdvanceStage,
  pendingProposal,
  onApproveProposal,
  onDismissProposal,
}: DevLayoutProps) {
  const { gapAnalysis: analysis } = session;
  const canAdvanceNow = canAdvance(session);

  const body = (
    <div className="space-y-4">
      {pendingProposal && onApproveProposal && onDismissProposal && (
        <PendingProposalCard
          proposal={pendingProposal}
          onApprove={onApproveProposal}
          onDismiss={onDismissProposal}
        />
      )}

      {analysis ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.round(analysis.reuseRatio * 100)}%` }} />
            </div>
            <span className="text-xs text-emerald-300 font-semibold">{Math.round(analysis.reuseRatio * 100)}% reuse</span>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1 uppercase font-semibold">Existing ({analysis.existing.length})</div>
            {analysis.existing.map(c => (
              <div key={c.name} className="py-1 border-b border-slate-700/20 last:border-0">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-emerald-300">{c.name}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-mono">{c.location}</span>
                    <span className="text-[10px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300">{c.reuseStrategy}</span>
                  </div>
                </div>
                {c.description && <div className="text-[10px] text-slate-400 mt-0.5">{c.description}</div>}
              </div>
            ))}
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1 uppercase font-semibold">Missing ({analysis.missing.length})</div>
            {analysis.missing.map(c => (
              <div key={c.name} className="py-1.5 border-b border-slate-700/20 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-amber-300">{c.name}</span>
                  <span className="text-[10px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300">{c.estimatedComplexity}</span>
                </div>
                <div className="text-[10px] text-slate-400">{c.description}</div>
                <div className="text-[10px] text-slate-500 font-mono">{c.suggestedLocation}</div>
                {c.dependencies.length > 0 && (
                  <div className="text-[10px] text-slate-500 mt-0.5">Deps: {c.dependencies.join(", ")}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-400 italic py-8 text-center">
          Gap analysis runs after context pack is assembled. Ask aigentZ to analyze gaps — it will audit existing capabilities against the golden rule: Reuse &gt; Extend &gt; Create.
        </div>
      )}
    </div>
  );

  return (
    <LayoutShell
      surfaceId="dev-gap-analysis"
      disTemplateId="dev-gap-analysis-layout-v1"
      headerIcon={<FileSearch className="w-4 h-4" />}
      headerEyebrow="ICE Stage 3"
      headerTitle="Gap Analysis"
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
