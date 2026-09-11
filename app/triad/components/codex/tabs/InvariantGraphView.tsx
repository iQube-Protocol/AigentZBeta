"use client";

/**
 * Invariant Graph — the traversal explorer over the invariant edge set
 * (CFS-003 §4). Pick a root invariant, then walk its neighbourhood via
 * GET /api/invariants/graph (direction + depth controls). Rendered as inline
 * SVG with a depth-radial layout — no graph library, no external assets
 * (CSP-safe). Nodes coloured by namespace, edges labelled by edge type;
 * clicking a node opens its detail modal.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import {
  NAMESPACE_HEX,
  loadAllInvariants,
  type InvariantRow,
} from "./invariantViewShared";

type Direction = "out" | "in" | "both";

interface GraphEdge {
  id: string;
  fromInvariantId: string;
  toInvariantId: string;
  edgeType: string;
  weight: number;
}

interface GraphNodeRaw {
  invariant: { id: string; statement: string; namespace: string; status: string };
  depth: number;
}

interface TraversalResult {
  roots: string[];
  nodes: GraphNodeRaw[];
  edges: GraphEdge[];
  truncated: boolean;
}

interface PlacedNode {
  id: string;
  statement: string;
  namespace: string;
  depth: number;
  x: number;
  y: number;
}

// Edge-type stroke — muted greys with two semantically loud exceptions:
// contradiction (rose) and supersession (amber), which a reader must never
// miss at a glance.
const EDGE_STROKE: Record<string, string> = {
  contradicts: "#f43f5e",
  supersedes: "#f59e0b",
};
const DEFAULT_EDGE_STROKE = "#475569";

const W = 720;
const H = 520;
const CX = W / 2;
const CY = H / 2;
const RING_GAP = 120;
const NODE_R = 9;

export function InvariantGraphView({
  onOpenInvariant,
}: {
  onOpenInvariant: (id: string) => void;
}) {
  const [allRows, setAllRows] = useState<InvariantRow[]>([]);
  const [rootId, setRootId] = useState<string | null>(null);
  const [direction, setDirection] = useState<Direction>("both");
  const [depth, setDepth] = useState(2);
  const [search, setSearch] = useState("");

  const [result, setResult] = useState<TraversalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoverEdgeId, setHoverEdgeId] = useState<string | null>(null);

  // Load the root-picker list once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadAllInvariants();
        if (!cancelled) setAllRows(data);
      } catch {
        /* the picker just stays empty; the traversal fetch surfaces errors */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch traversal whenever the root or controls change.
  useEffect(() => {
    if (!rootId) {
      setResult(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          root: rootId,
          direction,
          depth: String(depth),
        });
        const res = await personaFetch(`/api/invariants/graph?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "Traversal failed");
        if (!cancelled) setResult(data.result as TraversalResult);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Traversal failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rootId, direction, depth]);

  const pickerRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q ? allRows.filter((r) => r.statement.toLowerCase().includes(q)) : allRows;
    return base.slice(0, 40);
  }, [allRows, search]);

  // Depth-radial layout: root(s) at centre, one ring per depth level.
  const placed = useMemo<PlacedNode[]>(() => {
    if (!result) return [];
    const byDepth = new Map<number, GraphNodeRaw[]>();
    for (const n of result.nodes) {
      const arr = byDepth.get(n.depth) ?? [];
      arr.push(n);
      byDepth.set(n.depth, arr);
    }
    const out: PlacedNode[] = [];
    for (const [d, nodes] of byDepth.entries()) {
      if (d === 0) {
        // Root(s) clustered at centre.
        nodes.forEach((n, i) => {
          const offset = nodes.length === 1 ? 0 : (i - (nodes.length - 1) / 2) * 40;
          out.push({ ...toPlaced(n), x: CX + offset, y: CY });
        });
      } else {
        const radius = d * RING_GAP;
        nodes.forEach((n, i) => {
          const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
          out.push({
            ...toPlaced(n),
            x: CX + radius * Math.cos(angle),
            y: CY + radius * Math.sin(angle),
          });
        });
      }
    }
    return out;
  }, [result]);

  const posById = useMemo(() => {
    const m = new Map<string, PlacedNode>();
    for (const p of placed) m.set(p.id, p);
    return m;
  }, [placed]);

  const rootStatement = rootId ? allRows.find((r) => r.id === rootId)?.statement : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Walk the invariant graph (CFS-003). Pick a root, then traverse its neighbourhood by
        edge direction and depth. Contradiction and supersession edges are colour-loud; all others
        are muted. Click a node to open it.
      </p>

      {/* Root picker */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a root invariant…"
            className="w-full rounded-md border border-slate-700 bg-slate-900 pl-8 pr-3 py-1.5 text-sm text-slate-100"
          />
        </div>
        {!rootId && (
          <div className="max-h-40 overflow-y-auto divide-y divide-slate-800/60">
            {pickerRows.map((r) => (
              <button
                key={r.id}
                onClick={() => setRootId(r.id)}
                className="w-full text-left px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800/60 transition flex items-center gap-2"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: NAMESPACE_HEX[r.namespace] ?? "#64748b" }}
                />
                <span className="line-clamp-1">{r.statement}</span>
              </button>
            ))}
            {pickerRows.length === 0 && (
              <div className="px-2 py-3 text-xs text-slate-600">No invariants match.</div>
            )}
          </div>
        )}
        {rootId && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 shrink-0">Root:</span>
            <span className="text-slate-200 line-clamp-1 flex-1">{rootStatement}</span>
            <button
              onClick={() => {
                setRootId(null);
                setResult(null);
              }}
              className="text-slate-400 hover:text-slate-200 shrink-0"
            >
              change
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      {rootId && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 p-0.5">
            {(["out", "in", "both"] as Direction[]).map((d) => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={`rounded px-2 py-1 text-xs transition ${
                  direction === d ? "bg-slate-700 text-slate-100" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Depth
            <select
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300"
            >
              {[1, 2, 3, 4].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          {result && (
            <span className="text-xs text-slate-500">
              {result.nodes.length} nodes · {result.edges.length} edges
              {result.truncated && <span className="text-amber-400"> · truncated (raise depth cap)</span>}
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-10 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Traversing…
        </div>
      )}

      {!loading && rootId && result && result.nodes.length <= 1 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-500">
          This invariant has no edges in the chosen direction. Try direction “both” or a higher depth.
        </div>
      )}

      {!loading && result && result.nodes.length > 1 && (
        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 560 }}>
            <defs>
              <marker
                id="inv-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={DEFAULT_EDGE_STROKE} />
              </marker>
            </defs>

            {/* Edges */}
            {result.edges.map((e) => {
              const from = posById.get(e.fromInvariantId);
              const to = posById.get(e.toInvariantId);
              if (!from || !to) return null;
              const stroke = EDGE_STROKE[e.edgeType] ?? DEFAULT_EDGE_STROKE;
              const isHover = hoverEdgeId === e.id;
              const mx = (from.x + to.x) / 2;
              const my = (from.y + to.y) / 2;
              return (
                <g key={e.id} onMouseEnter={() => setHoverEdgeId(e.id)} onMouseLeave={() => setHoverEdgeId(null)}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={stroke}
                    strokeWidth={isHover ? 2.5 : 1.5}
                    strokeOpacity={isHover ? 1 : 0.55}
                    markerEnd="url(#inv-arrow)"
                  />
                  {isHover && (
                    <text x={mx} y={my - 4} textAnchor="middle" fontSize="10" fill="#e2e8f0">
                      {e.edgeType}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {placed.map((n) => (
              <g
                key={n.id}
                className="cursor-pointer"
                onClick={() => onOpenInvariant(n.id)}
              >
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.depth === 0 ? NODE_R + 3 : NODE_R}
                  fill={NAMESPACE_HEX[n.namespace] ?? "#64748b"}
                  stroke={n.depth === 0 ? "#f8fafc" : "#0f172a"}
                  strokeWidth={n.depth === 0 ? 2 : 1.5}
                />
                <title>{n.statement}</title>
                <text
                  x={n.x}
                  y={n.y + (n.depth === 0 ? NODE_R + 18 : NODE_R + 14)}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#94a3b8"
                >
                  {truncate(n.statement, 26)}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}

function toPlaced(n: GraphNodeRaw): Omit<PlacedNode, "x" | "y"> {
  return {
    id: n.invariant.id,
    statement: n.invariant.statement,
    namespace: n.invariant.namespace,
    depth: n.depth,
  };
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
