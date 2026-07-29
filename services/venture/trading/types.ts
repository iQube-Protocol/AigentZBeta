/**
 * VL-CT-001 venture substrate — the shared primitives.
 *
 * This is the schema layer for V-1 (preparation cost), V-2 (service-economy
 * ledger) and V-10 (Standing neutrality guard). They are ONE build, not three
 * features, because they are three views of one chain:
 *
 *   opportunity → work performed → preparation cost measured →
 *   constitutional completion/refusal determined → liability created →
 *   ledger entry → DVN receipt → Standing-safe outcome
 *
 * Two properties of this schema carry the whole experiment, and both are easy
 * to lose by accident:
 *
 *  1. **The OPPORTUNITY is the accounting unit, never the trade** (charter R-3).
 *     Executed, correctly-refused, abandoned and failed opportunities are all
 *     first-class and all fully measurable. A refusal is not a zero and not a
 *     missing record — it is a completed service with its own cost, verdict,
 *     obligation and receipt. Any schema keyed on executed trades hides the
 *     cost of refused opportunities inside executed-trade totals, which is
 *     precisely the population H3 exists to measure, and the failure is silent:
 *     every figure computes, on the wrong denominator.
 *
 *  2. **Preparation cost is never collapsed to one monetary figure.** Time,
 *     compute, tokens, external cost, human time and evidence are preserved as
 *     separate dimensions so the cost model can evolve without the evidence
 *     having been thrown away at capture time. A single `costMinorUnits` scalar
 *     would be a one-way door.
 *
 * T0/T2 isolation (CLAUDE.md Identity & Access Spine): every `*Ref` field on
 * every type here is a COMMITMENT, never a raw `personaId`. Use the helpers in
 * `./refs.ts` to derive them. Nothing in this substrate ever accepts, stores or
 * emits a raw persona UUID on a ledger row, receipt payload or chain-bound
 * field.
 *
 * Phase 1 is deterministic simulation with NO live value: `amountMinorUnits`
 * figures are simulated operator-funded balances, and settlement is a state
 * transition, never a transfer.
 */

// ─── Experiment cube (charter §8.6 / R-7) ───────────────────────────────────

/** Settlement instrument axis. */
export type VentureDenomination = 'USDC' | 'BASE_QC';

/** How work is priced — H2's axis. */
export type VenturePricingStructure = 'bundled' | 'per-service';

/**
 * Whether payment survives a refusal — H3's axis, and the only axis that
 * changes *when a liability comes into existence*.
 */
export type VentureCompensationContingency =
  | 'execution-contingent'
  | 'constitutional-completion-contingent';

/**
 * One cell of the ratified 2×2×2 factorial. The cell IDENTIFIER is always
 * DERIVED from this configuration (see `ventureExperimentCellId`) — bare arm
 * letters A/B/C/D are prohibited in records, reports, filenames and test names.
 */
export interface VentureExperimentCell {
  denomination: VentureDenomination;
  pricingStructure: VenturePricingStructure;
  compensationContingency: VentureCompensationContingency;
}

// ─── The opportunity (V-1 / V-8 accounting unit) ────────────────────────────

/**
 * Terminal and in-flight states of an opportunity. All six are measurable
 * populations; `correctly-refused` is a COMPLETED service, not a failure —
 * `failed` is reserved for an opportunity whose process itself broke down.
 */
export type VentureOpportunityStatus =
  | 'open'
  | 'evaluating'
  | 'execution-approved'
  | 'correctly-refused'
  | 'executed'
  | 'abandoned'
  | 'failed';

export interface VentureOpportunity {
  opportunityId: string;
  experimentId: string;
  scenarioId: string;
  /** Derived cell id, e.g. `BASEQC-SERVICE-COMPLETE`. Never a bare letter. */
  experimentalCellId: string;
  createdAt: string;
  closedAt?: string;
  requestedService: string;
  requestedOutcome?: string;
  /** Commitment (personaPublicRef), never a raw personaId. */
  principalRef: string;
  /** Delegation-grant commitments authorising the participating agents. */
  delegationRefs: string[];
  /** Agent commitments. */
  participatingAgentRefs: string[];
  status: VentureOpportunityStatus;
  /** Commitment over the opportunity's source — T2-safe provenance. */
  sourceCommitment: string;
  /** Simulated notional, minor units. Present so the coverage-by-size curve is
   *  computable; NEVER an input to Standing (see standingAdmission.ts). */
  notionalMinorUnits?: string;
}

