/**
 * The chain, made executable.
 *
 *   opportunity → work performed → preparation cost measured →
 *   constitutional completion/refusal determined → liability created →
 *   ledger entry → DVN receipt → Standing-safe outcome
 *
 * `runVentureScenario` walks one scenario fixture through one experiment cell.
 * The SAME scenario runs in all eight cells with no code changes — the cell is
 * a parameter, never a branch. That is what makes the eight-cell replay a
 * comparison rather than eight separately-written programs.
 *
 * Determinism is a hard constraint, not an aspiration: no clock, no randomness,
 * no I/O anywhere in this path. Every timestamp comes from the fixture and
 * every id is derived from `runId`. A source canary greps this module (and its
 * siblings) for `Date.now(`, `Math.random(` and `new Date(`, because a single
 * clock read would make replay worthless while leaving every other test green.
 *
 * Ordering note, and it is load-bearing: the constitutional-completion liability
 * event is applied BEFORE the execution liability event, in that order, always.
 * Under completion-contingency the obligation therefore exists — and is
 * observable, with `earnedAt` equal to the verdict time — before execution is
 * even considered. Reversing the order would produce the same final ledger and
 * destroy the ability to tell the two regimes apart.
 */

import { createHash } from 'crypto';
import {
  assessConstitutionalCompletion,
} from './completionVerdict';
import { buildCompensationExtension, type CompensationDisclosure } from './compensationExtension';
import { ventureExperimentCellId } from './experimentCells';
import {
  allocateServiceBudget,
  applyLiabilityEvent,
  approveObligation,
  createLedger,
  recordServiceCompletion,
  settleObligationSimulated,
  type ServiceEconomyLedger,
} from './serviceLedger';
import {
  checkpointCostEvents,
  createReceiptJournal,
  emitReservedVentureReceipt,
  emitVentureReceipt,
  reserveReceiptRef,
  type VentureReceiptJournal,
} from './receipts';
import {
  ventureAgentRef,
  ventureDelegationRef,
  ventureFunderRef,
  ventureOpportunityRef,
  venturePrincipalRef,
  ventureSourceCommitment,
} from './refs';
import { evaluateTradingStandingSignal } from './standingAdmission';
import type { VentureScenario } from './scenarios';
import type {
  ConstitutionalCompletionVerdict,
  PreparationCostEvent,
  StandingSignalDecision,
  VentureExperimentCell,
  VentureOpportunity,
} from './types';

/** A risk/penalty observation. Kept OUT of Standing on purpose — see below. */
export interface VentureRiskSignal {
  agentRef: string;
  kind: 'unauthorised-authority-expansion' | 'constitutionally-incomplete';
  opportunityRef: string;
  evidenceRefs: string[];
}

export interface VentureScenarioRun {
  runId: string;
  scenarioId: string;
  experimentalCellId: string;
  cell: VentureExperimentCell;
  opportunity: VentureOpportunity;
  costEvents: PreparationCostEvent[];
  verdict: ConstitutionalCompletionVerdict;
  ledger: ServiceEconomyLedger;
  journal: VentureReceiptJournal;
  /** Every decision the Standing gate made, admissible or not. */
  standingDecisions: StandingSignalDecision[];
  /**
   * ONLY the admissible decisions. This is what a Standing accrual would
   * consume. The gate's refusals are DISCARDED here by construction — a run
   * that folded every decision into this list would render the gate inert
   * while still importing and calling it, which is the "gate whose refusal is
   * thrown away" defect shape.
   */
  standingContributions: StandingSignalDecision[];
  /**
   * Risk/penalty observations. Deliberately a SEPARATE channel from Standing:
   * the charter's rule is that a prohibited or incomplete outcome earns no
   * POSITIVE Standing, not that it should be expressed as negative Standing.
   * Folding a penalty into the Standing number would make one figure carry two
   * incompatible meanings.
   */
  riskSignals: VentureRiskSignal[];
}

export interface RunOptions {
  /** R-8 disclosure mode for compensation-bearing receipts. */
  disclosure?: CompensationDisclosure;
}

/** Stable, UUID-free run id — receipt and obligation ids derive from it. */
export function ventureRunId(scenarioId: string, cell: VentureExperimentCell): string {
  return `${scenarioId}--${ventureExperimentCellId(cell)}`;
}

