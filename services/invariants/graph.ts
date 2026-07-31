/**
 * Invariant Service — graph traversal (CFS-003 §4, CFS-003a).
 *
 * BFS over invariant_edges with batched queries. Storage-agnostic contract:
 * callers see TraversalResult, never table rows, so the storage model can
 * evolve (recursive CTE / dedicated graph store) without touching consumers.
 *
 * Server-only.
 */

import type {
  InvariantEdgeRecord,
  InvariantEdgeType,
  TraversalOptions,
  TraversalResult,
} from '@/types/invariants';
import { ACYCLIC_EDGE_TYPES } from '@/types/invariants';
import {
  getInvariantsByIds,
  listContexts,
  listEdgesForInvariants,
} from './store';

const DEFAULT_DEPTH = 4;
const MAX_DEPTH = 8;
const MAX_NODES = 500;

/**
 * Resolve whether an edge passes the context filter: global edges always
 * pass; context-scoped edges pass only when their context's domain matches.
 */
async function passesContextFilter(
  edge: InvariantEdgeRecord,
  contextDomain: string | undefined,
  domainByContextId: Map<string, string>,
): Promise<boolean> {
  if (!edge.contextId) return true;
  if (!contextDomain) return true;
  if (domainByContextId.has(edge.contextId)) {
    return domainByContextId.get(edge.contextId) === contextDomain;
  }
  // Context rows are fetched per source invariant lazily; on a miss, fetch
  // the owning invariant's contexts and cache.
  const contexts = await listContexts(edge.fromInvariantId);
  for (const ctx of contexts) domainByContextId.set(ctx.id, ctx.domain);
  return domainByContextId.get(edge.contextId) === contextDomain;
}

export async function traverse(
  rootIds: string[],
  options: TraversalOptions = {},
): Promise<TraversalResult> {
  const direction = options.direction ?? 'out';
  const maxDepth = Math.min(options.maxDepth ?? DEFAULT_DEPTH, MAX_DEPTH);
  const minWeight = options.minWeight ?? 0;
  const minConfidence = options.minConfidence ?? 0;

  const visited = new Set<string>(rootIds);
  const collectedEdges: InvariantEdgeRecord[] = [];
  const nodeDepth = new Map<string, { depth: number; via: InvariantEdgeRecord | null }>();
  const domainByContextId = new Map<string, string>();
  rootIds.forEach((id) => nodeDepth.set(id, { depth: 0, via: null }));

  let frontier = [...rootIds];
  let truncated = false;

  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
    const edges = await listEdgesForInvariants(frontier, direction, options.edgeTypes);
    const nextFrontier: string[] = [];

    for (const edge of edges) {
      if (edge.weight < minWeight) continue;
      if (!(await passesContextFilter(edge, options.contextDomain, domainByContextId))) continue;

      const neighbours: string[] = [];
      if ((direction === 'out' || direction === 'both') && frontier.includes(edge.fromInvariantId)) {
        neighbours.push(edge.toInvariantId);
      }
      if ((direction === 'in' || direction === 'both') && frontier.includes(edge.toInvariantId)) {
        neighbours.push(edge.fromInvariantId);
      }

      let edgeUsed = false;
      for (const neighbour of neighbours) {
        if (visited.has(neighbour)) {
          edgeUsed = true; // edge still belongs in the result subgraph
          continue;
        }
        if (visited.size >= MAX_NODES) {
          truncated = true;
          continue;
        }
        visited.add(neighbour);
        nodeDepth.set(neighbour, { depth, via: edge });
        nextFrontier.push(neighbour);
        edgeUsed = true;
      }
      if (edgeUsed && !collectedEdges.some((e) => e.id === edge.id)) {
        collectedEdges.push(edge);
      }
    }
    frontier = nextFrontier;
  }

  const invariants = await getInvariantsByIds([...visited]);
  const filtered = invariants.filter(
    (inv) => nodeDepth.get(inv.id)?.depth === 0 || inv.confidence >= minConfidence,
  );

  return {
    roots: rootIds,
    nodes: filtered
      .map((invariant) => ({
        invariant,
        depth: nodeDepth.get(invariant.id)?.depth ?? 0,
        viaEdge: nodeDepth.get(invariant.id)?.via ?? null,
      }))
      .sort((a, b) => a.depth - b.depth),
    edges: collectedEdges,
    truncated,
  };
}

/**
 * CFS-003 §3 — cycle guard for acyclic edge types. Adding from→to creates a
 * cycle iff `from` is reachable from `to` along edges of the same type.
 */
export async function wouldCreateCycle(
  fromInvariantId: string,
  toInvariantId: string,
  edgeType: InvariantEdgeType,
): Promise<boolean> {
  if (!ACYCLIC_EDGE_TYPES.includes(edgeType)) return false;
  const result = await traverse([toInvariantId], {
    edgeTypes: [edgeType],
    direction: 'out',
    maxDepth: MAX_DEPTH,
  });
  return result.nodes.some((n) => n.invariant.id === fromInvariantId);
}

/**
 * CFS-003 §4 — the explainability surface: the inbound derivation/evidence
 * chain behind an invariant. Answers "why do we believe this?".
 */
export async function reasoningPath(invariantId: string): Promise<TraversalResult> {
  return traverse([invariantId], {
    edgeTypes: ['derives_from', 'supports', 'explains', 'validates'],
    direction: 'both',
    maxDepth: DEFAULT_DEPTH,
  });
}

/**
 * CFS-003 §3 / CFS-006 §3 — knowledge-initialization closure: everything the
 * given invariants depend on, context-filtered.
 */
export async function dependencyClosure(
  invariantIds: string[],
  contextDomain?: string,
): Promise<TraversalResult> {
  return traverse(invariantIds, {
    edgeTypes: ['depends_on', 'composes'],
    direction: 'out',
    maxDepth: MAX_DEPTH,
    contextDomain,
  });
}
