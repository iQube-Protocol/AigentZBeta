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

export const NBE_RANKING_NODE_ID = 'nbe.ranking';

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
  const ranked = input.items
    .map((it, i) => ({ ...it, i }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.i - b.i));
  return {
    nodeId: NBE_RANKING_NODE_ID,
    ranked: ranked.map((r) => r.candidate),
    projection: ranked.map((r) => ({
      importance: r.weight,
      need: r.score - r.weight,
      total: r.score,
    })),
    citedIds: snapshot?.citedIds ?? [],
  };
}
