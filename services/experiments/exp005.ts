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
 *   - CONSTITUTIONAL failure = a provider WAS reached but the battery task
 *     failed on content/protocol — recorded plainly for that provider, never
 *     masked, never silently retried onto a DIFFERENT provider (a silent
 *     failover would corrupt the measurement).
 *   - Provider UNAVAILABLE = a transport/infra error (timeout, HTTP 5xx / 429 /
 *     408, auth/quota/credit) — the provider never returned a usable answer.
 *     This is an honest NON-RESULT, NOT a constitutional failure: it is excluded
 *     from the constitutional-failure count and makes a run inconclusive, not
 *     failed. A transient error may be retried ONCE against the SAME provider
 *     (not a failover), which does not corrupt the measurement.
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

/**
 * Honest outcome taxonomy (operator + Aletheon, 2026-07-20). The prior binary
 * (completed / "constitutional failure") collapsed three distinct phenomena —
 * a reached-but-defective answer, a provider outage, and a timeout — into one
 * misleading label. Each task lands in exactly ONE class:
 *   - `completed`               answer + cross-judge both returned; no constitutional defect.
 *   - `constitutionally_failed` answer + judge returned, but the answer failed the
 *                               constitutional criterion (contradictions present).
 *                               THE ONLY class that counts against switch integrity.
 *   - `provider_unavailable`    answer-side infra: billing/credit, invalid/revoked key,
 *                               provider 4xx/5xx, outage — an availability result.
 *   - `timed_out`               answer-side: provider didn't finish inside the envelope —
 *                               a performance/deployability result, NOT a reasoning defect.
 *   - `judge_failed`            the answer exists but the JUDGE failed/timed out — the task
 *                               is inconclusive; scored as neither success nor failure.
 */
export type Exp005Outcome =
  | 'completed'
  | 'constitutionally_failed'
  | 'provider_unavailable'
  | 'timed_out'
  | 'judge_failed';

/** A single (answer|judge) call attempt — the auditable retry record. */
export interface Exp005Attempt {
  step: 'answer' | 'judge';
  n: number;
  status: 'ok' | 'timed_out' | 'error';
  error?: string;
}

/** Per-task record the summarizer consumes (the runner accumulates these). */
export interface Exp005TaskResult {
  taskId: string;
  answerProvider: ExperimentProvider;
  judgeProvider: ExperimentProvider | null;
  outcome: Exp005Outcome;
  /** Bounded, visible retry trail (transient classes only; never a re-route). */
  attempts?: Exp005Attempt[];
  citations?: number;
  claimsTotal?: number;
  consistent?: number;
  contradicting?: number;
}

/** True iff a completed+judged task's verdict fails the constitutional
 *  criterion. The criterion is transparent + auditable: any claim that
 *  CONTRADICTS the constitutional collection is a constitutional defect. */
export function exp005IsConstitutionalDefect(v: { contradicting?: number }): boolean {
  return (v.contradicting ?? 0) > 0;
}

/** Per-provider operational-viability accounting, split by ROLE (answer vs
 *  judge) — because a provider can be viable in one role and not the other
 *  (e.g. viable as a short-call judge, not as a long-form answerer within the
 *  serverless envelope). `null` viability = the role was never exercised. */
export interface Exp005ProviderViability {
  answerTotal: number;
  answerOk: number;
  answerTimedOut: number;
  answerUnavailable: number;
  judgeTotal: number;
  judgeOk: number;
  judgeFailed: number;
  /** No infra failure in the role it was asked to perform (null = not exercised). */
  answerViable: boolean | null;
  judgeViable: boolean | null;
}

export interface Exp005SwitchIntegrity {
  tasksTotal: number;
  /** Answered AND judged (completed + constitutionally_failed). */
  tasksCompleted: number;
  /** Completed with no constitutional defect. */
  cleanCompleted: number;
  /** THE ONLY switch-integrity failure: answered+judged but constitutionally defective. */
  constitutionalFailures: number;
  /** Answer-side timeouts (performance/deployability, not a reasoning defect). */
  timedOut: number;
  /** Answer-side provider outages/auth/credit (availability, not a reasoning defect). */
  providerUnavailable: number;
  /** Judge failed/timed out — the answer exists but the task is inconclusive. */
  judgeFailed: number;
  providersUsed: ExperimentProvider[];
  /** Distinct answer-side providers that hit infra (timeout or unavailable). */
  providersUnavailable: ExperimentProvider[];
  /** Per-provider, per-role viability. */
  perProvider: Record<string, Exp005ProviderViability>;
  /** Cross-provider judgments that ACTUALLY rendered a verdict (answer+judge both ran). */
  crossJudgePairs: { taskId: string; answerProvider: string; judgeProvider: string }[];
  /** Axis 1 — does VALID constitutional operation survive provider substitution?
   *  'broken' iff any completed task is constitutionally defective; 'held' iff
   *  clean completions span 2+ providers; 'inconclusive' otherwise. */
  constitutionalPortability: 'held' | 'broken' | 'inconclusive';
  /** Axis 2 — can each provider complete its assigned ROLE within the envelope? */
  operationalViability: Record<string, { answerViable: boolean | null; judgeViable: boolean | null }>;
  /** Overall: 'held' (clean across 2+ providers), 'constitutional_failure' (≥1
   *  defect), or 'inconclusive' (infra prevented a full exercise, no defects). */
  verdict: 'held' | 'constitutional_failure' | 'inconclusive';
  /** Legacy alias of verdict === 'held' (kept for existing consumers). */
  completedAcrossProviders: boolean;
}

