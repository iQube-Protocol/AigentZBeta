/**
 * Invariant Decision Node — NBE Ranking (CFS-035 §6, Phase-2 frontier node).
 *
 * The incumbent `selectNbeCandidates` (services/orchestration/nbeCatalog.ts)
 * ranks next-best-experience candidates by `score = static weight + goal-keyword
 * boost`, then `.sort()`s — the magic-number + ordering forms of embedded
 * compressed reasoning. This node re-expresses the SAME score as a transparent
 * projection over two named dimensions — **importance** (the curated priority
 * weight) and **need** (goal-fit) — so every NBE ordering carries a "why".
 *
 * Faithful by construction: `importance + need === score`, so shadow adoption is
 * behaviour-preserving. The caller supplies the already-computed `weight` and
 * `score` so this node duplicates NO scoring constants (need = score − weight).
 *
 * Generic over the candidate type `C` so the engine/nodes layer never imports an
 * orchestration domain type (keeps the dependency direction clean). Pure +
 * deterministic. Server-safe.
 */

import type { DecisionProjection, FieldSnapshot } from '../engine';
import { deriveWeightsFromStanding, getCachedFieldSnapshot, registerNodeMeta } from '../engine';

export const NBE_RANKING_NODE_ID = 'nbe.ranking';

registerNodeMeta({
  id: NBE_RANKING_NODE_ID,
  kind: 'ranking',
  dimensions: ['importance', 'need'],
  surface: 'next-best-experience',
  description: 'Ranks NBE candidates by an invariant projection (importance/need) instead of static weight + goal-keyword boost.',
});

/**
 * The NBE-governing invariant per dimension. Once seeded (context 'nbe'),
 * validated, and earning standing, the dimension weights derive from that
 * standing and the ranking DIVERGES from the incumbent weight+boost sum (the
 * meaningful flip). Faithful (all-1) until then. `importance+need===score` holds
 * at faithful weights, so shadow adoption is behaviour-preserving.
 */
export const NBE_DIMENSION_INVARIANT_SEED: Record<'importance' | 'need', string> = {
  importance: 'inv.reasoning.151', // "curated priority weight matters"
  need: 'inv.reasoning.152', // "goal-fit matters"
};

/** Cached NBE Field Snapshot (60s TTL) — domain 'nbe' scopes the governing slice. */
export async function getNbeFieldSnapshot(): Promise<FieldSnapshot | null> {
  return getCachedFieldSnapshot('nbe', { domains: ['nbe'], limit: 8 });
}

export interface NbeRankingItem<C> {
  candidate: C;
  /** The curated static priority weight (→ importance dimension). */
  weight: number;
  /** The incumbent total score (weight + goal boost). need = score − weight. */
  score: number;
}

export interface NbeRankingInput<C> {
  items: NbeRankingItem<C>[];
}

/**
 * Project NBE candidates into a ranking with a transparent importance/need
 * breakdown. Stable tiebreak on input order (mirrors V8's stable sort).
 */
export function nbeRankingProjector<C>(
  input: NbeRankingInput<C>,
  snapshot?: FieldSnapshot | null,
): DecisionProjection<C> {
  const w = deriveWeightsFromStanding(snapshot, NBE_DIMENSION_INVARIANT_SEED);
  // Weighted composite. At faithful weights (all 1) this equals the incumbent
  // score (importance+need); once the nbe invariants earn standing the weights
  // re-balance importance vs need and the ranking diverges (the meaningful flip).
  const scored = input.items.map((it, i) => {
    const importance = it.weight;
    const need = it.score - it.weight;
    return { it, i, importance, need, total: w.importance * importance + w.need * need };
  });
  const ranked = scored.sort((a, b) => (b.total !== a.total ? b.total - a.total : a.i - b.i));
  return {
    nodeId: NBE_RANKING_NODE_ID,
    ranked: ranked.map((r) => r.it.candidate),
    projection: ranked.map((r) => ({ importance: r.importance, need: r.need, total: r.total })),
    citedIds: snapshot?.citedIds ?? [],
  };
}
