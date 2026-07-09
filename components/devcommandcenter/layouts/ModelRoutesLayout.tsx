"use client";

/**
 * ModelRoutesLayout — the routing-transparency surface for the Chrysalis Phase 2
 * invariant-aware Model Router (CFS-015). READ-ONLY.
 *
 * Routing transparency IS sovereignty: the operator SEES, per reasoning stage,
 * how the stage is routed (provider/model), by which config source, under which
 * governing invariants, and where the open-weight sovereign floor
 * (inv.sovereignty.102 — the operator chooses) sits. Below the per-stage table,
 * the ModelQube registry shows every constitutional object the invariant-aware
 * policy ranks over, with its standing band and per-stage fitness.
 *
 * Consumes /api/constitutional/model-routes (admin-gated). No mutation, no
 * routing controls — it reflects the router's own describeRoutes() + registry.
 * personaFetchDeadline only. Slate house style (bg-slate-900/40 + slate borders,
 * no white hairlines).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Route, RefreshCw, Loader2, ShieldCheck } from "lucide-react";
import { LayoutShell } from "@/components/metame/welcome/layouts/LayoutShell";
import { personaFetchDeadline } from "@/utils/personaSpine";

type RouteSource = "default" | "modelqube" | "override";

interface StageRow {
  stage: string;
  provider: string;
  model: string;
  source: RouteSource;
  sovereignFloor: boolean;
  governingInvariants: string[];
}

type SovereigntyTier = "frontier" | "open-weight" | "self-hosted";

interface RegistryRow {
  id: string;
  ref: string;
  displayLabel: string;
  provider: string;
  model: string;
  tier: SovereigntyTier;
  standing: number;
  standingBand: string;
  sovereignFloor: boolean;
  stageFitness: Record<string, number>;
}

interface SovereignNodeStatus {
  configured: boolean;
  tier: "self-hosted";
  model: string | null;
  floor: "open-weight" | "self-hosted";
}

interface ModelRoutesData {
  at: string;
  readOnly: boolean;
  routingInvariants: string[];
  sovereignNode: SovereignNodeStatus;
  stages: StageRow[];
  registry: RegistryRow[];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
      <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">{title}</div>
      {children}
    </div>
  );
}

function SourceBadge({ source }: { source: RouteSource }) {
  const cls =
    source === "modelqube"
      ? "bg-violet-500/15 text-violet-300 border-violet-500/30"
      : source === "override"
      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
      : "bg-slate-800 text-slate-300 border-slate-700";
  return (
    <span className={`rounded px-1.5 py-0.5 border text-[10px] font-medium ${cls}`}>{source}</span>
  );
}

export function ModelRoutesLayout({
  onBack,
  onToolUsed,
}: {
  onBack: () => void;
  onToolUsed?: (op: string) => void;
}) {
  const [data, setData] = useState<ModelRoutesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Latest onToolUsed in a ref so `load` keeps a stable identity (matches the
  // DevToolsLayout pattern — avoids the mount-effect re-fire loop).
  const onToolUsedRef = useRef(onToolUsed);
  useEffect(() => {
    onToolUsedRef.current = onToolUsed;
  }, [onToolUsed]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    onToolUsedRef.current?.("refresh");
    try {
      const res = await personaFetchDeadline("/api/constitutional/model-routes", { cache: "no-store" });
      if (res.status === 403) {
        setError("forbidden — routing transparency requires an admin persona");
        return;
      }
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? `unexpected response (HTTP ${res.status})`);
        return;
      }
      setData(json as ModelRoutesData);
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      setError(
        aborted
          ? "model-routes timed out after 12s — server route or auth token step unavailable"
          : err instanceof Error
          ? err.message
          : String(err),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const body = (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Governing invariants — the constitutional basis of every route. */}
          <Section title="Governing invariants (routing is constitutional data)">
            <div className="flex flex-wrap gap-1.5">
              {data.routingInvariants.map((inv) => (
                <span
                  key={inv}
                  className="rounded px-1.5 py-0.5 border border-slate-700 bg-slate-800 text-[10.5px] font-mono text-slate-300"
                >
                  {inv}
                </span>
              ))}
            </div>
            <div className="flex items-start gap-1.5 text-[10px] text-slate-500">
              <ShieldCheck className="w-3 h-3 shrink-0 mt-0.5 text-emerald-400/70" />
              <span>
                Routing transparency is sovereignty — <code>inv.sovereignty.102</code>: the operator chooses,
                switches, and combines providers free of lock-in. Rows marked <em>sovereign floor</em> are the
                inalienable open-weight guarantee (never routed away).
              </span>
            </div>
          </Section>

          {/* Sovereign floor — where the fallback ladder terminates (CFS-018 apex
              recalibration). The floor is the third-party open-weight API (venice)
              until an apex self-hosted node is configured, at which point OUR own
              decentralised infra is the inalienable terminal rung. */}
          <Section title="Sovereign floor (the inalienable terminal rung)">
            <div className="flex items-start gap-2">
              <ShieldCheck
                className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                  data.sovereignNode.configured ? "text-fuchsia-400" : "text-emerald-400/70"
                }`}
              />
              <div className="space-y-1 text-[11px]">
                {data.sovereignNode.configured ? (
                  <div className="text-slate-200">
                    <span className="font-semibold text-fuchsia-300">S4 · self-hosted apex</span> — the
                    floor is our own decentralised node
                    {data.sovereignNode.model && (
                      <span className="font-mono text-slate-400"> ({data.sovereignNode.model})</span>
                    )}
                    . No third party can rate-limit, price-gate, or deny inference.
                  </div>
                ) : (
                  <div className="text-slate-300">
                    <span className="font-semibold text-emerald-300">S3 · open-weight (third-party hosted)</span> —
                    the floor is the open-weight API (venice). Open weights, but the hosting is a third
                    party's.
                  </div>
                )}
                <div className="text-[10px] text-slate-500">
                  Apex model sovereignty (<span className="font-mono">S4 self-hosted</span>) is a stubbed,
                  env-gated seam (<span className="font-mono">SOVEREIGN_NODE_BASE_URL</span>) — inert until a
                  node is deployed. Apex platform sovereignty (<span className="font-mono">S5</span>) is a
                  Chrysalis 3.0 horizon.
                </div>
              </div>
            </div>
          </Section>

          {/* Per-stage routing table — the live decision for each reasoning stage. */}
          <Section title={`Per-stage routing (${data.stages.length} reasoning stages)`}>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-1 pr-3 font-medium">Stage</th>
                    <th className="py-1 pr-3 font-medium">Provider / model</th>
                    <th className="py-1 pr-3 font-medium">Source</th>
                    <th className="py-1 pr-3 font-medium">Floor</th>
                    <th className="py-1 font-medium">Governing invariants</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stages.map((s) => (
                    <tr key={s.stage} className="border-t border-slate-800 align-top">
                      <td className="py-1.5 pr-3 text-slate-200 font-medium whitespace-nowrap">{s.stage}</td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">
                        <span className="text-slate-300">{s.provider}</span>
                        <span className="text-slate-600"> / </span>
                        <span className="font-mono text-slate-400">{s.model}</span>
                      </td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">
                        <SourceBadge source={s.source} />
                      </td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">
                        {s.sovereignFloor ? (
                          <span className="inline-flex items-center gap-1 text-emerald-300">
                            <ShieldCheck className="w-3 h-3" /> yes
                          </span>
                        ) : (
                          <span className="text-slate-600">·</span>
                        )}
                      </td>
                      <td className="py-1.5">
                        {s.governingInvariants.length === 0 ? (
                          <span className="text-slate-600">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {s.governingInvariants.map((inv) => (
                              <span key={inv} className="font-mono text-[10px] text-slate-500">
                                {inv}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* ModelQube registry — the constitutional objects routing ranks over. */}
          <Section title={`ModelQube registry (${data.registry.length} qubes)`}>
            <div className="space-y-2">
              {data.registry.map((q) => {
                const fitStages = Object.entries(q.stageFitness).sort((a, b) => b[1] - a[1]);
                return (
                  <div
                    key={q.id}
                    className="rounded-md border border-slate-800 bg-slate-900/40 p-2 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-slate-200 font-medium truncate">{q.displayLabel}</span>
                        {q.sovereignFloor && (
                          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 border border-emerald-500/30 bg-emerald-500/15 text-[10px] text-emerald-300">
                            <ShieldCheck className="w-3 h-3" /> sovereign floor
                          </span>
                        )}
                      </div>
                      <span
                        className={`rounded px-1.5 py-0.5 border text-[10px] font-medium shrink-0 ${
                          q.tier === "self-hosted"
                            ? "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30"
                            : q.tier === "open-weight"
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                            : "bg-slate-800 text-slate-300 border-slate-700"
                        }`}
                      >
                        {q.tier}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] text-slate-500">
                      <span className="font-mono text-slate-600">{q.ref}</span>
                      <span>
                        standing <span className="text-slate-400">{q.standing.toFixed(2)}</span>
                        <span className="text-slate-600"> · </span>
                        <span className="text-slate-400">{q.standingBand}</span>
                      </span>
                    </div>
                    {fitStages.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {fitStages.map(([stage, fit]) => (
                          <span
                            key={stage}
                            className="rounded px-1.5 py-0.5 border border-slate-700 bg-slate-800 text-[10px] text-slate-300"
                          >
                            {stage} <span className="text-slate-500">{fit.toFixed(2)}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          <div className="text-[10px] text-slate-600">
            read-only · last refreshed {new Date(data.at).toLocaleTimeString()}
          </div>
        </>
      )}

      {!data && !error && (
        <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> loading routing transparency…
        </div>
      )}
    </div>
  );

  return (
    <LayoutShell
      surfaceId="dev-model-routes"
      disTemplateId="dev-model-routes-layout-v1"
      headerIcon={<Route className="w-4 h-4" />}
      headerEyebrow="CDE tool · routing transparency"
      headerTitle="Model Routes"
      headerActions={
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-700/50 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Refresh
        </button>
      }
      onDismiss={onBack}
      dismissLabel="Back to overview"
      body={body}
    />
  );
}
