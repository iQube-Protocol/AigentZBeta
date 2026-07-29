/**
 * The scenario runner, the fingerprint and replay stability.
 *
 * REPLAY IS THE POINT. Running the same scenario twice must produce identical
 * ledgers, settlements, receipts and refusals. If it does not, nothing the
 * substrate reports about an inter-ledger payment can be checked by re-running
 * it — and re-running it is the only check available in Phase 1, where there is
 * no chain to consult.
 *
 * The runner interprets a scenario's step script against the state machine. It
 * contains NO settlement logic: every step is a call into `./settlement.ts`, so
 * a refusal observed in a scenario is a property of the state machine and not of
 * the runner. Refusals are RECORDED rather than thrown, because several
 * scenarios exist specifically to prove that a refusal happened, and a thrown
 * refusal would end the script before the following steps could show what the
 * substrate does next.
 *
 * Deterministic: every timestamp comes from the scenario, every reference is
 * derived, and the commitment derivations are the canonical ones.
 */

import {
  reconcileBook,
  settlementSupplyReport,
  type BookReconciliation,
  type SettlementSupplyReport,
} from './reconciliation';
import {
  settlementAdvanceRef,
  settlementAuthorityRef,
  settlementBeneficiaryRef,
  settlementCreditRef,
  settlementDelegationRef,
  settlementInstructionRef,
  settlementMessageRef,
  settlementNonce,
  settlementPayerRef,
  settlementSourceDebitRef,
} from './refs';
import {
  completeDestinationCredit,
  expireSettlement,
  failDestinationCredit,
  failSourceDebit,
  finaliseSourceDebit,
  initiateSettlement,
  initiateSourceDebit,
  openSettlementBook,
  recordSettlementReconciled,
  reserveDestinationLiquidity,
  reverseSettlement,
  verifyAuthorityAndBalance,
  verifySettlementMessage,
  type SettlementBook,
} from './settlement';
import {
  fixtureLedgers,
  FIXTURE_ADVANCE_AUTHORITY,
  FIXTURE_ALICE,
  FIXTURE_BOB,
  FIXTURE_DELEGATION_GRANT,
  FIXTURE_TREASURY,
  type SettlementScenario,
  type SettlementStep,
} from './scenarios';
import type { SettlementOutcome, SettlementRefusal } from './types';

/** One step's observed result — kept whether it succeeded or was refused. */
export interface StepResult {
  index: number;
  kind: SettlementStep['kind'];
  settlementId: string;
  ok: boolean;
  refusal?: SettlementRefusal;
  detail?: string;
}

export interface SettlementScenarioRun {
  scenarioId: string;
  book: SettlementBook;
  steps: StepResult[];
  /** Supply BEFORE any step ran — the baseline for "settlement never mints". */
  supplyBefore: SettlementSupplyReport;
  supplyAfter: SettlementSupplyReport;
  reconciliation: BookReconciliation;
}

/** Every refusal the run recorded, in order. */
export function refusalsOf(run: SettlementScenarioRun): SettlementRefusal[] {
  return run.steps.filter((s) => !s.ok && s.refusal).map((s) => s.refusal as SettlementRefusal);
}

export function runSettlementScenario(scenario: SettlementScenario): SettlementScenarioRun {
  const payerRefs = {
    alice: settlementPayerRef(FIXTURE_ALICE),
    bob: settlementPayerRef(FIXTURE_BOB),
  };
  const beneficiaryRefs = {
    alice: settlementBeneficiaryRef(FIXTURE_ALICE),
    bob: settlementBeneficiaryRef(FIXTURE_BOB),
  };
  const treasuryRef = settlementPayerRef(FIXTURE_TREASURY);
  const delegationRef = settlementDelegationRef(FIXTURE_DELEGATION_GRANT);

  const book = openSettlementBook({
    bookId: scenario.scenarioId,
    ledgers: fixtureLedgers(payerRefs.alice, payerRefs.bob, treasuryRef, scenario.ledgerOverrides),
    mode: 'fixture',
  });

  const supplyBefore = settlementSupplyReport(book);
  const steps: StepResult[] = [];

  scenario.steps.forEach((step, index) => {
    const outcome = applyStep(book, step, { payerRefs, beneficiaryRefs, delegationRef });
    steps.push({
      index,
      kind: step.kind,
      settlementId: step.settlementId,
      ok: outcome.ok,
      ...(outcome.ok ? {} : { refusal: outcome.refusal, detail: outcome.detail }),
    });
  });

  return {
    scenarioId: scenario.scenarioId,
    book,
    steps,
    supplyBefore,
    supplyAfter: settlementSupplyReport(book),
    reconciliation: reconcileBook(book),
  };
}

interface RunRefs {
  payerRefs: Record<'alice' | 'bob', string>;
  beneficiaryRefs: Record<'alice' | 'bob', string>;
  delegationRef: string;
}

