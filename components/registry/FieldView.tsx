"use client";

/**
 * FieldView — the Constitutional Observatory (CFS-035 §12), the iQube Registry's
 * third top-level view beside Assets + Activity. The operator's framing: the
 * constitutional field is the perimeter of the Constitutional Internet, and
 * invariants are a lens/substrate on state — so this view shows the field as
 * nodes, fields, projections, and health, not just assets.
 *
 * It READS the engine (GET /api/invariants/observatory) — it never re-instruments.
 * Five perspectives: Node · Field · Projection · Platform Health (+ Graph, a
 * follow-on). Slate house style (bg-slate-900/40, border-slate-800). The route
 * is spine-gated, so data is fetched with personaFetch (Bearer token attached).
 */

import React, { useCallback, useEffect, useState } from "react";
import { personaFetch } from "@/utils/personaSpine";

// ── API shape (mirrors app/api/invariants/observatory/route.ts) ──────────────
interface NodeMeta {
  id: string;
  kind: string;
  dimensions: string[];
  surface: string;
  description: string;
  lastObservation:
    | { nodeId: string; topAgreement?: boolean; rankAgreement?: number; delta?: number; itemCount?: number }
    | null;
  history:
    | { nodeId: string; kind: string; count: number; meanRankAgreement: number | null; meanAbsValueDelta: number | null; lastObservedAt: string | null }
    | null;
}
interface NamespaceMeasurement {
  namespace: string;
  invariants: number;
  avgStanding: number;
  avgReach: number;
  consequenceAccuracy: number | null;
  timesValidated: number;
  timesContradicted: number;
}
interface TopReused {
  id: string;
  seedId: string | null;
  statement: string;
  namespace: string;
  standing: number;
  reach: number;
}
interface DiscoveryDimension {
  dimension: "importance" | "novelty" | "trust" | "need";
  seedId: string;
  standing: number;
  status: string | null;
  weight: number;
}
interface ObservatoryResponse {
  ok: boolean;
  generatedAt: string;
  nodes: NodeMeta[];
  field: {
    canonVersion: string | null;
    totalInvariants: number;
    byNamespace: NamespaceMeasurement[];
    topReused: TopReused[];
  };
  projection: { nodeId: string; dimensions: DiscoveryDimension[]; diverges: boolean } | null;
  health: {
    nodesRegistered: number;
    nodesObserved: number;
    totalInvariants: number;
    meanRankAgreement: number | null;
    meanValueDelta: number | null;
    persistedObservations: number;
    persistenceAvailable: boolean;
    groundedReceiptCount: number | null;
  };
  note?: string;
}

// ── shared slate primitives ──────────────────────────────────────────────────
const PANEL = "rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm";
const SUBPANEL = "rounded-lg border border-slate-800 bg-slate-950/60";

const Metric: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className={`${SUBPANEL} p-3 flex flex-col gap-1`}>
    <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
    <span className="text-lg font-semibold text-slate-100 tabular-nums">{value}</span>
    {hint ? <span className="text-[11px] text-slate-500">{hint}</span> : null}
  </div>
);

/** Standing bar (0–100), purple ramp for high, matching the trust colour language. */
const StandingBar: React.FC<{ value: number; max?: number }> = ({ value, max = 100 }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const tone = value <= 30 ? "bg-red-500" : value <= 60 ? "bg-yellow-500" : "bg-purple-500";
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-700 overflow-hidden">
      <div className={`h-full ${tone} transition-all duration-300`} style={{ width: `${pct}%` }} />
    </div>
  );
};

function fmt(n: number | null | undefined, digits = 2): string {
  return typeof n === "number" ? n.toFixed(digits) : "—";
}

type Perspective = "health" | "projection" | "nodes" | "field";

const PERSPECTIVES: Array<{ id: Perspective; label: string }> = [
  { id: "health", label: "Health" },
  { id: "projection", label: "Projection" },
  { id: "nodes", label: "Nodes" },
  { id: "field", label: "Field" },
];

