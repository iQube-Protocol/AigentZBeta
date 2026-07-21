"use client";

/**
 * Invariant detail — a single-invariant modal (Chrysalis Foundation, CFS-001).
 *
 * Mirrors IQubeDetailModal's shape (self-fetch by id, fixed inset-0 overlay,
 * onClose prop) without reusing its internals — invariants are a distinct
 * primitive with their own fields (standing/reach, contexts, edges), not an
 * iQube. Fetches GET /api/invariants/[id] (invariant + contexts + edges +
 * neighbor summaries) in one call.
 */

import React, { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { Dots } from "@/components/iqube/scoreUtils";

interface InvariantContextRow {
  id: string;
  domain: string;
  interpretation: string | null;
  retrievalTags: string[];
}

interface InvariantEdgeRow {
  id: string;
  fromInvariantId: string;
  toInvariantId: string;
  edgeType: string;
  weight: number;
  rationale: string | null;
}

interface NeighborRow {
  id: string;
  statement: string;
  namespace: string;
  status: string;
}

interface InvariantDetail {
  id: string;
  seedId: string | null;
  statement: string;
  namespace: string;
  semanticType: string | null;
  status: string;
  confidence: number;
  confidenceBasis: string;
  standing: number;
  reach: number;
  timesValidated: number;
  timesContradicted: number;
  timesReferenced: number;
  timesUsed: number;
  version: number;
  supersedesId: string | null;
  ratifiedSource: string | null;
  provenance: Record<string, unknown>;
  reasoningProvenance: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export function InvariantDetailModal({
  invariantId,
  onClose,
}: {
  invariantId: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invariant, setInvariant] = useState<InvariantDetail | null>(null);
  const [contexts, setContexts] = useState<InvariantContextRow[]>([]);
  const [edges, setEdges] = useState<InvariantEdgeRow[]>([]);
  const [neighbors, setNeighbors] = useState<NeighborRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await personaFetch(`/api/invariants/${encodeURIComponent(invariantId)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load invariant");
        if (cancelled) return;
        setInvariant(data.invariant as InvariantDetail);
        setContexts((data.contexts as InvariantContextRow[]) ?? []);
        setEdges((data.edges as InvariantEdgeRow[]) ?? []);
        setNeighbors((data.neighbors as NeighborRow[]) ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load invariant");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invariantId]);

  const neighborById = new Map(neighbors.map((n) => [n.id, n]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-500 hover:text-slate-200"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-400 py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading invariant…
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        {!loading && !error && invariant && (
          <div className="space-y-5 pr-6">
            <div>
              <div className="flex flex-wrap gap-2 text-xs mb-2">
                <span className="rounded px-2 py-0.5 bg-slate-800 text-slate-300">{invariant.namespace}</span>
                {invariant.semanticType && (
                  <span className="rounded px-2 py-0.5 bg-slate-800 text-slate-400">{invariant.semanticType}</span>
                )}
                <span className="rounded px-2 py-0.5 bg-slate-800 text-slate-300">{invariant.status}</span>
                {invariant.seedId && (
                  <span className="rounded px-2 py-0.5 bg-slate-900 text-slate-500 font-mono">{invariant.seedId}</span>
                )}
              </div>
              <p className="text-base text-slate-100 leading-relaxed">{invariant.statement}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500 mb-1">
                  Standing <span className="text-slate-600">(validation-class only — Law XII)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Dots value={invariant.standing / 10} colorClass="text-emerald-400" title="Standing" />
                  <span className="text-sm text-slate-300">{invariant.standing.toFixed(1)}</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">
                  Reach <span className="text-slate-600">(adoption-class only — Law XII)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Dots value={invariant.reach / 10} colorClass="text-cyan-400" title="Reach" />
                  <span className="text-sm text-slate-300">{invariant.reach.toFixed(1)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-slate-500">Confidence</div>
                <div className="text-slate-300">
                  {(invariant.confidence * 100).toFixed(0)}%{" "}
                  <span className="text-slate-500">({invariant.confidenceBasis})</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Version</div>
                <div className="text-slate-300">
                  v{invariant.version}
                  {invariant.supersedesId && <span className="text-slate-500"> · supersedes an earlier version</span>}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Validated / Contradicted</div>
                <div className="text-slate-300">
                  {invariant.timesValidated} / {invariant.timesContradicted}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Referenced / Used</div>
                <div className="text-slate-300">
                  {invariant.timesReferenced} / {invariant.timesUsed}
                </div>
              </div>
              {invariant.ratifiedSource && (
                <div className="col-span-2">
                  <div className="text-xs text-slate-500">Ratified source</div>
                  <div className="text-slate-300">{invariant.ratifiedSource}</div>
                </div>
              )}
            </div>

            {contexts.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 mb-1.5">
                  Contexts <span className="text-slate-600">(domains of applicability — CFS-001 §3)</span>
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {contexts.map((c) => (
                    <span
                      key={c.id}
                      className="rounded px-2 py-0.5 text-xs bg-slate-900 border border-slate-800 text-slate-400"
                      title={c.interpretation ?? undefined}
                    >
                      {c.domain}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {edges.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 mb-1.5">
                  Graph edges <span className="text-slate-600">(CFS-003)</span>
                </h4>
                <ul className="space-y-1.5">
                  {edges.map((e) => {
                    const outgoing = e.fromInvariantId === invariant.id;
                    const otherId = outgoing ? e.toInvariantId : e.fromInvariantId;
                    const other = neighborById.get(otherId);
                    return (
                      <li key={e.id} className="text-xs text-slate-400 rounded border border-slate-800 bg-slate-900/50 p-2">
                        <span className="text-slate-500">{outgoing ? "→" : "←"}</span>{" "}
                        <span className="font-mono text-slate-500">{e.edgeType}</span>
                        {" · "}
                        {other ? (
                          <span className="text-slate-300">{other.statement}</span>
                        ) : (
                          <span className="font-mono">{otherId}</span>
                        )}
                        {e.rationale && <div className="mt-1 text-slate-500 italic">{e.rationale}</div>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
