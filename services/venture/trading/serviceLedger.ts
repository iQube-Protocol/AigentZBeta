/**
 * V-2 / V-7 — the service-economy ledger, and the liability-timing seam.
 *
 * ─── THE SEAM IS THE WHOLE POINT ─────────────────────────────────────────────
 *
 * The two compensation regimes differ in exactly one respect: **when a
 * liability comes into existence.**
 *
 *   execution-contingent
 *     service completed → NO liability → execution occurs → liability created
 *
 *   constitutional-completion-contingent
 *     service completed constitutionally → liability created →
 *     execution OR correct refusal → the obligation survives EITHER
 *
 * An implementation that creates every obligation at execution and back-fills
 * the refusals will typecheck, pass review, produce plausible ledgers — and
 * measure NOTHING, because the two treatments become structurally identical and
 * the refusal path never generates the obligation the hypothesis is about. That
 * failure is invisible in the output: every figure computes.
 *
 * So the timing decision lives in ONE pure predicate, `liabilityArisesAt`, and
 * both regimes flow through structurally symmetric code below — neither is a
 * special case grafted onto the other. The regimes are distinguished ONLY by
 * which event that predicate admits. `tests/venture-trading-substrate.test.ts`
 * mutation-tests this seam directly, asserting not merely that obligations
 * exist but WHEN they were earned, against timestamps taken from scenario
 * fixtures.
 *
 * ─── What pricing structure changes (and what it does not) ───────────────────
 *
 * Pricing structure changes HOW MANY obligations an opportunity produces and at
 * what amounts — `bundled` yields one obligation for the opportunity,
 * `per-service` one per completed service. It does NOT change when liability
 * arises. Keeping the two axes orthogonal in code is what makes the
 * `*-SERVICE-EXEC` vs `*-SERVICE-COMPLETE` interaction (charter §8.6) a real
 * comparison rather than an artifact of the implementation.
 *
 * ─── Funding (R-9) ──────────────────────────────────────────────────────────
 *
 * Compensation is funded from an *ex ante* operator-funded service budget. A
 * levy on executed trades is prohibited in the confirmatory arm — it would
 * recreate execution contingency at the pool level after removing it at the
 * agent level. Balances here are SIMULATED. `settleObligation` is a state
 * transition; no value moves, there is no wallet, and there is no chain call.
 *
 * Deterministic throughout: no clock, no randomness. Every timestamp is passed
 * in from scenario fixtures; obligation ids are derived from a per-run counter.
 */

import type {
  ServiceBudget,
  ServiceObligation,
  ServiceObligationBasis,
  ServiceObligationState,
  VentureCompensationContingency,
  VentureDenomination,
  VentureExperimentCell,
  VentureServiceType,
} from './types';
import { ventureExperimentCellId } from './experimentCells';

/** The two events at which a liability could conceivably come into existence. */
export type LiabilityEvent = 'constitutional-completion' | 'execution';

/**
 * ── THE SEAM ──
 *
 * Does a liability come into existence at THIS event, under THIS regime?
 *
 * Read the two branches side by side: they admit DIFFERENT events. That
 * asymmetry is the experimental manipulation. Collapsing them — returning
 * `event === 'execution'` for both, or ignoring `regime` — makes the two arms
 * identical and silently voids the experiment.
 */
export function liabilityArisesAt(
  regime: VentureCompensationContingency,
  event: LiabilityEvent,
  completedConstitutionally: boolean,
): boolean {
  if (regime === 'constitutional-completion-contingent') {
    // Liability attaches to the CONSTITUTIONAL COMPLETION of the delegated
    // service, and to nothing else. Execution is downstream of a liability that
    // already exists, so it creates none — and a correct refusal, which is a
    // completed service, creates one on exactly the same footing as an
    // execution would.
    return event === 'constitutional-completion' && completedConstitutionally;
  }
  // Execution-contingent: nothing is owed until the trade executes. Completed
  // service earns nothing; a correct refusal earns nothing, because the
  // execution that would have triggered the liability never happens.
  return event === 'execution';
}

