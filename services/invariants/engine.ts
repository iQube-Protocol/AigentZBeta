/**
 * The Invariant Engine — Level 2 of CFS-035 (constitutional runtime).
 *
 * ONE seam over the existing invariant substrate (Level 1: store / grounding /
 * fields / citation). Every consumer reads the same **Field Snapshot** and the
 * engine's four faces; nothing embeds its own invariant logic (CFS-035 §3 — the
 * engine stays constitutional; the OS composes it).
 *
 * The four faces (CFS-035 §5):
 *   1. Reasoning              — `groundReasoning` (LLM ← invariant slice)
 *   2. Constitutional Projection — `resolvePolicy` (decision ← invariant field)
 *   3. Experience             — field → UI/journey (Phase 2)
 *   4. Evolution              — outcome → learning (the shadow loop; §11)
 *
 * This module is pure composition of existing façades — it adds NO new reader
 * or ranker. Server-only. It never reads the clock (callers stamp).
 *
 * Adoption is observe-mode-first (CFS-017): a node runs its projection in
 * SHADOW alongside the incumbent heuristic and emits the comparison; the
 * shadow→authoritative flip is a separate, operator-gated ratification.
 */

import { buildInvariantSlice, type GroundingContext, type InvariantSlice } from './grounding';
import { persistObservation } from './observationStore';

// ─────────────────────────────────────────────────────────────────────────
// The Field Snapshot — one per intent/request; the shared interface (CFS-035 §5).
// ─────────────────────────────────────────────────────────────────────────

export interface FieldSnapshot {
  /** ISO timestamp stamped by the caller (this module never reads the clock). */
  stampedAt: string | null;
  /** The context signals the snapshot was projected from. */
  context: GroundingContext;
  /** The projected governing invariants for this request (standing-ranked). */
  slice: InvariantSlice;
  /** Convenience — the cited invariant ids (the citation/Reach return path). */
  citedIds: string[];
}

/**
 * Compute the Field Snapshot for a context — the single projection every face
 * reads. Composes `buildInvariantSlice` (Level 1). DB-backed: callers on hot
 * read paths should decide whether to await it (observe-mode nodes may run
 * their pure projection without a snapshot — see the node contract below).
 */
export async function computeFieldSnapshot(
  context: GroundingContext,
  stampedAt: string | null = null,
): Promise<FieldSnapshot> {
  const slice = await buildInvariantSlice(context);
  return { stampedAt, context, slice: { ...slice, generatedAt: stampedAt }, citedIds: slice.citedIds };
}

// ─────────────────────────────────────────────────────────────────────────
// Face 1 — Reasoning. Phase-1 consolidation target: LLM surfaces call this
// instead of hand-rolling a slice. For now a thin wrapper returning the snapshot.
// ─────────────────────────────────────────────────────────────────────────

export async function groundReasoning(
  context: GroundingContext,
  stampedAt: string | null = null,
): Promise<FieldSnapshot> {
  return computeFieldSnapshot(context, stampedAt);
}

// ── Shared node helpers (CFS-035 §6) — the discovery-node pattern, generalised
// so every Invariant Decision Node derives dimension weights + fetches its
// domain snapshot the same way (extend-don't-duplicate). ─────────────────────

/**
 * Derive per-dimension weights from a Field Snapshot's governing invariants.
 * Weight ∝ each dimension's governing invariant's EARNED standing, mean-
 * normalised to 1 (re-balances dimensions by standing without changing the
 * overall score scale). Returns all-1 (faithful) when no snapshot is supplied or
 * no governing invariant has positive standing yet — so a node stays behaviour-
 * preserving until its invariants earn standing. `seedMap` maps each dimension
 * key to the seed id of the invariant that governs it.
 */
