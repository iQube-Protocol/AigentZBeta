/**
 * EXP-006A — topology / abstraction-aware projection scoring (Aletheon 2026-07-20).
 *
 * EXP-006's exact-set metric plateaus because the sovereign router projects
 * invariants ONE ABSTRACTION LEVEL HIGHER than the flat CIRS reference:
 *   intent "authenticated delegation API" → router {authentication, delegation,
 *   security} SUBSUMES reference {token-validation, scope-limitation, ...}. Exact
 *   scoring reads that as F1=0.0; it is not a projection failure, it is an
 *   abstraction/vocabulary mismatch. EXP-006A reclassifies each disagreement and
 *   scores CAUSAL agreement, not lexical:
 *
 *   vocabulary  — folds under canonical normalization (accessibility≈accessible)
 *   abstraction — predicted subsumes/generalizes a reference item (same causal
 *                 family, different level)
 *   omission    — reference item with no predicted relation (a genuine gap)
 *   redundant   — predicted item with no reference relation
 *
 * SUBSUMPTION ORACLE — the abstraction/omission split needs a "does predicted
 * subsume reference?" signal. The GROUND TRUTH is the invariant graph's
 * `specializes`/`generalizes` edges (built by CFS-048 parent-linking): if the
 * predicted concept resolves to an ANCESTOR of the reference concept, that is a
 * confirmed abstraction. Where a label doesn't resolve to a graph node (generic
 * CIRS vocabulary that isn't yet a registry invariant), it falls back to
 * embedding cosine as a proxy. The aggregate reports how many abstraction deltas
 * were graph-confirmed vs proxy, so the two are never conflated.
 *
 * Projection Fidelity is a COMPOSITE (structural + causal coverage + minimality),
 * so a low lexical F1 can coexist with a high causal-agreement score.
 *
 * The CLASSIFIER is pure (takes a relation function) so it is canary-testable
 * without a provider or DB; the async runner supplies embeddings + the graph.
 */

import { canonicalizeLabel } from '@/services/experiments/gradedProjectionScore';
import { getEmbeddingService } from '@/services/content/embeddingService';
import { listInvariants, listEdgesForInvariants } from '@/services/invariants/store';

/** Cosine ≥ MATCH → same invariant (recovered); [FAMILY, MATCH) → same family,
 *  different level (abstraction delta); < FAMILY → unrelated. Graph subsumption
 *  overrides these bands (it is ground truth). */
export const MATCH_THRESHOLD = 0.82;
export const FAMILY_THRESHOLD = 0.62;

/** The relation between a predicted and a reference label. */
export interface Relation { sim: number; graphSubsumes: boolean }
export type RelationFn = (predicted: string, reference: string) => Relation;

export interface AbstractionPair { predicted: string; reference: string; similarity: number; source: 'graph' | 'embedding' }

