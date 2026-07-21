/**
 * EXP-006 baseline comparator arms (Aletheon 2026-07-20: "43% compared to
 * what?"). The sovereign invariant-aware router is the system under test; a
 * fidelity number is only interpretable against a floor. This module adds three
 * comparator arms that predict an invariant set for each CIRS intent WITHOUT the
 * platform's reasoning, scored against the SAME reference by the same pure
 * `projectionFidelity`:
 *
 *   - random   — chance floor. k labels drawn uniformly from the field vocabulary,
 *                averaged over many seeded draws (deterministic, reproducible).
 *   - keyword  — naive lexical IR. Rank vocab labels by token overlap with the
 *                intent, take the top k. Pure, no provider.
 *   - semantic — embedding retrieval. Rank vocab labels by cosine similarity to
 *                the intent embedding, take the top k. Degrades gracefully to
 *                {available:false} when no embedding provider is configured.
 *
 * FAIR PROTOCOL: every arm predicts exactly k = |reference| labels drawn from the
 * SHARED field vocabulary (the union of all intents' reference labels) — no arm
 * sees which subset of the vocabulary belongs to the current intent. Predicting
 * exactly k isolates ranking quality: precision == recall for the baselines, so
 * a single number per arm is directly comparable to the sovereign arm's recall.
 * The human baseline (Aletheon's fourth comparator) is intentionally NOT here —
 * it requires a manual annotation pass and is a separate, honest follow-on.
 *
 * Server-only (the semantic arm calls an embedding provider).
 */

import type { CanonicalInvariantReference } from '@/types/invariantIntelligence';
import { normalizeLabel, projectionFidelity } from '@/services/experiments/irlExp001';
import { getEmbeddingService } from '@/services/content/embeddingService';

export type BaselineArmId = 'random' | 'keyword' | 'semantic';

export interface BaselineIntentResult {
  intent: string;
  predicted: string[];
  precision: number;
  recall: number;
  f1: number;
}

export interface BaselineArm {
  arm: BaselineArmId;
  /** false when the arm could not run (e.g. no embedding provider) — never faked. */
  available: boolean;
  reason?: string;
  meanPrecision: number;
  meanRecall: number;
  meanF1: number;
  perIntent: BaselineIntentResult[];
}

export interface BaselineComparison {
  /** The field vocabulary size (shared candidate pool) — context for the floor. */
  vocabularySize: number;
  random: BaselineArm;
  keyword: BaselineArm;
  semantic: BaselineArm;
}

// ─── Field vocabulary (the shared candidate pool) ────────────────────────────

/** Union of all normalised reference labels across intents — the field's
 *  invariant vocabulary. Every baseline draws only from here. */
export function buildFieldVocabulary(cirs: CanonicalInvariantReference[]): string[] {
  const set = new Set<string>();
  for (const ref of cirs) for (const label of ref.candidateInvariants) {
    const n = normalizeLabel(label);
    if (n) set.add(n);
  }
  return [...set].sort();
}

// ─── Deterministic PRNG (reproducible random baseline) ───────────────────────

/** mulberry32 — small, fast, seedable. Avoids Math.random so a random-arm run is
 *  reproducible (a science baseline must be stable across runs). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** k distinct items sampled uniformly without replacement (Fisher–Yates prefix). */
function sampleK<T>(items: T[], k: number, rand: () => number): T[] {
  const arr = items.slice();
  const n = arr.length;
  const take = Math.min(k, n);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(rand() * (n - i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, take);
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function summarise(arm: BaselineArmId, perIntent: BaselineIntentResult[], available = true, reason?: string): BaselineArm {
  return {
    arm,
    available,
    reason,
    meanPrecision: mean(perIntent.map((r) => r.precision)),
    meanRecall: mean(perIntent.map((r) => r.recall)),
    meanF1: mean(perIntent.map((r) => r.f1)),
    perIntent,
  };
}

// ─── Random arm (chance floor) ───────────────────────────────────────────────

/** Average fidelity over `samples` seeded k-label draws per intent (k=|ref|). */
export function randomBaselineArm(
  cirs: CanonicalInvariantReference[],
  vocab: string[],
  samples = 25,
  seed = 0x51_5e_ed,
): BaselineArm {
  const rand = mulberry32(seed);
  const perIntent: BaselineIntentResult[] = cirs.map((ref) => {
    const k = new Set(ref.candidateInvariants.map(normalizeLabel).filter(Boolean)).size;
    const ps: number[] = [];
    const rs: number[] = [];
    const fs: number[] = [];
    let lastDraw: string[] = [];
    for (let s = 0; s < samples; s++) {
      lastDraw = sampleK(vocab, k, rand);
      const f = projectionFidelity(lastDraw, ref.candidateInvariants);
      ps.push(f.precision); rs.push(f.recall); fs.push(f.f1);
    }
    return { intent: ref.intent, predicted: lastDraw, precision: mean(ps), recall: mean(rs), f1: mean(fs) };
  });
  return summarise('random', perIntent);
}

// ─── Keyword arm (naive lexical IR) ──────────────────────────────────────────

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'for', 'in', 'on', 'with', 'by', 'at', 'as', 'is',
  'are', 'be', 'this', 'that', 'from', 'into', 'how', 'do', 'does', 'your', 'you', 'it',
]);