export function deriveWeightsFromStanding<K extends string>(
  snapshot: FieldSnapshot | null | undefined,
  seedMap: Record<K, string>,
): Record<K, number> {
  const keys = Object.keys(seedMap) as K[];
  const base = Object.fromEntries(keys.map((k) => [k, 1])) as Record<K, number>;
  if (!snapshot) return base;
  const bySeed = new Map<string, number>();
  for (const item of snapshot.slice.items) if (item.seedId) bySeed.set(item.seedId, item.standing);
  const standings = keys.map((k) => bySeed.get(seedMap[k]) ?? 0);
  const total = standings.reduce((a, b) => a + b, 0);
  if (total <= 0) return base;
  const mean = total / keys.length;
  const weights = { ...base };
  keys.forEach((k, i) => {
    weights[k] = mean > 0 ? standings[i] / mean : 1;
  });
  return weights;
}

/** Minimal coordinate-bearing shape (CFS-039 / PRD-IPE-001). A resolved field's
 *  `coordinates` (services/invariants/resolution.ts `InvariantCoordinates`)
 *  satisfy this structurally — engine.ts (the IPE) never imports the IRE, so
 *  there is no cycle: the projector consumes a field, it does not construct one. */
export interface CoordinateBearing {
  seedId: string | null;
  structural: {
    verifiability: { value: number };
    evidenceDensity: { value: number };
    adoption: { value: number };
  };
}

/**
 * Invariant Projection Engine (CFS-039) — derive node dimension weights from a
 * RESOLVED FIELD's constitutional coordinates instead of the raw slice. Weight ∝
 * each dimension's governing invariant's chosen coordinate axis, mean-normalised
 * to 1 (the `deriveWeightsFromStanding` generalisation, CFS-037 §5).
 *
 * ADDITIVE + BACKWARD-COMPATIBLE by construction: default axis `evidenceDensity`
 * IS the standing axis, so a field whose coordinates carry standing yields the
 * SAME weights as `deriveWeightsFromStanding`; and absent/empty coordinates
 * return all-1 (faithful) — nothing that consumes CFS-035 today changes unless a
 * caller opts in by passing coordinates. Pure.
 */
export function deriveWeightsFromCoordinates<K extends string>(
  coordinates: CoordinateBearing[] | null | undefined,
  seedMap: Record<K, string>,
  axis: 'evidenceDensity' | 'verifiability' | 'adoption' = 'evidenceDensity',
): Record<K, number> {
  const keys = Object.keys(seedMap) as K[];
  const base = Object.fromEntries(keys.map((k) => [k, 1])) as Record<K, number>;
  if (!coordinates || coordinates.length === 0) return base;
  const bySeed = new Map<string, number>();
  for (const c of coordinates) if (c.seedId) bySeed.set(c.seedId, c.structural[axis].value);
  const vals = keys.map((k) => bySeed.get(seedMap[k]) ?? 0);
  const total = vals.reduce((a, b) => a + b, 0);
  if (total <= 0) return base;
  const mean = total / keys.length;
  const weights = { ...base };
  keys.forEach((k, i) => {
    weights[k] = mean > 0 ? vals[i] / mean : 1;
  });
  return weights;
}

// Per-key cached Field Snapshots for hot node paths. Guarded — any failure
// yields null (→ faithful projection). Short TTL so standing changes propagate.
const _snapshotCaches = new Map<string, { at: number; snap: FieldSnapshot | null }>();

