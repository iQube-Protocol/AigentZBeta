/**
 * EXP-006A — topology / abstraction-aware projection scoring (Aletheon 2026-07-20).
 *
 * EXP-006's exact-set metric plateaus because the sovereign router projects
 * invariants ONE ABSTRACTION LEVEL HIGHER than the flat CIRS reference:
 *   intent "authenticated delegation API" → router {authentication, delegation,
 *   security} SUBSUMES reference {token-validation, scope-limitation, secure-
 *   access, ...}. Exact scoring reads that as F1=0.0; it is not a projection
 *   failure, it is an abstraction/vocabulary mismatch. EXP-006A reclassifies each
 *   disagreement instead of counting it binary, and scores CAUSAL agreement, not
 *   lexical agreement:
 *
 *   vocabulary  — folds under canonical normalization (accessibility≈accessible)
 *   abstraction — predicted is in the same causal family as a reference item but
 *                 at a different level (authentication ↔ secure-access)
 *   omission    — reference item with no predicted relation (a genuine gap)
 *   redundant   — predicted item with no reference relation
 *
 * Projection Fidelity is a COMPOSITE (structural + causal coverage + minimality),
 * so a low lexical F1 can coexist with a high causal-agreement score — the point
 * of EXP-006A. The abstraction/omission split needs a "same family" signal; v1
 * uses embedding cosine (the graph-based version, using the Compare `specializes`
 * edges, is the documented successor once CIRS labels are registry nodes).
 *
 * The CLASSIFIER is pure (takes a similarity function) so it is canary-testable
 * without a provider; the async runner supplies embeddings.
 */

import { canonicalizeLabel } from '@/services/experiments/gradedProjectionScore';
import { getEmbeddingService } from '@/services/content/embeddingService';

/** Cosine ≥ MATCH → same invariant (recovered); [FAMILY, MATCH) → same family,
 *  different level (abstraction delta); < FAMILY → unrelated. */
export const MATCH_THRESHOLD = 0.82;
export const FAMILY_THRESHOLD = 0.62;

export interface AbstractionPair { predicted: string; reference: string; similarity: number }

export interface TopologyIntentScore {
  intent: string;
  lexicalMatches: number;      // exact / normalized (the old metric's overlap)
  semanticMatches: number;     // additional, cosine ≥ MATCH
  abstractionPairs: AbstractionPair[]; // same family, different level
  omissions: string[];         // reference items genuinely absent
  redundancies: string[];      // predicted items unrelated to the reference
  structural: number;          // lexical recall
  causalCoverage: number;      // (full + ½·abstraction) / |reference|
  minimality: number;          // on-target predictions / |predicted|
  projectionFidelity: number;  // composite
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Classify one intent's projection against its reference. Pure: `sim(a,b)`
 * returns a similarity in [0,1] (cosine in the async path; synthetic in tests).
 * Greedy one-to-one matching: canonical (lexical) first, then best-cosine.
 */
export function classifyProjection(
  intent: string,
  predicted: string[],
  reference: string[],
  sim: (a: string, b: string) => number,
): TopologyIntentScore {
  const pred = predicted.map((l) => ({ label: l, canon: canonicalizeLabel(l), used: false }));
  const ref = reference.map((l) => ({ label: l, canon: canonicalizeLabel(l), matched: false }));

  // 1. Lexical (exact / normalized) — canonical-label equality.
  let lexicalMatches = 0;
  for (const r of ref) {
    const p = pred.find((p) => !p.used && p.canon === r.canon);
    if (p) { p.used = true; r.matched = true; lexicalMatches += 1; }
  }

  // 2. Semantic / abstraction — best available predicted per remaining reference.
  let semanticMatches = 0;
  const abstractionPairs: AbstractionPair[] = [];
  for (const r of ref) {
    if (r.matched) continue;
    let best: { p: typeof pred[number]; s: number } | null = null;
    for (const p of pred) {
      if (p.used) continue;
      const s = sim(p.label, r.label);
      if (!best || s > best.s) best = { p, s };
    }
    if (!best) continue;
    if (best.s >= MATCH_THRESHOLD) {
      best.p.used = true; r.matched = true; semanticMatches += 1;
    } else if (best.s >= FAMILY_THRESHOLD) {
      best.p.used = true; r.matched = true;
      abstractionPairs.push({ predicted: best.p.label, reference: r.label, similarity: Number(best.s.toFixed(3)) });
    }
    // else: leave r unmatched → omission
  }

  const omissions = ref.filter((r) => !r.matched).map((r) => r.label);
  const redundancies = pred.filter((p) => !p.used).map((p) => p.label);

  const refN = reference.length || 1;
  const predN = predicted.length || 1;
  const full = lexicalMatches + semanticMatches;
  const structural = clamp01(lexicalMatches / refN);
  const causalCoverage = clamp01((full + 0.5 * abstractionPairs.length) / refN);
  const minimality = clamp01((full + abstractionPairs.length) / predN);
  // Composite — weight causal coverage highest (EXP-006A's whole point), keep the
  // lexical floor honest, and reward minimal sufficient projections.
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
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function topologyAggregate(scores: TopologyIntentScore[]): TopologyAggregate {
  return {
    intentCount: scores.length,
    meanStructural: mean(scores.map((s) => s.structural)),
    meanCausalCoverage: mean(scores.map((s) => s.causalCoverage)),
    meanMinimality: mean(scores.map((s) => s.minimality)),
    meanProjectionFidelity: mean(scores.map((s) => s.projectionFidelity)),
    deltaClasses: {
      abstraction: scores.reduce((a, s) => a + s.abstractionPairs.length, 0),
      omission: scores.reduce((a, s) => a + s.omissions.length, 0),
      redundant: scores.reduce((a, s) => a + s.redundancies.length, 0),
    },
  };
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/**
 * Score a whole EXP-006 run with topology awareness. Embeds every distinct label
 * once, builds the similarity function, and classifies each intent. Degrades to
 * { available:false } (never a fabricated score) when no embedding provider is
 * configured — mirroring the semantic baseline arm.
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
  const sim = (a: string, b: string) => {
    const va = vectors.get(a.trim()); const vb = vectors.get(b.trim());
    return va && vb ? cosine(va, vb) : 0;
  };
  const perIntent = rows.map((r) =>
    classifyProjection(r.intent ?? '', Array.isArray(r.predicted) ? r.predicted : [], Array.isArray(r.reference) ? r.reference : [], sim),
  );
  return { available: true, perIntent, aggregate: topologyAggregate(perIntent) };
}
