"use client";

/**
 * Invariant Field Explorer — Consequence Engineering, first slice
 * (CCRL Phase E, CFS-019 §5 item 6).
 *
 * Computational Epistemology made visible: the `enables / constrains /
 * contradicts` field of the LIVE invariant substrate, plus the consequence
 * forecast summary. This is the "can knowledge compose?" question rendered
 * over the real edges — never a simulation.
 *
 * READ-ONLY. Reuses the substrate-browsing data path (loadAllInvariants over
 * /api/invariants, the same reader the Invariant Registry uses) for the
 * picker, and the resilient experimentGet transport for the field read.
 * Honest empty/error states throughout.
 *
 * Deferred to a later Phase E slice (stated in the footer): counterfactual
 * analysis and constitutional simulations. Nothing here writes or edits.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  GitBranch,
  Loader2,
  Network,
  Search,
  ShieldAlert,
} from "lucide-react";
import { experimentGet } from "./experimentStepFetch";
import {
  NAMESPACES,
  NAMESPACE_COLOR,
  NAMESPACE_HEX,
  loadAllInvariants,
  type InvariantRow,
} from "@/app/triad/components/codex/tabs/invariantViewShared";

// Edge-type colour ramp — the three consequence-bearing relations.
const EDGE_TONE: Record<string, string> = {
  enables: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  constrains: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  contradicts: "text-rose-300 border-rose-500/40 bg-rose-500/10",
};
const EDGE_DOT: Record<string, string> = {
  enables: "bg-emerald-400",
  constrains: "bg-amber-400",
  contradicts: "bg-rose-400",
};

interface FieldEndpoint {
  id: string;
  seedId: string | null;
  statement: string;
  namespace: string | null;
}
interface FieldEdge {
  id: string;
  edgeType: string;
  weight: number;
  direction: "out" | "in";
  from: FieldEndpoint;
  to: FieldEndpoint;
}
interface FieldForecast {
  enables: number;
  constrains: number;
  contradicts: number;
  forcesEscalation: boolean;
  constitutionalConstraint: boolean;
  nodeCount: number;
  rationale: string;
}
interface NeighbourhoodResponse {
  ok: true;
  mode: "neighbourhood";
  invariant: {
    id: string;
    seedId: string | null;
    statement: string;
    namespace: string;
    status: string;
    standing: number;
    reach: number;
  } | null;
  edges: FieldEdge[];
  forecast: FieldForecast | null;
  note?: string;
}
interface NamespaceCount {
  namespace: string;
  enables: number;
  constrains: number;
  contradicts: number;
  total: number;
}
interface TopConnected {
  id: string;
  seedId: string | null;
  statement: string;
  namespace: string;
  degree: number;
}
interface OverviewResponse {
  ok: true;
  mode: "overview";
  totalInvariants?: number;
  totalFieldEdges?: number;
  namespaceCounts: NamespaceCount[];
  topConnected: TopConnected[];
  note?: string;
}

// The composition laws that are the THEORY behind the field (CFS-013 §7).
const COMPOSITION_LAWS = [
  {
    seedId: "inv.constitutional.078",
    label: "Constitutional Sequencing",
    statement:
      "Constitutional fields shall compose according to a constitutionally valid sequence; correct components arranged in an invalid sequence do not constitute a coherent experience.",
  },
  {
    seedId: "inv.reasoning.095",
    label: "Sequence is scored, not validated",
    statement:
      "Temporal correctness is a graded coherence field over the space of orderings — the designed sequence a global maximum, alternative coherent orderings possible local maxima, with graded decay away from the optimum.",
  },
  {
    seedId: "inv.reasoning.096",
    label: "Remix preserves the work",
    statement:
      "A remix does not change the work; it finds another coherent trajectory through the same invariant space — the invariants remain fixed, only the traversal changes.",
  },
];

export default function InvariantFieldExplorerTab() {
  const [allRows, setAllRows] = useState<InvariantRow[]>([]);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [namespace, setNamespace] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [neighbourhood, setNeighbourhood] = useState<NeighbourhoodResponse | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Picker list — the same substrate reader the Invariant Registry uses.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadAllInvariants();
        if (!cancelled) setAllRows(data);
      } catch (err) {
        if (!cancelled)
          setPickerError(err instanceof Error ? err.message : "picker unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Field overview whenever nothing is selected (namespace-scoped).
  useEffect(() => {
    if (selectedId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (namespace) params.set("namespace", namespace);
        const qs = params.toString();
        const data = (await experimentGet(
          `/api/research/invariant-field${qs ? `?${qs}` : ""}`,
        )) as unknown as OverviewResponse;
        if (!cancelled) setOverview(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "field unavailable");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, namespace]);

  // Neighbourhood whenever an invariant is selected.
  useEffect(() => {
    if (!selectedId) {
      setNeighbourhood(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = (await experimentGet(
          `/api/research/invariant-field?id=${encodeURIComponent(selectedId)}`,
        )) as unknown as NeighbourhoodResponse;
        if (!cancelled) setNeighbourhood(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "field unavailable");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const pickerRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let base = allRows;
    if (namespace) base = base.filter((r) => r.namespace === namespace);
    if (q) base = base.filter((r) => r.statement.toLowerCase().includes(q) || (r.seedId ?? "").toLowerCase().includes(q));
    return base.slice(0, 40);
  }, [allRows, search, namespace]);

  const selectedRow = selectedId ? allRows.find((r) => r.id === selectedId) : null;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Framing header — Computational Epistemology made visible */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-violet-300" />
          <h2 className="text-lg font-semibold text-slate-100">Invariant Field Explorer</h2>
        </div>
        <p className="mt-2 text-sm text-slate-300">
          The invariant field: how knowledge composes (<span className="text-emerald-300">enables</span>),
          bounds (<span className="text-amber-300">constrains</span>), and conflicts
          (<span className="text-rose-300">contradicts</span>). This is the
          <span className="italic text-slate-200"> &ldquo;can knowledge compose?&rdquo;</span> question of
          Computational Epistemology rendered over the live substrate — the real
          <code className="mx-1 text-slate-400">enables / constrains / contradicts</code> edges, never a simulation.
        </p>
      </div>

      {/* Picker */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find an invariant by statement or seed id…"
              className="w-full rounded-md border border-slate-700 bg-slate-900 pl-8 pr-3 py-1.5 text-sm text-slate-100"
            />
          </div>
          <select
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-300"
          >
            <option value="">All namespaces</option>
            {NAMESPACES.map((ns) => (
              <option key={ns} value={ns}>
                {ns}
              </option>
            ))}
          </select>
          {selectedId && (
            <button
              onClick={() => setSelectedId(null)}
              className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800/60"
            >
              ← Field overview
            </button>
          )}
        </div>

        {pickerError && <p className="text-xs text-rose-400">{pickerError}</p>}

        {!selectedId && (
          <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/60 rounded-md border border-slate-800/60">
            {pickerRows.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setSelectedId(r.id);
                  setSearch("");
                }}
                className="w-full text-left px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800/60 transition flex items-center gap-2"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: NAMESPACE_HEX[r.namespace] ?? "#64748b" }}
                />
                {r.seedId && <span className="font-mono text-slate-500 shrink-0">{r.seedId}</span>}
                <span className="line-clamp-1">{r.statement}</span>
              </button>
            ))}
            {pickerRows.length === 0 && allRows.length > 0 && (
              <div className="px-2.5 py-3 text-xs text-slate-600">No invariants match this filter.</div>
            )}
            {allRows.length === 0 && !pickerError && (
              <div className="px-2.5 py-3 text-xs text-slate-600 flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> loading substrate…
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> reading the field…
        </div>
      )}

      {/* ── Neighbourhood view ─────────────────────────────────────────── */}
      {!loading && selectedId && neighbourhood && (
        <div className="space-y-4">
          {/* The focus invariant */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {(neighbourhood.invariant?.seedId ?? selectedRow?.seedId) && (
                <span className="font-mono text-xs text-slate-500">
                  {neighbourhood.invariant?.seedId ?? selectedRow?.seedId}
                </span>
              )}
              {(neighbourhood.invariant?.namespace ?? selectedRow?.namespace) && (
                <span
                  className={`rounded border px-1.5 py-0.5 text-[10px] ${
                    NAMESPACE_COLOR[neighbourhood.invariant?.namespace ?? selectedRow?.namespace ?? ""] ?? ""
                  }`}
                >
                  {neighbourhood.invariant?.namespace ?? selectedRow?.namespace}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-200">
              {neighbourhood.invariant?.statement ?? selectedRow?.statement ?? "(invariant unavailable)"}
            </p>
          </div>

          {/* Forecast summary — the real forecaster's output */}
          {neighbourhood.forecast ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="flex items-center gap-2 mb-3">
                <GitBranch className="h-4 w-4 text-violet-300" />
                <h3 className="text-sm font-semibold text-slate-100">Consequence forecast (live traversal)</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded px-2 py-1 border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                  enables {neighbourhood.forecast.enables}
                </span>
                <span className="rounded px-2 py-1 border border-amber-500/40 bg-amber-500/10 text-amber-300">
                  constrains {neighbourhood.forecast.constrains}
                </span>
                <span className="rounded px-2 py-1 border border-rose-500/40 bg-rose-500/10 text-rose-300">
                  contradicts {neighbourhood.forecast.contradicts}
                </span>
                <span className="text-slate-500">{neighbourhood.forecast.nodeCount} downstream node(s) in reach</span>
              </div>
              <div
                className={`mt-3 flex items-start gap-2 rounded-lg border p-3 text-xs ${
                  neighbourhood.forecast.forcesEscalation
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                }`}
              >
                <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold">
                    {neighbourhood.forecast.forcesEscalation ? "Forces escalation" : "No escalation forced"}
                  </div>
                  <p className="mt-0.5 text-slate-300">{neighbourhood.forecast.rationale}</p>
                  <p className="mt-1 text-slate-500">
                    A reachable <span className="text-rose-300">contradicts</span> edge, or a{" "}
                    <span className="text-amber-300">constrains</span> edge from a canonical invariant, forces
                    escalation — the guardian&rsquo;s veto becomes informed rather than lexical (CFS-006a §5).
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-500">
              {neighbourhood.note ?? "No forecast available for this invariant."}
            </div>
          )}

          {/* Edge neighbourhood — readable from → edgeType → to */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h3 className="text-sm font-semibold text-slate-100 mb-3">
              Edge neighbourhood ({neighbourhood.edges.length})
            </h3>
            {neighbourhood.edges.length === 0 ? (
              <p className="text-xs text-slate-500">
                {neighbourhood.note ??
                  "This invariant has no enables / constrains / contradicts edges in the substrate."}
              </p>
            ) : (
              <div className="space-y-2">
                {neighbourhood.edges.map((e) => (
                  <div
                    key={e.id}
                    className="flex flex-col gap-1.5 rounded-lg border border-slate-800 bg-slate-950/40 p-2.5 sm:flex-row sm:items-center"
                  >
                    <span className="flex-1 text-xs text-slate-300 line-clamp-2" title={e.from.statement}>
                      {e.from.seedId && <span className="font-mono text-slate-500 mr-1">{e.from.seedId}</span>}
                      {e.from.statement}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] shrink-0 ${
                        EDGE_TONE[e.edgeType] ?? "text-slate-400 border-slate-700 bg-slate-800/40"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${EDGE_DOT[e.edgeType] ?? "bg-slate-500"}`} />
                      {e.edgeType}
                      <ArrowRight className="h-3 w-3" />
                    </span>
                    <span className="flex-1 text-xs text-slate-300 line-clamp-2" title={e.to.statement}>
                      {e.to.seedId && <span className="font-mono text-slate-500 mr-1">{e.to.seedId}</span>}
                      {e.to.statement}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Field overview view ────────────────────────────────────────── */}
      {!loading && !selectedId && overview && (
        <div className="space-y-4">
          {overview.note && <p className="text-xs text-slate-500">{overview.note}</p>}

          {overview.namespaceCounts.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Network className="h-4 w-4 text-violet-300" />
                <h3 className="text-sm font-semibold text-slate-100">Field density by namespace</h3>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">
                {overview.totalFieldEdges ?? 0} field edge(s) across {overview.totalInvariants ?? 0} invariant(s)
                — attributed to each edge&rsquo;s source namespace.
              </p>
              <div className="space-y-1.5">
                {overview.namespaceCounts.map((n) => (
                  <div key={n.namespace} className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`w-32 rounded border px-1.5 py-0.5 text-[10px] ${
                        NAMESPACE_COLOR[n.namespace] ?? "bg-slate-800 text-slate-300 border-slate-700"
                      }`}
                    >
                      {n.namespace}
                    </span>
                    <span className="text-emerald-300">{n.enables} enables</span>
                    <span className="text-amber-300">{n.constrains} constrains</span>
                    <span className="text-rose-300">{n.contradicts} contradicts</span>
                    <span className="text-slate-500">· {n.total} total</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {overview.topConnected.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <h3 className="text-sm font-semibold text-slate-100 mb-1">Most-connected invariants</h3>
              <p className="text-[11px] text-slate-500 mb-3">
                Degree = enables/constrains/contradicts edges touching the invariant. Click to explore its field.
              </p>
              <div className="space-y-1.5">
                {overview.topConnected.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className="w-full text-left flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-2.5 py-1.5 hover:border-slate-600 transition"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: NAMESPACE_HEX[t.namespace] ?? "#64748b" }}
                    />
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 shrink-0">
                      deg {t.degree}
                    </span>
                    {t.seedId && <span className="font-mono text-[10px] text-slate-500 shrink-0">{t.seedId}</span>}
                    <span className="text-xs text-slate-300 line-clamp-1">{t.statement}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {overview.namespaceCounts.length === 0 && overview.topConnected.length === 0 && !overview.note && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-500">
              No field edges in the substrate yet — pick an invariant above to inspect its neighbourhood.
            </div>
          )}
        </div>
      )}

      {/* ── Composition & resequencing — the theory behind the field ───── */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="flex items-center gap-2 mb-1">
          <GitBranch className="h-4 w-4 text-slate-300" />
          <h3 className="text-sm font-semibold text-slate-100">Composition & resequencing (the theory)</h3>
        </div>
        <p className="text-[11px] text-slate-500 mb-3">
          The field&rsquo;s edges are governed by the composition laws (CFS-013 §7). Composition is not free: a
          valid sequence is constitutional data, and a remix is a different traversal of the same fixed invariant
          space — not a different work.
        </p>
        <div className="space-y-2">
          {COMPOSITION_LAWS.map((law) => (
            <div key={law.seedId} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-slate-500">{law.seedId}</span>
                <span className="text-xs font-semibold text-slate-200">{law.label}</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{law.statement}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Honest deferral footer */}
      <p className="text-[11px] text-slate-600 border-t border-slate-800/60 pt-3">
        First Phase E slice (CFS-019 §8): read-only visualisation over the real substrate. Counterfactual analysis
        (&ldquo;what if this edge were removed?&rdquo;) and constitutional simulations are a later Phase E slice —
        this surface neither simulates nor edits.
      </p>
    </div>
  );
}