export async function getCachedFieldSnapshot(
  key: string,
  context: GroundingContext,
  ttlMs = 60_000,
): Promise<FieldSnapshot | null> {
  const now = Date.now();
  const cached = _snapshotCaches.get(key);
  if (cached && now - cached.at < ttlMs) return cached.snap;
  try {
    const snap = await computeFieldSnapshot(context);
    _snapshotCaches.set(key, { at: now, snap });
    return snap;
  } catch {
    _snapshotCaches.set(key, { at: now, snap: null });
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Face 2 — Constitutional Projection. The Invariant Decision Node (CFS-035 §6).
// ─────────────────────────────────────────────────────────────────────────

/**
 * The result of projecting the constitutional field into a decision. The
 * per-item `projection` breakdown is the receipt's "why" — transparent
 * dimensions, not an opaque score.
 */
export interface DecisionProjection<TItem> {
  nodeId: string;
  /** The decided ordering / selection — the node's output. */
  ranked: TItem[];
  /** Per-item dimension breakdown, parallel to `ranked` (transparency). */
  projection: Array<Record<string, number>>;
  /** Governing invariant ids (Reach accrual when cited). May be empty on a
   *  pure/hot-path projection that skipped the DB snapshot. */
  citedIds: string[];
  /** Which pathway lens shaped the projection (CFS-035 §8). */
  lens?: string;
}

/**
 * A node projector: pure function from inputs (+ optional snapshot) to a
 * decision. Pure so it can run on a hot path without a DB call; when a snapshot
 * is supplied the projection may weight by standing and cite the slice.
 */
export type NodeProjector<TInput, TItem> = (
  input: TInput,
  snapshot?: FieldSnapshot | null,
) => DecisionProjection<TItem>;

// ─────────────────────────────────────────────────────────────────────────
// Face 4 — Evolution. The shadow loop (CFS-035 §11): run the projection
// alongside the incumbent heuristic, emit the comparison. Observe-mode only —
// NEVER throws, NEVER mutates the surface. The flip to authoritative is a
// separate operator-gated ratification.
// ─────────────────────────────────────────────────────────────────────────

export interface ShadowComparison {
  nodeId: string;
  /** Same top-ranked item under both orders? */
  topAgreement: boolean;
  /** Rank agreement over the shared items, 0..1 (1 = identical order). */
  rankAgreement: number;
  /** Number of items compared. */
  itemCount: number;
  /** Governing invariant ids attached to the projection. */
  citedIds: string[];
}

/**
 * Rank-agreement over two orderings of the same items, keyed by `keyOf`.
 * Returns 1.0 for identical order, 0.0 for full reversal; a simple normalized
 * pairwise-concordance (Kendall-τ-like) that needs no external dep.
 */
export function rankAgreement<T>(incumbent: T[], projected: T[], keyOf: (t: T) => string): number {
  const a = incumbent.map(keyOf);
  const b = projected.map(keyOf);
  const posB = new Map<string, number>();
  b.forEach((k, i) => posB.set(k, i));
  const shared = a.filter((k) => posB.has(k));
  const n = shared.length;
  if (n < 2) return 1;
  let concordant = 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      total++;
      const ai = i, aj = j;                       // order in incumbent (shared is a-order)
      const bi = posB.get(shared[i])!, bj = posB.get(shared[j])!;
      if ((ai < aj && bi < bj) || (ai > aj && bi > bj)) concordant++;
    }
  }
  return total === 0 ? 1 : concordant / total;
}

/**
 * Compute the shadow comparison between an incumbent ordering and an engine
 * projection. Pure. `keyOf` identifies items across the two orders.
 */
export function compareShadow<TItem>(
  incumbent: TItem[],
  projection: DecisionProjection<TItem>,
  keyOf: (t: TItem) => string,
): ShadowComparison {
  const topAgreement =
    incumbent.length > 0 && projection.ranked.length > 0
      ? keyOf(incumbent[0]) === keyOf(projection.ranked[0])
      : incumbent.length === projection.ranked.length; // both empty ⇒ agree
  return {
    nodeId: projection.nodeId,
    topAgreement,
    rankAgreement: rankAgreement(incumbent, projection.ranked, keyOf),
    itemCount: Math.min(incumbent.length, projection.ranked.length),
    citedIds: projection.citedIds,
  };
}

/**
 * Emit a shadow observation. Observe-mode floor: a structured server log
 * (CloudWatch-visible, like `[DVN ESCALATION]`). NEVER throws. Receipting the
 * comparison to a persona is a Phase-2 enrichment for persona-scoped nodes.
 */
export function emitShadowObservation(cmp: ShadowComparison): void {
  try {
    // eslint-disable-next-line no-console
    console.log(
      `[INVARIANT-SHADOW] node=${cmp.nodeId} topAgree=${cmp.topAgreement} ` +
        `rankAgree=${cmp.rankAgreement.toFixed(3)} n=${cmp.itemCount} cited=${cmp.citedIds.length}`,
    );
  } catch {
    /* observe-mode never throws */
  }
}

/**
 * Run a node projection in SHADOW against an incumbent ordering: compute the
 * projection, compare, emit the observation, and return the comparison. The
 * caller ALWAYS serves the incumbent — this changes nothing (CFS-035 §11).
 */
