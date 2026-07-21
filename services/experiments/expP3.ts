/**
 * EXP-P3 / D1 — Capability Validation (Consequence Engineering by field projection).
 *
 * Two arms answer ONE held-out change-set of ≥20 changes whose actually-affected
 * invariant set is ground-truthed and SEALED before any forecast:
 *   - FIELD arm     — project the change into the invariant field and read the
 *                     reachable affected set (forecastConsequences — the live
 *                     Phase-0 forecaster, already in production).
 *   - BASELINE arm  — predict the affected set by similarity/keyword retrieval
 *                     over the flattened canonical corpus, at MATCHED budget
 *                     (top-K where K = |field prediction| — a fair set-size cap).
 * Each arm's predicted set is scored precision / recall / F1 against the sealed
 * ground truth. The hypothesis is supported only if the field arm materially
 * beats the baseline on mean F1.
 *
 * HONEST CONTRACT (CLAUDE.md epistemic honesty): this harness NEVER fabricates
 * ground truth. It runs only against a sealed change-set the operator/researcher
 * authors (services/experiments/exp-p3-changeset.json, `sealed: true`). With no
 * sealed cases it reports "awaiting dataset" and refuses to emit numbers — a run
 * against nothing would be measuring nothing.
 */

import { forecastConsequences } from '@/services/consequence/stages';
import { listInvariants } from '@/services/invariants/store';

export interface ChangeCase {
  /** Stable case id (e.g. 'chg-001'). */
  id: string;
  /** Free-text description of the change under test. */
  changeText: string;
  /** The invariant id(s) the change touches — the projection locus (field arm). */
  seedInvariantIds: string[];
  /** SEALED ground truth: the invariant ids actually affected by the change. */
  groundTruthAffectedIds: string[];
}

export interface ChangeSetFile {
  sealed: boolean;
  note?: string;
  cases: ChangeCase[];
}

export interface ArmScore {
  predicted: string[];
  precision: number;
  recall: number;
  f1: number;
}
export interface ChangeResult {
  id: string;
  field: ArmScore;
  baseline: ArmScore;
}
export interface ExpP3Aggregate {
  cases: number;
  fieldMeanF1: number;
  fieldMeanPrecision: number;
  fieldMeanRecall: number;
  baselineMeanF1: number;
  baselineMeanPrecision: number;
  baselineMeanRecall: number;
  /** field mean F1 − baseline mean F1 (the headline delta). */
  f1Delta: number;
}

function scoreSet(predicted: string[], truth: string[]): ArmScore {
  const P = new Set(predicted);
  const T = new Set(truth);
  const tp = [...P].filter((x) => T.has(x)).length;
  const precision = P.size ? tp / P.size : 0;
  const recall = T.size ? tp / T.size : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return { predicted, precision, recall, f1 };
}

function termSet(s: string): Set<string> {
  return new Set((s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []));
}
function overlapCount(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Run both arms over a sealed change-set. Pure w.r.t. the input cases; the
 * corpus + field forecaster are read from the live substrate.
 */
export async function runExpP3(cases: ChangeCase[]): Promise<{ results: ChangeResult[]; aggregate: ExpP3Aggregate }> {
  // Baseline corpus: the flattened canonical invariant statements.
  const corpus = await listInvariants({ status: 'canonical', limit: 500 });
  const corpusTerms = corpus.map((inv) => ({ id: String(inv.id), terms: termSet(inv.statement) }));

  const results: ChangeResult[] = [];
  for (const c of cases) {
    // FIELD arm — reachable affected set from the change's locus.
    const forecast = await forecastConsequences(c.seedInvariantIds);
    const fieldPredicted = forecast.nodes.map((n) => n.invariantId);

    // BASELINE arm — matched-budget keyword retrieval (K = |field prediction|,
    // min 1), excluding the seed ids themselves (both arms predict NEW effects).
    const K = Math.max(fieldPredicted.length, 1);
    const seedSet = new Set(c.seedInvariantIds);
    const changeTerms = termSet(c.changeText);
    const baselinePredicted = corpusTerms
      .filter((x) => !seedSet.has(x.id))
      .map((x) => ({ id: x.id, score: overlapCount(changeTerms, x.terms) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, K)
      .map((x) => x.id);

    results.push({
      id: c.id,
      field: scoreSet(fieldPredicted, c.groundTruthAffectedIds),
      baseline: scoreSet(baselinePredicted, c.groundTruthAffectedIds),
    });
  }

  const aggregate: ExpP3Aggregate = {
    cases: results.length,
    fieldMeanF1: mean(results.map((r) => r.field.f1)),
    fieldMeanPrecision: mean(results.map((r) => r.field.precision)),
    fieldMeanRecall: mean(results.map((r) => r.field.recall)),
    baselineMeanF1: mean(results.map((r) => r.baseline.f1)),
    baselineMeanPrecision: mean(results.map((r) => r.baseline.precision)),
    baselineMeanRecall: mean(results.map((r) => r.baseline.recall)),
    f1Delta: mean(results.map((r) => r.field.f1)) - mean(results.map((r) => r.baseline.f1)),
  };
  return { results, aggregate };
}
