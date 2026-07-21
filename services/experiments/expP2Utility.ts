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

export type ExpP2Arm = 'cold' | 'discovered';

export interface ExpP2Task {
  id: string;
  prompt: string;
  rubric: string;
}

export function expP2Config(): { domain: string; tasks: ExpP2Task[] } {
  return { domain: DEFAULT_DOMAIN, tasks: config.tasks as ExpP2Task[] };
}

export interface LibraryInvariant {
  marker: string;
  statement: string;
}

/**
 * The library under test = the DISCOVERED domain invariants, promoted to
 * `proposed` (never presupposed canon — inv.reasoning.337/340). Fetched through
 * the same grounding seam production reasoning uses, so the experiment measures
 * the real substrate, not a bespoke copy.
 */
export async function fetchDiscoveredLibrary(domain: string = DEFAULT_DOMAIN): Promise<LibraryInvariant[]> {
  const slice = await buildInvariantSlice({ domains: [domain], statuses: ['proposed'], limit: 40 });
  return slice.items.map((it, i) => ({ marker: `[FS-${i + 1}]`, statement: it.statement }));
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
): Promise<ExpP2AnswerResult> {
  const task = (config.tasks as ExpP2Task[])[taskIndex];
  if (!task) throw new Error(`unknown task index ${taskIndex}`);

  let user = task.prompt;
  let libraryCount = 0;
  if (arm === 'discovered') {
    const lib = await fetchDiscoveredLibrary();
    if (lib.length === 0) {
      throw new Error(
        'discovered FS invariant library is empty — promote some discovered financial-services invariants (they land as `proposed`) before running the discovered arm.',
      );
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

/** Aggregate an accumulated set of judged results into per-arm means + delta. */
export interface ExpP2Aggregate {
  coldMean: number | null;
  discoveredMean: number | null;
  delta: number | null; // discovered − cold
  perArmCounts: { cold: number; discovered: number };
}

export function expP2Aggregate(
  judged: { arm: ExpP2Arm; score: number }[],
): ExpP2Aggregate {
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const cold = judged.filter((j) => j.arm === 'cold').map((j) => j.score);
  const disc = judged.filter((j) => j.arm === 'discovered').map((j) => j.score);
  const coldMean = mean(cold);
  const discoveredMean = mean(disc);
  return {
    coldMean,
    discoveredMean,
    delta: coldMean !== null && discoveredMean !== null ? Number((discoveredMean - coldMean).toFixed(2)) : null,
    perArmCounts: { cold: cold.length, discovered: disc.length },
  };
}