/** Work completed and registered, awaiting whatever event creates its liability. */
export interface PendingServiceRecord {
  opportunityId: string;
  beneficiaryAgentRef: string;
  serviceType: VentureServiceType;
  /** Price of this service under per-service pricing, minor units. */
  priceMinorUnits: string;
  completedAt: string;
  constitutionallyComplete: boolean;
  basis: ServiceObligationBasis;
  receiptRef: string;
}

export interface ServiceEconomyLedger {
  /** Stable per-run id — obligation ids derive from it, so replay reproduces them. */
  runId: string;
  cell: VentureExperimentCell;
  experimentalCellId: string;
  budgets: ServiceBudget[];
  obligations: ServiceObligation[];
  pending: PendingServiceRecord[];
  /** Refusals to create an obligation, with the reason. Never silent. */
  declined: { opportunityId: string; event: LiabilityEvent; reason: string }[];
  /** Deterministic obligation-id counter. */
  seq: number;
}

export function createLedger(runId: string, cell: VentureExperimentCell): ServiceEconomyLedger {
  return {
    runId,
    cell,
    experimentalCellId: ventureExperimentCellId(cell),
    budgets: [],
    obligations: [],
    pending: [],
    declined: [],
    seq: 0,
  };
}

/** Allocate an *ex ante* operator-funded budget (R-9). */
export function allocateServiceBudget(
  ledger: ServiceEconomyLedger,
  input: { budgetId: string; funderRef: string; denomination: VentureDenomination; allocatedMinorUnits: string },
): ServiceBudget {
  const budget: ServiceBudget = {
    budgetId: input.budgetId,
    funderRef: input.funderRef,
    denomination: input.denomination,
    allocatedMinorUnits: input.allocatedMinorUnits,
    obligatedMinorUnits: '0',
    settledMinorUnits: '0',
    remainingMinorUnits: input.allocatedMinorUnits,
  };
  ledger.budgets.push(budget);
  return budget;
}

function budgetFor(ledger: ServiceEconomyLedger, funderRef: string): ServiceBudget | undefined {
  return ledger.budgets.find(
    (b) => b.funderRef === funderRef && b.denomination === ledger.cell.denomination,
  );
}

/**
 * Recompute a budget's three derived figures from the obligations themselves.
 * Derived rather than incrementally maintained: an incremental counter is a
 * second source of truth that drifts from the rows the moment a transition is
 * missed, and reconciliation would then be checking the counter against itself.
 */
function recomputeBudget(ledger: ServiceEconomyLedger, budget: ServiceBudget): void {
  let obligated = 0n;
  let settled = 0n;
  for (const o of ledger.obligations) {
    if (o.funderRef !== budget.funderRef || o.denomination !== budget.denomination) continue;
    if (o.state === 'settled') settled += BigInt(o.amountMinorUnits);
    else if (o.state === 'earned' || o.state === 'approved' || o.state === 'disputed') {
      obligated += BigInt(o.amountMinorUnits);
    }
    // 'reversed' and 'proposed' encumber nothing.
  }
  budget.obligatedMinorUnits = obligated.toString();
  budget.settledMinorUnits = settled.toString();
  budget.remainingMinorUnits = (BigInt(budget.allocatedMinorUnits) - obligated - settled).toString();
}

function nextObligationId(ledger: ServiceEconomyLedger): string {
  ledger.seq += 1;
  return `${ledger.runId}-obl-${String(ledger.seq).padStart(3, '0')}`;
}

/**
 * Register a service that has been performed. This NEVER creates a liability by
 * itself — it records the work and its constitutional status. Which event turns
 * it into a liability is decided by `liabilityArisesAt`, and by nothing else.
 */
export function recordServiceCompletion(
  ledger: ServiceEconomyLedger,
  record: PendingServiceRecord,
): void {
  ledger.pending.push(record);
}

