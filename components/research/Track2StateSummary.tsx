"use client";

/**
 * Track2StateSummary — the reviewer-safe, READ-ONLY projection of Track 2
 * programme state for the IRL OS Workspace's EXP-P1 dossier (2026-09-12).
 *
 * Deliberately NOT a mount of `Track2ProgrammePanel` (the ~7000-line admin
 * grooming console — duplicate-pair merge, promotion, reconciliation,
 * relationship/provenance cohorts, diversity/bridge candidates, validate-all):
 * that component has no reviewer-safe mode today, and retrofitting one across
 * every mutation control it renders is out of scope for this pass (flagged in
 * the accompanying resolution record rather than silently done partially).
 * This component instead reads the SAME canonical, now reviewer-readable
 * `GET /api/research/track2/[experimentId]` — the identical composition
 * `loadTrack2ProgrammeState` produces for the admin panel — and renders only
 * the state a reviewer needs to understand where the programme stands: never
 * a second derivation of Track 2 logic, only a smaller READ projection of the
 * one canonical read model. It calls no mutating route, so there is nothing
 * here to disable.
 */

import { useEffect, useState } from "react";
import { Layers, Loader2 } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface Track2State {
  requestSucceeded: boolean;
  error?: string;
  programme?: { currentStageId?: string; [k: string]: unknown };
  lifecycle?: string;
  reviewStage?: string;
  readiness?: Record<string, unknown>;
  declarationHash?: string | null;
  unreadableSignals?: string[];
}

const PANEL = "rounded-xl border border-slate-800 bg-slate-900/40 p-4";

export function Track2StateSummary({ experimentId }: { experimentId: string }) {
  const [state, setState] = useState<Track2State | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await personaFetch(`/api/research/track2/${encodeURIComponent(experimentId)}`, { cache: "no-store" });
        const d = (await res.json().catch(() => null)) as Track2State | null;
        if (alive) setState(d ?? { requestSucceeded: false, error: `HTTP ${res.status}` });
      } catch (e) {
        if (alive) setState({ requestSucceeded: false, error: e instanceof Error ? e.message : "could not be read" });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [experimentId]);

  if (loading) {
    return (
      <div className={`${PANEL} text-xs text-slate-500`}>
        <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" /> Loading Track 2 state…
      </div>
    );
  }
  if (!state?.requestSucceeded) {
    return (
      <div className={`${PANEL} text-xs text-slate-500`}>
        Track 2 state is not available for this experiment{state?.error ? ` (${state.error})` : ""}.
      </div>
    );
  }

  return (
    <div className={PANEL}>
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-100">
        <Layers className="h-3.5 w-3.5 text-violet-300" /> Track 2 programme state
      </h4>
      <div className="grid gap-1.5 text-[11px] text-slate-300 sm:grid-cols-2">
        <div>Current stage <span className="text-slate-100">{state.programme?.currentStageId ?? "—"}</span></div>
        <div>Lifecycle <span className="text-slate-100">{state.lifecycle ?? "—"}</span></div>
        <div>Review stage <span className="text-slate-100">{state.reviewStage ?? "—"}</span></div>
        <div className="truncate">Crystal declaration hash <span className="font-mono text-slate-100">{state.declarationHash ? `${state.declarationHash.slice(0, 16)}…` : "—"}</span></div>
      </div>
      {state.unreadableSignals && state.unreadableSignals.length > 0 && (
        <p className="mt-2 text-[10px] text-amber-300">
          Unreadable signals (reported as unknown, not zeroed): {state.unreadableSignals.join(", ")}
        </p>
      )}
      <p className="mt-2 text-[10px] text-slate-500">
        Read-only projection. Grooming, promotion, reconciliation and other Track 2 authoring actions are
        Laboratory/steward operations and are not available here.
      </p>
    </div>
  );
}

export default Track2StateSummary;
