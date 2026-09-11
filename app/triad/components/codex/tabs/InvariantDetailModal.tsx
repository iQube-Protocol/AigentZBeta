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

import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Plus, Search, X } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { Dots } from "@/components/iqube/scoreUtils";
import { INVARIANT_EDGE_TYPES } from "@/types/invariants";

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch(`/api/invariants/${encodeURIComponent(invariantId)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load invariant");
      setInvariant(data.invariant as InvariantDetail);
      setContexts((data.contexts as InvariantContextRow[]) ?? []);
      setEdges((data.edges as InvariantEdgeRow[]) ?? []);
      setNeighbors((data.neighbors as NeighborRow[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invariant");
    } finally {
      setLoading(false);
    }
  }, [invariantId]);

  useEffect(() => {
    void load();
  }, [load]);

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

            {edges.length === 0 && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-2.5 text-[11px] text-slate-400">
                <span className="text-slate-300">No relationships recorded.</span> An invariant with no
                intra-crystal relationship is an <span className="text-amber-200">orphan</span>, and three Crystal
                Readiness checks — relationship density, graph connectivity and orphan detection — read this graph.
                Independently discovered invariants arrive as orphans by default; nothing in acquisition creates
                edges.
              </div>
            )}

            <AddRelationship invariantId={invariant.id} onRecorded={() => void load()} />

            {edges.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 mb-1.5">
                  Related invariants <span className="text-slate-600">(CFS-003 graph edges)</span>
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

/**
 * Add relationship — the front end for `POST /api/invariants/[id]/edges`.
 *
 * ── Why this control exists (operator ruling, 2026-08-02) ───────────────────
 *
 * Three of the nine Crystal Intrinsic Readiness checks read `invariant_edges`,
 * and until 2026-08-02 the platform had no way to record one: `addEdge` had no
 * caller, and the discovery pipeline's side-effect edges wrote `specializes`
 * only, keyed by a candidate id. A crystal assembled from independently
 * discovered invariants would have been all orphans, and the operator would
 * have had no action available except to debug the readiness engine.
 *
 * ── Preview then confirm, and why the preview is not the check ─────────────
 *
 * Preview asks the SERVER (not this component) whether the edge would create a
 * cycle and whether it would trigger the CFS-003a §2.6 contradiction
 * quarantine. It is advisory: the service re-runs every rule at write time, so
 * a corpus that changed between preview and confirm cannot slip an edge
 * through. Nothing about the rules is decided here.
 *
 * A relationship is a CLAIM about the corpus, so rationale is required and
 * evidence references are recorded. The form never invents a relationship to
 * make a check pass — the readiness remedies say so in the same words.
 */
function AddRelationship({
  invariantId,
  onRecorded,
}: {
  invariantId: string;
  onRecorded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [relation, setRelation] = useState<string>("supports");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NeighborRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [target, setTarget] = useState<NeighborRow | null>(null);
  const [rationale, setRationale] = useState("");
  const [evidenceText, setEvidenceText] = useState("");
  const [preview, setPreview] = useState<{
    wouldSucceed: boolean;
    wouldCreateCycle: boolean;
    quarantineWarning: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const evidenceRefs = evidenceText
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setFormError(null);
    try {
      const res = await personaFetch(
        `/api/invariants?q=${encodeURIComponent(query.trim())}&limit=20`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "search failed");
      setResults(
        ((data.invariants as NeighborRow[]) ?? []).filter((r) => r.id !== invariantId),
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "search failed");
    } finally {
      setSearching(false);
    }
  }, [query, invariantId]);

  const submit = useCallback(
    async (previewOnly: boolean) => {
      if (!target) {
        setFormError("choose a target invariant");
        return;
      }
      setBusy(true);
      setFormError(null);
      try {
        const res = await personaFetch(
          `/api/invariants/${encodeURIComponent(invariantId)}/edges`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              toInvariantId: target.id,
              relation,
              rationale,
              evidenceRefs,
              ...(previewOnly ? { preview: true } : {}),
            }),
          },
        );
        const data = await res.json();
        // The server's own words win — a refusal here is a rule speaking.
        if (!res.ok || !data.ok) throw new Error(data.error || `request failed (HTTP ${res.status})`);
        if (previewOnly) {
          setPreview({
            wouldSucceed: Boolean(data.wouldSucceed),
            wouldCreateCycle: Boolean(data.wouldCreateCycle),
            quarantineWarning: (data.quarantineWarning as string | null) ?? null,
          });
        } else {
          setOpen(false);
          setTarget(null);
          setQuery("");
          setResults([]);
          setRationale("");
          setEvidenceText("");
          setPreview(null);
          onRecorded();
        }
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "the relationship could not be recorded");
      } finally {
        setBusy(false);
      }
    },
    [invariantId, target, relation, rationale, evidenceRefs, onRecorded],
  );

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/40 px-2.5 py-1 text-[11px] text-slate-300 transition hover:bg-slate-800/60"
      >
        <Plus className="h-3 w-3" /> Add relationship
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-200">Add relationship</h4>
        <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300" aria-label="Cancel">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div>
        <label className="text-[10px] text-slate-500">Relation</label>
        <select
          value={relation}
          onChange={(e) => {
            setRelation(e.target.value);
            setPreview(null);
          }}
          className="mt-0.5 w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
        >
          {INVARIANT_EDGE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[10px] text-slate-500">Target invariant</label>
        <div className="mt-0.5 flex gap-1.5">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void search();
            }}
            placeholder="search statements…"
            className="flex-1 rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600"
          />
          <button
            onClick={() => void search()}
            disabled={searching || !query.trim()}
            className="rounded border border-slate-800 bg-slate-900/60 px-2 text-[11px] text-slate-300 disabled:opacity-50"
          >
            {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
          </button>
        </div>
        {target && (
          <div className="mt-1.5 rounded border border-slate-700 bg-slate-950 p-1.5 text-[11px] text-slate-300">
            <span className="text-slate-500">selected · {target.namespace} · {target.status}</span>
            <div>{target.statement}</div>
          </div>
        )}
        {!target && results.length > 0 && (
          <ul className="mt-1.5 max-h-32 space-y-1 overflow-y-auto">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => {
                    setTarget(r);
                    setPreview(null);
                  }}
                  className="w-full rounded border border-slate-800 bg-slate-950 p-1.5 text-left text-[11px] text-slate-400 hover:border-slate-700 hover:text-slate-200"
                >
                  <span className="text-slate-600">{r.namespace} · {r.status}</span>
                  <div>{r.statement}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label className="text-[10px] text-slate-500">
          Rationale <span className="text-slate-600">(required — three readiness checks read this graph)</span>
        </label>
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          rows={2}
          className="mt-0.5 w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
          placeholder="why this relationship holds"
        />
      </div>

      <div>
        <label className="text-[10px] text-slate-500">Evidence references <span className="text-slate-600">(one per line)</span></label>
        <textarea
          value={evidenceText}
          onChange={(e) => setEvidenceText(e.target.value)}
          rows={2}
          className="mt-0.5 w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
          placeholder="URL, DOI, or evidence id"
        />
      </div>

      {formError && (
        <div className="rounded border border-rose-500/30 bg-rose-500/10 p-2 text-[11px] text-rose-200">
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          {formError}
        </div>
      )}

      {preview && (
        <div className="rounded border border-slate-700 bg-slate-950 p-2 text-[11px]">
          <div className={preview.wouldSucceed ? "text-emerald-300" : "text-amber-200"}>
            would succeed: {String(preview.wouldSucceed)}
            {preview.wouldCreateCycle && " — this edge would create a cycle in an acyclic relation type (CFS-003 §3)"}
          </div>
          {preview.quarantineWarning && (
            <div className="mt-1 text-amber-200">{preview.quarantineWarning}</div>
          )}
          <div className="mt-1 text-[10px] text-slate-500">
            Advisory. The service re-checks every rule at write time.
          </div>
        </div>
      )}

      <div className="flex gap-1.5">
        <button
          onClick={() => void submit(true)}
          disabled={busy || !target || !rationale.trim()}
          className="rounded border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-300 disabled:opacity-50"
        >
          Preview
        </button>
        <button
          onClick={() => void submit(false)}
          disabled={busy || !target || !rationale.trim() || preview?.wouldSucceed === false}
          className="rounded border border-emerald-800 bg-emerald-900/30 px-2.5 py-1 text-[11px] text-emerald-200 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Record relationship"}
        </button>
      </div>
    </div>
  );
}
