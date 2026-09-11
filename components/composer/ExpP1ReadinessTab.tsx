"use client";

/**
 * EXP-P1 Readiness Dashboard — PRD-EPI-001 §10 (IRL OS · Laboratory).
 *
 * Renders the seven readiness sections from
 * GET /api/research/readiness/[experimentId] — each section gates a DIFFERENT
 * macro transition, never one blanket "all green" bar.
 *
 * Load-bearing honesty (Aletheon reconciliation, 2026-07-22): Execution and
 * Publication are EXPECTED red before the experiment runs. They render with a
 * muted/neutral treatment and an explicit "expected before the run" label —
 * driven by the payload's `expectedRedPreRun` + `gatesProtocolRatified: false`,
 * never inferred client-side — so a viewer never misreads them as failures.
 * The headline state is `protocolRatifiedReady` (§2.2's derivation projected).
 *
 * Spine discipline: the route resolves the caller via getActivePersona, so the
 * ONLY permitted transport is personaFetch (CLAUDE.md PARAMOUNT rule) with the
 * surface's personaId threaded as personaIdHint. Errors surface honestly —
 * no fake data, ever.
 */

import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Gauge, Loader2, RefreshCw } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

type ReadinessStatus = "green" | "amber" | "red";

interface ReadinessSection {
  section: string;
  status: ReadinessStatus;
  gates: string;
  gatesProtocolRatified: boolean;
  detail: string;
}

interface ReadinessDashboard {
  experimentId: string;
  sections: ReadinessSection[];
  protocolRatifiedReady: boolean;
  expectedRedPreRun: string[];
}

interface ExpP1ReadinessTabProps {
  personaId?: string;
}

/** Validation Programme v1 registry ids (types/research.ts) — EXP-P1 is the
 * PRD-EPI-001 subject; P2/P3 reuse the same infrastructure. */
const EXPERIMENT_IDS = ["EXP-P1", "EXP-P2", "EXP-P3"] as const;

/** Chip classes per status. Colour ramp follows the house convention
 * (green=emerald · amber=amber · red=rose); panel chrome stays slate. */
const STATUS_CHIP: Record<ReadinessStatus, string> = {
  green: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  amber: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  red: "text-rose-300 border-rose-500/40 bg-rose-500/10",
};

/** Muted/neutral chip for a red that is CORRECT pre-run (Execution /
 * Publication) — deliberately NOT rose, so it cannot read as a failure. */
const EXPECTED_RED_CHIP = "text-slate-400 border-slate-700 bg-slate-800/60";

export default function ExpP1ReadinessTab({ personaId }: ExpP1ReadinessTabProps) {
  const [experimentId, setExperimentId] = useState<(typeof EXPERIMENT_IDS)[number]>("EXP-P1");
  const [dashboard, setDashboard] = useState<ReadinessDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch(`/api/research/readiness/${experimentId}`, {
        cache: "no-store",
        personaIdHint: personaId,
      });
      const text = await res.text();
      let data: { ok?: boolean; error?: string; dashboard?: ReadinessDashboard } | null = null;
      try {
        data = text.trim().length > 0 ? JSON.parse(text) : null;
      } catch {
        throw new Error(`HTTP ${res.status} — non-JSON response`);
      }
      if (!res.ok || !data?.ok || !data.dashboard) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setDashboard(data.dashboard);
    } catch (err) {
      // Honest failure — show the error (401/403 included), never fake data.
      setDashboard(null);
      setError(err instanceof Error ? err.message : "readiness unavailable");
    } finally {
      setLoading(false);
    }
  }, [experimentId, personaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const gateSections = dashboard?.sections.filter((s) => s.gatesProtocolRatified) ?? [];
  const gateGreen = gateSections.filter((s) => s.status === "green").length;

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header — headline protocol-ratified state */}
      <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-violet-400" />
            <h2 className="text-lg font-semibold text-slate-100">
              {experimentId} Readiness — PRD-EPI-001 §10
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {EXPERIMENT_IDS.map((id) => (
              <button
                key={id}
                onClick={() => setExperimentId(id)}
                className={`rounded px-2 py-1 text-xs border transition-colors ${
                  id === experimentId
                    ? "border-violet-500/50 bg-violet-500/10 text-violet-300 font-semibold"
                    : "border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200"
                }`}
              >
                {id}
              </button>
            ))}
            <button
              onClick={() => void load()}
              disabled={loading}
              title="Refresh"
              className="rounded p-1.5 border border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Seven sections, each gating a <span className="text-slate-200">different</span> macro
          transition — never one blanket bar. Only Infrastructure, Crystal, Coverage, Freeze, and
          Review gate <code className="text-slate-300">protocol-ratified</code>; Execution and
          Publication are later milestones, <span className="italic">expected</span> red before the run.
        </p>
        {dashboard && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`rounded px-2 py-1 border font-semibold ${
                dashboard.protocolRatifiedReady
                  ? STATUS_CHIP.green
                  : "text-slate-300 border-slate-700 bg-slate-800/60"
              }`}
            >
              protocol-ratified: {dashboard.protocolRatifiedReady ? "READY" : "not yet"}
            </span>
            <span className="text-slate-400">
              {gateGreen}/{gateSections.length} protocol gates green (§2.2 derivation — computed
              server-side, never asserted)
            </span>
          </div>
        )}
      </div>

      {/* Loading / error — honest states */}
      {loading && !dashboard && (
        <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-5 flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> deriving readiness…
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-5">
          <div className="flex items-center gap-2 text-xs text-rose-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="font-semibold">Readiness unavailable:</span> {error}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            This surface is admin-gated (Steward access) — the error above is the server&apos;s
            honest answer, not a rendering fallback.
          </p>
        </div>
      )}

      {/* The seven sections, in payload order */}
      {dashboard && (
        <div className="space-y-2">
          {dashboard.sections.map((s) => {
            const expectedRed =
              !s.gatesProtocolRatified &&
              s.status === "red" &&
              dashboard.expectedRedPreRun.includes(s.section);
            return (
              <div
                key={s.section}
                className={`rounded-xl bg-slate-900/40 border border-slate-800 p-4 ${
                  expectedRed ? "opacity-80" : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-32 text-sm font-semibold text-slate-100">{s.section}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] border font-semibold ${
                      expectedRed ? EXPECTED_RED_CHIP : STATUS_CHIP[s.status]
                    }`}
                  >
                    {s.status}
                    {expectedRed ? " — expected before the run" : ""}
                  </span>
                  <span className="text-[11px] text-slate-500">gates: {s.gates}</span>
                  {!s.gatesProtocolRatified && (
                    <span className="rounded px-1.5 py-0.5 text-[10px] border border-slate-700 bg-slate-800/60 text-slate-400">
                      not a protocol-ratified blocker
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-slate-400">{s.detail}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
