/**
 * THREE STATE AXES, NOT ONE BLOCKING SEQUENCE.
 *
 * ── THE OPERATOR'S RULING (2026-08-03), verbatim ──────────────────────────
 *
 *   > "Constitutional admission establishes the agent and its bounded
 *   >  authority. Factory ingestion establishes participation and Standing
 *   >  eligibility. Verification establishes eligibility for specialist
 *   >  capabilities. These are distinct state axes and must not be collapsed
 *   >  into one blocking sequence."
 *
 * ── WHAT WENT WRONG WHEN THEY WERE ONE SEQUENCE ───────────────────────────
 *
 * Verify sat at position 2 of the admission line, so Pulse/P&L transparency —
 * an OPTIONAL partner enrichment — was a prerequisite of Claim, and therefore
 * of Passport, delegation and activation. When `partner_authorization_requests`
 * turned out to be missing from the deployed schema, a local, unapplied
 * migration held an agent's entire constitutional progression hostage. One
 * deploy step became a total block on personhood.
 *
 * The defect was never the missing table. It was that three unrelated
 * questions had been strung onto one line:
 *
 *   "may this agent act?"            → ADMISSION   (constitutional)
 *   "may this agent participate?"    → FACTORY     (participation + Standing)
 *   "may this agent do FS work?"     → VERIFICATION (specialist capability)
 *
 * Answering "not yet" to the third must not change the answer to the first.
 *
 * ── THE SHAPE ─────────────────────────────────────────────────────────────
 *
 *   Register → Claim → Passport → Delegate → aigentMe        (linear spine)
 *                                                │
 *                        ┌───────────────────────┴──────────────────────┐
 *                        │                                              │
 *              Ingest into Factory                        Verify Pulse / P&L
 *              → Standing ELIGIBLE                        → FS eligible
 *
 * Neither branch blocks the other. Neither blocks or regresses admission.
 *
 * ── MONOTONICITY IS PER-AXIS ──────────────────────────────────────────────
 *
 * The monotonic guarantee from `stageResolution.ts` applies WITHIN each axis,
 * never across them. Admission cannot be regressed by a verification failure
 * because they are different axes — that is the structural version of the
 * rule, and it is why this file exists rather than a longer list of guards.
 */

import type { JourneyMilestone } from '@/types/journey';

// ── AXIS 1 · ADMISSION — the constitutional spine ───────────────────────────

/**
 * The five linear acts. Each corresponds to a stage on the spine, and four of
 * them to a `SettledPredicate` (services/journey/settledFacts.ts) — so once
 * established they are RETRIEVED, never re-derived.
 */
export interface AdmissionAxis {
  registered: boolean;
  claimed: boolean;
  passportReady: boolean;
  delegated: boolean;
  aigentMeActive: boolean;
}

export const ADMISSION_STEPS = ['registered', 'claimed', 'passportReady', 'delegated', 'aigentMeActive'] as const;
export type AdmissionStep = (typeof ADMISSION_STEPS)[number];

/** Which spine stage establishes which admission flag. */
export const ADMISSION_STEP_BY_STAGE: Record<string, AdmissionStep> = {
  register: 'registered',
  claim: 'claimed',
  passport: 'passportReady',
  delegate: 'delegated',
  aigentme: 'aigentMeActive',
};

// ── AXIS 2 · FACTORY — participation and Standing ELIGIBILITY ───────────────

/**
 * ── THE DISTINCTION THAT MUST NOT COLLAPSE ────────────────────────────────
 *
 *   Ingested into Factory  ≠  Standing accrued
 *   Ingested into Factory  →  ELIGIBLE to accrue Standing through
 *                             qualifying, VALIDATED action
 *
 * Ingestion is an act of participation; Standing is earned by conduct
 * afterwards. Awarding Standing for ingestion alone would make Standing a
 * membership badge rather than a record of behaviour — and PRD-GJR-001 §3.7 is
 * explicit that "an agent can lose money honestly and still earn Standing
 * through accurate disclosure. An agent can be profitable and lose Standing by
 * concealing risk." Standing that arrives with the paperwork can do neither.
 *
 * So `ingested: true` sets `standingEligible: true` and NOTHING else.
 */
