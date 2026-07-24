"use client";

/**
 * myResearch — the fifth myCluster tab (SPEC-MMC-001 §5, PRD-MMC-IMPL-006).
 *
 * A compact, read-only mirror of the live research-programme state, composing
 * the SAME `/api/research/overview` route `IRLDashboardTab` and the public
 * IRL OS surface already call (`services/research/publicReads.ts::
 * buildResearchOverview`) — no new backend route, no new gate. That route is
 * persona-gated only (no `isAdmin` check); the deeper propose/approve/publish
 * surfaces stay admin-only inside the IRL cartridge (`ccrl-cartridge`/
 * `irl-os`) and are not duplicated here — see PRD-MMC-IMPL-006 §0.3.
 */

import React, { useCallback, useEffect, useState } from "react";
import { FlaskConical, Loader2, RefreshCw, ExternalLink } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface ResearchExperiment {
  id: string;
  layer: string;
  family: string;
  seriesId: string;
}

interface OverviewEntry {
  experiment: ResearchExperiment;
  lifecycle: string;
  persistedLifecycle: string | null;
  publishedRuns: number;
  distinctProviders: number;
  latestRunAt: string | null;
}

interface ResearchOverviewResponse {
  ok: boolean;
  lifecycleOrder: string[];
  experiments: OverviewEntry[];
  computedAt: string;
  error?: string;
}

const LAYER_LABEL: Record<string, string> = {
  I: "Invariant Intelligence",
  II: "Constitutional Computing",
  III: "Constitutional Cybernetics",
};

function lifecycleTone(state: string): string {
  if (state === "replicated" || state === "published") return "text-emerald-400 border-emerald-500/40 bg-emerald-500/10";
  if (state === "running" || state === "evaluated") return "text-amber-400 border-amber-500/40 bg-amber-500/10";
  return "text-slate-400 border-slate-700 bg-slate-800/40";
}

interface Props {
  personaId?: string;
  isAdmin?: boolean;
}

export function MyResearchTab({ personaId, isAdmin }: Props) {
  const [data, setData] = useState<ResearchOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch("/api/research/overview", { personaIdHint: personaId, cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json?.error) {
        setError(json?.error || `request failed (${res.status})`);
        setData(null);
      } else {
        setData(json);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load research overview");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-slate-200">myResearch</h2>
          <span className="text-xs text-slate-500">metaMe IRL — live programme state</span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1 rounded border border-slate-800 bg-slate-900/40 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800/60 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading && !data && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading research overview...
        </div>
      )}

      {error && (
        <div className="rounded border border-rose-800/60 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
          {error}
        </div>
      )}

      {data && (
        <div className="flex flex-col gap-2">
          {data.experiments.length === 0 && (
            <div className="text-xs text-slate-500">No experiments in the registry yet.</div>
          )}
          {data.experiments.map((entry) => {
            const state = entry.persistedLifecycle ?? entry.lifecycle;
            return (
              <div
                key={entry.experiment.id}
                className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/40 px-3 py-2"
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-200">{entry.experiment.id}</span>
                    <span className="text-xs text-slate-500">{entry.experiment.family}</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Layer {entry.experiment.layer} — {LAYER_LABEL[entry.experiment.layer] ?? entry.experiment.layer}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-500">
                    {entry.publishedRuns} run{entry.publishedRuns === 1 ? "" : "s"}
                    {entry.distinctProviders > 0 ? ` · ${entry.distinctProviders} providers` : ""}
                  </span>
                  <span className={`rounded border px-2 py-0.5 text-[11px] ${lifecycleTone(state)}`}>{state}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-1 border-t border-slate-800 pt-3 text-[11px] text-slate-500">
        <ExternalLink className="h-3 w-3" />
        {isAdmin
          ? "Full lab operations — design, run, publish — live in the metaMe IRL cartridge (irl-os)."
          : "Read-only summary. Designing, running, and publishing experiments requires admin access to the metaMe IRL cartridge."}
      </div>
    </div>
  );
}

export default MyResearchTab;
