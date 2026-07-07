"use client";

/**
 * DeploymentAuthorizationLayout — ICE-8, consequence-test-before-deploy.
 *
 * The final constitutional gate: deployment is authorized ONLY when the
 * consequence test passed (constitutionalThresholdMet). When it has not, the
 * blocking consequences are listed and the authorize action stays disabled.
 *
 * Honest limit (CFS-016 D1): execution stays human. This card records the
 * AUTHORIZATION — a `deployment_authorized` receipt (Deployment class). No
 * credentials move; the code runs in Claude Code and is pushed manually. The
 * receipt is the authorization record, not an executor.
 */

import React, { useMemo, useState } from "react";
import { CheckCircle, Loader2, Play, Rocket, ShieldCheck, ShieldX } from "lucide-react";
import { LayoutShell } from "@/components/metame/welcome/layouts/LayoutShell";
import { PendingProposalCard } from "./PendingProposalCard";
import { canAdvance, constitutionalThresholdMet } from "@/services/devCommandCenter";
import { experimentStep } from "@/components/composer/experimentStepFetch";
import type { DeploymentAuthorization } from "@/types/devCommandCenter";
import type { DevLayoutProps } from "./types";

export function DeploymentAuthorizationLayout({
  session,
  onDismiss,
  onAdvanceStage,
  pendingProposal,
  onApproveProposal,
  onDismissProposal,
  onReceipt,
  onAuthorize,
}: DevLayoutProps & {
  /** Commits the deployment authorization into the session so the loop can
   *  complete. Called after the receipt is recorded. */
  onAuthorize?: (auth: DeploymentAuthorization) => void;
}) {
  const canAdvanceNow = canAdvance(session);
  const thresholdMet = constitutionalThresholdMet(session);
  const report = session.validationReport;
  const existing = session.deploymentAuthorization ?? null;

  // Blocking consequences when the threshold is not met: high/critical items
  // that failed or partially failed in the validation report.
  const blocking = useMemo(() => {
    if (!report || thresholdMet) return [] as string[];
    const all = [...report.satisfied, ...report.unresolved, ...report.unintended];
    return all
      .filter(
        (i) =>
          (i.verdict === "unintended" || i.verdict === "partial") &&
          (i.severity === "critical" || i.severity === "high"),
      )
      .map((i) => i.consequenceId || i.description);
  }, [report, thresholdMet]);

  const [authorizing, setAuthorizing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const authorize = async () => {
    if (!session.intent || !thresholdMet) return;
    setAuthorizing(true);
    setResult(null);
    try {
      const rationale = `Constitutional threshold met — validation verdict ${report?.overallVerdict ?? "pass"}; consequence test passed before deploy.`;
      const data = await experimentStep("/api/constitutional/deployment-authorization", {
        goal: session.intent.goal,
        constitutionalThresholdMet: true,
        validationVerdict: report?.overallVerdict ?? "pass",
        blockingCount: 0,
      });
      if (typeof data.receiptId === "string" && data.receiptId) {
        onReceipt?.({ id: data.receiptId, actionType: "deployment_authorized" });
        setResult(`Authorized — receipt ${data.receiptId.slice(0, 8)}…`);
      } else {
        setResult("Authorized (no receipt id returned)");
      }
      onAuthorize?.({
        intentId: session.intent.intentId,
        authorized: true,
        constitutionalThresholdMet: true,
        rationale,
        blockingConsequences: [],
        authorizedAt: new Date().toISOString(),
      });
    } catch (err) {
      setResult(err instanceof Error ? err.message : "authorization failed");
    } finally {
      setAuthorizing(false);
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

      {/* Threshold status */}
      <div className={`rounded-lg border p-3 space-y-2 ${thresholdMet ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"}`}>
        <div className="flex items-center gap-2">
          {thresholdMet ? (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <ShieldX className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          )}
          <span className={`text-xs font-semibold ${thresholdMet ? "text-emerald-300" : "text-rose-300"}`}>
            {thresholdMet
              ? "Constitutional threshold met — consequence test passed"
              : "Constitutional threshold NOT met — deployment blocked"}
          </span>
        </div>
        {!thresholdMet && (
          <div className="text-[10px] text-slate-400">
            {report
              ? "Remedy the blocking consequences and re-validate before deployment can be authorized."
              : "No validation report yet — run Constitutional Validation first."}
          </div>
        )}
        {blocking.length > 0 && (
          <ul className="space-y-0.5">
            {blocking.map((b, i) => (
              <li key={i} className="text-[10px] text-rose-300 flex gap-1.5">
                <span className="text-rose-400/60 shrink-0">·</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Honest execution boundary */}
      <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-3 space-y-1.5">
        <div className="text-[10px] font-semibold text-slate-300">Execution stays human (CFS-016 D1)</div>
        <p className="text-[10px] text-slate-500">
          This authorizes deployment — it does not execute it. No credentials move. The receipt is the
          authorization record; the implementation pack is run in Claude Code and pushed manually. Only a
          passing consequence test unlocks this action.
        </p>
        <button
          onClick={authorize}
          disabled={authorizing || !thresholdMet || existing?.authorized === true}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 hover:bg-emerald-600 px-2.5 py-1.5 text-xs text-white disabled:opacity-50"
        >
          {authorizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
          {existing?.authorized ? "Deployment authorized" : authorizing ? "Authorizing…" : "Authorize deployment"}
        </button>
        {result && <p className="text-[10px] text-slate-400">{result}</p>}
        {existing?.authorized && (
          <div className="flex items-center gap-1 text-[10px] text-emerald-300">
            <CheckCircle className="w-3 h-3" />
            {existing.rationale}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <LayoutShell
      surfaceId="dev-deployment-authorization"
      disTemplateId="dev-deployment-authorization-layout-v1"
      headerIcon={<Rocket className="w-4 h-4" />}
      headerEyebrow="ICE Stage 8"
      headerTitle="Deployment Authorization"
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