export interface TopologyIntentScore {
  intent: string;
  lexicalMatches: number;
  semanticMatches: number;
  abstractionPairs: AbstractionPair[];
  omissions: string[];
  redundancies: string[];
  structural: number;
  causalCoverage: number;
  minimality: number;
  projectionFidelity: number;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Classify one intent's projection against its reference. Pure: `rel(p,r)` gives
 * `{ sim, graphSubsumes }`. Greedy one-to-one matching: lexical (canonical) →
 * graph subsumption (ground truth) → semantic (cosine) → abstraction band →
 * omission. Graph-confirmed abstractions are preferred over cosine proxies.
 */
export function classifyProjection(
  intent: string,
  predicted: string[],
  reference: string[],
  rel: RelationFn,
): TopologyIntentScore {
  const pred = predicted.map((l) => ({ label: l, canon: canonicalizeLabel(l), used: false }));
  const ref = reference.map((l) => ({ label: l, canon: canonicalizeLabel(l), matched: false }));

  // 1. Lexical (exact / normalized).
  let lexicalMatches = 0;
  for (const r of ref) {
    const p = pred.find((p) => !p.used && p.canon === r.canon);
    if (p) { p.used = true; r.matched = true; lexicalMatches += 1; }
  }

  // 2. Graph subsumption (ground truth) — a predicted ancestor of the reference.
  const abstractionPairs: AbstractionPair[] = [];
  for (const r of ref) {
    if (r.matched) continue;
    const gp = pred.find((p) => !p.used && rel(p.label, r.label).graphSubsumes);
    if (gp) {
      gp.used = true; r.matched = true;
      abstractionPairs.push({ predicted: gp.label, reference: r.label, similarity: Number(rel(gp.label, r.label).sim.toFixed(3)), source: 'graph' });
    }
  }

  // 3. Semantic / embedding-band — best available predicted per remaining reference.
  let semanticMatches = 0;
  for (const r of ref) {
    if (r.matched) continue;
    let best: { p: typeof pred[number]; s: number } | null = null;
    for (const p of pred) {
      if (p.used) continue;
      const s = rel(p.label, r.label).sim;
      if (!best || s > best.s) best = { p, s };
    }
    if (!best) continue;
    if (best.s >= MATCH_THRESHOLD) {
      best.p.used = true; r.matched = true; semanticMatches += 1;
    } else if (best.s >= FAMILY_THRESHOLD) {
      best.p.used = true; r.matched = true;
      abstractionPairs.push({ predicted: best.p.label, reference: r.label, similarity: Number(best.s.toFixed(3)), source: 'embedding' });
    }
  }

  const omissions = ref.filter((r) => !r.matched).map((r) => r.label);
  const redundancies = pred.filter((p) => !p.used).map((p) => p.label);

  const refN = reference.length || 1;
  const predN = predicted.length || 1;
  const full = lexicalMatches + semanticMatches;
  const structural = clamp01(lexicalMatches / refN);
  const causalCoverage = clamp01((full + 0.5 * abstractionPairs.length) / refN);
  const minimality = clamp01((full + abstractionPairs.length) / predN);
  const projectionFidelity = clamp01(0.35 * structural + 0.45 * causalCoverage + 0.2 * minimality);

  return { intent, lexicalMatches, semanticMatches, abstractionPairs, omissions, redundancies, structural, causalCoverage, minimality, projectionFidelity };
}

export interface TopologyAggregate {
  intentCount: number;
  meanStructural: number;
  meanCausalCoverage: number;
  meanMinimality: number;
  meanProjectionFidelity: number;
  deltaClasses: { abstraction: number; omission: number; redundant: number };
  /** How many abstraction deltas were confirmed by the graph vs embedding proxy. */
  graphConfirmedAbstractions: number;
  embeddingAbstractions: number;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function topologyAggregate(scores: TopologyIntentScore[]): TopologyAggregate {
  const pairs = scores.flatMap((s) => s.abstractionPairs);
  return {
    intentCount: scores.length,
    meanStructural: mean(scores.map((s) => s.structural)),
    meanCausalCoverage: mean(scores.map((s) => s.causalCoverage)),
    meanMinimality: mean(scores.map((s) => s.minimality)),
    meanProjectionFidelity: mean(scores.map((s) => s.projectionFidelity)),
    deltaClasses: {
      abstraction: pairs.length,
      omission: scores.reduce((a, s) => a + s.omissions.length, 0),
      redundant: scores.reduce((a, s) => a + s.redundancies.length, 0),
    },
    graphConfirmedAbstractions: pairs.filter((p) => p.source === 'graph').length,
    embeddingAbstractions: pairs.filter((p) => p.source === 'embedding').length,
  };
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

// ── Graph subsumption oracle (ground truth from `specializes`/`generalizes`) ──

/**
 * Build a `subsumes(pred, ref)` oracle from the invariant graph: true iff the
 * predicted concept resolves to an ANCESTOR of the reference concept via
 * child→parent (`specializes`) edges. Labels resolve to invariant nodes by
 * canonical-token containment in the invariant's statement — so a label only
 * hits when the registry actually contains a matching invariant (generic CIRS
 * vocabulary won't, and correctly falls through to the embedding proxy). Loads a
 * bounded slice; degrades to a no-op oracle on any failure.
 */
export async function buildGraphSubsumptionOracle(): Promise<(pred: string, ref: string) => boolean> {
  try {
    const invs = await listInvariants({ status: ['proposed', 'validated', 'canonical'], limit: 1000 });
    if (invs.length === 0) return () => false;
    const edges = await listEdgesForInvariants(invs.map((i) => i.id), 'both', ['specializes', 'generalizes']);
    // child → parents adjacency. specializes: from=child,to=parent; generalizes is the inverse.
    const parents = new Map<string, Set<string>>();
    const addParent = (child: string, parent: string) => {
      const set = parents.get(child) ?? new Set<string>();
      set.add(parent); parents.set(child, set);
    };
    for (const e of edges) {
      if (e.edgeType === 'specializes') addParent(e.fromInvariantId, e.toInvariantId);
      else if (e.edgeType === 'generalizes') addParent(e.toInvariantId, e.fromInvariantId);
    }
    // token → invariant ids (canonical tokens of each statement).
    const tokenIndex = new Map<string, Set<string>>();
    for (const inv of invs) {
      for (const tok of canonicalizeLabel(inv.statement).split('-').filter((t) => t.length >= 4)) {
        const set = tokenIndex.get(tok) ?? new Set<string>();
        set.add(inv.id); tokenIndex.set(tok, set);
      }
    }
    const resolve = (label: string): Set<string> => {
      const toks = canonicalizeLabel(label).split('-').filter((t) => t.length >= 4);
      if (toks.length === 0) return new Set();
      // Intersection: an invariant whose statement contains ALL the label's tokens.
      let acc: Set<string> | null = null;
      for (const t of toks) {
        const ids = tokenIndex.get(t) ?? new Set<string>();
        acc = acc === null ? new Set(ids) : new Set([...acc].filter((x) => ids.has(x)));
        if (acc.size === 0) break;
      }
      return acc ?? new Set();
    };
    const ancestors = (node: string): Set<string> => {
      const seen = new Set<string>();
      const stack = [node];
      let depth = 0;
      while (stack.length && depth < 64) {
        const cur = stack.pop()!;
        for (const p of parents.get(cur) ?? []) if (!seen.has(p)) { seen.add(p); stack.push(p); }
        depth += 1;
      }
      return seen;
    };
    return (pred: string, ref: string): boolean => {
      const predNodes = resolve(pred);
      const refNodes = resolve(ref);
      if (predNodes.size === 0 || refNodes.size === 0) return false;
      for (const rn of refNodes) {
        const anc = ancestors(rn);
        for (const pn of predNodes) if (anc.has(pn)) return true;
      }
      return false;
    };
  } catch {
    return () => false;
  }
}

/**
 * Score a whole EXP-006 run with topology awareness. Embeds every distinct label
 * once for the cosine proxy, builds the graph oracle (ground truth), and
 * classifies each intent. Degrades to { available:false } when no embedding
 * provider is configured.
 */
export async function scoreTopologyRun(
  rows: { intent?: string; predicted?: string[]; reference?: string[] }[],
): Promise<
  | { available: true; perIntent: TopologyIntentScore[]; aggregate: TopologyAggregate }
  | { available: false; reason: string }
> {
  const labels = [...new Set(rows.flatMap((r) => [...(r.predicted ?? []), ...(r.reference ?? [])]).map((l) => l.trim()).filter(Boolean))];
  if (labels.length === 0) return { available: false, reason: 'no labels to score' };
  let vectors: Map<string, number[]>;
  try {
    const svc = getEmbeddingService();
    const embs = await svc.generateEmbeddings(labels.map((l) => l.replace(/[-_]/g, ' ')));
    if (embs.some((e) => !Array.isArray(e.embedding) || e.embedding.length === 0)) {
      return { available: false, reason: 'embedding provider returned empty vectors' };
    }
    vectors = new Map(labels.map((l, i) => [l, embs[i].embedding]));
  } catch (e) {
    return { available: false, reason: e instanceof Error ? e.message : 'embedding provider unavailable' };
  }
  const graphSubsumes = await buildGraphSubsumptionOracle();
  const rel: RelationFn = (a, b) => {
    const va = vectors.get(a.trim()); const vb = vectors.get(b.trim());
    return { sim: va && vb ? cosine(va, vb) : 0, graphSubsumes: graphSubsumes(a, b) };
  };
  const perIntent = rows.map((r) =>
    classifyProjection(r.intent ?? '', Array.isArray(r.predicted) ? r.predicted : [], Array.isArray(r.reference) ? r.reference : [], rel),
  );
  return { available: true, perIntent, aggregate: topologyAggregate(perIntent) };
}