interface CreateObligationsInput {
  opportunityId: string;
  funderRef: string;
  /** The event now occurring. */
  event: LiabilityEvent;
  /** Whether the opportunity completed constitutionally (verdict.complete). */
  completedConstitutionally: boolean;
  /** Timestamp of this event, from scenario fixtures. */
  at: string;
  /** Bundle price used under `bundled` pricing, minor units. */
  bundlePriceMinorUnits: string;
  receiptRef: string;
}

/**
 * Apply a liability event to an opportunity's pending work.
 *
 * Both regimes call THIS function at BOTH events. The regime never selects a
 * different code path — it only changes the answer `liabilityArisesAt` gives.
 * That symmetry is deliberate: it is what makes "the refusal path never
 * generates an obligation" a property of the experimental manipulation rather
 * than of an if-branch someone forgot to write.
 */
export function applyLiabilityEvent(
  ledger: ServiceEconomyLedger,
  input: CreateObligationsInput,
): ServiceObligation[] {
  const regime = ledger.cell.compensationContingency;

  if (!liabilityArisesAt(regime, input.event, input.completedConstitutionally)) {
    ledger.declined.push({
      opportunityId: input.opportunityId,
      event: input.event,
      reason:
        regime === 'execution-contingent'
          ? 'execution-contingent-regime-defers-liability-to-execution'
          : 'completion-contingent-liability-already-attached-at-constitutional-completion',
    });
    return [];
  }

  const pending = ledger.pending.filter((p) => p.opportunityId === input.opportunityId);
  if (pending.length === 0) {
    ledger.declined.push({
      opportunityId: input.opportunityId,
      event: input.event,
      reason: 'no-completed-service-to-compensate',
    });
    return [];
  }

  const budget = budgetFor(ledger, input.funderRef);
  if (!budget) {
    ledger.declined.push({
      opportunityId: input.opportunityId,
      event: input.event,
      reason: 'no-service-budget-for-funder',
    });
    return [];
  }

  // Pricing structure decides HOW MANY obligations and at what amounts. It does
  // not, and must not, touch the timing decision made above.
  const drafts =
    ledger.cell.pricingStructure === 'bundled'
      ? [
          {
            beneficiaryAgentRef: pending[0].beneficiaryAgentRef,
            amountMinorUnits: input.bundlePriceMinorUnits,
            basis: bundleBasis(pending),
            serviceType: undefined as VentureServiceType | undefined,
            receiptRef: input.receiptRef,
          },
        ]
      : pending.map((p) => ({
          beneficiaryAgentRef: p.beneficiaryAgentRef,
          amountMinorUnits: p.priceMinorUnits,
          basis: p.basis,
          serviceType: p.serviceType as VentureServiceType | undefined,
          receiptRef: p.receiptRef,
        }));

  const created: ServiceObligation[] = [];
  for (const draft of drafts) {
    if (BigInt(budget.remainingMinorUnits) < BigInt(draft.amountMinorUnits)) {
      ledger.declined.push({
        opportunityId: input.opportunityId,
        event: input.event,
        reason: 'service-budget-exhausted',
      });
      continue;
    }
    const obligation: ServiceObligation = {
      obligationId: nextObligationId(ledger),
      opportunityId: input.opportunityId,
      beneficiaryAgentRef: draft.beneficiaryAgentRef,
      funderRef: input.funderRef,
      basis: draft.basis,
      denomination: ledger.cell.denomination,
      amountMinorUnits: draft.amountMinorUnits,
      compensationRegime: regime,
      state: 'earned',
      createdAt: input.at,
      // The seam, made observable: `earnedAt` is the time of the event that
      // created the liability. Under completion-contingency that is the
      // constitutional-completion time; under execution-contingency it is the
      // execution time. A test can therefore assert WHEN, not merely whether.
      earnedAt: input.at,
      receiptRefs: [draft.receiptRef, input.receiptRef].filter(
        (r, i, a) => r && a.indexOf(r) === i,
      ),
      experimentalCellId: ledger.experimentalCellId,
      ...(draft.serviceType ? { serviceType: draft.serviceType } : {}),
    };
    ledger.obligations.push(obligation);
    created.push(obligation);
    recomputeBudget(ledger, budget);
  }

  // Pending work is consumed once it has produced its obligations, so a later
  // event on the same opportunity cannot compensate the same work twice.
  ledger.pending = ledger.pending.filter((p) => p.opportunityId !== input.opportunityId);
  return created;
}