export const FieldView: React.FC<{ className?: string }> = ({ className }) => {
  const [data, setData] = useState<ObservatoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [perspective, setPerspective] = useState<Perspective>("health");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch("/api/invariants/observatory", { cache: "no-store" });
      const json = (await res.json()) as ObservatoryResponse;
      if (!res.ok || !json.ok) throw new Error((json as { error?: string })?.error || `HTTP ${res.status}`);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the constitutional field");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={`flex flex-col gap-4 ${className || ""}`}>
      {/* header + perspective switch */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Constitutional Field</h2>
          <p className="text-xs text-slate-500">
            The Observatory — the field as nodes, projections, and health. Reads the engine; never re-instruments.
          </p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-1">
          {PERSPECTIVES.map((p) => (
            <button
              key={p.id}
              onClick={() => setPerspective(p.id)}
              className={`px-3 py-1 text-xs rounded-md transition ${
                perspective === p.id ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => void load()}
            className="px-2 py-1 text-xs rounded-md text-slate-400 hover:text-slate-200 transition"
            title="Refresh"
            aria-label="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className={`${PANEL} p-8 text-center text-sm text-slate-500`}>Reading the constitutional field…</div>
      ) : error ? (
        <div className={`${PANEL} p-6 text-sm text-red-300`}>
          {error}
          <button onClick={() => void load()} className="ml-3 underline hover:text-red-200">
            retry
          </button>
        </div>
      ) : data ? (
        <>
          {perspective === "health" && <HealthPerspective data={data} />}
          {perspective === "projection" && <ProjectionPerspective data={data} />}
          {perspective === "nodes" && <NodesPerspective data={data} />}
          {perspective === "field" && <FieldPerspective data={data} />}

          <p className="text-[11px] text-slate-600 px-1">
            {data.note} · canon {data.field.canonVersion || "—"} · generated{" "}
            {new Date(data.generatedAt).toLocaleTimeString()}
          </p>
        </>
      ) : null}
    </div>
  );
};

// ── Platform Health — Constitutional Observability metrics ───────────────────
const HealthPerspective: React.FC<{ data: ObservatoryResponse }> = ({ data }) => {
  const h = data.health;
  return (
    <div className={`${PANEL} p-4`}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <Metric label="Invariants" value={h.totalInvariants} hint="in the field" />
        <Metric label="Decision Nodes" value={`${h.nodesObserved}/${h.nodesRegistered}`} hint="observed / registered" />
        <Metric
          label="Projection accuracy"
          value={h.meanRankAgreement === null ? "—" : fmt(h.meanRankAgreement, 3)}
          hint="mean rank agreement (1 = faithful)"
        />
        <Metric
          label="Value delta"
          value={h.meanValueDelta === null ? "—" : fmt(h.meanValueDelta, 3)}
          hint="mean |Δ| vs incumbent (0 = faithful)"
        />
        <Metric
          label="Observations"
          value={h.persistedObservations}
          hint={h.persistenceAvailable ? "persisted history" : "in-memory only"}
        />
        <Metric
          label="Grounded receipts"
          value={h.groundedReceiptCount === null ? "unmeasured" : h.groundedReceiptCount}
          hint="cited an invariant"
        />
      </div>
      {!h.persistenceAvailable ? (
        <p className="mt-3 text-[11px] text-amber-500/80">
          Observation persistence table not found — Health reads the per-instance snapshot only. Apply migration{" "}
          <code className="text-amber-300">20260718000000_invariant_shadow_observations</code> to accrue durable history.
        </p>
      ) : h.meanRankAgreement === null && h.meanValueDelta === null ? (
        <p className="mt-3 text-[11px] text-slate-500">
          No shadow observations recorded yet — projections observe as the surfaces run.
        </p>
      ) : null}
    </div>
  );
};

// ── Projection — the discovery node's live dimension weights ─────────────────
const ProjectionPerspective: React.FC<{ data: ObservatoryResponse }> = ({ data }) => {
  const p = data.projection;
  if (!p) return <div className={`${PANEL} p-6 text-sm text-slate-500`}>No projection node available.</div>;
  return (
    <div className={`${PANEL} p-4 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{p.nodeId}</h3>
          <p className="text-xs text-slate-500">
            Discovery ranking as a projection over four invariant dimensions. Weight ∝ each dimension's governing
            invariant's earned standing (mean-normalised to 1).
          </p>
        </div>
        <span
          className={`text-[11px] px-2 py-1 rounded-md border ${
            p.diverges
              ? "border-purple-700 bg-purple-950/40 text-purple-300"
              : "border-slate-700 bg-slate-950/60 text-slate-400"
          }`}
        >
          {p.diverges ? "diverges from incumbent" : "faithful (weights ≈ 1)"}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {p.dimensions.map((d) => (
          <div key={d.dimension} className={`${SUBPANEL} p-3`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-slate-200 capitalize">{d.dimension}</span>
              <span className="text-xs text-slate-400 tabular-nums">
                standing {fmt(d.standing, 1)} · weight ×{fmt(d.weight, 2)}
                <span
                  className={`ml-2 text-[10px] uppercase ${
                    d.status === "validated" || d.status === "canonical" ? "text-emerald-400" : "text-slate-500"
                  }`}
                >
                  {d.status || "unseeded"}
                </span>
              </span>
            </div>
            <StandingBar value={d.standing} />
            <div className="mt-1 text-[10px] text-slate-600 font-mono">{d.seedId}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Node View — every registered Invariant Decision Node ─────────────────────
const NodesPerspective: React.FC<{ data: ObservatoryResponse }> = ({ data }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    {data.nodes.map((n) => (
      <div key={n.id} className={`${PANEL} p-4 flex flex-col gap-2`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">{n.id}</h3>
          <span className="text-[10px] uppercase tracking-wide text-slate-500 px-2 py-0.5 rounded border border-slate-800">
            {n.kind}
          </span>
        </div>
        <p className="text-xs text-slate-400">{n.description}</p>
        <div className="flex flex-wrap gap-1">
          {n.dimensions.map((d) => (
            <span key={d} className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-800/60">
              {d}
            </span>
          ))}
        </div>
        <div className="text-[11px] text-slate-500">
          surface <span className="text-slate-300">{n.surface}</span>
          {n.lastObservation ? (
            <span className="ml-2">
              · last:{" "}
              {typeof n.lastObservation.rankAgreement === "number"
                ? `rankAgreement ${fmt(n.lastObservation.rankAgreement, 3)}`
                : typeof n.lastObservation.delta === "number"
                ? `Δ ${fmt(n.lastObservation.delta, 3)}`
                : "recorded"}
            </span>
          ) : (
            <span className="ml-2 text-slate-600">· not yet observed this instance</span>
          )}
        </div>
        {n.history ? (
          <div className="text-[11px] text-slate-500 border-t border-slate-800 pt-2">
            history: <span className="text-slate-300 tabular-nums">{n.history.count}</span> obs ·{" "}
            {n.history.meanRankAgreement !== null
              ? `mean rankAgreement ${fmt(n.history.meanRankAgreement, 3)}`
              : n.history.meanAbsValueDelta !== null
              ? `mean |Δ| ${fmt(n.history.meanAbsValueDelta, 3)}`
              : "—"}
          </div>
        ) : null}
      </div>
    ))}
  </div>
);

// ── Field — invariants as fields (per-namespace) + adoption leaders ──────────
const FieldPerspective: React.FC<{ data: ObservatoryResponse }> = ({ data }) => (
  <div className="flex flex-col gap-4">
    <div className={`${PANEL} p-4`}>
      <h3 className="text-sm font-semibold text-slate-100 mb-3">Fields by namespace</h3>
      <div className="flex flex-col gap-2">
        {data.field.byNamespace.map((ns) => (
          <div key={ns.namespace} className={`${SUBPANEL} p-3`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-slate-200">{ns.namespace}</span>
              <span className="text-xs text-slate-400 tabular-nums">
                {ns.invariants} inv · standing {fmt(ns.avgStanding, 1)} · reach {fmt(ns.avgReach, 1)}
                {ns.consequenceAccuracy !== null ? ` · accuracy ${fmt(ns.consequenceAccuracy, 2)}` : ""}
              </span>
            </div>
            <StandingBar value={ns.avgStanding} />
          </div>
        ))}
        {data.field.byNamespace.length === 0 ? (
          <p className="text-xs text-slate-500">No invariants ingested yet.</p>
        ) : null}
      </div>
    </div>

    {data.field.topReused.length > 0 ? (
      <div className={`${PANEL} p-4`}>
        <h3 className="text-sm font-semibold text-slate-100 mb-1">Adoption leaders</h3>
        <p className="text-[11px] text-slate-500 mb-3">Most-reused invariants — adoption (Reach), never presented as authority (Law XII).</p>
        <div className="flex flex-col gap-2">
          {data.field.topReused.map((inv) => (
            <div key={inv.id} className={`${SUBPANEL} p-3`}>
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs text-slate-300 line-clamp-2">{inv.statement}</span>
                <span className="text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                  reach {fmt(inv.reach, 1)} · standing {fmt(inv.standing, 1)}
                </span>
              </div>
              <div className="mt-1 text-[10px] text-slate-600 font-mono">{inv.seedId || inv.id} · {inv.namespace}</div>
            </div>
          ))}
        </div>
      </div>
    ) : null}
  </div>
);

export default FieldView;