export function runVentureScenario(
  scenario: VentureScenario,
  cell: VentureExperimentCell,
  options: RunOptions = {},
): VentureScenarioRun {
  const disclosure: CompensationDisclosure = options.disclosure ?? 'open';
  const experimentalCellId = ventureExperimentCellId(cell);
  const runId = ventureRunId(scenario.scenarioId, cell);
  const opportunityRef = ventureOpportunityRef(scenario.opportunityId);

  const journal = createReceiptJournal(runId, experimentalCellId);
  const ledger = createLedger(runId, cell);
  const funderRef = ventureFunderRef(scenario.funderPersonaId);

  allocateServiceBudget(ledger, {
    budgetId: `${runId}-budget`,
    funderRef,
    denomination: cell.denomination,
    allocatedMinorUnits: scenario.budgetMinorUnits,
  });

  // ── 1. Opportunity opened ────────────────────────────────────────────────
  const opportunity: VentureOpportunity = {
    opportunityId: scenario.opportunityId,
    experimentId: scenario.experimentId,
    scenarioId: scenario.scenarioId,
    experimentalCellId,
    createdAt: scenario.createdAt,
    requestedService: scenario.requestedService,
    ...(scenario.requestedOutcome ? { requestedOutcome: scenario.requestedOutcome } : {}),
    principalRef: venturePrincipalRef(scenario.principalPersonaId),
    delegationRefs: scenario.delegationGrantIds.map(ventureDelegationRef),
    participatingAgentRefs: Object.values(scenario.agents).map(ventureAgentRef),
    status: 'open',
    sourceCommitment: ventureSourceCommitment(scenario.source),
    notionalMinorUnits: scenario.notionalMinorUnits,
  };

  emitVentureReceipt(journal, {
    actionType: 'venture_opportunity_opened',
    at: scenario.createdAt,
    experimentalCellId,
    opportunityRef,
    summary: `Opportunity presented for constitutional assessment: ${scenario.requestedService}`,
    evidenceRefs: [opportunity.sourceCommitment],
  });

  opportunity.status = 'evaluating';

  // ── 2. Work performed, cost measured, services registered ────────────────
  const costEvents: PreparationCostEvent[] = [];
  for (const svc of scenario.services) {
    const agentRef = ventureAgentRef(scenario.agents[svc.agentKey]);
    // Reserve the reference first so the cost event and the ledger's pending
    // record can both name the receipt that attests the work.
    const receiptRef = reserveReceiptRef(journal);

    costEvents.push({
      eventId: `${runId}-cost-${svc.key}`,
      opportunityId: scenario.opportunityId,
      agentRef,
      serviceType: svc.serviceType,
      startedAt: svc.startedAt,
      completedAt: svc.completedAt,
      elapsedMs: svc.elapsedMs,
      modelTokens: svc.modelTokens,
      computeUnits: svc.computeUnits,
      humanTimeMs: svc.humanTimeMs,
      externalCostMinorUnits: svc.externalCostMinorUnits,
      evidenceRefs: [...svc.evidence],
      receiptRef,
    });

    emitReservedVentureReceipt(journal, receiptRef, {
      actionType: 'venture_service_completed',
      at: svc.completedAt,
      experimentalCellId,
      opportunityRef,
      summary: `Authorised service completed: ${svc.serviceType}`,
      evidenceRefs: [...svc.evidence],
    });

    // A refusal is a completed service, and it gets its OWN receipt saying so —
    // "service completed constitutionally / execution declined". This is the
    // encoding §8.8 requires and that a failed-trade encoding cannot express.
    if (svc.isRefusal) {
      emitVentureReceipt(journal, {
        actionType: 'venture_refusal_recorded',
        at: svc.completedAt,
        experimentalCellId,
        opportunityRef,
        summary:
          'Service completed constitutionally; execution declined on the evidence considered',
        evidenceRefs: [...svc.evidence],
        refusalKind: 'constitutional-service-refusal',
      });
    }

    recordServiceCompletion(ledger, {
      opportunityId: scenario.opportunityId,
      beneficiaryAgentRef: agentRef,
      serviceType: svc.serviceType,
      priceMinorUnits: svc.priceMinorUnits,
      completedAt: svc.completedAt,
      constitutionallyComplete: svc.constitutionallyComplete,
      basis: svc.basis,
      receiptRef,
    });
  }

  // Ordinary cost lines are batch-checkpointed into one recomputable
  // commitment rather than individually anchored (R-6).
  checkpointCostEvents(
    journal,
    costEvents.map((e) =>
      createHash('sha256')
        .update(
          [e.eventId, e.agentRef, e.serviceType, e.elapsedMs, e.modelTokens ?? 0, e.externalCostMinorUnits ?? '0'].join(
            ':',
          ),
        )
        .digest('hex')
        .slice(0, 16),
    ),
    scenario.completion.assessedAt,
  );

  // ── 3. Constitutional completion determined ──────────────────────────────
  const verdictReceiptRef = reserveReceiptRef(journal);
  const verdict = assessConstitutionalCompletion({
    opportunityId: scenario.opportunityId,
    experimentalCellId,
    assessedAt: scenario.completion.assessedAt,
    checksPerformed: scenario.completion.checksPerformed,
    executed: scenario.completion.executed,
    ...(scenario.completion.refusalWasCorrect === undefined
      ? {}
      : { refusalWasCorrect: scenario.completion.refusalWasCorrect }),
    ...(scenario.completion.unauthorisedExpansion === undefined
      ? {}
      : { unauthorisedExpansion: scenario.completion.unauthorisedExpansion }),
    evidenceRefs: scenario.services.flatMap((s) => s.evidence),
    receiptRef: verdictReceiptRef,
  });

  emitReservedVentureReceipt(journal, verdictReceiptRef, {
    actionType: 'venture_completion_assessed',
    at: verdict.assessedAt,
    experimentalCellId,
    opportunityRef,
    summary: `Constitutional completion assessed: ${verdict.outcomeClass} (${7 - verdict.missingChecks.length}/7 links)`,
    evidenceRefs: verdict.evidenceRefs,
  });

  // ── 4. Liability events, in fixed order ──────────────────────────────────
  // Constitutional completion FIRST. Under completion-contingency the liability
  // exists from this moment, before execution is considered at all.
  const emitObligationReceipts = (
    obligations: ReturnType<typeof applyLiabilityEvent>,
    liabilityCreationEvent: 'constitutional-completion' | 'execution',
    at: string,
  ) => {
    for (const o of obligations) {
      const receipt = emitVentureReceipt(journal, {
        actionType: 'venture_obligation_earned',
        at,
        experimentalCellId,
        opportunityRef,
        summary: `Compensation liability created on basis ${o.basis} (${o.compensationRegime})`,
        evidenceRefs: [...o.receiptRefs],
        compensation: buildCompensationExtension(o, { disclosure, liabilityCreationEvent }),
      });
      if (!o.receiptRefs.includes(receipt.receiptRef)) o.receiptRefs.push(receipt.receiptRef);
    }
  };

  const completionObligations = applyLiabilityEvent(ledger, {
    opportunityId: scenario.opportunityId,
    funderRef,
    event: 'constitutional-completion',
    completedConstitutionally: verdict.complete,
    at: verdict.assessedAt,
    bundlePriceMinorUnits: scenario.bundlePriceMinorUnits,
    receiptRef: verdictReceiptRef,
  });
  emitObligationReceipts(completionObligations, 'constitutional-completion', verdict.assessedAt);

  // Execution SECOND, and only when the scenario actually executed. Nothing
  // back-fills an execution event for a refusal — that back-fill is precisely
  // what would make the two regimes structurally identical.
  if (scenario.executionAt) {
    opportunity.status = 'execution-approved';
    const executionReceiptRef = reserveReceiptRef(journal);
    emitReservedVentureReceipt(journal, executionReceiptRef, {
      actionType: 'venture_service_completed',
      at: scenario.executionAt,
      experimentalCellId,
      opportunityRef,
      summary: 'Execution completed under the approved eligibility decision',
      evidenceRefs: [verdictReceiptRef],
    });
    const executionObligations = applyLiabilityEvent(ledger, {
      opportunityId: scenario.opportunityId,
      funderRef,
      event: 'execution',
      completedConstitutionally: verdict.complete,
      at: scenario.executionAt,
      bundlePriceMinorUnits: scenario.bundlePriceMinorUnits,
      receiptRef: executionReceiptRef,
    });
    emitObligationReceipts(executionObligations, 'execution', scenario.executionAt);
  }

  // A ledger that declined to create ANY liability because the opportunity
  // never completed constitutionally is receipted as such — distinct from an
  // agent's constitutional refusal to execute.
  if (!verdict.complete && ledger.obligations.length === 0) {
    emitVentureReceipt(journal, {
      actionType: 'venture_refusal_recorded',
      at: verdict.assessedAt,
      experimentalCellId,
      opportunityRef,
      summary: `Compensation refused: no valid constitutional completion (${verdict.outcomeClass})`,
      evidenceRefs: [verdictReceiptRef],
      refusalKind: 'compensation-refused-no-valid-completion',
    });
  }

  // ── 5. Approval and simulated settlement ─────────────────────────────────
  for (const o of [...ledger.obligations]) {
    const approvalRef = reserveReceiptRef(journal);
    const approved = approveObligation(ledger, o.obligationId, scenario.approvalAt, approvalRef);
    if (!approved) continue;
    emitReservedVentureReceipt(journal, approvalRef, {
      actionType: 'venture_obligation_approved',
      at: scenario.approvalAt,
      experimentalCellId,
      opportunityRef,
      summary: `Obligation approved for settlement (${approved.basis})`,
      evidenceRefs: [],
      compensation: buildCompensationExtension(approved, {
        disclosure,
        liabilityCreationEvent: approved.earnedAt === verdict.assessedAt ? 'constitutional-completion' : 'execution',
      }),
    });

    const settlementRef = reserveReceiptRef(journal);
    const settled = settleObligationSimulated(ledger, o.obligationId, scenario.settlementAt, settlementRef);
    if (!settled) continue;
    emitReservedVentureReceipt(journal, settlementRef, {
      actionType: 'venture_settlement_simulated',
      at: scenario.settlementAt,
      experimentalCellId,
      opportunityRef,
      // Named "simulated" in the summary too, so a reader of the receipt stream
      // cannot mistake a Phase-1 artifact for a real transfer.
      summary: `Simulated settlement against operator-funded budget in ${settled.denomination} (no live value moved)`,
      evidenceRefs: [],
      compensation: buildCompensationExtension(settled, {
        disclosure,
        liabilityCreationEvent: settled.earnedAt === verdict.assessedAt ? 'constitutional-completion' : 'execution',
        settlementRef,
      }),
    });
  }

  // ── 6. Standing-safe outcome ─────────────────────────────────────────────
  const standingDecisions: StandingSignalDecision[] = [];
  const standingContributions: StandingSignalDecision[] = [];
  for (const claim of scenario.standingClaims) {
    const decision = evaluateTradingStandingSignal({
      opportunityId: scenario.opportunityId,
      agentRef: ventureAgentRef(scenario.agents[claim.agentKey]),
      proposedBases: claim.proposedBases,
      lane: claim.lane,
      evidenceRefs: claim.evidenceRefs,
      verdict,
    });
    standingDecisions.push(decision);
    // The gate's refusal is HONOURED here. Pushing unconditionally would leave
    // the gate imported, called, and inert.
    if (decision.admissible) standingContributions.push(decision);
  }

  const riskSignals: VentureRiskSignal[] = [];
  if (verdict.unauthorisedExpansion) {
    riskSignals.push({
      agentRef: ventureAgentRef(scenario.agents[scenario.standingClaims[0]?.agentKey] ?? Object.values(scenario.agents)[0]),
      kind: 'unauthorised-authority-expansion',
      opportunityRef,
      evidenceRefs: verdict.evidenceRefs,
    });
  } else if (!verdict.complete) {
    riskSignals.push({
      agentRef: opportunity.participatingAgentRefs[0],
      kind: 'constitutionally-incomplete',
      opportunityRef,
      evidenceRefs: verdict.evidenceRefs,
    });
  }

  // ── 7. Opportunity closed ────────────────────────────────────────────────
  opportunity.status = scenario.finalStatus;
  opportunity.closedAt = scenario.closedAt;
  emitVentureReceipt(journal, {
    actionType: 'venture_opportunity_closed',
    at: scenario.closedAt,
    experimentalCellId,
    opportunityRef,
    summary: `Opportunity closed with status ${scenario.finalStatus} and verdict ${verdict.outcomeClass}`,
    evidenceRefs: [verdictReceiptRef],
  });

  return {
    runId,
    scenarioId: scenario.scenarioId,
    experimentalCellId,
    cell,
    opportunity,
    costEvents,
    verdict,
    ledger,
    journal,
    standingDecisions,
    standingContributions,
    riskSignals,
  };
}
