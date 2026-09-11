"use client";

import React from "react";
import { AlertTriangle, CheckCircle, Play } from "lucide-react";
import { LayoutShell } from "@/components/metame/welcome/layouts/LayoutShell";
import { PendingProposalCard } from "./PendingProposalCard";
import { canAdvance } from "@/services/devCommandCenter";
import type { DevLayoutProps } from "./types";

export function ConsequenceCanvasLayout({
  session,
  onDismiss,
  onAdvanceStage,
  pendingProposal,
  onApproveProposal,
  onDismissProposal,
}: DevLayoutProps) {
  const { consequenceCanvas: canvas } = session;
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

      {canvas ? (
        <div className="space-y-3">
          <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
            <div className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Success State</div>
            <p className="text-xs text-green-300">{canvas.successState || "(not defined)"}</p>
          </div>
          {canvas.workflowsActivated.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Workflows:</span>
              {canvas.workflowsActivated.map(w => (
                <span key={w} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">{w}</span>
              ))}
            </div>
          )}
          {canvas.systemsAffected.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Systems:</span>
              {canvas.systemsAffected.map(s => (
                <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300">{s}</span>
              ))}
            </div>
          )}
          {canvas.permissionsRequired.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Permissions:</span>
              {canvas.permissionsRequired.map(p => (
                <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">{p}</span>
              ))}
            </div>
          )}
          <div>
            <div className="text-xs text-emerald-400 font-semibold mb-1">Should Happen ({canvas.shouldHappen.length})</div>
            {canvas.shouldHappen.map(e => (
              <div key={e.id} className="flex items-start gap-2 py-1 border-b border-slate-700/20 last:border-0">
                <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-slate-300">{e.description}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-500">{e.category}</span>
                    <span className={`text-[10px] ${e.severity === "critical" ? "text-red-400" : e.severity === "high" ? "text-amber-400" : "text-slate-400"}`}>{e.severity}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div>
            <div className="text-xs text-rose-400 font-semibold mb-1">Should Never Happen ({canvas.shouldNeverHappen.length})</div>
            {canvas.shouldNeverHappen.map(e => (
              <div key={e.id} className="flex items-start gap-2 py-1 border-b border-slate-700/20 last:border-0">
                <AlertTriangle className="w-3 h-3 text-rose-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-slate-300">{e.description}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-500">{e.category}</span>
                    <span className={`text-[10px] ${e.severity === "critical" ? "text-red-400" : e.severity === "high" ? "text-amber-400" : "text-slate-400"}`}>{e.severity}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-400 italic py-8 text-center">
          Consequence canvas models what should and shouldn&apos;t happen. Ask aigentZ to model consequences — it will propose a canvas with should-happen and must-never-happen entries.
        </div>
      )}
    </div>
  );

  return (
    <LayoutShell
      surfaceId="dev-consequence-canvas"
      disTemplateId="dev-consequence-canvas-layout-v1"
      headerIcon={<AlertTriangle className="w-4 h-4" />}
      headerEyebrow="ICE Stage 4"
      headerTitle="Consequence Canvas"
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