// ─── Preparation cost (V-1) ─────────────────────────────────────────────────

/**
 * The kinds of constitutional work an opportunity can consume. `refusal` is a
 * service type in its own right — the charter's central claim is that a
 * justified refusal is work performed, not work skipped.
 */
export type VentureServiceType =
  | 'discovery'
  | 'analysis'
  | 'verification'
  | 'risk-review'
  | 'compliance-review'
  | 'execution-preparation'
  | 'settlement-preparation'
  | 'reconciliation'
  | 'refusal';

/**
 * One unit of measured work against one opportunity by one agent.
 *
 * Six independent cost dimensions are preserved. Do not add a derived
 * single-figure total to this record: the aggregation layer computes views,
 * and a stored scalar would become a second source of truth that drifts.
 */
export interface PreparationCostEvent {
  eventId: string;
  opportunityId: string;
  /** Agent commitment. */
  agentRef: string;
  serviceType: VentureServiceType;
  startedAt: string;
  completedAt: string;
  elapsedMs: number;
  modelTokens?: number;
  computeUnits?: number;
  /** Minor units as a decimal string — never a float. */
  externalCostMinorUnits?: string;
  humanTimeMs?: number;
  evidenceRefs: string[];
  /** The receipt that attests this work was performed. */
  receiptRef: string;
}

// ─── Constitutional completion (V-8) ────────────────────────────────────────

/**
 * The seven links of constitutional process an opportunity must receive
 * (charter §8.7). Scored PER OPPORTUNITY including opportunities that never
 * executed — that is the entire point of the metric.
 */
export const CONSTITUTIONAL_COMPLETION_CHECKS = [
  'market-assessment',
  'authority-verification',
  'risk-review',
  'execution-eligibility-decision',
  'evidence-record',
  'dvn-receipt',
  'reconciliation-closure',
] as const;

export type ConstitutionalCompletionCheck = (typeof CONSTITUTIONAL_COMPLETION_CHECKS)[number];

/**
 * How the opportunity concluded, constitutionally. `refused-complete` is a
 * SUCCESS class: service completed constitutionally / execution declined.
 * It must never be encoded as a failed trade.
 */
export type ConstitutionalOutcomeClass =
  | 'executed-complete'
  | 'refused-complete'
  | 'incomplete'
  | 'unauthorised';

export interface ConstitutionalCompletionVerdict {
  opportunityId: string;
  experimentalCellId: string;
  assessedAt: string;
  checks: Record<ConstitutionalCompletionCheck, boolean>;
  missingChecks: ConstitutionalCompletionCheck[];
  /** All seven checks present AND no unauthorised expansion of authority. */
  complete: boolean;
  outcomeClass: ConstitutionalOutcomeClass;
  /** An agent acted beyond its delegated authority — voids completion outright. */
  unauthorisedExpansion: boolean;
  evidenceRefs: string[];
  receiptRef: string;
}

// ─── Service-economy ledger (V-2 / V-7 / V-9) ───────────────────────────────

/** Why a liability came into existence. */
export type ServiceObligationBasis =
  | 'service-completed'
  | 'correct-refusal'
  | 'execution-completed'
  | 'verification-completed'
  | 'reconciliation-completed';

/**
 * One component service covered by an obligation (RULING 3).
 *
 * A bundled obligation carries ONE terminal basis — `correct-refusal` where
 * refusal is the constitutionally valid terminal outcome, because refusal is
 * the load-bearing outcome for H3 and labelling the bundle merely "completed"
 * would erase the distinction under test. But the aggregate label must not
 * falsely imply that ALL the bundled work was refusal: the discovery, analysis,
 * verification and risk review inside that same bundle were COMPLETED services.
 * So the component bases are preserved alongside the terminal basis rather than
 * flattened into it.
 *
 * There is deliberately NO `mixed` terminal basis. It would add vocabulary
 * without improving the Phase 1 treatment distinction — revisit only when
 * settlement or reporting needs multiple simultaneous terminal bases.
 */
