"use client";

import React, { useState } from "react";
import { CheckCircle, AlertTriangle, Loader2, Play, ShieldCheck } from "lucide-react";
import { LayoutShell } from "@/components/metame/welcome/layouts/LayoutShell";
import { PendingProposalCard } from "./PendingProposalCard";
import { canAdvance } from "@/services/devCommandCenter";
import { personaFetch } from "@/utils/personaSpine";
import type { DevLayoutProps } from "./types";

export function ValidationLayout({
  session,
  onDismiss,
  onAdvanceStage,
  pendingProposal,
  onApproveProposal,
  onDismissProposal,
  onProposal,
}: DevLayoutProps & {
  /** Feeds a route-produced validation_report proposal into the SAME pending-
   *  approval path chat proposals use (parent: handleStageProposals). */
  onProposal?: (proposal: { kind: string; summary: string; data: Record<string, unknown> }) => void;
}) {
  const { validationReport: report } = session;
  const canAdvanceNow = canAdvance(session);

  // Dedicated validation runner (2026-07-14): the chat validate turn dies at
  // Amplify's hard ~30s response ceiling (the copilot mega-prompt + the
  // longest structured generation of any stage). This button runs the same
  // validation as a FOCUSED job — /api/dev-command-center/validate, one
  // compact invariant-routed inference — and returns the standard proposal.
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const canvas = session.consequenceCanvas;

  const runValidation = async () => {
    if (!session.intent || !canvas) return;
    setRunning(true);
    setRunError(null);
    try {
      const res = await personaFetch("/api/dev-command-center/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: session.intent.goal,
          shouldHappen: canvas.shouldHappen,
          shouldNeverHappen: canvas.shouldNeverHappen,
          implementationSummary: session.implementationBrief ?? "",
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; proposal?: { kind: string; summary: string; data: Record<string, unknown> } }
        | null;
      if (!res.ok || data?.ok !== true || !data.proposal) {
        throw new Error(data?.error || `validation failed (HTTP ${res.status})`);
      }
      onProposal?.(data.proposal);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "validation failed");
    } finally {
      setRunning(false);
    }
  };

  const body = (
    <div className="space-y-4">
      {pendingProposal && onApproveProposal && onDismissProposal && (
        <PendingProposalCard
          proposal={pendingProposal}
          onApprove={onApproveProposal}
          onDismiss={onDismissProposal}
        />
      )}

      {/* The reliable validation lane — always available once a canvas exists. */}
      {canvas && !pendingProposal && (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 space-y-1.5">
          <div className="text-xs font-semibold text-emerald-300">Run Constitutional Validation</div>
          <p className="text-[10px] text-slate-500">
            Judges every should-happen and must-never-happen entry against the implementation brief in one
            focused, invariant-routed inference, then surfaces the report for your approval. Approving it
            records the validation receipt that opens the merge gate on the pack&apos;s PR.
          </p>
          <button
            onClick={runValidation}
            disabled={running || !session.intent}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 hover:bg-emerald-600 px-2.5 py-1.5 text-xs text-white disabled:opacity-50"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {running ? "Validating…" : "Run validation"}
          </button>
          {runError && <p className="text-xs text-rose-400">{runError}</p>}
        </div>
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
