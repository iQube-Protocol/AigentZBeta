/**
 * Invariant Decision Node — Discovery Ranking (CFS-035 §10, the Phase-0 pilot).
 *
 * The incumbent `scoreCapsule` (app/api/runtime/capsules/route.ts) is the four
 * forms of embedded compressed reasoning in one place: magic numbers (+10/+6/
 * +4/+3), hard-coded branches (`if intent === …`), and the final `.sort()`
 * (ordering). This node re-expresses the same observable signals as a
 * transparent projection over four named invariant dimensions —
 * **importance · novelty · trust · need** — so every ranking carries a "why"
 * (the receipt), and so the weights can later become genuine invariant
 * projections as `inv.discovery.*` are discovered and earn standing.
 *
 * SHADOW-MODE / PHASE 0 honesty: the dimension weights below are transparent,
 * principle-named constants, NOT yet derived from `inv.discovery.*` standing
 * (those invariants are the parallel discovery workstream). What Phase 0
 * establishes is the MECHANISM — the dimensional decomposition, the snapshot
 * citation path, and the shadow comparison instrument (Evolution face). When a
 * FieldSnapshot with discovery-governing standing is supplied, `citedIds` rides
 * the projection; until then the projection is pure (safe on the hot path).
 *
 * Pure + deterministic (no DB, no clock) so it runs on the capsules hot path
 * without degrading it. Server- or edge-safe.
 */

import type { RuntimeCapsuleRecord } from '@/types/runtimeCapsules';
import type { DecisionProjection, FieldSnapshot, NodeProjector } from '../engine';

export const DISCOVERY_RANKING_NODE_ID = 'discovery.ranking';

/** Showcase signals — mirror the incumbent scorer's local constants. */
const SHOWCASE_FOCUS = ['qripto', 'knyt'];
const SHOWCASE_TOKENS = ['qripto', 'qriptopian', 'knyt', 'metaknyt', 'metaknyts'];

export interface DiscoveryRankingInput {
  capsules: RuntimeCapsuleRecord[];
  prompt: string;
  intent: string;
}

/**
 * The four projection dimensions (CFS-035 §6 node schema). Each is documented
 * by the constitutional principle it encodes — the transparency that replaces
 * an opaque magic-number sum.
 */
interface DiscoveryDimensions {
  /** Explicitly published / consequential — a deployed experience was chosen. */
  importance: number;
  /** New-to-this-operator signal. Phase 0 neutral — needs exposure/selection
   *  history from the Evolution face (documented gap). */
  novelty: number;
  /** Provenance / authority: published source > catalogue; showcase focus. */
  trust: number;
  /** Intent fit: does this serve what the operator asked for right now? */
  need: number;
}

function projectDimensions(
  capsule: RuntimeCapsuleRecord,
  prompt: string,
  intent: string,
): DiscoveryDimensions {
  // importance — "an explicitly published experience is consequential."
  let importance = 0;
  if (capsule.sourceType === 'experience') importance += 10;
  if (capsule.assetStatus === 'resolved') importance += 6;

  // trust — "published/curated provenance outranks generic catalogue content."
  let trust = 0;
  if (capsule.sourceType === 'smart-content') trust += 4;
  if (capsule.metadata.codexSlug && SHOWCASE_FOCUS.includes(capsule.metadata.codexSlug)) trust += 3;
  const searchable = `${capsule.title} ${capsule.description} ${(capsule.metadata.modalityHints || []).join(' ')}`.toLowerCase();
  if (SHOWCASE_TOKENS.some((t) => searchable.includes(t))) trust += 2;

  // need — "serve the operator's active intent." Intent↔modality/kind fit + term overlap.
  let need = 0;
  const hints = capsule.metadata.modalityHints || [];
  if (intent === 'watch' && hints.includes('watch')) need += 4;
  if (intent === 'read' && hints.includes('read')) need += 3;
  if (intent === 'play' && (capsule.metadata.contentKind === 'video' || capsule.metadata.contentKind === 'episode')) need += 3;
  if (intent === 'make' && capsule.metadata.surfaceIntent === 'make') need += 8;
  if (intent === 'make' && capsule.sourceType === 'experience') need += 5;
  if (intent === 'make' && capsule.metadata.contentKind === 'article') need += 2;
  if (intent === 'make' && capsule.metadata.contentKind === 'video') need += 3;
  const words = prompt.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  for (const w of words) if (searchable.includes(w)) need += 1;

  // novelty — Phase 0 neutral (Evolution-face history not yet wired).
  const novelty = 0;

  return { importance, novelty, trust, need };
}

/**
 * The discovery-ranking projector. Ranks capsules by the summed projection,
 * emitting a per-capsule dimension breakdown for the receipt. When a snapshot
 * is supplied its cited invariant ids ride the projection (Reach path).
 */
export const discoveryRankingProjector: NodeProjector<DiscoveryRankingInput, RuntimeCapsuleRecord> = (
  input: DiscoveryRankingInput,
  snapshot?: FieldSnapshot | null,
): DecisionProjection<RuntimeCapsuleRecord> => {
  const scored = input.capsules.map((capsule) => {
    const dims = projectDimensions(capsule, input.prompt, input.intent);
    const total = dims.importance + dims.novelty + dims.trust + dims.need;
    return { capsule, dims, total };
  });
  // Stable sort by projected total (desc); ties keep input order.
  const ranked = scored
    .map((s, i) => ({ ...s, i }))
    .sort((a, b) => (b.total !== a.total ? b.total - a.total : a.i - b.i));

  return {
    nodeId: DISCOVERY_RANKING_NODE_ID,
    ranked: ranked.map((r) => r.capsule),
    projection: ranked.map((r) => ({
      importance: r.dims.importance,
      novelty: r.dims.novelty,
      trust: r.dims.trust,
      need: r.dims.need,
      total: r.total,
    })),
    citedIds: snapshot?.citedIds ?? [],
  };
};
