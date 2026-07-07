"use client";

/**
 * RemediationLayout — ICE-7, the constitutional remediation fork.
 *
 * When Constitutional Validation surfaces a high/critical must-not-happen
 * consequence that FAILED or PARTIALLY failed, the loop forks here instead of
 * terminating as "validated" (validationRequiresRemediation). This card:
 *
 *   1. Shows the validation failures that triggered the fork.
 *   2. Hosts the pending `remediation_plan` proposal (each remedy + its
 *      learningNote — the feedback-loop-for-learning the operator asked for).
 *   3. "Record remediation" POSTs a Constitutional-class receipt
 *      (`remediation_recorded`) and pushes its receiptId into the session.
 *
 * After the plan is approved the loop re-validates (revalidationRequired) or
 * proceeds to Deployment Authorization when residual risk is accepted.
 */

import React, { useMemo, useState } from "react";
import { AlertTriangle, Check, Lightbulb, Loader2, Play, ShieldAlert } from "lucide-react";
import { LayoutShell } from "@/components/metame/welcome/layouts/LayoutShell";
import { PendingProposalCard } from "./PendingProposalCard";
import { canAdvance, validationRequiresRemediation } from "@/services/devCommandCenter";
import { experimentStep } from "@/components/composer/experimentStepFetch";
import type { ConsequenceValidationItem } from "@/types/devCommandCenter";
import type { DevLayoutProps } from "./types";

export function RemediationLayout({
  session,
  onDismiss,
  onAdvanceStage,
  pendingProposal,
  onApproveProposal,
  onDismissProposal,
  onReceipt,
}: DevLayoutProps) {
  const canAdvanceNow = canAdvance(session);
  const report = session.validationReport;
  const plan = session.remediationPlan;

  // The failures that triggered the fork: high/critical items that came back
  // unintended or partial, plus everything already bucketed as unintended.
  const failures = useMemo<ConsequenceValidationItem[]>(() => {
    if (!report) return [];
    const all = [...report.satisfied, ...report.unresolved, ...report.unintended];
    return all.filter(
      (i) =>
        (i.verdict === "unintended" || i.verdict === "partial") &&
        (i.severity === "critical" || i.severity === "high"),
    );
  }, [report]);

  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState<string | null>(null);

  const record = async () => {
    if (!session.intent || !plan) return;
    setRecording(true);
    setRecorded(null);
    try {
      const data = await experimentStep("/api/constitutional/validation-record", {
        goal: session.intent.goal,
        kind: "remediation",
        remedyCount: plan.remedies.length,
        revalidationRequired: plan.revalidationRequired,
      });
      if (typeof data.receiptId === "string" && data.receiptId) {
        onReceipt?.({ id: data.receiptId, actionType: "remediation_recorded" });
        setRecorded(`Recorded — receipt ${data.receiptId.slice(0, 8)}…`);
      } else {
        setRecorded("Recorded (no receipt id returned)");
      }
    } catch (err) {
      setRecorded(err instanceof Error ? err.message : "recording failed");
    } finally {
      setRecording(false);
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

      {/* Why we forked here */}
      <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span className="text-xs font-semibold text-rose-300">
            Constitutional consequence test did not pass — remediation required
          </span>
        </div>
        <p className="text-[10px] text-slate-400">
          A high/critical must-not-happen consequence came back failed or partial. The loop does not
          accept this as "validated": remedy each below, capturing the lesson learned, then re-validate.
        </p>
        {report && (
          <div className="text-[10px] text-slate-500">
            Overall verdict: <span className="uppercase font-semibold text-rose-300">{report.overallVerdict}</span>
            {" · "}
            {failures.length} high/critical failure{failures.length === 1 ? "" : "s"}
          </div>
        )}
      </div>

      {/* The failures that triggered the fork */}
      {failures.length > 0 && (
        <div>
          <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Failures to remedy</div>
          {failures.map((item, i) => (
            <div key={`${item.consequenceId}-${i}`} className="flex items-start gap-2 py-1 border-b border-slate-700/20 last:border-0">
              <AlertTriangle className="w-3 h-3 text-rose-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-slate-300">{item.description}</div>
                <div className="text-[10px] text-slate-500">
                  [{item.severity} · {item.verdict}] {item.evidence}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* The approved remediation plan */}
      {plan ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
          <div className="text-xs font-semibold text-amber-300">Remediation plan</div>
          {plan.remedies.map((r, i) => (
            <div key={`${r.consequenceId}-${i}`} className="py-1 border-b border-amber-500/10 last:border-0 space-y-0.5">
              <div className="text-[11px] text-slate-200">{r.description}</div>
              <div className="text-[10px] text-emerald-300">Remedy: {r.remedy}</div>
              {r.learningNote && (
                <div className="flex items-start gap-1 text-[10px] text-cyan-300/80">
                  <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>Lesson: {r.learningNote}</span>
                </div>
              )}
            </div>
          ))}
          {plan.residualRisk && (
            <div className="text-[10px] text-slate-400">Residual risk: {plan.residualRisk}</div>
          )}
          <div className="text-[10px] text-slate-500">
            {plan.revalidationRequired
              ? "Re-validation required — advancing returns to Constitutional Validation."
              : "Residual risk accepted — advancing proceeds to Deployment Authorization."}
          </div>
          <button
            onClick={record}
            disabled={recording}
            className="inline-flex items-center gap-1 rounded bg-indigo-700 hover:bg-indigo-600 px-2 py-1 text-[11px] text-white disabled:opacity-50"
          >
            {recording ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            {recording ? "Recording…" : "Record remediation"}
          </button>
          {recorded && <p className="text-[10px] text-slate-400">{recorded}</p>}
        </div>
      ) : (
        <div className="text-xs text-slate-400 italic py-4 text-center">
          No remediation plan yet. Ask aigentZ to remediate the failed consequences — it will propose a
          remedy and a captured lesson for each, which you approve here.
        </div>
      )}
    </div>
  );

  return (
    <LayoutShell
      surfaceId="dev-remediation"
      disTemplateId="dev-remediation-layout-v1"
      headerIcon={<ShieldAlert className="w-4 h-4" />}
      headerEyebrow="ICE Stage 7"
      headerTitle="Remediation"
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
