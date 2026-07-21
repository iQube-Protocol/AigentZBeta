/**
 * EXP-P2 utility — the "do the discovered invariants have OPERATIONAL utility?"
 * experiment (the strongest external result behind inv.reasoning.323). Same
 * shape as EXP-003 (one LLM call per request so a full run fits Lambda; the
 * client accumulates), but the library under test is the ENGINE'S OWN OUTPUT:
 * the discovered domain invariants promoted to `proposed`, fetched live via the
 * grounding substrate seam `buildInvariantSlice`.
 *
 * Two arms per task:
 *   - cold       — the task alone (no invariant library)
 *   - discovered — the task grounded in the discovered FS invariant library
 * An INDEPENDENT, BLIND judge (no arm label, no library shown) scores each
 * answer's QUALITY against the task rubric. The utility claim is supported when
 * the discovered arm's mean score materially exceeds cold.
 *
 * A manual-baseline arm (discovered-vs-hand-authored library) is a follow-on;
 * this v1 establishes discovered-vs-cold, the necessary first comparison.
 *
 * Server-only.
 */

import { buildInvariantSlice } from '@/services/invariants/grounding';
import config from './expP2-tasks.json';
import { callChatWithUsage, callJsonWithRetry, type ExperimentProvider } from './llm';

const MAX_ANSWER_TOKENS = 1200;
const DEFAULT_DOMAIN = config.domain || 'financial-services';

// Three arms (Aletheon 2026-07-21): cold (no substrate) vs manual (expert/
// hand-authored baseline) vs discovered (the earned, recursively-compressed
// substrate). Cold isolates marginal value; manual isolates whether DISCOVERY
// beats hand-authoring; ablation (below) isolates which roots carry the load.
export type ExpP2Arm = 'cold' | 'manual' | 'discovered';

export interface ExpP2Task {
  id: string;
  prompt: string;
  rubric: string;
}

export function expP2Config(): { domain: string; tasks: ExpP2Task[]; manualBaselineCount: number } {
  return {
    domain: DEFAULT_DOMAIN,
    tasks: config.tasks as ExpP2Task[],
    manualBaselineCount: Array.isArray(config.manualBaseline) ? config.manualBaseline.length : 0,
  };
}

export interface LibraryInvariant {
  marker: string;
  statement: string;
}

/**
 * The library under test = the DISCOVERED domain invariants, promoted to
 * `proposed` (never presupposed canon — inv.reasoning.337/340). Fetched through
 * the same grounding seam production reasoning uses, so the experiment measures
 * the real substrate, not a bespoke copy. `excludeIndex` drops one invariant for
 * the ABLATION arm (drop-one-root → measure task-class degradation).
 */
export async function fetchDiscoveredLibrary(
  domain: string = DEFAULT_DOMAIN,
  excludeIndex?: number,
): Promise<LibraryInvariant[]> {
  const slice = await buildInvariantSlice({ domains: [domain], statuses: ['proposed'], limit: 40 });
  const items = slice.items.map((it, i) => ({ marker: `[FS-${i + 1}]`, statement: it.statement }));
  return typeof excludeIndex === 'number' ? items.filter((_, i) => i !== excludeIndex) : items;
}

/** The MANUAL-BASELINE library — the expert/hand-authored FS set (editable config). */
export function fetchManualLibrary(): LibraryInvariant[] {
  const base = Array.isArray(config.manualBaseline) ? (config.manualBaseline as string[]) : [];
  return base.map((statement, i) => ({ marker: `[MB-${i + 1}]`, statement }));
}

function libraryBlock(lib: LibraryInvariant[]): string {
  return [
    'You have a library of discovered governing invariants for this domain.',
    'Reason FROM these; never contradict one; cite the marker of each invariant you rely on inline (e.g. [FS-3]).',
    '',
    ...lib.map((inv) => `${inv.marker} ${inv.statement}`),
  ].join('\n');
}

const ANSWER_SYSTEM =
  'You are a financial-services systems designer. Answer rigorously and concisely in plain prose. Make every governing principle you rely on explicit and justify it.';

export interface ExpP2AnswerResult {
  taskId: string;
  arm: ExpP2Arm;
  answer: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  libraryCount: number;
}

