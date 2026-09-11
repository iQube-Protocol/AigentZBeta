/**
 * EXP-006 graded projection scorer (Aletheon 2026-07-20 instrument-calibration).
 *
 * The Stage-A scorer (`projectionFidelity`) matches on EXACT normalised labels,
 * so morphological / separator variants score as ZERO overlap AND get
 * double-counted as both a missing AND a redundant delta:
 *   accessibility / accessible · data-collection / data_collection ·
 *   root-cause / root_cause · transparency / transparent · engaging / engagement
 * That understates the sovereign arm — a measurement defect, not a projection
 * failure. This module adds a GRADED scorer that reports fidelity at rising
 * tiers of tolerance and keeps only the GENUINE deltas:
 *
 *   exact       — identical normalised label (the raw Stage-A baseline, unchanged)
 *   normalized  — separator-folded + lightly stemmed (accessibility ≈ accessible)
 *
 * The exact tier is preserved verbatim so the published Stage-A baseline is never
 * overwritten — the graded tiers RIDE ALONGSIDE it. A semantic-equivalence tier
 * (embedding cosine) and a subsumption tier (higher-order invariant subsumes
 * several operational refinements — e.g. `security` ⊇ secure-access + token-
 * validation) are the documented next step: subsumption needs the reference
 * encoded as a hierarchy, which the flat CIRS is not yet.
 *
 * Pure + deterministic — no provider, no clock.
 */

import { normalizeLabel } from '@/services/experiments/irlExp001';

export interface TierFidelity {
  overlap: number;
  predictedCount: number;
  referenceCount: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface GradedIntentScore {
  intent: string;
  exact: TierFidelity;
  normalized: TierFidelity;
  /** Reference labels still unmatched at the NORMALIZED tier — genuine gaps. */
  genuineMissing: string[];
  /** Predicted labels still unmatched at the NORMALIZED tier — genuine extras. */
  genuineRedundant: string[];
}

// ── Canonical normalization (separator folding + light morphological stem) ────

// Ordered longest-first; one suffix stripped per word, stem kept ≥ 3 chars, then
// a single trailing 'e' folded. Heuristic (not a full stemmer) — deliberately
// conservative, tuned to fold the observed quality-label variants without merging
// distinct concepts. It RAISES a distorted lower bound; it is not final truth.
const SUFFIXES = [
  'ibility', 'ability', 'ization', 'isation', 'iveness', 'ousness', 'fulness',
  'ations', 'itions', 'ation', 'ition', 'ment', 'ness', 'ency', 'ancy', 'ence',
  'ance', 'ing', 'ity', 'ent', 'ive', 'ous', 'ful', 'able', 'ible', 'ed', 'es',
  'al', 'ly', 'cy', 's', 'y',
];

function stemWord(w: string): string {
  for (const suf of SUFFIXES) {
    if (w.length - suf.length >= 3 && w.endsWith(suf)) {
      const stem = w.slice(0, w.length - suf.length);
      return stem.length >= 4 && stem.endsWith('e') ? stem.slice(0, -1) : stem;
    }
  }
  return w.length >= 5 && w.endsWith('e') ? w.slice(0, -1) : w;
}

/** Fold a label to its canonical form: unify separators (space/hyphen/underscore),
 *  stem each word, sort the word-set so order doesn't matter. */
export function canonicalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .split(/[\s\-_]+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean)
    .map(stemWord)
    .sort()
    .join('-');
}

// ── Tiered fidelity ──────────────────────────────────────────────────────────

function fidelityFromMatch(predKeys: string[], refKeys: string[]): TierFidelity {
  const P = new Set(predKeys.filter(Boolean));
  const R = new Set(refKeys.filter(Boolean));
  let overlap = 0;
  for (const x of P) if (R.has(x)) overlap += 1;
  const precision = P.size ? overlap / P.size : 0;
  const recall = R.size ? overlap / R.size : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { overlap, predictedCount: P.size, referenceCount: R.size, precision, recall, f1 };
}

/**
 * Score one intent at the exact and normalized tiers, returning the genuine
 * (still-unmatched-after-normalization) deltas. The exact tier uses the SAME
 * `normalizeLabel` as the raw Stage-A scorer, so it reproduces the baseline.
 */
export function gradedIntentScore(intent: string, predicted: string[], reference: string[]): GradedIntentScore {
  const exact = fidelityFromMatch(predicted.map(normalizeLabel), reference.map(normalizeLabel));

  const predCanon = predicted.map((l) => ({ label: l, key: canonicalizeLabel(l) }));
  const refCanon = reference.map((l) => ({ label: l, key: canonicalizeLabel(l) }));
  const normalized = fidelityFromMatch(predCanon.map((x) => x.key), refCanon.map((x) => x.key));

  const predKeys = new Set(predCanon.map((x) => x.key));
  const refKeys = new Set(refCanon.map((x) => x.key));
  // Dedup by original label, exclude anything matched at the normalized tier.
  const genuineMissing = [...new Map(refCanon.filter((x) => !predKeys.has(x.key)).map((x) => [x.label, x.label])).keys()];
  const genuineRedundant = [...new Map(predCanon.filter((x) => !refKeys.has(x.key)).map((x) => [x.label, x.label])).keys()];

  return { intent, exact, normalized, genuineMissing, genuineRedundant };
}

export interface GradedAggregate {
  intentCount: number;
  exact: { meanPrecision: number; meanRecall: number; meanF1: number };
  normalized: { meanPrecision: number; meanRecall: number; meanF1: number };
  genuineMissingCount: number;
  genuineRedundantCount: number;
}

function mean(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }

export function gradedAggregate(scores: GradedIntentScore[]): GradedAggregate {
  return {
    intentCount: scores.length,
    exact: {
      meanPrecision: mean(scores.map((s) => s.exact.precision)),
      meanRecall: mean(scores.map((s) => s.exact.recall)),
      meanF1: mean(scores.map((s) => s.exact.f1)),
    },
    normalized: {
      meanPrecision: mean(scores.map((s) => s.normalized.precision)),
      meanRecall: mean(scores.map((s) => s.normalized.recall)),
      meanF1: mean(scores.map((s) => s.normalized.f1)),
    },
    genuineMissingCount: scores.reduce((a, s) => a + s.genuineMissing.length, 0),
    genuineRedundantCount: scores.reduce((a, s) => a + s.genuineRedundant.length, 0),
  };
}

/** Score a whole EXP-006 result (rows of predicted/reference label sets). */
export function gradeProjectionRun(
  rows: { intent?: string; predicted?: string[]; reference?: string[] }[],
): { perIntent: GradedIntentScore[]; aggregate: GradedAggregate } {
  const perIntent = rows.map((r) =>
    gradedIntentScore(r.intent ?? '', Array.isArray(r.predicted) ? r.predicted : [], Array.isArray(r.reference) ? r.reference : []),
  );
  return { perIntent, aggregate: gradedAggregate(perIntent) };
}