export interface FactoryAxis {
  ingested: boolean;
  standingEligible: boolean;
}

// ── AXIS 3 · VERIFICATION — specialist capability eligibility ───────────────

/**
 * `exception` is a first-class value beside `not-started` and `complete`,
 * because "we tried and something is wrong" is genuinely different from "we
 * have not tried" — and BOTH are different from failure of the agent. A
 * verification exception is scoped to the capability it concerns; it never
 * becomes an exception about the agent.
 */
export type VerificationStepState = 'not-started' | 'complete' | 'exception';

export interface VerificationAxis {
  pulse: VerificationStepState;
  pnl: VerificationStepState;
  /** Both steps complete. Never implied by either alone. */
  financialServicesEligible: boolean;
}

// ── AXIS 4 · STANDING — accrued by conduct, never by admission ──────────────

/**
 * ── CORRECTED BY THE OPERATOR, 2026-08-03 ────────────────────────────────
 *
 * An earlier version of this axis asserted `accrued: 0` after ingestion, on
 * the reading that "Ingested into Factory ≠ Standing accrued" meant NO
 * Standing may ever arise from registration. The operator judged that too
 * absolute:
 *
 *   > "Factory ingestion can earn a nominal initial Standing award because
 *   >  registration is itself a consequential, receipted action — not merely
 *   >  passive eligibility. … The important safeguard is not 'no Standing on
 *   >  ingestion.' It is: Admission Standing must be distinguishable from
 *   >  earned performance Standing."
 *
 * So the safeguard is a TIER SPLIT, not a zero. `initial` is admission;
 * `contribution` is earned by validated work. They are separate fields rather
 * than one total with a note, because a single number invites precisely the
 * reading the operator is guarding against — and because any surface
 * reporting Standing must be able to separate them without inferring from
 * timing or amount.
 *
 * The seed's own magnitude and one-time idempotency are owned by
 * `services/journey/registrationStandingSeed.ts`; this axis only reports.
 */
export interface StandingAxis {
  /** Total. Always `initialAccrued + contributionAccrued`. */
  accrued: number;
  /** Admission Standing — the nominal, one-time registration seed. */
  initialAccrued: number;
  /** Earned performance Standing, from qualifying validated action. */
  contributionAccrued: number;
  /** The receipts the CONTRIBUTION accrual is derived from. Empty when nothing
   *  has been earned, which is the honest state for a newly ingested agent. */
  sourceReceipts: string[];
}

export interface AgentStateAxes {
  admission: AdmissionAxis;
  factory: FactoryAxis;
  verification: VerificationAxis;
  standing: StandingAxis;
}

// ── Resolution ──────────────────────────────────────────────────────────────

export interface AgentStateAxesInput {
  /** Canonical admission outcomes, keyed by spine stage id. */
  canonicalStages: Readonly<Record<string, boolean | undefined>>;
  factoryIngested: boolean;
  pulse: VerificationStepState;
  pnl: VerificationStepState;
  /** Receipts evidencing qualifying, validated action. NOT the ingestion receipt. */
  standingReceipts?: readonly string[];
  /** The nominal admission seed, when one has been awarded. Owned by
   *  registrationStandingSeed.ts; reported, never computed, here. */
  initialStandingAwarded?: number;
  /** The previously recorded axes — the per-axis monotonic floor. */
  prior?: AgentStateAxes | null;
}

/**
 * Resolve all four axes.
 *
 * Every axis is computed from its OWN inputs. There is deliberately no
 * expression in this function in which a verification value appears on the
 * right-hand side of an admission assignment, or vice versa — the axes cannot
 * contaminate each other because no code path connects them.
 */