function tokens(text: string): Set<string> {
  return new Set(
    text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );
}

/** Rank vocab labels by shared-token count with the intent; take top k=|ref|. */
export function keywordBaselineArm(cirs: CanonicalInvariantReference[], vocab: string[]): BaselineArm {
  const vocabTokens = vocab.map((v) => ({ label: v, toks: tokens(v.replace(/-/g, ' ')) }));
  const perIntent: BaselineIntentResult[] = cirs.map((ref) => {
    const k = new Set(ref.candidateInvariants.map(normalizeLabel).filter(Boolean)).size;
    const iTok = tokens(ref.intent);
    const scored = vocabTokens.map((v, idx) => {
      let overlap = 0;
      for (const t of v.toks) if (iTok.has(t)) overlap += 1;
      return { label: v.label, score: overlap, idx };
    });
    // Stable: score desc, then original vocab order (idx asc) as tie-break.
    scored.sort((a, b) => (b.score - a.score) || (a.idx - b.idx));
    const predicted = scored.slice(0, Math.min(k, vocab.length)).map((s) => s.label);
    const f = projectionFidelity(predicted, ref.candidateInvariants);
    return { intent: ref.intent, predicted, precision: f.precision, recall: f.recall, f1: f.f1 };
  });
  return summarise('keyword', perIntent);
}

// ─── Semantic arm (embedding retrieval) ──────────────────────────────────────

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/** Rank vocab labels by cosine similarity to the intent embedding; take top k.
 *  Degrades to available:false (never a fabricated score) if embeddings fail. */
export async function semanticBaselineArm(cirs: CanonicalInvariantReference[], vocab: string[]): Promise<BaselineArm> {
  if (vocab.length === 0) return summarise('semantic', [], false, 'empty vocabulary');
  try {
    const svc = getEmbeddingService();
    const vocabEmb = await svc.generateEmbeddings(vocab.map((v) => v.replace(/-/g, ' ')));
    const intentEmb = await svc.generateEmbeddings(cirs.map((r) => r.intent));
    const vectors = vocabEmb.map((e) => e.embedding);
    if (vectors.some((v) => !Array.isArray(v) || v.length === 0)) {
      return summarise('semantic', [], false, 'embedding provider returned empty vectors');
    }
    const perIntent: BaselineIntentResult[] = cirs.map((ref, i) => {
      const k = new Set(ref.candidateInvariants.map(normalizeLabel).filter(Boolean)).size;
      const q = intentEmb[i]?.embedding ?? [];
      const scored = vocab.map((label, idx) => ({ label, idx, score: cosine(q, vectors[idx]) }));
      scored.sort((a, b) => (b.score - a.score) || (a.idx - b.idx));
      const predicted = scored.slice(0, Math.min(k, vocab.length)).map((s) => s.label);
      const f = projectionFidelity(predicted, ref.candidateInvariants);
      return { intent: ref.intent, predicted, precision: f.precision, recall: f.recall, f1: f.f1 };
    });
    return summarise('semantic', perIntent);
  } catch (e) {
    return summarise('semantic', [], false, e instanceof Error ? e.message : 'embedding provider unavailable');
  }
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

/** Run all three comparator arms against the SAME CIRS the sovereign arm used. */
export async function runBaselines(cirs: CanonicalInvariantReference[]): Promise<BaselineComparison> {
  const vocab = buildFieldVocabulary(cirs);
  const semantic = await semanticBaselineArm(cirs, vocab);
  return {
    vocabularySize: vocab.length,
    random: randomBaselineArm(cirs, vocab),
    keyword: keywordBaselineArm(cirs, vocab),
    semantic,
  };
}
