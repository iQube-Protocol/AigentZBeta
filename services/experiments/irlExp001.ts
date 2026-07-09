/**
 * IRL-EXP-001 — Intent → Invariant Projection Fidelity (CRP-002 / metaMe IRL).
 *
 * Stage A (this module, first runnable slice): for each CIRS-v0.1 intent, predict
 * the minimal invariant set the intent projects onto, score it against the CIRS
 * reference (overlap / precision / recall / f1), and classify every disagreement
 * as an Invariant Delta. The score is the EXPLICIT objective; the classified
 * deltas are the HIDDEN objective — the first-class data the emergent WP0 (Option
 * 1A) synthesises into what an invariant actually is.
 *
 * Division of concern:
 *   - The SCORING + delta classification are PURE and deterministic (drillable
 *     without a provider) — the scientifically load-bearing core.
 *   - The PREDICTION step routes through `callSovereign` (invariant-aware,
 *     sovereign inference) — the experiment uses the platform's own reasoning.
 *
 * Honest limits (stated, never masked):
 *   - Matching is EXACT-STRING on normalised labels — synonyms/abstraction-level
 *     differences understate true overlap. Semantic matching is a named follow-on.
 *   - The structural classifier assigns only `missing-invariant` /
 *     `redundant-invariant`. The five richer classes (incorrect-abstraction-
 *     level, ontological-conflict, domain-specific-specialization, projection-
 *     error, ambiguous-intent) require a semantic judge (LLM/human) — a Stage-A.5
 *     follow-on. This is by design: the structural deltas accumulate first.
 *   - Stage B (does the predicted set REASON better?) is a separate increment.
 *
 * Server-only (the prediction step calls a provider).
 */

import { callSovereign } from '@/services/constitutional/modelRouter';
import type { CanonicalInvariantReference, InvariantDelta, InvariantDeltaClass } from '@/types/invariantIntelligence';
import { CIRS_V0_1, CIRS_VERSION } from '@/services/experiments/cirs';

// ─── Pure scoring core (deterministic — no provider, no clock) ───────────────

/** Normalise a label for set comparison: lowercase, trimmed, inner space→dash. */
export function normalizeLabel(label: string): string {
  return label.toLowerCase().trim().replace(/\s+/g, '-');
}

export interface ProjectionFidelity {
  /** |predicted ∩ reference| on normalised labels. */
  overlap: number;
  predictedCount: number;
  referenceCount: number;
  /** overlap / |predicted| — of what we predicted, how much was right. */
  precision: number;
  /** overlap / |reference| — of the reference, how much we recovered. */
  recall: number;
  f1: number;
}

/** Projection fidelity of a predicted invariant set against a reference set. Pure. */
export function projectionFidelity(predicted: string[], reference: string[]): ProjectionFidelity {
  const P = new Set(predicted.map(normalizeLabel).filter(Boolean));
  const R = new Set(reference.map(normalizeLabel).filter(Boolean));
  let overlap = 0;
  for (const x of P) if (R.has(x)) overlap += 1;
  const precision = P.size ? overlap / P.size : 0;
  const recall = R.size ? overlap / R.size : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { overlap, predictedCount: P.size, referenceCount: R.size, precision, recall, f1 };
}

/**
 * Classify the STRUCTURAL disagreements between a prediction and the reference.
 * A reference item not predicted → `missing-invariant`; a predicted item not in
 * the reference → `redundant-invariant`. The richer classes are a semantic-judge
 * follow-on (see honest limits). Deterministic; order-stable (reference misses
 * first, then redundant predictions, each sorted).
 */
export function classifyStructuralDeltas(
  intent: string,
  predicted: string[],
  reference: string[],
): InvariantDelta[] {
  const P = new Set(predicted.map(normalizeLabel).filter(Boolean));
  const R = new Set(reference.map(normalizeLabel).filter(Boolean));
  const predictedList = [...P];
  const referenceList = [...R];
  const deltas: InvariantDelta[] = [];
  const push = (item: string, classification: InvariantDeltaClass) =>
    deltas.push({ intent, predicted: predictedList, reference: referenceList, difference: [item], classification });
  for (const r of referenceList.sort()) if (!P.has(r)) push(r, 'missing-invariant');
  for (const p of predictedList.sort()) if (!R.has(p)) push(p, 'redundant-invariant');
  return deltas;
}

// ─── The prediction step (sovereign, invariant-aware inference) ──────────────

