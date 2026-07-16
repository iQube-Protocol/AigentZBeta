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
import { computeFieldSnapshot, registerNodeMeta } from '../engine';

export const DISCOVERY_RANKING_NODE_ID = 'discovery.ranking';

/**
 * The discovery-governing invariant per dimension. Once these are seeded (with
 * domain 'discovery'), VALIDATED, and earn standing (the parallel invariant-
 * discovery workstream + operator ingest), the dimension weights derive from
 * their standing and the projection DIVERGES from the incumbent magic numbers —
 * the point at which a shadow→authoritative flip becomes meaningful. Until then
 * the weights stay 1 (faithful). buildInvariantSlice only surfaces
 * canonical/validated invariants, so proposed/absent discovery invariants leave
 * the projection faithful automatically.
 */
const DIMENSION_INVARIANT_SEED: Record<'importance' | 'novelty' | 'trust' | 'need', string> = {
  importance: 'inv.reasoning.086', // "explicitly published/consequential content is important"
  novelty: 'inv.reasoning.087', // "new-to-this-operator surfacing"
  trust: 'inv.reasoning.088', // "published/curated provenance outranks catalogue"
  need: 'inv.reasoning.089', // "serve the operator's active intent"
};

/**
 * Derive per-dimension weights from a Field Snapshot's discovery invariants.
 * Weight ∝ the governing invariant's EARNED standing, normalised so the mean
 * weight is 1 (this re-balances the dimensions by standing without changing the
 * overall score scale). Returns all-1 (faithful) when no snapshot is supplied or
 * no discovery invariant has positive standing yet.
 */
function deriveDimensionWeights(
  snapshot?: FieldSnapshot | null,
): Record<'importance' | 'novelty' | 'trust' | 'need', number> {
  const dims = ['importance', 'novelty', 'trust', 'need'] as const;
  const base = { importance: 1, novelty: 1, trust: 1, need: 1 };
  if (!snapshot) return base;
  const bySeed = new Map<string, number>();
  for (const item of snapshot.slice.items) if (item.seedId) bySeed.set(item.seedId, item.standing);
  const standings = dims.map((d) => bySeed.get(DIMENSION_INVARIANT_SEED[d]) ?? 0);
  const total = standings.reduce((a, b) => a + b, 0);
  if (total <= 0) return base; // no earned discovery standing yet → faithful
  const mean = total / dims.length;
  const weights = { ...base };
  dims.forEach((d, i) => {
    weights[d] = mean > 0 ? standings[i] / mean : 1;
  });
  return weights;
}

// ── Cached discovery Field Snapshot (hot-path safe) ──────────────────────────
// The capsules route is a hot read path, so the snapshot (a DB slice) is cached
// per-instance with a short TTL. Guarded — any failure yields null → the
// projection runs faithful. domain 'discovery' scopes the slice to the
// discovery-governing invariants.
let _snapCache: { at: number; snap: FieldSnapshot | null } | null = null;
const SNAP_TTL_MS = 60_000;

export async function getDiscoveryFieldSnapshot(): Promise<FieldSnapshot | null> {
  const now = Date.now();
  if (_snapCache && now - _snapCache.at < SNAP_TTL_MS) return _snapCache.snap;
  try {
    const snap = await computeFieldSnapshot({ domains: ['discovery'], limit: 8 });
    _snapCache = { at: now, snap };
    return snap;
  } catch {
    _snapCache = { at: now, snap: null };
    return null;
  }
}

registerNodeMeta({
  id: DISCOVERY_RANKING_NODE_ID,
  kind: 'ranking',
  dimensions: ['importance', 'novelty', 'trust', 'need'],
  surface: 'discovery',
  description: 'Ranks runtime capsules by an invariant projection (importance/novelty/trust/need) instead of scoreCapsule magic numbers.',
});

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
  const w = deriveDimensionWeights(snapshot);
  const scored = input.capsules.map((capsule) => {
    const dims = projectDimensions(capsule, input.prompt, input.intent);
    // Weighted composite. At faithful weights (all 1) this equals the incumbent
    // scoreCapsule sum; once discovery invariants earn standing the weights
    // re-balance the dimensions and the ranking diverges (the meaningful flip).
    const total =
      w.importance * dims.importance +
      w.novelty * dims.novelty +
      w.trust * dims.trust +
      w.need * dims.need;
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