export async function expP2AnswerStep(
  provider: ExperimentProvider,
  taskIndex: number,
  arm: ExpP2Arm,
  model?: string,
  /** ABLATION: drop the discovered invariant at this index (discovered arm only). */
  excludeIndex?: number,
): Promise<ExpP2AnswerResult & { excludedIndex?: number }> {
  const task = (config.tasks as ExpP2Task[])[taskIndex];
  if (!task) throw new Error(`unknown task index ${taskIndex}`);

  let user = task.prompt;
  let libraryCount = 0;
  if (arm === 'discovered') {
    const lib = await fetchDiscoveredLibrary(DEFAULT_DOMAIN, excludeIndex);
    if (lib.length === 0) {
      throw new Error(
        'discovered FS invariant library is empty — promote some discovered financial-services invariants (they land as `proposed`) before running the discovered arm.',
      );
    }
    libraryCount = lib.length;
    user = `${libraryBlock(lib)}\n\nTASK:\n${task.prompt}`;
  } else if (arm === 'manual') {
    const lib = fetchManualLibrary();
    if (lib.length === 0) {
      throw new Error('manual baseline library is empty — populate config.manualBaseline before running the manual arm.');
    }
    libraryCount = lib.length;
    user = `${libraryBlock(lib)}\n\nTASK:\n${task.prompt}`;
  }

  const result = await callChatWithUsage(provider, ANSWER_SYSTEM, user, MAX_ANSWER_TOKENS, model);
  return {
    taskId: task.id,
    arm,
    answer: result.text,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    model: result.model,
    libraryCount,
    ...(arm === 'discovered' && typeof excludeIndex === 'number' ? { excludedIndex: excludeIndex } : {}),
  };
}

export interface ExpP2Verdict {
  score: number; // 0..10
  justification: string;
}

/**
 * BLIND independent judge: it never learns which arm produced the answer and is
 * NOT shown the invariant library (else it would reward restatement of the
 * library rather than reasoning quality). It scores the answer against the task
 * rubric only.
 */
export async function expP2JudgeStep(
  provider: ExperimentProvider,
  taskIndex: number,
  answer: string,
  model?: string,
): Promise<ExpP2Verdict> {
  const task = (config.tasks as ExpP2Task[])[taskIndex];
  if (!task) throw new Error(`unknown task index ${taskIndex}`);
  const system =
    'You are an exacting, independent evaluator of financial-services reasoning. You will receive a TASK, a RUBRIC, ' +
    'and an ANSWER. Score the answer 0-10 for how well it identifies the GOVERNING PRINCIPLES the task requires and ' +
    'justifies them with sound reasoning (not policy/regulation name-dropping). Judge only against the rubric; do not ' +
    'reward verbosity. Respond with ONLY a JSON object: {"score": <0-10>, "justification": "one sentence"}.';
  const user = [`TASK: ${task.prompt}`, '', `RUBRIC: ${task.rubric}`, '', 'ANSWER TO EVALUATE:', answer].join('\n');
  const { value } = await callJsonWithRetry<ExpP2Verdict>(provider, system, user, 300, model);
  return {
    score: Math.max(0, Math.min(10, Number(value?.score) || 0)),
    justification: String(value?.justification ?? ''),
  };
}

/**
 * Claim-analysis metric (EXP-003 pattern) — decompose the answer into substantive
 * claims and, against a COMMON reference set = the EARNED discovered library
 * (the thing under test), classify each CONSISTENT / CONTRADICTING / OUTSIDE.
 * A common yardstick across arms makes grounded-claim-share + contradiction rate
 * comparable. (Independent of the blind quality judge above.)
 */
export interface ExpP2ClaimAnalysis {
  claimsTotal: number;
  consistent: number;
  contradicting: number;
  outside: number;
}