/**
 * Predict the minimal invariant set an intent projects onto. Routes through
 * callSovereign (the ModelQube-governed, sovereign-floored router), so the
 * experiment uses the platform's own invariant-aware reasoning. Returns short
 * lowercase principle labels; the model MAY propose labels outside the candidate
 * vocabulary (those surface as deltas / CIRS-mutation candidates — the point).
 */
export async function predictInvariantsForIntent(
  intent: string,
  maxTokens = 300,
): Promise<string[]> {
  const system =
    'You project an INTENT onto the MINIMAL set of governing INVARIANTS (principles) it ' +
    'requires — not the documents that are relevant, the PRINCIPLES. Return ONLY a JSON ' +
    'array of short lowercase principle labels (1-2 words each). Be minimal: include only ' +
    'what the intent genuinely requires. No commentary.';
  const user = `Intent: ${intent}`;
  const result = await callSovereign('classification', system, user, maxTokens, 0);
  return parsePredictedLabels(result.text);
}

/** Parse a model completion into a clean label list (lenient — array or lines). */
export function parsePredictedLabels(text: string): string[] {
  // Prefer a JSON array anywhere in the completion (tolerating fences/prose).
  const match = text.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const arr = JSON.parse(match[0]);
      if (Array.isArray(arr) && arr.length) {
        return arr.map((x) => String(x).trim()).filter(Boolean);
      }
    } catch {
      /* fall through to line parsing */
    }
  }
  // Fallback: split on commas / newlines, strip bullets/quotes/brackets.
  return text
    .replace(/[[\]"']/g, '')
    .split(/[,\n]/)
    .map((s) => s.replace(/^[-*\d.\s]+/, '').trim())
    .filter((s) => s.length > 0 && s.length < 40);
}

// ─── Stage A orchestrator ────────────────────────────────────────────────────

export interface IrlExp001IntentResult {
  intent: string;
  predicted: string[];
  reference: string[];
  fidelity: ProjectionFidelity;
  deltas: InvariantDelta[];
}

export interface IrlExp001Aggregate {
  cirsVersion: string;
  intentCount: number;
  meanPrecision: number;
  meanRecall: number;
  meanF1: number;
  /** Count of each Invariant Delta class across all intents (research data). */
  deltaCounts: Partial<Record<InvariantDeltaClass, number>>;
}

/** Aggregate per-intent results into the Stage A summary. Pure. */
export function aggregateStageA(results: IrlExp001IntentResult[], cirsVersion: string): IrlExp001Aggregate {
  const n = results.length || 1;
  const sum = (f: (r: IrlExp001IntentResult) => number) => results.reduce((a, r) => a + f(r), 0);
  const deltaCounts: Partial<Record<InvariantDeltaClass, number>> = {};
  for (const r of results) {
    for (const d of r.deltas) deltaCounts[d.classification] = (deltaCounts[d.classification] ?? 0) + 1;
  }
  return {
    cirsVersion,
    intentCount: results.length,
    meanPrecision: sum((r) => r.fidelity.precision) / n,
    meanRecall: sum((r) => r.fidelity.recall) / n,
    meanF1: sum((r) => r.fidelity.f1) / n,
    deltaCounts,
  };
}

/**
 * Run IRL-EXP-001 Stage A over a CIRS (default CIRS-v0.1): predict → score →
 * classify deltas → aggregate. The prediction step is the only impure part; the
 * scoring and deltas are pure. A prediction failure for one intent is recorded
 * as an empty prediction (fidelity 0, all-missing deltas), never masked.
 */
export async function runIrlExp001StageA(
  cirs: CanonicalInvariantReference[] = CIRS_V0_1,
): Promise<{ results: IrlExp001IntentResult[]; aggregate: IrlExp001Aggregate }> {
  const results: IrlExp001IntentResult[] = [];
  for (const ref of cirs) {
    let predicted: string[] = [];
    try {
      predicted = await predictInvariantsForIntent(ref.intent);
    } catch {
      predicted = []; // honest: a failed prediction is 0 fidelity, not a skip
    }
    results.push({
      intent: ref.intent,
      predicted,
      reference: ref.candidateInvariants,
      fidelity: projectionFidelity(predicted, ref.candidateInvariants),
      deltas: classifyStructuralDeltas(ref.intent, predicted, ref.candidateInvariants),
    });
  }
  return { results, aggregate: aggregateStageA(results, cirs[0]?.version ?? CIRS_VERSION) };
}
