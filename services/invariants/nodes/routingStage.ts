/**
 * Invariant Decision Node — Model Routing (CFS-035 §6, the fourth Phase-2 node).
 *
 * HONEST STATUS: routing is the one Phase-2 surface that has ALREADY reached the
 * Constitutional-Projection end-state. `services/constitutional/modelRouter.ts`
 * (`routeFor`) is already ModelQube-driven, standing-ranked, and invariant-citing
 * (it carries `governingInvariants` per route) — it is not an embedded magic-
 * number heuristic waiting to be migrated; it IS the projection. So this node is
 * not a shadow-vs-incumbent comparison — it is a thin OBSERVER that re-expresses
 * the router's already-constitutional decision in the node schema, so routing
 * appears in the Constitutional Observatory's Node View for parity and its cited
 * invariants are visible.
 *
 * Pure + deterministic: the caller supplies the route descriptors (from the
 * router's `describeRoutes()`), so this node never imports the router — the
 * dependency direction (nodes → engine only) stays clean.
 */

import type { DecisionProjection, FieldSnapshot } from '../engine';
import { registerNodeMeta } from '../engine';

export const ROUTING_STAGE_NODE_ID = 'routing.stage';

registerNodeMeta({
  id: ROUTING_STAGE_NODE_ID,
  kind: 'ranking',
  dimensions: ['constitutional', 'sovereignFloor'],
  surface: 'model-routing',
  description:
    'Observes the Model Router’s per-stage provider selection (already ModelQube-driven + standing-ranked + invariant-citing). Already-authoritative: the incumbent IS the constitutional projection.',
});

/** A route descriptor, mirroring modelRouter’s StageRoute (supplied by the caller). */
export interface RoutingStageItem {
  stage: string;
  provider: string;
  model: string;
  source: 'override' | 'modelqube' | 'default';
  governingInvariants?: string[];
  sovereignFloor?: boolean;
}

export interface RoutingStageInput {
  routes: RoutingStageItem[];
}

/** Precedence of the routing source (override > modelqube > default). */
const SOURCE_RANK: Record<RoutingStageItem['source'], number> = { override: 2, modelqube: 1, default: 0 };

/**
 * Project the routing decisions. `constitutional` = 1 when the route came from a
 * ModelQube (the object-model-driven, invariant-citing path), 0 for a literal
 * default; `sovereignFloor` = 1 when the route pins the open-weight sovereign
 * floor. Cites the union of the routes’ governing invariants.
 */
export function routingStageProjector(
  input: RoutingStageInput,
  snapshot?: FieldSnapshot | null,
): DecisionProjection<RoutingStageItem> {
  const ranked = input.routes
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (SOURCE_RANK[b.r.source] !== SOURCE_RANK[a.r.source] ? SOURCE_RANK[b.r.source] - SOURCE_RANK[a.r.source] : a.i - b.i));

  const cited = new Set<string>();
  for (const { r } of ranked) for (const id of r.governingInvariants ?? []) cited.add(id);
  for (const id of snapshot?.citedIds ?? []) cited.add(id);

  return {
    nodeId: ROUTING_STAGE_NODE_ID,
    ranked: ranked.map((x) => x.r),
    projection: ranked.map((x) => ({
      constitutional: x.r.source === 'modelqube' ? 1 : 0,
      sovereignFloor: x.r.sovereignFloor ? 1 : 0,
    })),
    citedIds: [...cited],
  };
}