/**
 * The basis a bundled obligation carries. A bundle containing a correct refusal
 * is recorded as `correct-refusal`, not as `service-completed`: the charter's
 * claim is that the refusal IS the compensable act, and a bundle that flattened
 * it to a generic completion would erase the one classification H3 reads.
 */
function bundleBasis(pending: readonly PendingServiceRecord[]): ServiceObligationBasis {
  if (pending.some((p) => p.basis === 'correct-refusal')) return 'correct-refusal';
  if (pending.some((p) => p.basis === 'execution-completed')) return 'execution-completed';
  return 'service-completed';
}

function transition(
  ledger: ServiceEconomyLedger,
  obligationId: string,
  from: readonly ServiceObligationState[],
  to: ServiceObligationState,
  at: string,
  receiptRef: string,
): ServiceObligation | null {
  const o = ledger.obligations.find((x) => x.obligationId === obligationId);
  if (!o || !from.includes(o.state)) return null;
  o.state = to;
  if (to === 'settled') o.settledAt = at;
  if (!o.receiptRefs.includes(receiptRef)) o.receiptRefs.push(receiptRef);
  const budget = budgetFor(ledger, o.funderRef);
  if (budget) recomputeBudget(ledger, budget);
  return o;
}

/** Operator approval of an earned obligation. */
export function approveObligation(
  ledger: ServiceEconomyLedger,
  obligationId: string,
  at: string,
  receiptRef: string,
): ServiceObligation | null {
  return transition(ledger, obligationId, ['earned'], 'approved', at, receiptRef);
}

/**
 * SIMULATED settlement — a state transition against a simulated
 * operator-funded balance. No transfer, no wallet, no chain call, no live
 * value. Phase 1 tests the incentive structure, not the payment rail.
 */
export function settleObligationSimulated(
  ledger: ServiceEconomyLedger,
  obligationId: string,
  at: string,
  receiptRef: string,
): ServiceObligation | null {
  return transition(ledger, obligationId, ['approved'], 'settled', at, receiptRef);
}

/** Reversal — an obligation created or settled in error. */
export function reverseObligation(
  ledger: ServiceEconomyLedger,
  obligationId: string,
  at: string,
  receiptRef: string,
): ServiceObligation | null {
  return transition(ledger, obligationId, ['earned', 'approved', 'settled'], 'reversed', at, receiptRef);
}

/** Dispute — contested, still encumbering the budget until resolved. */
export function disputeObligation(
  ledger: ServiceEconomyLedger,
  obligationId: string,
  at: string,
  receiptRef: string,
): ServiceObligation | null {
  return transition(ledger, obligationId, ['earned', 'approved', 'settled'], 'disputed', at, receiptRef);
}

/** Obligations attached to one opportunity. */
export function obligationsForOpportunity(
  ledger: ServiceEconomyLedger,
  opportunityId: string,
): ServiceObligation[] {
  return ledger.obligations.filter((o) => o.opportunityId === opportunityId);
}

/**
 * Compensation earned on a NON-EXECUTED outcome — the single measurement H3
 * turns on, and the one an execution-keyed schema cannot express at all.
 */
export function obligationsEarnedWithoutExecution(
  ledger: ServiceEconomyLedger,
): ServiceObligation[] {
  return ledger.obligations.filter((o) => o.basis === 'correct-refusal');
}
