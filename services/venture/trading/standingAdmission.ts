/**
 * V-10 — the Standing neutrality guard. Built FIRST, deliberately.
 *
 * A contaminated Standing write is harder to reverse than a missing analytic:
 * once execution-derived credit is inside `crm_persona_reputation` it is
 * indistinguishable from constitutional credit, and the experiment's own result
 * would mask the contamination it was meant to detect. So the gate exists
 * before anything can write through it.
 *
 * This is an ADMISSION GATE IN FRONT OF the existing Standing system. It does
 * not change `services/standing/standingScore.ts` (veracity-led; its `volume`
 * term already counts verified FACTS, not transactions) and it does not change
 * `services/venture/standingForVenture.ts`. Existing Standing behaviour is
 * untouched — what is new is that a TRADING signal cannot reach it without
 * passing this evaluation first.
 *
 * The constitutional rule (charter §8.9, ruled as an immediate requirement):
 *
 *   > The unit is the VERIFIED CONTRIBUTION, not the executed transaction.
 *   > A correct refusal must be capable of earning equal or greater Standing
 *   > than an execution where it better satisfies the mandate.
 *
 * Two failure modes this guard is shaped against:
 *
 *  1. **Commercial metrics smuggled in as constitutional ones.** Transaction
 *     volume, executed-trade count, revenue, fees, realised profit, notional
 *     and execution frequency are legitimate COMMERCIAL metrics. They are not
 *     Standing signals, and they never become one by being renamed. They are
 *     refused as bases here — they do not contribute weight, and each refusal
 *     is recorded so the exclusion is visible rather than silent.
 *
 *  2. **A profitable-but-incomplete execution outranking a correct refusal.**
 *     Weight derives from constitutional properties of the WORK. It has no
 *     term in profit or size, so a large profitable trade with a hole in its
 *     process cannot out-weigh a small, fully evidenced refusal. The paired
 *     canary in tests/venture-trading-substrate.test.ts asserts exactly that.
 */

import type {
  ConstitutionalCompletionVerdict,
  StandingContributionType,
  StandingLane,
  StandingSignalDecision,
} from './types';

/**
 * Bases that are PROHIBITED as direct Standing inputs. These stay commercial
 * metrics. The list is closed: a basis that is not explicitly permitted below
 * is also refused, so adding a new commercial metric elsewhere cannot leak in
 * by omission.
 */
export const PROHIBITED_STANDING_BASES = [
  'transaction-volume',
  'executed-trade-count',
  'revenue-generated',
  'fees-generated',
  'realised-profit',
  'notional-value',
  'execution-frequency',
] as const;

export type ProhibitedStandingBasis = (typeof PROHIBITED_STANDING_BASES)[number];

/**
 * Permitted contribution classes and the CVS weight each carries. Every weight
 * is a property of the work. Note that `correct-refusal` is weighted at parity
 * with `correctness` — the charter requires a correct refusal to be capable of
 * earning equal or greater Standing than an execution, and a lower constant
 * here would quietly deny that while appearing to honour it.
 */
export const PERMITTED_STANDING_BASES: Record<StandingContributionType, number> = {
  correctness: 1.0,
  veracity: 1.0,
  'proof-quality': 0.75,
  'constitutional-completeness': 1.0,
  'correct-refusal': 1.0,
  'risk-detection': 0.75,
  'authority-compliance': 0.5,
  reproducibility: 0.5,
  'service-reliability': 0.5,
  'reconciliation-quality': 0.5,
  'no-unauthorised-expansion': 0.5,
};

const PERMITTED_SET = new Set<string>(Object.keys(PERMITTED_STANDING_BASES));
const PROHIBITED_SET = new Set<string>(PROHIBITED_STANDING_BASES);

/** Ceiling on a single signal's contribution, so no one opportunity dominates. */
export const MAX_STANDING_SIGNAL_WEIGHT = 3;

