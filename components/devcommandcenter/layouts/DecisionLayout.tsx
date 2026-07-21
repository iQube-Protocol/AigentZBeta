"use client";

/**
 * DecisionLayout — the Constitutional Decision capsule (CFS-029 §7.1,
 * ratified 2026-07-13): the ICE stage between Consequence and Implementation
 * where the pipeline explicitly decides HOW a capability should be realized —
 * the nine mechanisms plus `none` (capability exists; compose, build nothing)
 * — BEFORE any Implementation Pack is drafted.
 *
 * Drives POST /api/constitutional/decision with the session's live Capability
 * Evidence (the same projection ImplementationLayout ships to pack
 * generation); the accepted decision writes into the session
 * (`constitutionalDecision`), satisfying the stage's advance gate, and
 * travels VERBATIM into pack generation (the pipeline decides once).
 */

import { useState } from "react";
import { Scale, Loader2, CheckCircle2, RefreshCw } from "lucide-react";
import { experimentStep } from "@/components/composer/experimentStepFetch";
import type { DevLayoutProps } from "./types";
import { evidenceFromSession } from "./types";
import type { DevConstitutionalDecision } from "@/types/devCommandCenter";

export function DecisionLayout({
  session,
  onDismiss,
  onAdvanceStage,
  onDecided,
}: DevLayoutProps & {
  /** Writes the taken decision into the session (satisfies the advance gate). */
  onDecided?: (decision: DevConstitutionalDecision) => void;
}) {
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshness, setFreshness] = useState<string | null>(null);
  const decision = session.constitutionalDecision ?? null;
  const evidence = evidenceFromSession(session);
  const evidenceCount =
    (evidence?.existing?.length ?? 0) + (evidence?.missing?.length ?? 0) + (evidence?.contextAssets?.length ?? 0);

  const decide = async () => {
    if (!session.intent) return;
    setDeciding(true);
    setError(null);
    try {
      const res = await experimentStep("/api/constitutional/decision", {
        goal: session.intent.goal,
        ...(evidenceCount > 0 ? { capabilityEvidence: evidence } : {}),
      });
      const d = res.decision as DevConstitutionalDecision;
      if (!d?.mechanism) throw new Error("decision route returned no mechanism");
      setFreshness(typeof res.evidenceFreshness === "string" ? res.evidenceFreshness : null);
      onDecided?.(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "decision failed");
    } finally {
      setDeciding(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Scale className="h-4 w-4 text-violet-300" /> Constitutional Decision
          <span className="text-[10px] font-normal uppercase tracking-wide text-slate-500">
            ICE stage 4.5 · CFS-029
          </span>
        </h3>
        <button onClick={onDismiss} className="text-xs text-slate-500 hover:text-slate-300">
          ✕
        </button>
      </div>

      <p className="text-xs text-slate-400">
        HOW should this capability be realized? Nine mechanisms — code is only one — plus{" "}
        <code className="text-violet-300">none</code>: the capability already exists, compose it. Decided
        BEFORE the Implementation Pack, from the session&apos;s Capability Evidence
        {evidenceCount > 0 ? ` (${evidenceCount} items live)` : " (none live — persisted evidence is read back)"}.
      </p>

      {!decision && (
        <button
          onClick={decide}
          disabled={deciding || !session.intent}
          className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-100 hover:bg-violet-500/25 transition disabled:opacity-50"
        >
          {deciding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Scale className="h-3.5 w-3.5" />}
          Decide realization mechanism
        </button>
      )}
      {error && <p className="text-xs text-rose-400">{error}</p>}

      {decision && (
        <div className="space-y-2 rounded-md border border-slate-800 bg-slate-950/50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded border px-2 py-0.5 text-xs font-semibold ${
                decision.noBuildRequired
                  ? "border-emerald-600 bg-emerald-950/50 text-emerald-300"
                  : "border-violet-600 bg-violet-950/50 text-violet-200"
              }`}
            >
              {decision.mechanism}
              {decision.noBuildRequired ? " — no build required" : ""}
            </span>
            <span className="text-[10px] text-slate-500">decided by {decision.decidedBy}</span>
            {freshness && freshness !== "supplied" && (
              <span
                className={`rounded border px-1.5 py-0.5 text-[10px] ${
                  freshness === "persisted-stale"
                    ? "border-amber-700 bg-amber-950/40 text-amber-300"
                    : "border-slate-700 text-slate-400"
                }`}
                title="CFS-029 §7.3 freshness policy — stale persisted evidence grounds loudly, never silently"
              >
                evidence: {freshness}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-300">{decision.rationale}</p>
          {decision.alternatives.length > 0 && (
            <ul className="space-y-0.5">
              {decision.alternatives.map((a, i) => (
                <li key={i} className="text-[11px] text-slate-500">
                  considered <code className="text-slate-400">{a.mechanism}</code>: {a.reason}
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={onAdvanceStage}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/25 transition"
            >
              <CheckCircle2 className="h-3 w-3" /> Proceed to implementation
            </button>
            <button
              onClick={decide}
              disabled={deciding}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800/60 transition disabled:opacity-50"
            >
              {deciding ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Re-decide
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