export async function expP2ClaimAnalysisStep(
  provider: ExperimentProvider,
  answer: string,
  model?: string,
): Promise<ExpP2ClaimAnalysis & { referenceCount: number }> {
  const reference = await fetchDiscoveredLibrary();
  const system =
    'You are an exacting evaluator. You receive a fixed list of reference invariants and an ANSWER. ' +
    'Decompose the answer into its distinct substantive claims. For each claim decide: CONSISTENT ' +
    '(entailed by or compatible with a listed invariant), CONTRADICTING (conflicts with one), or OUTSIDE ' +
    '(neither supported nor contradicted). Respond with ONLY JSON: ' +
    '{"claimsTotal": n, "consistent": n, "contradicting": n, "outside": n}';
  const user = [
    'REFERENCE INVARIANTS:',
    ...reference.map((inv) => `${inv.marker} ${inv.statement}`),
    '',
    'ANSWER TO EVALUATE:',
    answer,
  ].join('\n');
  const { value } = await callJsonWithRetry<ExpP2ClaimAnalysis>(provider, system, user, 400, model);
  const consistent = Math.max(0, Number(value?.consistent) || 0);
  const contradicting = Math.max(0, Number(value?.contradicting) || 0);
  const outside = Math.max(0, Number(value?.outside) || 0);
  return {
    claimsTotal: Math.max(consistent + contradicting + outside, Number(value?.claimsTotal) || 0),
    consistent,
    contradicting,
    outside,
    referenceCount: reference.length,
  };
}

/** Mechanical citation count — distinct library markers the answer cites (no model). */
export function expP2CountCitations(answer: string, library: LibraryInvariant[]): { totalCitations: number; distinctCited: number } {
  let total = 0;
  const seen = new Set<string>();
  for (const inv of library) {
    const hits = answer.split(inv.marker).length - 1;
    if (hits > 0) seen.add(inv.marker);
    total += hits;
  }
  return { totalCitations: total, distinctCited: seen.size };
}

/** Aggregate judged results across the THREE arms → per-arm means + the two deltas. */
export interface ExpP2Aggregate {
  coldMean: number | null;
  manualMean: number | null;
  discoveredMean: number | null;
  deltaVsCold: number | null; // discovered − cold  (does curation help at all?)
  deltaVsManual: number | null; // discovered − manual (does DISCOVERY beat hand-authoring?)
  perArmCounts: { cold: number; manual: number; discovered: number };
}

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}
const round2 = (n: number) => Number(n.toFixed(2));

export function expP2Aggregate(judged: { arm: ExpP2Arm; score: number }[]): ExpP2Aggregate {
  const cold = judged.filter((j) => j.arm === 'cold').map((j) => j.score);
  const manual = judged.filter((j) => j.arm === 'manual').map((j) => j.score);
  const disc = judged.filter((j) => j.arm === 'discovered').map((j) => j.score);
  const coldMean = mean(cold);
  const manualMean = mean(manual);
  const discoveredMean = mean(disc);
  return {
    coldMean,
    manualMean,
    discoveredMean,
    deltaVsCold: coldMean !== null && discoveredMean !== null ? round2(discoveredMean - coldMean) : null,
    deltaVsManual: manualMean !== null && discoveredMean !== null ? round2(discoveredMean - manualMean) : null,
    perArmCounts: { cold: cold.length, manual: manual.length, discovered: disc.length },
  };
}

/**
 * ABLATION aggregate — for each dropped-root index, the mean full-discovered score
 * vs the mean ablated score. A NEGATIVE delta (ablated < full) means removing that
 * root degraded reasoning → the root is causally LOAD-BEARING, not merely recurrent.
 */
export interface ExpP2AblationRow {
  excludedIndex: number;
  fullMean: number | null;
  ablatedMean: number | null;
  degradation: number | null; // fullMean − ablatedMean (positive ⇒ load-bearing)
}

export function expP2AblationAggregate(
  fullDiscovered: { score: number }[],
  ablated: { excludedIndex: number; score: number }[],
): ExpP2AblationRow[] {
  const fullMean = mean(fullDiscovered.map((r) => r.score));
  const byIndex = new Map<number, number[]>();
  for (const a of ablated) {
    const arr = byIndex.get(a.excludedIndex) ?? [];
    arr.push(a.score);
    byIndex.set(a.excludedIndex, arr);
  }
  return [...byIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([excludedIndex, scores]) => {
      const ablatedMean = mean(scores);
      return {
        excludedIndex,
        fullMean,
        ablatedMean,
        degradation: fullMean !== null && ablatedMean !== null ? round2(fullMean - ablatedMean) : null,
      };
    });
}
