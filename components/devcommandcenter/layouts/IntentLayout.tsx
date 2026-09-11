"use client";

import React from "react";
import { Target, Play } from "lucide-react";
import { LayoutShell } from "@/components/metame/welcome/layouts/LayoutShell";
import { PendingProposalCard } from "./PendingProposalCard";
import { canAdvance } from "@/services/devCommandCenter";
import type { DevLayoutProps } from "./types";

export function IntentLayout({
  session,
  onDismiss,
  onAdvanceStage,
  pendingProposal,
  onApproveProposal,
  onDismissProposal,
}: DevLayoutProps) {
  const { intent } = session;
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

      {intent ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
              intent.status === "refined" ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
              : intent.status === "approved" ? "bg-green-500/20 text-green-300 border-green-500/30"
              : "bg-slate-500/20 text-slate-300 border-slate-500/30"
            }`}>{intent.status}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
              intent.priority === "critical" ? "bg-red-500/20 text-red-300 border-red-500/30"
              : intent.priority === "high" ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
              : "bg-slate-500/20 text-slate-300 border-slate-500/30"
            }`}>{intent.priority}</span>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-0.5">Goal</div>
            <p className="text-sm text-white">{intent.goal}</p>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-0.5">Raw input</div>
            <p className="text-xs text-slate-400 italic">&ldquo;{intent.rawInput}&rdquo;</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-500 mb-1">Users</div>
              {intent.users.map(u => <div key={u} className="text-xs text-slate-300">· {u}</div>)}
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Desired Outcomes</div>
              {intent.desiredOutcomes.map(o => <div key={o} className="text-xs text-slate-300">· {o}</div>)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Success Criteria</div>
            {intent.successCriteria.map(c => <div key={c} className="text-xs text-emerald-300">✓ {c}</div>)}
          </div>
          {intent.constraints.length > 0 && (
            <div>
              <div className="text-xs text-slate-500 mb-1">Constraints</div>
              {intent.constraints.map(c => <div key={c} className="text-xs text-amber-300">⚠ {c}</div>)}
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-slate-400 italic py-8 text-center">
          No intent captured yet. Use the copilot to start a new intent — aigentZ will propose a structured intent card here for your approval.
        </div>
      )}
    </div>
  );

  return (
    <LayoutShell
      surfaceId="dev-intent"
      disTemplateId="dev-intent-layout-v1"
      headerIcon={<Target className="w-4 h-4" />}
      headerEyebrow="ICE Stage 1"
      headerTitle="Intent Distillation"
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
