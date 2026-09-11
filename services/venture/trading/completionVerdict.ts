/**
 * Constitutional completion (V-8) — scoring whether an OPPORTUNITY received its
 * full constitutional process.
 *
 * The subject is the opportunity, not the trade. A schema keyed on executed
 * trades cannot represent the population H3 is about, and the mistake is
 * invisible until the analysis stage: every number computes, on the wrong
 * denominator. So an opportunity that was correctly refused is scored on the
 * same seven links as one that executed, and can score COMPLETE.
 *
 * The four outcome classes are not a quality ranking with refusal in the
 * middle. Two of them are constitutional successes:
 *
 *   executed-complete  — full process, execution occurred
 *   refused-complete   — full process, execution correctly declined
 *   incomplete         — the process itself has a hole
 *   unauthorised       — an agent acted beyond its delegated authority
 *
 * `refused-complete` must never be encoded as a failed trade. An encoding that
 * can only express "the trade did not happen" cannot express the thing H3 is
 * about (charter §8.8).
 */

import {
  CONSTITUTIONAL_COMPLETION_CHECKS,
  type ConstitutionalCompletionCheck,
  type ConstitutionalCompletionVerdict,
  type ConstitutionalOutcomeClass,
} from './types';

export interface AssessCompletionInput {
  opportunityId: string;
  experimentalCellId: string;
  /** From scenario fixtures — never a clock (replay must be reproducible). */
  assessedAt: string;
  /** Which of the seven constitutional links the opportunity actually received. */
  checksPerformed: readonly ConstitutionalCompletionCheck[];
  /** True when execution occurred; false for a refusal or a non-execution. */
  executed: boolean;
  /** True when the decision not to execute was itself the correct outcome. */
  refusalWasCorrect?: boolean;
  /** An agent exceeded its delegated authority — voids completion outright. */
  unauthorisedExpansion?: boolean;
  evidenceRefs: readonly string[];
  receiptRef: string;
}

/**
 * Assess one opportunity. Pure and deterministic.
 *
 * Completion requires ALL seven links AND no unauthorised expansion. There is
 * no partial-credit path: a "mostly complete" verdict would let a hole in the
 * process be averaged away, and the Constitutional Completeness Rate is
 * defined over fully completed assessments precisely to prevent that.
 */
export function assessConstitutionalCompletion(
  input: AssessCompletionInput,
): ConstitutionalCompletionVerdict {
  const performed = new Set<string>(input.checksPerformed);
  const checks = Object.fromEntries(
    CONSTITUTIONAL_COMPLETION_CHECKS.map((c) => [c, performed.has(c)]),
  ) as Record<ConstitutionalCompletionCheck, boolean>;

  const missingChecks = CONSTITUTIONAL_COMPLETION_CHECKS.filter((c) => !checks[c]);
  const unauthorisedExpansion = input.unauthorisedExpansion === true;
  const allChecksPresent = missingChecks.length === 0;
  const complete = allChecksPresent && !unauthorisedExpansion;

  let outcomeClass: ConstitutionalOutcomeClass;
  if (unauthorisedExpansion) {
    // Unauthorised action is its own class, ranked below merely incomplete: an
    // incomplete process failed to do work, an unauthorised one did work it had
    // no authority to do.
    outcomeClass = 'unauthorised';
  } else if (!allChecksPresent) {
    outcomeClass = 'incomplete';
  } else if (input.executed) {
    outcomeClass = 'executed-complete';
  } else {
    // Full process, no execution. This is `refused-complete` only when the
    // refusal was the correct call; a complete process that simply lapsed is
    // not a constitutional success.
    outcomeClass = input.refusalWasCorrect ? 'refused-complete' : 'incomplete';
  }

  return {
    opportunityId: input.opportunityId,
    experimentalCellId: input.experimentalCellId,
    assessedAt: input.assessedAt,
    checks,
    missingChecks,
    // A complete process that lapsed without being a correct refusal is not
    // constitutionally complete either — keep `complete` and `outcomeClass`
    // consistent rather than letting them disagree.
    complete: complete && outcomeClass !== 'incomplete',
    outcomeClass,
    unauthorisedExpansion,
    evidenceRefs: [...input.evidenceRefs],
    receiptRef: input.receiptRef,
  };
}

/**
 * Constitutional Completeness Rate = fully completed constitutional assessments
 * ÷ ALL eligible opportunities presented — including non-executed ones. The
 * denominator is the whole verdict population by construction; passing a
 * filtered list would silently restore the executed-trade denominator.
 */
export function constitutionalCompletenessRate(
  verdicts: readonly ConstitutionalCompletionVerdict[],
): number {
  if (verdicts.length === 0) return 0;
  return verdicts.filter((v) => v.complete).length / verdicts.length;
}