const emptyViability = (): Exp005ProviderViability => ({
  answerTotal: 0,
  answerOk: 0,
  answerTimedOut: 0,
  answerUnavailable: 0,
  judgeTotal: 0,
  judgeOk: 0,
  judgeFailed: 0,
  answerViable: null,
  judgeViable: null,
});

/** Pure summarizer — the drill's measurement under the honest taxonomy. Only a
 * constitutionally-defective ANSWERED+JUDGED task counts against switch
 * integrity; timeouts, provider outages, and judge failures are separate,
 * honestly-reported classes that make a run inconclusive, never "failed".
 * Reports two independent axes (constitutional portability vs operational
 * viability). Canary-pinned. */
export function exp005SwitchIntegrity(results: Exp005TaskResult[]): Exp005SwitchIntegrity {
  const providersUsed: ExperimentProvider[] = [];
  const perProvider: Record<string, Exp005ProviderViability> = {};
  const crossJudgePairs: Exp005SwitchIntegrity['crossJudgePairs'] = [];
  const providersUnavailable: ExperimentProvider[] = [];
  let tasksCompleted = 0;
  let cleanCompleted = 0;
  let constitutionalFailures = 0;
  let timedOut = 0;
  let providerUnavailable = 0;
  let judgeFailed = 0;

  const markInfra = (p: ExperimentProvider) => {
    if (!providersUnavailable.includes(p)) providersUnavailable.push(p);
  };

  for (const r of results) {
    if (!providersUsed.includes(r.answerProvider)) providersUsed.push(r.answerProvider);
    const pa = (perProvider[r.answerProvider] ??= emptyViability());
    pa.answerTotal += 1;
    // The answer succeeded for every class EXCEPT the two answer-side infra ones.
    const answerSucceeded = r.outcome !== 'timed_out' && r.outcome !== 'provider_unavailable';
    if (answerSucceeded) pa.answerOk += 1;

    switch (r.outcome) {
      case 'completed':
        cleanCompleted += 1;
        tasksCompleted += 1;
        break;
      case 'constitutionally_failed':
        constitutionalFailures += 1;
        tasksCompleted += 1;
        break;
      case 'timed_out':
        timedOut += 1;
        pa.answerTimedOut += 1;
        markInfra(r.answerProvider);
        break;
      case 'provider_unavailable':
        providerUnavailable += 1;
        pa.answerUnavailable += 1;
        markInfra(r.answerProvider);
        break;
      case 'judge_failed':
        judgeFailed += 1;
        break;
    }

    // Judge role accounting — only when the answer succeeded (else the judge
    // never ran). A rendered verdict (completed / constitutionally_failed) is a
    // real cross-provider judgment; judge_failed is an attempted-but-failed one.
    if (r.judgeProvider && answerSucceeded) {
      const pj = (perProvider[r.judgeProvider] ??= emptyViability());
      pj.judgeTotal += 1;
      if (r.outcome === 'judge_failed') pj.judgeFailed += 1;
      else pj.judgeOk += 1;
      if (r.outcome === 'completed' || r.outcome === 'constitutionally_failed') {
        crossJudgePairs.push({ taskId: r.taskId, answerProvider: r.answerProvider, judgeProvider: r.judgeProvider });
      }
    }
  }

  // Finalise per-role viability booleans (viable = no infra failure in a role
  // that WAS exercised; null = never exercised in that role).
  for (const v of Object.values(perProvider)) {
    v.answerViable = v.answerTotal > 0 ? v.answerTimedOut === 0 && v.answerUnavailable === 0 : null;
    v.judgeViable = v.judgeTotal > 0 ? v.judgeFailed === 0 : null;
  }
  const operationalViability: Record<string, { answerViable: boolean | null; judgeViable: boolean | null }> = {};
  for (const [p, v] of Object.entries(perProvider)) {
    operationalViability[p] = { answerViable: v.answerViable, judgeViable: v.judgeViable };
  }

  const cleanProviders = new Set(
    results.filter((r) => r.outcome === 'completed').map((r) => r.answerProvider),
  );
  const constitutionalPortability: Exp005SwitchIntegrity['constitutionalPortability'] =
    constitutionalFailures > 0
      ? 'broken'
      : cleanCompleted > 0 && cleanProviders.size >= EXP005_MIN_PROVIDERS
        ? 'held'
        : 'inconclusive';

  const noInfra = timedOut === 0 && providerUnavailable === 0 && judgeFailed === 0;
  const verdict: Exp005SwitchIntegrity['verdict'] =
    constitutionalFailures > 0
      ? 'constitutional_failure'
      : results.length > 0 && noInfra && cleanCompleted === results.length && providersUsed.length >= EXP005_MIN_PROVIDERS
        ? 'held'
        : 'inconclusive';

  return {
    tasksTotal: results.length,
    tasksCompleted,
    cleanCompleted,
    constitutionalFailures,
    timedOut,
    providerUnavailable,
    judgeFailed,
    providersUsed,
    providersUnavailable,
    perProvider,
    crossJudgePairs,
    constitutionalPortability,
    operationalViability,
    verdict,
    completedAcrossProviders: verdict === 'held',
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
