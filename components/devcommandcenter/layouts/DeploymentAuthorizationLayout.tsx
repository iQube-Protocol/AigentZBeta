"use client";

/**
 * DeploymentAuthorizationLayout — ICE-8, consequence-test-before-deploy.
 *
 * The final constitutional gate: deployment is authorized ONLY when the
 * consequence test passed (constitutionalThresholdMet). When it has not, the
 * blocking consequences are listed and the authorize action stays disabled.
 *
 * Deploy — merge the pack PR (2026-07-14, operator direction: "would this
 * final deployment auth stage not be where and when the PR is actually merged
 * and deployed?"): when a dispatched implementation PR (`aigentz/pack-*` →
 * dev) is open, this capsule lists it and hosts the MERGE — the same
 * `/api/dev-command-center/github/merge` route the GitHub capsule uses, so
 * the server-side validation gate (+ receipted admin override) is identical.
 * The loop's final stage IS the deploy act: merge → Amplify builds dev.
 *
 * CFS-016 D1: execution stays human — the operator's deliberate merge click
 * here is the human gate, receipted as `deployment_authorized`.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle, GitBranch, Loader2, Play, Rocket, ShieldCheck, ShieldX } from "lucide-react";
import { LayoutShell } from "@/components/metame/welcome/layouts/LayoutShell";
import { PendingProposalCard } from "./PendingProposalCard";
import { canAdvance, constitutionalThresholdMet } from "@/services/devCommandCenter";
import { experimentStep } from "@/components/composer/experimentStepFetch";
import { personaFetchDeadline } from "@/utils/personaSpine";
import type { DeploymentAuthorization } from "@/types/devCommandCenter";
import type { DevLayoutProps } from "./types";

/** The dispatch route's slug transform (deterministic on packId) — used to
 *  recognise THIS session's pack PR among the open aigentz/pack-* PRs. */