export function resolveAgentStateAxes(input: AgentStateAxesInput): AgentStateAxes {
  const prior = input.prior ?? null;

  // AXIS 1 — admission. Monotonic: a prior true is never lowered here.
  const admission: AdmissionAxis = {
    registered: input.canonicalStages.register === true || prior?.admission.registered === true,
    claimed: input.canonicalStages.claim === true || prior?.admission.claimed === true,
    passportReady: input.canonicalStages.passport === true || prior?.admission.passportReady === true,
    delegated: input.canonicalStages.delegate === true || prior?.admission.delegated === true,
    aigentMeActive: input.canonicalStages.aigentme === true || prior?.admission.aigentMeActive === true,
  };

  // AXIS 2 — factory. Ingestion confers ELIGIBILITY, never Standing.
  const ingested = input.factoryIngested || prior?.factory.ingested === true;
  const factory: FactoryAxis = { ingested, standingEligible: ingested };

  // AXIS 3 — verification. Monotonic only in the `complete` direction: an
  // exception must be able to REPLACE not-started (that is news), but must
  // never overwrite a completed step (that would be a regression).
  const pulse = mergeVerificationStep(prior?.verification.pulse, input.pulse);
  const pnl = mergeVerificationStep(prior?.verification.pnl, input.pnl);
  const verification: VerificationAxis = {
    pulse,
    pnl,
    financialServicesEligible: pulse === 'complete' && pnl === 'complete',
  };

  // AXIS 4 — standing, split by TIER. The factory axis is still not consulted:
  // being eligible is not the same as having been awarded, and the admission
  // seed arrives as an explicit input from the act that awarded it, never as
  // an inference from `ingested`.
  const sourceReceipts = Array.from(new Set([...(prior?.standing.sourceReceipts ?? []), ...(input.standingReceipts ?? [])]));
  const contributionAccrued = sourceReceipts.length;
  const initialAccrued = Math.max(input.initialStandingAwarded ?? 0, prior?.standing.initialAccrued ?? 0);
  const standing: StandingAxis = {
    accrued: initialAccrued + contributionAccrued,
    initialAccrued,
    contributionAccrued,
    sourceReceipts,
  };

  return { admission, factory, verification, standing };
}

/** `complete` is terminal; anything else may still change. */
function mergeVerificationStep(
  prior: VerificationStepState | undefined,
  observed: VerificationStepState,
): VerificationStepState {
  if (prior === 'complete') return 'complete';
  return observed;
}

/** The admission milestones reached, for the ladder in `stageResolution.ts`. */
export function admissionMilestones(admission: AdmissionAxis): JourneyMilestone[] {
  const milestones: JourneyMilestone[] = [];
  if (admission.registered) milestones.push('REGISTERED');
  if (admission.claimed) milestones.push('CLAIMED');
  if (admission.passportReady) milestones.push('PASSPORT_ISSUED');
  if (admission.delegated) milestones.push('DELEGATED');
  return milestones;
}

// ── The post-activation branch offer ────────────────────────────────────────

export interface BranchOffer {
  branch: 'factory' | 'capability';
  stageId: string;
  label: string;
  /** What the operator GETS — stated as the outcome, never as the mechanism. */
  outcome: string;
  complete: boolean;
  /** True when the spine has reached activation and this may be executed. */
  available: boolean;
}

/**
 * The two post-activation offers.
 *
 *   > "Either may be executed first; the operator returns for the other later.
 *   >  The header may show both states but must not imply one gates the other."
 *
 * `available` is computed from `aigentMeActive` ALONE for both offers. Neither
 * reads the other's state — which is what makes "completing either branch
 * requires the other" unrepresentable rather than merely discouraged.
 */
export function resolveBranchOffers(axes: AgentStateAxes): BranchOffer[] {
  const available = axes.admission.aigentMeActive;
  return [
    {
      branch: 'factory',
      stageId: 'deploy',
      label: 'Ingest into Factory',
      outcome: 'Become eligible to accrue Standing through validated work.',
      complete: axes.factory.ingested,
      available,
    },
    {
      branch: 'capability',
      stageId: 'verify',
      label: 'Add Pulse & P&L verification',
      outcome: 'Become eligible for the financial-services runtime.',
      complete: axes.verification.financialServicesEligible,
      available,
    },
  ];
}