function applyStep(book: SettlementBook, step: SettlementStep, refs: RunRefs): SettlementOutcome {
  switch (step.kind) {
    case 'initiate': {
      const nonceSource = step.nonceFromSettlementId ?? step.settlementId;
      const nonceInstruction = step.nonceFromSettlementId
        ? (book.settlements[step.nonceFromSettlementId]?.instructionRef ?? step.instructionId)
        : step.instructionId;
      return initiateSettlement(book, {
        settlementId: step.settlementId,
        instructionRef: settlementInstructionRef(step.instructionId),
        nonce: settlementNonce(nonceInstruction, nonceSource),
        sourceDenomination: step.sourceDenomination,
        destinationDenomination: step.destinationDenomination,
        sourceNetwork: step.networkOverride?.source ?? (step.sourceDenomination === 'BCENT' ? 'bitcoin' : 'base'),
        destinationNetwork:
          step.networkOverride?.destination ?? (step.destinationDenomination === 'BCENT' ? 'bitcoin' : 'base'),
        amountMinorUnits: step.amountMinorUnits,
        // `rawPayerId` exists only to drive the T0 leakage refusal: it puts a
        // raw UUID where a commitment belongs, and the substrate must refuse it.
        payerRef: step.rawPayerId ?? refs.payerRefs[step.payer],
        beneficiaryRef: refs.beneficiaryRefs[step.beneficiary],
        delegationRef: refs.delegationRef,
        feeBreakdown: step.feeBreakdown ?? {},
        initiatedAt: step.initiatedAt,
        expiresAt: step.expiresAt,
      });
    }
    case 'verify-authority':
      return verifyAuthorityAndBalance(book, step.settlementId, step.at);
    case 'source-debit':
      return initiateSourceDebit(book, step.settlementId, {
        sourceDebitRef: settlementSourceDebitRef(step.debitId),
        at: step.at,
      });
    case 'finalise-debit':
      return finaliseSourceDebit(book, step.settlementId, {
        confirmations: step.confirmations,
        at: step.at,
      });
    case 'fail-source-debit':
      return failSourceDebit(book, step.settlementId, { detail: step.detail, at: step.at });
    case 'verify-message': {
      // A replayed message presents ANOTHER settlement's message reference.
      const replayed = step.messageIdFromSettlementId
        ? book.settlements[step.messageIdFromSettlementId]?.dvnMessageRef
        : undefined;
      const foreignNonce = step.nonceFromSettlementId
        ? book.settlements[step.nonceFromSettlementId]?.nonce
        : undefined;
      return verifySettlementMessage(book, step.settlementId, {
        dvnMessageRef: replayed ?? settlementMessageRef(step.messageId),
        nonce: foreignNonce ?? book.settlements[step.settlementId]?.nonce ?? '',
        at: step.at,
      });
    }
    case 'reserve':
      return reserveDestinationLiquidity(book, step.settlementId, step.at);
    case 'credit': {
      const replayedCredit = step.creditIdFromSettlementId
        ? book.settlements[step.creditIdFromSettlementId]?.destinationCreditRef
        : undefined;
      return completeDestinationCredit(book, step.settlementId, {
        destinationCreditRef: replayedCredit ?? settlementCreditRef(step.creditId),
        at: step.at,
        ...(step.advance
          ? {
              advance: {
                advanceRef: settlementAdvanceRef(step.advance.advanceId),
                // An "advance" with no authority named is the refusal case: an
                // advance is an authorised act, not a fallback the code takes.
                authorisedByRef: step.advance.unauthorised
                  ? ''
                  : settlementAuthorityRef(FIXTURE_ADVANCE_AUTHORITY),
              },
            }
          : {}),
      });
    }
    case 'fail-credit':
      return failDestinationCredit(book, step.settlementId, { detail: step.detail, at: step.at });
    case 'expire':
      return expireSettlement(book, step.settlementId, step.at);
    case 'reverse':
      return reverseSettlement(book, step.settlementId, {
        reversalRef: settlementSourceDebitRef(step.reversalId),
        detail: step.detail,
        at: step.at,
      });
    case 'reconcile':
      return recordSettlementReconciled(book, step.settlementId, step.at);
  }
}

/**
 * A structural fingerprint of a run — everything replay must reproduce exactly.
 *
 * It deliberately includes the REFUSALS and the observed ledger movements, not
 * merely the terminal states: a substrate that refused the right things at the
 * wrong moments, or that credited the right amount by a different route, would
 * otherwise fingerprint identically to a correct one.
 */
export function settlementFingerprint(run: SettlementScenarioRun): string {
  return JSON.stringify({
    scenarioId: run.scenarioId,
    steps: run.steps.map((s) => [s.index, s.kind, s.settlementId, s.ok, s.refusal ?? null]),
    settlements: run.book.settlementOrder.map((id) => {
      const s = run.book.settlements[id];
      return [
        s.settlementId,
        s.state,
        s.amountMinorUnits,
        s.sourceDebitedMinorUnits ?? null,
        s.destinationCreditedMinorUnits ?? null,
        s.sourceDebitFinalisedAt ?? null,
        s.settledAt ?? null,
        s.liquidityAdvance?.advanceRef ?? null,
      ];
    }),
    ledgers: (['BCENT', 'BASE_QC'] as const).map((d) => {
      const l = run.book.ledgers[d];
      return [
        d,
        l.issuedMinorUnits,
        l.settlementLiquidityMinorUnits,
        l.reservedLiquidityMinorUnits,
        l.feesCollectedMinorUnits,
        Object.entries(l.balances)
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([holder, balance]) => `${holder}:${balance}`),
      ];
    }),
    receipts: run.book.journal.receipts.map((r) => [
      r.receiptRef,
      r.actionType,
      r.at,
      r.amountMinorUnits ?? null,
      r.valueCommitted ?? null,
    ]),
    exceptions: run.book.exceptions.map((e) => [e.settlementId, e.refusal, e.valueCommitted, e.at]),
  });
}

/** Two independent runs of the same scenario must match. */
export function settlementReplayIsStable(scenario: SettlementScenario): boolean {
  return (
    settlementFingerprint(runSettlementScenario(scenario)) ===
    settlementFingerprint(runSettlementScenario(scenario))
  );
}
