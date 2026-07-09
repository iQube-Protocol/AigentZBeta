/**
 * EXP-005 — the Provider-Choice Drill (PSE-2; CFS-018, `inv.sovereignty.102`).
 * Claim under test: provider choice is a REAL, MEASURED component of the
 * sovereignty bundle — the platform can hand the SAME constitutional battery
 * across providers MID-RUN and constitutional operation survives the switch
 * (grounding, citations, judged verdicts stay coherent).
 *
 * Design: the five EXP-003 constitutional tasks (initialized arm — the
 * constitutional mode of operation is grounded by definition), STRIPED across
 * an operator-selected provider set: task i is answered by
 * providers[i % providers.length]. The switch-integrity check rides every
 * task: the judge's provider is always the NEXT provider in the rotation —
 * never the answerer — so every verdict is a cross-provider judgment (with
 * 2+ providers the judge can never equal the answerer). Providers are pinned
 * explicitly at every call site; no env manipulation, no router changes.
 *
 * Pass/fail semantics, stated precisely (the EXP-004 honesty discipline):
 *   - CONSTITUTIONAL failure = a battery task cannot complete at all. A
 *     provider adapter erroring IS that task's constitutional failure for
 *     that provider — recorded plainly, never masked, never silently
 *     retried onto a different provider (a silent failover would corrupt
 *     the measurement).
 *   - Quality deltas across providers are the DEGRADATION REPORT — reported,
 *     never scored as failure.
 *
 * Sovereignty framing: a completed multi-provider run demonstrates S2
 * (substitutable) EXERCISED — not merely available. If the rotation includes
 * venice (the open-weight adapter) the run additionally carries
 * open-weight-participation — but S3 (open-weight carries constitutional
 * operation ALONE) remains EXP-004's claim; this drill never claims it.
 */

import {
  exp003AnswerStep,
  exp003Config,
  exp003CountCitations,
  exp003JudgeStep,
  fetchExp003Collection,
  type Exp003Verdict,
} from '@/services/experiments/exp003';
import {
  EXPERIMENT_PROVIDERS,
  isAllowedExperimentModel,
  type ExperimentProvider,
} from '@/services/experiments/llm';

export const EXP005_ID = 'EXP-005' as const;

/** Minimum rotation size — a provider "switch" needs somewhere to switch to,
 * and cross-provider judging needs a judge that is not the answerer. */
export const EXP005_MIN_PROVIDERS = 2;

/**
 * The bundle components a COMPLETED multi-provider run measures (CFS-018).
 * provider-choice-exercised is the drill's own datum: the switch happened
 * mid-battery, it was not merely available. Pinned by canary
 * (tests/exp005-provider-choice.test.ts).
 */
export const EXP005_BUNDLE_COMPONENTS = [
  'provider-interchangeability',
  'provider-choice-exercised',
  'commercial-independence',
  'constitutional-operation',
] as const;

/** Added when the rotation includes the open-weight adapter (venice). This is
 * PARTICIPATION, not independence — S3 (open-weight alone) is EXP-004's
 * claim and this drill never makes it. */
export const EXP005_OPEN_WEIGHT_COMPONENT = 'open-weight-participation' as const;

/** The open-weight adapter (mirrors exp004's SOVEREIGN_PROVIDER — the class
 * definition lives there; this drill only detects participation). */
const OPEN_WEIGHT_PROVIDER: ExperimentProvider = 'venice';

/** Validate an operator-selected rotation: 2+ providers, all distinct, all
 * real adapters from services/experiments/llm.ts — no invented providers. */
export function exp005ValidateProviders(providers: string[]): asserts providers is ExperimentProvider[] {
  if (!Array.isArray(providers) || providers.length < EXP005_MIN_PROVIDERS) {
    throw new Error(`provider rotation needs at least ${EXP005_MIN_PROVIDERS} providers`);
  }
  const known = Object.keys(EXPERIMENT_PROVIDERS);
  for (const p of providers) {
    if (!known.includes(p)) throw new Error(`unknown provider '${p}' — adapters: ${known.join(', ')}`);
  }
  if (new Set(providers).size !== providers.length) {
    throw new Error('provider rotation must not repeat a provider');
  }
}

/** Deterministic stripe: task i is ANSWERED by providers[i % n]. Pure. */
export function exp005AnswerProviderForTask(
  taskIndex: number,
  providers: readonly ExperimentProvider[],
): ExperimentProvider {
  return providers[taskIndex % providers.length];
}

/** Cross-provider judging: task i is JUDGED by the NEXT provider in the
 * rotation — never the answerer (guaranteed by the 2+ distinct-provider
 * validation). Pure. */
export function exp005JudgeProviderForTask(
  taskIndex: number,
  providers: readonly ExperimentProvider[],
): ExperimentProvider {
  return providers[(taskIndex + 1) % providers.length];
}

export interface Exp005Config {
  /** The five EXP-003 constitutional tasks — imported, never forked. */
  tasks: { id: string; prompt: string }[];
  minProviders: number;
}

export function exp005Config(): Exp005Config {
  const { tasks } = exp003Config();
  return {
    tasks: tasks.map((t) => ({ id: t.id, prompt: t.prompt })),
    minProviders: EXP005_MIN_PROVIDERS,
  };
}