export interface TradingStandingSignalInput {
  /** Server-internal opportunity id — used only for correlation, never emitted. */
  opportunityId: string;
  /** Agent commitment (ventureAgentRef). Raw persona ids are rejected. */
  agentRef: string;
  /** The bases the caller claims justify Standing credit. */
  proposedBases: string[];
  /** Which Standing lane the credit would land in. */
  lane: StandingLane;
  /** Evidence backing the claim. A claim with no evidence is inadmissible. */
  evidenceRefs: string[];
  /**
   * The opportunity's completion verdict, when one exists. An INCOMPLETE
   * verdict makes the signal inadmissible regardless of the bases offered —
   * that is the "profitable but constitutionally incomplete" case.
   */
  verdict?: Pick<ConstitutionalCompletionVerdict, 'complete' | 'outcomeClass' | 'unauthorisedExpansion'>;
}

/**
 * Decide whether a trading-derived signal may enter Standing, and at what
 * weight. Pure and deterministic — no clock, no I/O, no DB.
 *
 * The returned decision is not advisory: callers MUST branch on `admissible`
 * and MUST NOT accrue on a refused decision. `runVentureScenario` folds only
 * admissible decisions into its Standing contributions, and the canary asserts
 * the refused ones stay out.
 */
export function evaluateTradingStandingSignal(
  input: TradingStandingSignalInput,
): StandingSignalDecision {
  const refusalReasons: string[] = [];
  const evidenceRefs = [...input.evidenceRefs];

  // Identity hygiene comes before merit: a signal carrying a raw persona id is
  // refused outright rather than sanitised, because sanitising would let the
  // caller keep the broken habit.
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(input.agentRef)) {
    return {
      admissible: false,
      refusalReasons: ['agentRef-is-a-raw-identifier-not-a-commitment'],
      evidenceRefs,
    };
  }

  // Partition the proposed bases. Prohibited ones are named individually so a
  // reviewer can see WHICH commercial metric was offered, not merely that one
  // was.
  const permitted: StandingContributionType[] = [];
  for (const basis of input.proposedBases) {
    if (PROHIBITED_SET.has(basis)) {
      refusalReasons.push(`prohibited-basis:${basis}`);
      continue;
    }
    if (!PERMITTED_SET.has(basis)) {
      refusalReasons.push(`unrecognised-basis:${basis}`);
      continue;
    }
    permitted.push(basis as StandingContributionType);
  }

  if (permitted.length === 0) {
    refusalReasons.push('no-permitted-constitutional-basis');
    return { admissible: false, refusalReasons, evidenceRefs };
  }

  if (evidenceRefs.length === 0) {
    refusalReasons.push('no-evidence');
    return { admissible: false, refusalReasons, evidenceRefs };
  }

  // An unauthorised expansion of delegated authority voids the signal even
  // where the permitted bases would otherwise support it. Penalty/risk handling
  // is a SEPARATE concern: this gate refuses positive credit, it does not
  // produce a negative Standing signal.
  if (input.verdict?.unauthorisedExpansion) {
    refusalReasons.push('unauthorised-authority-expansion');
    return { admissible: false, refusalReasons, evidenceRefs };
  }

  // Work that did not constitutionally complete earns nothing, however
  // profitable the underlying execution was. This is the clause that stops a
  // profitable-but-incomplete execution from accruing at all.
  if (input.verdict && !input.verdict.complete) {
    refusalReasons.push('constitutionally-incomplete');
    return { admissible: false, refusalReasons, evidenceRefs };
  }

  // Weight from the constitutional properties of the work only. There is no
  // profit, notional or count term anywhere in this expression, and there must
  // never be one.
  const rawWeight = permitted.reduce((sum, b) => sum + PERMITTED_STANDING_BASES[b], 0);
  const weight = Math.min(MAX_STANDING_SIGNAL_WEIGHT, rawWeight);

  // The headline contribution type is the highest-weighted permitted basis,
  // ties broken by the caller's ordering so the choice is reproducible.
  const contributionType = permitted.reduce((best, b) =>
    PERMITTED_STANDING_BASES[b] > PERMITTED_STANDING_BASES[best] ? b : best,
  );

  return {
    admissible: true,
    lane: input.lane,
    contributionType,
    weight,
    refusalReasons,
    evidenceRefs,
  };
}
