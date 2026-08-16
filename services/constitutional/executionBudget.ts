/**
 * Execution Budget — the economic-authority envelope for an implementation
 * actor (Phase F bounded-execution repair, operator-directed 2026-08-16).
 *
 * Canonized finding this module exists to enforce: "Execution authority
 * includes economic authority; therefore autonomous implementation must be
 * bounded by an explicit compute envelope." No dollar figure is hardcoded —
 * the forensic audit (2026-08-16_devon-phase-f-bounded-execution-forensic-audit.md)
 * confirmed no reliable LIVE cost-interruption API exists from the current
 * implementation-actor transport (`anthropics/claude-code-action@v1`); a
 * dollar ceiling here would be advisory prose, not an enforced governor.
 * Bounded proxies instead — every one either a real, already-supported CLI
 * flag (`maxTurns` → `--max-turns`) or a countable signal from the actor's
 * own tool-call stream (validation passes, context-expansion events).
 *
 * `ExecutionProfile` is the SAME four-tier vocabulary the operator named
 * (routine/complex/protected/remediation) — used identically by budget
 * selection here and by execution-actor/model routing
 * (`services/constitutional/executionRouting.ts`), never a second taxonomy.
 */

export const EXECUTION_PROFILES = ['routine', 'complex', 'protected', 'remediation'] as const;
export type ExecutionProfile = (typeof EXECUTION_PROFILES)[number];

export interface ExecutionBudget {
  /** Wall-clock ceiling for the implementation-actor step specifically —
   *  tighter than the CI job's own outer timeout, which stays as the hard
   *  backstop regardless of this value. */
  maxWallClockMinutes: number;
  /** Maps directly to the Claude Code CLI's own `--max-turns` flag — no new
   *  mechanism, just the first time this workflow has ever set it. */
  maxTurns: number;
  /** How many DISTINCT validation invocations (any rung of the ladder) are
   *  permitted before requiring escalation — guards a retry loop hoping a
   *  re-run changes the answer. */
  maxValidationPasses: number;
  /** How many times the actor may record a scope-expansion event (reading
   *  outside `areasToTouch` + its direct dependents) before requiring
   *  escalation — a cumulative-uncertainty circuit breaker. */
  maxContextExpansionEvents: number;
}

/** Per-profile defaults — plain, editable CONFIGURATION (operator instruction:
 *  "provider/model mapping must be configuration, not constitutional logic" —
 *  the same discipline applies to budgets). Deliberately asymmetric: routine
 *  packs get the tightest envelope; remediation (a prior attempt already
 *  failed) gets more room precisely because the failure itself is evidence
 *  the task is harder than first estimated, not a license to run unbounded. */
export const DEFAULT_EXECUTION_BUDGETS: Record<ExecutionProfile, ExecutionBudget> = {
  routine: { maxWallClockMinutes: 12, maxTurns: 20, maxValidationPasses: 4, maxContextExpansionEvents: 3 },
  complex: { maxWallClockMinutes: 20, maxTurns: 35, maxValidationPasses: 6, maxContextExpansionEvents: 6 },
  protected: { maxWallClockMinutes: 20, maxTurns: 30, maxValidationPasses: 6, maxContextExpansionEvents: 4 },
  remediation: { maxWallClockMinutes: 25, maxTurns: 40, maxValidationPasses: 8, maxContextExpansionEvents: 8 },
};

export type ExecutionState = 'proceeding' | 'awaiting-escalation' | 'complete';

/** Observed counters an implementation actor's run produces — the same
 *  shapes execution telemetry (`services/constitutional/executionTelemetry.ts`)
 *  extracts from the actor's own result JSON, kept intentionally minimal so
 *  this evaluator has no dependency on any one provider's telemetry shape. */
export interface ObservedExecutionCounters {
  turns: number | null;
  wallClockMinutes: number | null;
  validationPasses: number;
  contextExpansionEvents: number;
}

export interface BudgetEvaluation {
  state: ExecutionState;
  /** Which specific ceiling(s) were exceeded — empty when `state ===
   *  'proceeding'`. Named so the escalation surface can say WHY, not just
   *  THAT. */
  exceeded: Array<keyof ExecutionBudget>;
}

/**
 * Pure comparison — the SAME arithmetic the workflow's post-execution step
 * mirrors (necessarily inline there; GitHub Actions steps cannot import this
 * app's TS module graph without a build step). Keep both in sync on any
 * change to this function.
 */
export function evaluateBudget(budget: ExecutionBudget, observed: ObservedExecutionCounters): BudgetEvaluation {
  const exceeded: Array<keyof ExecutionBudget> = [];
  if (observed.turns !== null && observed.turns > budget.maxTurns) exceeded.push('maxTurns');
  if (observed.wallClockMinutes !== null && observed.wallClockMinutes > budget.maxWallClockMinutes) {
    exceeded.push('maxWallClockMinutes');
  }
  if (observed.validationPasses > budget.maxValidationPasses) exceeded.push('maxValidationPasses');
  if (observed.contextExpansionEvents > budget.maxContextExpansionEvents) exceeded.push('maxContextExpansionEvents');
  return { state: exceeded.length > 0 ? 'awaiting-escalation' : 'proceeding', exceeded };
}