export function runShadow<TInput, TItem>(
  projector: NodeProjector<TInput, TItem>,
  input: TInput,
  incumbent: TItem[],
  keyOf: (t: TItem) => string,
  snapshot?: FieldSnapshot | null,
): ShadowComparison | null {
  try {
    const projection = projector(input, snapshot ?? null);
    const cmp = compareShadow(incumbent, projection, keyOf);
    emitShadowObservation(cmp);
    recordObservation(cmp);
    return cmp;
  } catch {
    return null; // observe-mode never degrades the surface
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Node registry — the single source for the Constitutional Observatory's Node
// View (CFS-035 Observatory amendment). Nodes self-register their metadata at
// module load; the shadow runners record each node's last observation. The
// Observatory READS this — it never re-instruments (engine stays constitutional).
// ─────────────────────────────────────────────────────────────────────────

export interface NodeMeta {
  id: string;
  kind: 'ranking' | 'value';
  /** The projection dimensions this node exposes (the "why"). */
  dimensions: string[];
  /** The product surface / stratum this node governs. */
  surface: string;
  description: string;
}

const NODE_REGISTRY = new Map<string, NodeMeta>();
const LAST_OBSERVATION = new Map<string, ShadowComparison | ValueShadowComparison>();

/** Register a node's metadata (idempotent). Called at node-module load. */
export function registerNodeMeta(meta: NodeMeta): void {
  NODE_REGISTRY.set(meta.id, meta);
}

/** Every registered node's metadata — the Observatory Node View source. */
export function listRegisteredNodes(): NodeMeta[] {
  return [...NODE_REGISTRY.values()];
}

/** The most recent shadow observation for a node (this instance), or null. */
export function lastObservation(nodeId: string): ShadowComparison | ValueShadowComparison | null {
  return LAST_OBSERVATION.get(nodeId) ?? null;
}

/** All last-observations keyed by node id — the Observatory Health source. */
export function allObservations(): Record<string, ShadowComparison | ValueShadowComparison> {
  return Object.fromEntries(LAST_OBSERVATION);
}

function recordObservation(cmp: ShadowComparison | ValueShadowComparison): void {
  try {
    LAST_OBSERVATION.set(cmp.nodeId, cmp);
    // Durable history for the Constitutional Observatory — fire-and-forget, never
    // blocks or throws on the observed surface (CFS-035 §11). Guarded inside the
    // store; degrades to in-memory-only until the migration is applied.
    void persistObservation(cmp);
  } catch {
    /* never throws */
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Scalar value projections — for nodes whose decision is a VALUE (a weight,
// threshold, or score), not a ranking. Covers the magic-number / threshold
// forms of compressed reasoning (CFS-035 §2) — e.g. the Standing composite.
// ─────────────────────────────────────────────────────────────────────────

export interface ValueProjection {
  nodeId: string;
  /** The projected scalar (e.g. the standing composite). */
  value: number;
  /** Dimensional breakdown behind the value (the receipt "why"). */
  projection: Record<string, number>;
  citedIds: string[];
  lens?: string;
}

export interface ValueShadowComparison {
  nodeId: string;
  incumbent: number;
  projected: number;
  delta: number;
  citedIds: string[];
}

/**
 * Run a value-projection node in SHADOW against an incumbent scalar. Emits the
 * delta; the caller ALWAYS keeps the incumbent value. Observe-only; never throws.
 */
export function runValueShadow(
  incumbentValue: number,
  projection: ValueProjection,
): ValueShadowComparison | null {
  try {
    const cmp: ValueShadowComparison = {
      nodeId: projection.nodeId,
      incumbent: incumbentValue,
      projected: projection.value,
      delta: projection.value - incumbentValue,
      citedIds: projection.citedIds,
    };
    // eslint-disable-next-line no-console
    console.log(
      `[INVARIANT-SHADOW] node=${cmp.nodeId} valueDelta=${cmp.delta.toFixed(4)} ` +
        `incumbent=${cmp.incumbent.toFixed(2)} projected=${cmp.projected.toFixed(2)} cited=${cmp.citedIds.length}`,
    );
    recordObservation(cmp);
    return cmp;
  } catch {
    return null;
  }
}