/** One grounded answer on the task's rotation provider (initialized arm —
 * identical battery semantics to EXP-003/EXP-004; reused, never forked).
 * `model` (optional) must be on the RESOLVED provider's allowlist. */
export async function exp005AnswerStep(
  taskIndex: number,
  providers: ExperimentProvider[],
  model?: string,
) {
  exp005ValidateProviders(providers);
  const provider = exp005AnswerProviderForTask(taskIndex, providers);
  if (model && !isAllowedExperimentModel(provider, model)) {
    throw new Error(`model '${model}' is not on the ${provider} allowlist (task ${taskIndex} answers on ${provider})`);
  }
  const result = await exp003AnswerStep(provider, taskIndex, 'initialized', model);
  return { ...result, provider };
}

/** Groundedness judged by the NEXT provider in the rotation — the
 * switch-integrity check: the verdict itself crosses the provider boundary. */
export async function exp005JudgeStep(
  taskIndex: number,
  answer: string,
  providers: ExperimentProvider[],
  model?: string,
): Promise<Exp003Verdict & { citations: number; judgeProvider: ExperimentProvider }> {
  exp005ValidateProviders(providers);
  const judgeProvider = exp005JudgeProviderForTask(taskIndex, providers);
  if (model && !isAllowedExperimentModel(judgeProvider, model)) {
    throw new Error(`model '${model}' is not on the ${judgeProvider} allowlist (task ${taskIndex} judged by ${judgeProvider})`);
  }
  const verdict = await exp003JudgeStep(judgeProvider, taskIndex, answer, model);
  const collection = await fetchExp003Collection();
  const { totalCitations } = exp003CountCitations(answer, collection);
  return { ...verdict, citations: totalCitations, judgeProvider };
}

/** Per-task record the summarizer consumes (the runner accumulates these). */
export interface Exp005TaskResult {
  taskId: string;
  answerProvider: ExperimentProvider;
  judgeProvider: ExperimentProvider | null;
  /** false = constitutional failure — the task could not complete at all. */
  completed: boolean;
  citations?: number;
  claimsTotal?: number;
  consistent?: number;
  contradicting?: number;
}

export interface Exp005SwitchIntegrity {
  tasksTotal: number;
  tasksCompleted: number;
  /** Constitutional failures = tasks that did not complete. */
  constitutionalFailures: number;
  /** Distinct answer providers, in first-use order. */
  providersUsed: ExperimentProvider[];
  /** Per-provider completion counts (answer-side). */
  perProvider: Record<string, { completed: number; total: number }>;
  /** Every (answerer, judge) pair — the cross-provider judgments. */
  crossJudgePairs: { taskId: string; answerProvider: string; judgeProvider: string }[];
  /** THE measurement: every task completed AND the battery spanned 2+
   * providers — provider choice exercised mid-run without losing
   * constitutional operation. */
  completedAcrossProviders: boolean;
}

/** Pure summarizer — the drill's measurement. Constitutional failure iff a
 * task failed to complete; canary-pinned. */
export function exp005SwitchIntegrity(results: Exp005TaskResult[]): Exp005SwitchIntegrity {
  const providersUsed: ExperimentProvider[] = [];
  const perProvider: Record<string, { completed: number; total: number }> = {};
  const crossJudgePairs: Exp005SwitchIntegrity['crossJudgePairs'] = [];
  let tasksCompleted = 0;
  for (const r of results) {
    if (!providersUsed.includes(r.answerProvider)) providersUsed.push(r.answerProvider);
    const bucket = (perProvider[r.answerProvider] ??= { completed: 0, total: 0 });
    bucket.total += 1;
    if (r.completed) {
      bucket.completed += 1;
      tasksCompleted += 1;
    }
    if (r.judgeProvider) {
      crossJudgePairs.push({
        taskId: r.taskId,
        answerProvider: r.answerProvider,
        judgeProvider: r.judgeProvider,
      });
    }
  }
  const constitutionalFailures = results.length - tasksCompleted;
  return {
    tasksTotal: results.length,
    tasksCompleted,
    constitutionalFailures,
    providersUsed,
    perProvider,
    crossJudgePairs,
    completedAcrossProviders:
      results.length > 0 && constitutionalFailures === 0 && providersUsed.length >= EXP005_MIN_PROVIDERS,
  };
}

/** The bundle components a run measures: the pinned set on completion (plus
 * open-weight-participation when venice rode the rotation); an incomplete
 * run measures NOTHING — no component is claimed on failure. Pure. */
export function exp005BundleComponentsForRun(
  providers: readonly ExperimentProvider[],
  completed: boolean,
): readonly string[] {
  if (!completed) return [];
  return providers.includes(OPEN_WEIGHT_PROVIDER)
    ? [...EXP005_BUNDLE_COMPONENTS, EXP005_OPEN_WEIGHT_COMPONENT]
    : EXP005_BUNDLE_COMPONENTS;
}

/** The Sovereignty Scale rung a completed run measures: S2 (substitutable)
 * EXERCISED mid-battery. Never S3 — open-weight independence (the S3 rung; the
 * apex tiers S4/S5 are higher still) is EXP-004's claim; venice in the rotation
 * is participation, not S3. null when constitutional operation did not complete. Pure. */
export function exp005RungForRun(completed: boolean): 's2-substitutable' | null {
  return completed ? 's2-substitutable' : null;
}