function packSlug(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

interface PackPr {
  number: number;
  title: string;
  headRef: string;
  baseRef: string;
}

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

  // ── Deploy: the pack PR(s) waiting on dev, merged from THIS capsule ──
  const sessionSlug = useMemo(() => {
    const id = (session.generatedPack as { id?: string } | null)?.id;
    return id ? packSlug(id) : null;
  }, [session.generatedPack]);
  const [packPrs, setPackPrs] = useState<PackPr[] | null>(null);
  const [armedMerge, setArmedMerge] = useState<number | null>(null);
  const [merging, setMerging] = useState<number | null>(null);
  const [mergeNote, setMergeNote] = useState<string | null>(null);
  const [overrideArmed, setOverrideArmed] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const loadPackPrs = useCallback(async () => {
    try {
      const res = await personaFetchDeadline("/api/dev-command-center/github", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; pulls?: PackPr[] } | null;
      if (!res.ok || !json?.ok || !Array.isArray(json.pulls)) { setPackPrs([]); return; }
      const packOnly = json.pulls.filter((p) => p.baseRef === "dev" && p.headRef.startsWith("aigentz/pack-"));
      // Prefer THIS session's pack when we know it; otherwise show all pack PRs.
      const mine = sessionSlug ? packOnly.filter((p) => p.headRef.startsWith(`aigentz/pack-${sessionSlug}`)) : [];
      setPackPrs(mine.length > 0 ? mine : packOnly);
    } catch {
      setPackPrs([]);
    }
  }, [sessionSlug]);
  useEffect(() => { void loadPackPrs(); }, [loadPackPrs]);

  const mergePackPr = useCallback(async (pullNumber: number, override?: { reason: string }) => {
    setMerging(pullNumber);
    setArmedMerge(null);
    setMergeNote(null);
    try {
      const res = await personaFetchDeadline("/api/dev-command-center/github/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pullNumber,
          ...(override ? { overrideValidation: true, overrideReason: override.reason } : {}),
        }),
      });
      const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok || json?.ok !== true) {
        if (json?.validationGate === "blocked") setOverrideArmed(true);
        setMergeNote((typeof json?.error === "string" && json.error) || `merge failed (HTTP ${res.status})`);
        return;
      }
      setOverrideArmed(false);
      setOverrideReason("");
      setMergeNote(
        `${json.validationGate === "overridden" ? "⚠ OVERRIDE — " : ""}Merged ${String(json.sha ?? "").slice(0, 10)} — Amplify is deploying dev.` +
          (typeof json.receiptId === "string" && json.receiptId ? ` receipt ${String(json.receiptId).slice(0, 8)}…` : ""),
      );
      if (typeof json.receiptId === "string" && json.receiptId) {
        onReceipt?.({ id: json.receiptId, actionType: "deployment_authorized" });
      }
      void loadPackPrs();
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      setMergeNote(aborted ? "merge timed out — check GitHub before retrying (it may have landed)" : err instanceof Error ? err.message : String(err));
    } finally {
      setMerging(null);
    }
  }, [loadPackPrs, onReceipt]);

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

      {/* Deploy — merge the dispatched pack PR (the loop's final act). The
          server enforces the validation gate; the override is receipted. */}
      <div className="rounded-lg border border-indigo-500/25 bg-indigo-500/5 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <GitBranch className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
          <span className="text-xs font-semibold text-indigo-300">Deploy — merge the pack PR</span>
        </div>
        {packPrs === null ? (
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <Loader2 className="w-3 h-3 animate-spin" /> checking for the dispatched implementation PR…
          </div>
        ) : packPrs.length === 0 ? (
          <p className="text-[10px] text-slate-500">
            No open <code className="text-slate-400">aigentz/pack-*</code> PR found. Dispatch the pack to
            Claude from the Implement capsule; its PR appears here (and in the GitHub capsule) when CI
            finishes.
          </p>
        ) : (
          packPrs.map((pr) => (
            <div key={pr.number} className="space-y-1">
              <div className="text-[11px] text-slate-300">
                <span className="text-slate-500 font-mono">#{pr.number}</span> {pr.title}
                <span className="text-slate-600"> · {pr.headRef} → dev</span>
              </div>
              <div className="flex items-center gap-1.5">
                {armedMerge === pr.number ? (
                  <>
                    <button
                      onClick={() => void mergePackPr(pr.number)}
                      disabled={merging !== null}
                      className="rounded bg-emerald-700 hover:bg-emerald-600 px-2 py-1 text-[11px] text-white disabled:opacity-50"
                    >
                      Confirm merge → deploys dev
                    </button>
                    <button
                      onClick={() => setArmedMerge(null)}
                      className="rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[11px] text-slate-300"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setArmedMerge(pr.number)}
                    disabled={merging !== null}
                    className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1 text-[11px] text-emerald-300 disabled:opacity-50"
                  >
                    {merging === pr.number ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3" />}
                    Merge & deploy
                  </button>
                )}
              </div>
              {overrideArmed && (
                <div className="rounded border border-amber-500/40 bg-amber-500/10 p-1.5 space-y-1">
                  <div className="text-[10px] font-semibold text-amber-300">
                    Override validation gate — deploys UNVALIDATED code; the override is receipted (DVN-anchorable).
                  </div>
                  <input
                    className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-slate-100 text-[10px]"
                    placeholder="Reason for overriding (required, ≥ 10 chars)"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                  />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => void mergePackPr(pr.number, { reason: overrideReason })}
                      disabled={merging !== null || overrideReason.trim().length < 10}
                      className="rounded bg-amber-700 hover:bg-amber-600 px-1.5 py-0.5 text-[10px] text-white disabled:opacity-50"
                    >
                      Override & merge
                    </button>
                    <button
                      onClick={() => { setOverrideArmed(false); setOverrideReason(""); }}
                      className="rounded bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        {mergeNote && (
          <p className={`text-[10px] ${mergeNote.includes("Merged") ? "text-emerald-300" : "text-rose-300"}`}>{mergeNote}</p>
        )}
        <p className="text-[10px] text-slate-500">
          The merge is validation-gated server-side: a passing consequence-validation record for THIS pack
          (approve the validation report in the Validate capsule) opens the gate. Merging deploys dev via
          Amplify — the operator&apos;s click is the D1 human gate, receipted.
        </p>
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
