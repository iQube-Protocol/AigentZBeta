/**
 * factorExecutionBridge — the seam MoneyPenny's own server-side code uses to
 * DELEGATE Use Case Zero execution to Aigent Factor (scoped 2026-09-06, see
 * codexes/packs/agentiq/updates/2026-09-06_factor-agent-callable-execution-scope.md).
 *
 * Factor remains the executing agent throughout — this is routing within ONE
 * already-accountable request, never a new principal acting. The
 * `actorPersonaId`/`tenantId` this call carries MUST be the SAME values the
 * calling route already resolved for the current request via
 * `getActivePersona` — never re-derived, never a different persona, and
 * never a platform credential (that path is `/api/moneypenny/factor/use-case-zero/execute`,
 * for a genuinely external caller with no shared human-persona context).
 *
 * Extend-Don't-Duplicate: this is a thin, explicitly-named pass-through to
 * `runUseCaseZeroToCompletion` — it exists so the MoneyPenny→Factor
 * delegation is a visible, testable seam of its own, rather than MoneyPenny
 * code reaching into `useCaseZeroOrchestrator` ad hoc from scattered call
 * sites.
 */

import {
  runUseCaseZeroToCompletion,
  type RunUseCaseZeroToCompletionInput,
  type RunUseCaseZeroToCompletionResult,
} from '@/services/factor/useCaseZeroOrchestrator';

export type DelegateUseCaseZeroInput = RunUseCaseZeroToCompletionInput;
export type DelegateUseCaseZeroResult = RunUseCaseZeroToCompletionResult;

/**
 * MoneyPenny delegates "run Use Case Zero for this case" to Factor. Factor
 * executes; MoneyPenny receives the same honest, boundary-respecting result
 * a step-by-step caller would see (see runUseCaseZeroToCompletion's own
 * contract) — never a simulated or auto-approved outcome.
 */
export async function delegateUseCaseZeroToFactor(
  input: DelegateUseCaseZeroInput,
): Promise<DelegateUseCaseZeroResult> {
  return runUseCaseZeroToCompletion(input);
}