export interface ServiceObligationComponent {
  serviceType: VentureServiceType;
  basis: ServiceObligationBasis;
  /** How this one component ended. Derived from its basis, never asserted. */
  disposition: 'completed' | 'refused';
}

export type ServiceObligationState =
  | 'proposed'
  | 'earned'
  | 'approved'
  | 'settled'
  | 'reversed'
  | 'disputed';

export interface ServiceObligation {
  obligationId: string;
  opportunityId: string;
  /** Commitment of the agent owed the compensation. */
  beneficiaryAgentRef: string;
  /** Commitment of the operator-funded budget holder. */
  funderRef: string;
  /**
   * The obligation's TERMINAL basis. For a bundle this is the terminal outcome
   * of the bundled work, not a summary of it — read `components` for that.
   */
  basis: ServiceObligationBasis;
  /**
   * Every service this obligation compensates, with its own basis. Populated
   * for both pricing structures: one entry under `per-service`, one per bundled
   * service under `bundled`. Never empty — an obligation with no components
   * would be a liability for no identifiable work.
   */
  components: ServiceObligationComponent[];
  denomination: VentureDenomination;
  /** Minor units, decimal string. Simulated — no live value moves. */
  amountMinorUnits: string;
  compensationRegime: VentureCompensationContingency;
  state: ServiceObligationState;
  createdAt: string;
  /**
   * When the liability came into existence. THE seam: in the
   * constitutional-completion regime this is the service-completion time; in
   * the execution-contingent regime it is the execution time and the
   * obligation does not exist at all before it.
   */
  earnedAt?: string;
  settledAt?: string;
  receiptRefs: string[];
  /** The cell this entry belongs to — without it no entry is attributable. */
  experimentalCellId: string;
  /** Which service the obligation compensates (per-service pricing only). */
  serviceType?: VentureServiceType;
}

/**
 * An *ex ante* operator-funded service budget (R-9). A levy on executed trades
 * is prohibited in the confirmatory arm: it would recreate execution
 * contingency at the pool level after removing it at the agent level.
 */
export interface ServiceBudget {
  budgetId: string;
  /** Commitment of the funding principal. */
  funderRef: string;
  denomination: VentureDenomination;
  allocatedMinorUnits: string;
  /** Earned + approved, not yet settled. */
  obligatedMinorUnits: string;
  settledMinorUnits: string;
  /** allocated − obligated − settled. Must never go negative. */
  remainingMinorUnits: string;
}

// ─── Standing admission (V-10) ──────────────────────────────────────────────

/**
 * Contribution classes Standing MAY recognise from trading activity. Every one
 * is a property of the WORK, not of the money — that is the whole distinction
 * the guard exists to hold.
 */
export type StandingContributionType =
  | 'correctness'
  | 'veracity'
  | 'proof-quality'
  | 'constitutional-completeness'
  | 'correct-refusal'
  | 'risk-detection'
  | 'authority-compliance'
  | 'reproducibility'
  | 'service-reliability'
  | 'reconciliation-quality'
  | 'no-unauthorised-expansion'
  /**
   * HONEST REPORTING OF A NEGATIVE OR NULL RESULT (operator ruling, 2026-07-29,
   * extending the gate to research contributions).
   *
   * THE RESEARCH ANALOGUE OF `correct-refusal`, and it carries the same weight
   * for the same reason. A capstone or experiment that correctly reports "this
   * approach does not work, and here is the evidence" is the outcome the
   * conventional incentive punishes — publication bias is exactly the
   * volume-and-positive-results ordering V-10 exists to prevent, wearing an
   * academic hat. Ranking it below a positive finding would quietly deny the
   * charter's own rule while appearing to honour it.
   */
  | 'negative-result-reporting';

/** Existing Standing lanes — this guard admits INTO them, it does not add one. */
export type StandingLane = 'personal' | 'delegated' | 'stewardship';

export interface StandingSignalDecision {
  admissible: boolean;
  lane?: StandingLane;
  contributionType?: StandingContributionType;
  /** Contribution weight in CVS units. Absent/0 when inadmissible. */
  weight?: number;
  /** Every basis refused, and why. Populated even on an admissible decision. */
  refusalReasons: string[];
  evidenceRefs: string[];
}
