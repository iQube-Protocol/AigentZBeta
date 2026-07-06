"use client";

/**
 * CCRL Research Copilot — Aigent Z as research narrator (CFS-019 Phase C2).
 *
 * DCIR-conforming from birth (CFS-020): this surface is the second
 * instrumented seam after the Dev Command Center D1 reference. Deliberately
 * NARRATE-ONLY — the copilot observes and narrates the live lab state
 * (experiment lifecycles derived from the canonical record, series claims,
 * hash-committed results). Research stage-proposal kinds (experiment design,
 * finding drafts) are C2.1, their own increment AFTER usage observation —
 * the dev-loop misroute regression (CFS-015) is the precedent for not
 * rushing new proposal kinds.
 *
 * Two-pane split mirroring DevCommandCenterTab, economically:
 *   LEFT  = aigentZ copilot (SmartTriadCopilotLayer, panel variant)
 *   RIGHT = compact live panel (the observed state the copilot narrates)
 *
 * DCIR observe-mode discipline: events (tab opened, overview refreshed,
 * quick prompt selected) ride a session-scoped ring buffer and feed the
 * next copilot turn via groundContext.recentEvents. Nothing blocks,
 * nothing mutates — T2-safe label summaries only.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlaskConical, Landmark, Loader2, RefreshCw } from "lucide-react";
import { SmartTriadCopilotLayer } from "@/components/smarttriad/copilot/SmartTriadCopilotLayer";
import { experimentGet } from "./experimentStepFetch";
import type { DcirEvent } from "@/types/dcir";
import {
  appendDcirEvent,
  compactDcirEvents,
  surfaceOpenedEvent,
  surfaceDataRefreshedEvent,
  surfacePromptSelectedEvent,
} from "@/services/dcir/eventStream";

const SURFACE = "ccrl-research";

interface OverviewEntry {
  experiment: { id: string; layer: string; family: string; seriesId: string };
  lifecycle: string;
  publishedRuns: number;
  distinctProviders: number;
  latestRunAt: string | null;
}

interface SeriesEntry {
  id: string;
  name: string;
  claim: string;
  members: string[];
}

interface ResultRow {
  id: string;
  experiment: string;
  provider: string;
  model: string;
  contentHash: string;
  createdAt: string;
}

interface CCRLResearchCopilotTabProps {
  personaId?: string;
}

export default function CCRLResearchCopilotTab({ personaId }: CCRLResearchCopilotTabProps) {
  const [overview, setOverview] = useState<OverviewEntry[] | null>(null);
  const [series, setSeries] = useState<SeriesEntry[]>([]);
  const [lifecycleOrder, setLifecycleOrder] = useState<string[]>([]);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ── DCIR observation seam (CFS-020) — observe-mode ONLY. Session-scoped
  // ring buffer; the next copilot turn reads the compacted tail.
  const [dcirEvents, setDcirEvents] = useState<DcirEvent[]>([]);
  const observe = useCallback((event: DcirEvent) => {
    setDcirEvents(prev => appendDcirEvent(prev, event));
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    let expCount = 0;
    let resultCount = 0;
    try {
      const data = await experimentGet("/api/research/overview");
      const entries = (data.experiments as OverviewEntry[]) ?? [];
      setOverview(entries);
      setSeries((data.series as SeriesEntry[]) ?? []);
      setLifecycleOrder((data.lifecycleOrder as string[]) ?? []);
      setOverviewError(null);
      expCount = entries.length;
    } catch (err) {
      // Degrade honestly — the copilot is told the overview is unavailable.
      setOverviewError(err instanceof Error ? err.message : "overview unavailable");
    }
    try {
      const data = await experimentGet("/api/experiments/results");
      const rows = (data.results as ResultRow[]) ?? [];
      setResults(rows);
      setResultsError(null);
      resultCount = rows.length;
    } catch (err) {
      setResultsError(err instanceof Error ? err.message : "results unavailable");
    }
    setRefreshing(false);
    observe(surfaceDataRefreshedEvent(SURFACE, `${expCount} experiments · ${resultCount} canonical results`));
  }, [observe]);

  const openedRef = useRef(false);
  useEffect(() => {
    if (!openedRef.current) {
      openedRef.current = true;
      observe(surfaceOpenedEvent(SURFACE));
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Ground context — the observed state the copilot narrates (T2-safe:
  // ids, families, lifecycle states, counts, hash prefixes — never bodies).
  const copilotGroundContext = useMemo(() => ({
    surface: SURFACE,
    lifecycleOrder,
    experiments: (overview ?? []).map(o => ({
      id: o.experiment.id,
      family: o.experiment.family,
      lifecycle: o.lifecycle,
      publishedRuns: o.publishedRuns,
      distinctProviders: o.distinctProviders,
    })),
    series: series.map(s => ({ id: s.id, name: s.name, claim: s.claim, members: s.members })),
    recentResults: (results ?? []).slice(0, 5).map(r => ({
      experiment: r.experiment,
      provider: r.provider,
      contentHashPrefix: r.contentHash.slice(0, 12),
      createdAt: r.createdAt,
    })),
    overviewError,
    resultsError,
    // DCIR observation seam: the last ~12 session events, compacted —
    // the next copilot turn observes what happened (narrate-only).
    recentEvents: compactDcirEvents(dcirEvents),
  }), [overview, series, lifecycleOrder, results, overviewError, resultsError, dcirEvents]);

  const quickPrompts = useMemo(() => [
    "Where does the research programme stand?",
    "Which experiments need runs?",
    "Summarize the latest canonical results",
    "What would advance the sovereignty gate?",
  ].map(label => ({
    label,
    prompt: label,
    onSelect: () => observe(surfacePromptSelectedEvent(SURFACE, label)),
  })), [observe]);

  return (
    <div className="h-[calc(100vh-96px)] flex flex-col lg:flex-row gap-2 px-2 pr-3 overflow-hidden">
      {/* ── LEFT: aigentZ research copilot ─────────────────────── */}
      <div className="lg:w-1/2 w-full h-full min-h-0 flex flex-col">
        <SmartTriadCopilotLayer
          isOpen
          variant="panel"
          quickPrompts={quickPrompts}
          promptPlaceholder="Ask aigentZ about the research programme, experiments, results…"
          agent={{ id: "aigent-z", name: "aigentZ" }}
          agentSubtitle="CCRL Research Laboratory · constitutional science"
          personaId={personaId}
          groundContext={copilotGroundContext}
          onClose={() => undefined}
        />
      </div>

      {/* ── RIGHT: live lab state (the observed panel) ─────────── */}
      <div className="lg:w-1/2 w-full h-full min-h-0 flex flex-col">
        <div className="shrink-0 flex items-center justify-between py-2 px-1">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-violet-300" />
            <h3 className="text-sm font-semibold text-slate-100">Live lab state (observed)</h3>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border border-slate-700/50 bg-slate-800/40 text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-1 pb-4 space-y-3">
          {/* Experiment lifecycle strips — derived, never asserted */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h4 className="text-xs font-semibold text-slate-100 mb-1">Experiment lifecycles (derived, never asserted)</h4>
            {overviewError && <p className="text-[11px] text-slate-500">{overviewError}</p>}
            {!overviewError && overview === null && (
              <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> loading…</div>
            )}
            {overview && overview.length === 0 && (
              <p className="text-[11px] text-slate-500">No experiments registered.</p>
            )}
            {overview && overview.length > 0 && (
              <div className="space-y-2 mt-2">
                {overview.map((o) => (
                  <div key={o.experiment.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="w-16 font-semibold text-slate-200">{o.experiment.id}</span>
                    <span className="w-40 text-slate-400">{o.experiment.family}</span>
                    <span className="flex items-center gap-1">
                      {lifecycleOrder.map((stage, i) => {
                        const reached = lifecycleOrder.indexOf(o.lifecycle) >= i;
                        return (
                          <span
                            key={stage}
                            title={stage}
                            className={`rounded px-1.5 py-0.5 text-[10px] border ${
                              stage === o.lifecycle
                                ? "bg-violet-500/20 text-violet-300 border-violet-500/40 font-semibold"
                                : reached
                                  ? "bg-emerald-500/10 text-emerald-300/70 border-emerald-500/20"
                                  : "bg-slate-800/40 text-slate-600 border-slate-700/40"
                            }`}
                          >
                            {stage}
                          </span>
                        );
                      })}
                    </span>
                    <span className="text-slate-500">
                      {o.publishedRuns} run{o.publishedRuns === 1 ? "" : "s"} · {o.distinctProviders} provider{o.distinctProviders === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Series claims */}
          {series.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <h4 className="text-xs font-semibold text-slate-100 mb-2">Series claims</h4>
              <div className="space-y-2">
                {series.map((s) => (
                  <div key={s.id} className="text-xs">
                    <span className="font-semibold text-slate-200">{s.id}</span>
                    <span className="text-slate-400"> — {s.name} ({s.members.join(", ")})</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">{s.claim}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent canonical results */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FlaskConical className="h-3.5 w-3.5 text-indigo-300" />
              <h4 className="text-xs font-semibold text-slate-100">Recent canonical results (hash-committed)</h4>
            </div>
            {resultsError && <p className="text-[11px] text-slate-500">{resultsError}</p>}
            {!resultsError && results === null && (
              <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> loading…</div>
            )}
            {results && results.length === 0 && (
              <p className="text-[11px] text-slate-500">No canonical results published yet.</p>
            )}
            {results && results.length > 0 && (
              <div className="space-y-1">
                {results.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-2 text-xs border-t border-slate-800 first:border-t-0 py-1">
                    <span className="w-16 font-semibold text-slate-200">{r.experiment}</span>
                    <span className="text-slate-400">{r.provider} · {r.model}</span>
                    <span className="font-mono text-slate-500">{r.contentHash.slice(0, 12)}…</span>
                    <span className="text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Honest scope note */}
          <p className="text-[10px] text-slate-600 px-1">
            Narrate-only surface (CFS-019 C2): aigentZ observes and narrates this state.
            Research proposal kinds (experiment design, finding drafts) are C2.1 — after usage observation.
          </p>
        </div>
      </div>
    </div>
  );
}
