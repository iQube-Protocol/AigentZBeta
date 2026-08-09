"use client";

/**
 * Crystal Observer Review — the ONE canonical Workspace Review surface for
 * the Autonomi Independent Review Programme's `autonomi-review-exp-p1`
 * workspace (Post-Freeze Observer Review Closure, points 2 and 10).
 *
 * Composes, never duplicates:
 *   - the EXISTING read-only Crystal vP1 readiness/statistics/freeze
 *     recommendation projection (`IndependentReviewPanel` in `reviewerMode`,
 *     which already renders the frozen-artifact summary and observer
 *     acceptance status once frozen — see that file's `CrystalPanel`), and
 *   - the NEW self-service Observer Decision submission
 *     (`/api/research/observer-review/[experimentId]/decision`).
 *
 * This is the SINGLE surface the Validation Programme journey's
 * `crystal-review` stage now mounts (services/journey/validationProgrammeJourney.ts),
 * replacing the prior direct mount of `IndependentReviewPanel reviewerMode`.
 * The read-only readiness projection lives INSIDE this component rather than
 * being a second, independently-fetched summary — one workspace review flow,
 * one source of the readiness data.
 */

import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Send } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import IndependentReviewPanel from "./IndependentReviewPanel";

const PANEL = "rounded-xl border border-slate-800 bg-slate-900/40 p-4";
const FIELD =
  "w-full rounded-lg border border-slate-800 bg-slate-900/40 px-2.5 py-1.5 text-xs text-slate-200 " +
  "focus:border-slate-700 focus:outline-none disabled:opacity-50";

type ObserverDecisionKind = "accepted" | "changes_requested" | "unable_to_assess";

interface ObserverRoundResolution {
  policy: "any-assigned" | "all-assigned";
  assignedCount: number;
  decidedCount: number;
  outstandingObserverRefs: string[];
  acceptance: "pending" | "accepted" | "changes_requested" | "mixed";
  detail: string;
}

function explainFailedRequest(res: Response, body: unknown, subject: string): string {
  const msg = (body as { error?: string } | null)?.error;
  if (msg) return msg;
  return `${subject} could not be read (HTTP ${res.status})`;
}

export default function CrystalObserverReviewPanel({ experimentId = "EXP-P1" }: { experimentId?: string } = {}) {
  const [round, setRound] = useState<Record<string, unknown> | null>(null);
  const [resolution, setResolution] = useState<ObserverRoundResolution | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [decision, setDecision] = useState<ObserverDecisionKind>("accepted");
  const [rationale, setRationale] = useState("");
  const [proposedChange, setProposedChange] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<Record<string, unknown> | null>(null);

  const loadRound = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch(`/api/research/observer-review/${encodeURIComponent(experimentId)}`, { cache: "no-store" });
      const d = await res.json().catch(() => null);
      if (!d?.ok) throw new Error(explainFailedRequest(res, d, "The Observer Review round"));
      setRound(d.round ?? null);
      setResolution(d.resolution ?? null);
      setNote(d.note ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "the Observer Review round could not be read");
    } finally {
      setLoading(false);
    }
  }, [experimentId]);

  useEffect(() => {
    void loadRound();
  }, [loadRound]);

  const submitDecision = useCallback(async () => {
    setSubmitBusy(true);
    setSubmitError(null);
    setSubmitResult(null);
    try {
      const res = await personaFetch(`/api/research/observer-review/${encodeURIComponent(experimentId)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          rationale,
          ...(decision === "changes_requested" ? { proposedChange } : {}),
        }),
      });
      const d = await res.json().catch(() => null);
      if (!d?.ok) throw new Error(explainFailedRequest(res, d, "The decision"));
      setSubmitResult(d);
      await loadRound();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "the decision could not be submitted");
    } finally {
      setSubmitBusy(false);
    }
  }, [experimentId, decision, rationale, proposedChange, loadRound]);

  const pkg = round?.package as { packageHash: string; assignedObserverRefs: string[]; roundPolicy: string } | null | undefined;

  return (
    <div className="space-y-4">
      {/* Read-only Pipeline/Readiness projection — the SAME Crystal vP1 report
          an operator sees, reused rather than re-fetched. */}
      <IndependentReviewPanel reviewerMode />

      <div className={PANEL}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold text-slate-100">Observer Review Round</h4>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
        </div>

        {error && (
          <div className="mb-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-[11px] text-rose-200">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            {error}
          </div>
        )}
        {note && !error && <p className="mb-2 text-[11px] leading-relaxed text-slate-400">{note}</p>}

        {pkg && (
          <div className="mb-3 grid gap-1 text-[11px] text-slate-300 sm:grid-cols-2">
            <div>package <span className="font-mono text-slate-200">{pkg.packageHash.slice(0, 24)}…</span></div>
            <div>policy <span className="text-slate-200">{pkg.roundPolicy}</span></div>
            <div className="sm:col-span-2">assigned observers <span className="text-slate-200">{pkg.assignedObserverRefs.join(", ") || "—"}</span></div>
          </div>
        )}

        {resolution && (
          <div className="mb-3 flex items-center gap-2 text-[11px]">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${
                resolution.acceptance === "accepted"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : resolution.acceptance === "changes_requested"
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-200"
              }`}
            >
              {resolution.acceptance}
            </span>
            <span className="text-slate-400">{resolution.detail}</span>
          </div>
        )}

        {pkg && (
          <>
            <h5 className="mb-1 text-[11px] font-semibold text-slate-200">Submit your decision</h5>
            <p className="mb-2 text-[10px] leading-relaxed text-slate-500">
              Attributed to you alone — the decision is self-service and persona-scoped. You may resubmit to replace
              your own decision; resubmission never creates a second vote, and a delegated agent may only assist,
              never decide on your behalf.
            </p>
            <select
              className={FIELD}
              value={decision}
              onChange={(e) => setDecision(e.target.value as ObserverDecisionKind)}
            >
              <option value="accepted">Accepted</option>
              <option value="changes_requested">Changes requested</option>
              <option value="unable_to_assess">Unable to assess</option>
            </select>
            <textarea
              className={`${FIELD} mt-2`}
              rows={3}
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="rationale (required)"
            />
            {decision === "changes_requested" && (
              <textarea
                className={`${FIELD} mt-2`}
                rows={2}
                value={proposedChange}
                onChange={(e) => setProposedChange(e.target.value)}
                placeholder="proposed change — what should change (required)"
              />
            )}
            <button
              onClick={() => void submitDecision()}
              disabled={submitBusy || !rationale.trim() || (decision === "changes_requested" && !proposedChange.trim())}
              className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-slate-800/60 disabled:opacity-50"
            >
              {submitBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Submit decision
            </button>
            {submitError && (
              <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-[11px] text-rose-200">
                <AlertTriangle className="mr-1 inline h-3 w-3" />
                {submitError}
              </div>
            )}
            {submitResult && (
              <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-[11px] text-emerald-200">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
                Decision recorded.{" "}
                {(submitResult.changeProposal as Record<string, unknown> | null)
                  ? "A change proposal was opened for a steward to resolve."
                  : ""}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
