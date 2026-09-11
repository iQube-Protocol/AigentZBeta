"use client";

import React from "react";
import { Package, Play } from "lucide-react";
import { LayoutShell } from "@/components/metame/welcome/layouts/LayoutShell";
import { PendingProposalCard } from "./PendingProposalCard";
import { canAdvance } from "@/services/devCommandCenter";
import type { DevLayoutProps } from "./types";

export function ContextLayout({
  session,
  onDismiss,
  onAdvanceStage,
  pendingProposal,
  onApproveProposal,
  onDismissProposal,
}: DevLayoutProps) {
  const { contextPack: pack } = session;
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

      {pack ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Reuse: {pack.reuseFirst.length}</span>
            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">Extend: {pack.extendSecond.length}</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-300">Reference: {pack.buildNewLast.length}</span>
            {pack.totalTokenEstimate > 0 && (
              <span className="text-[10px] text-slate-500">{pack.totalTokenEstimate.toLocaleString()} est. tokens</span>
            )}
          </div>
          {pack.items.map(item => (
            <div key={item.sourcePath} className="py-1.5 border-b border-slate-700/20 last:border-0">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-white truncate">{item.title}</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">{item.sourcePath}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-500">{item.relevanceScore}%</span>
                  <span className={`text-[10px] px-1 py-0.5 rounded ${
                    item.reuseSignal === "reuse" ? "bg-emerald-500/20 text-emerald-300"
                    : item.reuseSignal === "extend" ? "bg-blue-500/20 text-blue-300"
                    : "bg-slate-500/20 text-slate-300"
                  }`}>{item.reuseSignal}</span>
                </div>
              </div>
              {item.excerpt && <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{item.excerpt}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-slate-400 italic py-8 text-center">
          Context pack assembles after intent is refined. Ask aigentZ to assemble context — it will propose a pack here grounded in real platform inventory.
        </div>
      )}
    </div>
  );

  return (
    <LayoutShell
      surfaceId="dev-context"
      disTemplateId="dev-context-layout-v1"
      headerIcon={<Package className="w-4 h-4" />}
      headerEyebrow="ICE Stage 2"
      headerTitle="Context Pack"
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
