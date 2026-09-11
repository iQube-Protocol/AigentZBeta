"use client";

/**
 * Invariant Ontology — the class tree over the substrate (CFS-002). Renders
 * the ontology returned by GET /api/ontology (already assembled into a tree
 * server-side: roots + children) and annotates each class with the count of
 * invariants classified under it (computed from the same snapshot the Browse
 * view lists). Clicking a class jumps to the Browse view filtered to it.
 *
 * Today the ontology is one root class per namespace with no ratified
 * sub-classes yet (extending it is a constitutional act, CFS-002 §7), so the
 * tree renders shallow — but it renders the real recursive structure, so
 * ratified sub-classes appear automatically once they exist.
 */

import React, { useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import {
  NAMESPACE_COLOR,
  loadAllInvariants,
  type InvariantRow,
} from "./invariantViewShared";

interface OntologyNode {
  id: string;
  namespace: string;
  slug: string;
  name: string;
  parentId: string | null;
  semanticType: string | null;
  description: string | null;
  children: OntologyNode[];
}

export function InvariantOntologyView({
  onSelectClass,
}: {
  onSelectClass: (namespace: string, ontologyClassId: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tree, setTree] = useState<OntologyNode[]>([]);
  const [invariants, setInvariants] = useState<InvariantRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [ontRes, invs] = await Promise.all([
          personaFetch(`/api/ontology`, { cache: "no-store" }),
          loadAllInvariants(),
        ]);
        const ont = await ontRes.json();
        if (!ontRes.ok || !ont.ok) throw new Error(ont.error || "Failed to load ontology");
        if (cancelled) return;
        setTree(ont.tree as OntologyNode[]);
        setInvariants(invs);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load ontology");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Count invariants per ontology class id, plus a per-namespace tally for
  // the "unclassified" line (invariants with no ontology_class_id).
  const { countByClass, unclassifiedByNamespace } = useMemo(() => {
    const countByClass: Record<string, number> = {};
    const unclassifiedByNamespace: Record<string, number> = {};
    for (const inv of invariants) {
      if (inv.ontologyClassId) {
        countByClass[inv.ontologyClassId] = (countByClass[inv.ontologyClassId] ?? 0) + 1;
      } else {
        unclassifiedByNamespace[inv.namespace] = (unclassifiedByNamespace[inv.namespace] ?? 0) + 1;
      }
    }
    return { countByClass, unclassifiedByNamespace };
  }, [invariants]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 py-10 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading ontology…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">
        {error}
      </div>
    );
  }
  if (tree.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-500">
        No ontology classes registered. Extending the ontology is a constitutional act (CFS-002 §7).
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">
        The invariant class tree (CFS-002). Each class shows how many invariants are classified under
        it — click to browse them. Extending the ontology with new classes is a constitutional act
        (CFS-002 §7), so the tree is deliberately shallow until sub-classes are ratified.
      </p>
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-2">
        {tree.map((node) => (
          <OntologyBranch
            key={node.id}
            node={node}
            depth={0}
            countByClass={countByClass}
            unclassifiedByNamespace={unclassifiedByNamespace}
            onSelectClass={onSelectClass}
          />
        ))}
      </div>
    </div>
  );
}

function subtreeCount(node: OntologyNode, countByClass: Record<string, number>): number {
  let total = countByClass[node.id] ?? 0;
  for (const child of node.children) total += subtreeCount(child, countByClass);
  return total;
}

function OntologyBranch({
  node,
  depth,
  countByClass,
  unclassifiedByNamespace,
  onSelectClass,
}: {
  node: OntologyNode;
  depth: number;
  countByClass: Record<string, number>;
  unclassifiedByNamespace: Record<string, number>;
  onSelectClass: (namespace: string, ontologyClassId: string) => void;
}) {
  const directCount = countByClass[node.id] ?? 0;
  const total = subtreeCount(node, countByClass);
  const isRoot = depth === 0;
  // Roots correspond 1:1 with namespaces today; surface the unclassified tally
  // there so no invariant is invisible in this view.
  const unclassified = isRoot ? (unclassifiedByNamespace[node.namespace] ?? 0) : 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-800/50 transition"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {node.children.length > 0 ? (
          <ChevronRight className="h-3.5 w-3.5 text-slate-600 shrink-0" />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <button
          onClick={() => onSelectClass(node.namespace, node.id)}
          disabled={directCount === 0}
          className="flex items-center gap-2 flex-1 text-left disabled:cursor-default"
          title={node.description ?? undefined}
        >
          <span className={`rounded border px-1.5 py-0.5 text-[10px] ${NAMESPACE_COLOR[node.namespace] ?? ""}`}>
            {node.namespace}
          </span>
          <span className="text-sm text-slate-200">{node.name}</span>
          <span className="text-[10px] text-slate-600 font-mono">{node.slug}</span>
          {node.semanticType && (
            <span className="text-[10px] text-slate-500">· {node.semanticType}</span>
          )}
        </button>
        <span className="text-xs text-slate-400 tabular-nums shrink-0" title="invariants classified here (subtree total)">
          {node.children.length > 0 ? `${directCount} · Σ${total}` : directCount}
        </span>
      </div>

      {isRoot && unclassified > 0 && (
        <div
          className="flex items-center gap-2 px-2 py-1 text-[11px] text-slate-500 italic"
          style={{ paddingLeft: `${depth * 20 + 8 + 22}px` }}
        >
          {unclassified} unclassified in this namespace
        </div>
      )}

      {node.children.map((child) => (
        <OntologyBranch
          key={child.id}
          node={child}
          depth={depth + 1}
          countByClass={countByClass}
          unclassifiedByNamespace={unclassifiedByNamespace}
          onSelectClass={onSelectClass}
        />
      ))}
    </div>
  );
}
