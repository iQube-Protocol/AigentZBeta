"use client";

import React from "react";
import { CheckCircle, AlertTriangle, Play } from "lucide-react";
import { LayoutShell } from "@/components/metame/welcome/layouts/LayoutShell";
import { PendingProposalCard } from "./PendingProposalCard";
import { canAdvance } from "@/services/devCommandCenter";
import type { DevLayoutProps } from "./types";

export function ValidationLayout({
  session,
  onDismiss,
  onAdvanceStage,
  pendingProposal,
  onApproveProposal,
  onDismissProposal,
}: DevLayoutProps) {
  const { validationReport: report } = session;
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

      {report ? (
        <div className="space-y-3">
          <div className={`p-2 rounded border ${
            report.overallVerdict === "pass" ? "text-green-400 bg-green-500/10 border-green-500/20"
            : report.overallVerdict === "fail" ? "text-red-400 bg-red-500/10 border-red-500/20"
            : "text-amber-400 bg-amber-500/10 border-amber-500/20"
          }`}>
            <div className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Overall Verdict</div>
            <div className="text-sm font-bold uppercase">{report.overallVerdict}</div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Satisfied: {report.satisfied.length}</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">Unresolved: {report.unresolved.length}</span>
            <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">Unintended: {report.unintended.length}</span>
          </div>
          {report.satisfied.length > 0 && (
            <div>
              <div className="text-xs text-emerald-400 font-semibold mb-1">Satisfied</div>
              {report.satisfied.map(item => (
                <div key={item.consequenceId} className="flex items-start gap-2 py-1 border-b border-slate-700/20 last:border-0">
                  <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs text-slate-300">{item.description}</div>
                    <div className="text-[10px] text-slate-500">{item.evidence}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {report.unresolved.length > 0 && (
            <div>
              <div className="text-xs text-amber-400 font-semibold mb-1">Unresolved</div>
              {report.unresolved.map(item => (
                <div key={item.consequenceId} className="flex items-start gap-2 py-1 border-b border-slate-700/20 last:border-0">
                  <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs text-slate-300">{item.description}</div>
                    <div className="text-[10px] text-slate-500">{item.evidence}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {report.unintended.length > 0 && (
            <div>
              <div className="text-xs text-red-400 font-semibold mb-1">Unintended</div>
              {report.unintended.map(item => (
                <div key={item.consequenceId} className="flex items-start gap-2 py-1 border-b border-slate-700/20 last:border-0">
                  <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs text-slate-300">{item.description}</div>
                    <div className="text-[10px] text-slate-500">{item.evidence}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-slate-400 italic py-8 text-center">
          {session.implementationBrief || session.generatedPack
            ? "The implementation pack is in place — the loop is AT Constitutional Validation now. In the chat, ask aigentZ to “validate the build against the consequence canvas” — it will check every should-happen and must-never-happen entry and write the validation report here. APPROVING the report records the constitutional validation receipt (with this pack's id) — that receipt is what OPENS THE MERGE GATE on the pack's PR in the GitHub capsule, and what unlocks Remediation or Deployment Authorization. If Claude was dispatched, its PR is waiting in the GitHub capsule; merging it deploys."
            : "Validation runs after implementation. Ask aigentZ to validate the build against the consequence canvas — it will check every should-happen and must-never-happen entry."}
        </div>
      )}
    </div>
  );

  return (
    <LayoutShell
      surfaceId="dev-validation"
      disTemplateId="dev-validation-layout-v1"
      headerIcon={<CheckCircle className="w-4 h-4" />}
      headerEyebrow="ICE Stage 6"
      headerTitle="Consequence Validation"
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
