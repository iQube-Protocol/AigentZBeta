/**
 * The eight-cell replay runner and reconciliation.
 *
 * Three scenarios × eight cells = 24 deterministic runs. The same scenario runs
 * in every cell WITHOUT code changes — the cell is a parameter threaded through
 * `runVentureScenario`, never a branch. Phase 1 is deterministic simulation, so
 * the marginal cost of the full factorial over a four-cell slice is close to
 * zero; that is why running all eight is affordable and why collapsing to a
 * slice would trade away the interaction term for nothing.
 *
 * REPLAY IS THE POINT. Running the same scenario in the same cell twice must
 * produce identical ledgers, receipts and costs. If it does not, no comparison
 * between cells means anything, because a difference could always be noise.
 * `replayIsStable` compares two independent runs structurally.
 *
 * Reconciliation checks the accounting identities that must hold in every run,
 * plus the correspondence between the ledger and the receipt stream — because
 * the ledger is an accounting VIEW composed from receipted events, and a ledger
 * that can assert what the receipt stream cannot corroborate has forked the
 * record. A fork would be discovered during audit rather than before.
 */

import { VENTURE_EXPERIMENT_CELLS } from './experimentCells';
import { runVentureScenario, type RunOptions, type VentureScenarioRun } from './runScenario';
import { VENTURE_SCENARIOS, type VentureScenario } from './scenarios';
import { aggregatePreparationCost, type PreparationCostAggregate } from './preparationCost';
import { constitutionalCompletenessRate } from './completionVerdict';

/** Run one scenario across the full factorial. */
export function runScenarioAcrossCells(
  scenario: VentureScenario,
  options?: RunOptions,
): VentureScenarioRun[] {
  return VENTURE_EXPERIMENT_CELLS.map((cell) => runVentureScenario(scenario, cell, options));
}

/** The full 3 × 8 = 24-run matrix. */
export function runFullVentureMatrix(options?: RunOptions): VentureScenarioRun[] {
  return VENTURE_SCENARIOS.flatMap((s) => runScenarioAcrossCells(s, options));
}

export interface RunReconciliation {
  runId: string;
  scenarioId: string;
  experimentalCellId: string;
  /** Every violated accounting or correspondence identity. Empty = reconciled. */
  violations: string[];
  obligationCount: number;
  obligationsEarnedWithoutExecution: number;
  settledMinorUnits: string;
  remainingMinorUnits: string;
  receiptCount: number;
  cost: PreparationCostAggregate;
  completenessRate: number;
}

/**
 * Reconcile one run. Every check is an identity that must hold regardless of
 * cell, scenario or outcome — so a violation is a defect in the substrate, not
 * an experimental result.
 */
export function reconcileRun(run: VentureScenarioRun): RunReconciliation {
  const violations: string[] = [];
  const { ledger, journal } = run;

  for (const budget of ledger.budgets) {
    const allocated = BigInt(budget.allocatedMinorUnits);
    const obligated = BigInt(budget.obligatedMinorUnits);
    const settled = BigInt(budget.settledMinorUnits);
    const remaining = BigInt(budget.remainingMinorUnits);
    // Identity 1 — the budget balances.
    if (allocated !== obligated + settled + remaining) {
      violations.push(
        `budget ${budget.budgetId}: allocated ${allocated} != obligated ${obligated} + settled ${settled} + remaining ${remaining}`,
      );
    }
    // Identity 2 — an operator-funded budget cannot go negative. A negative
    // remainder would mean the substrate promised value it was never given,
    // which is the failure mode a levy-funded model would hide.
    if (remaining < 0n) violations.push(`budget ${budget.budgetId}: remaining is negative (${remaining})`);
    // Identity 3 — the budget's denomination is the cell's denomination.
    if (budget.denomination !== run.cell.denomination) {
      violations.push(`budget ${budget.budgetId}: denomination ${budget.denomination} != cell ${run.cell.denomination}`);
    }
  }

  const receiptRefs = new Set(journal.receipts.map((r) => r.receiptRef));
  for (const o of ledger.obligations) {
    // Identity 4 — the ledger never asserts what the receipt stream cannot
    // corroborate. Every obligation names at least one receipt, and every
    // receipt it names exists.
    if (o.receiptRefs.length === 0) violations.push(`obligation ${o.obligationId}: no receipt reference`);
    for (const ref of o.receiptRefs) {
      if (!receiptRefs.has(ref)) violations.push(`obligation ${o.obligationId}: receipt ${ref} not in journal`);
    }
    // Identity 5 — every entry is attributable to a cell, or the whole
    // factorial comparison is unrecoverable after the fact.
    if (o.experimentalCellId !== run.experimentalCellId) {
      violations.push(`obligation ${o.obligationId}: cell ${o.experimentalCellId} != run ${run.experimentalCellId}`);
    }
    // Identity 6 — a liability that exists has a moment at which it came into
    // existence. An obligation with no `earnedAt` cannot be attributed to a
    // regime, which is the only thing the two regimes differ in.
    if (!o.earnedAt) violations.push(`obligation ${o.obligationId}: earned with no earnedAt`);
    // Identity 7 — the obligation's regime is the cell's regime.
    if (o.compensationRegime !== run.cell.compensationContingency) {
      violations.push(`obligation ${o.obligationId}: regime ${o.compensationRegime} != cell ${run.cell.compensationContingency}`);
    }
  }

  // Identity 8 — pending work is fully consumed or explicitly declined; work
  // must never be left in limbo, neither compensated nor refused with a reason.
  if (ledger.pending.length > 0 && ledger.declined.length === 0) {
    violations.push(`${ledger.pending.length} services left pending with no recorded decline`);
  }

  // Identity 9 — every cost event names a receipt that exists.
  for (const e of run.costEvents) {
    if (!receiptRefs.has(e.receiptRef)) violations.push(`cost event ${e.eventId}: receipt ${e.receiptRef} not in journal`);
  }

  // Identity 10 — an inadmissible Standing decision never reaches contributions.
  for (const c of run.standingContributions) {
    if (!c.admissible) violations.push('an inadmissible Standing decision reached standingContributions');
  }

  return {
    runId: run.runId,
    scenarioId: run.scenarioId,
    experimentalCellId: run.experimentalCellId,
    violations,
    obligationCount: ledger.obligations.length,
    obligationsEarnedWithoutExecution: ledger.obligations.filter((o) => o.basis === 'correct-refusal').length,
    settledMinorUnits: ledger.budgets[0]?.settledMinorUnits ?? '0',
    remainingMinorUnits: ledger.budgets[0]?.remainingMinorUnits ?? '0',
    receiptCount: journal.receipts.length,
    cost: aggregatePreparationCost(run.costEvents),
    completenessRate: constitutionalCompletenessRate([run.verdict]),
  };
}

export interface MatrixReconciliation {
  runs: RunReconciliation[];
  totalRuns: number;
  reconciledRuns: number;
  violations: string[];
}

export function reconcileMatrix(runs: readonly VentureScenarioRun[]): MatrixReconciliation {
  const reconciliations = runs.map(reconcileRun);
  return {
    runs: reconciliations,
    totalRuns: reconciliations.length,
    reconciledRuns: reconciliations.filter((r) => r.violations.length === 0).length,
    violations: reconciliations.flatMap((r) => r.violations.map((v) => `${r.runId}: ${v}`)),
  };
}

/**
 * A structural fingerprint of a run — everything replay must reproduce
 * exactly. Deliberately includes the OBSERVABLE TIMING of every obligation
 * (`earnedAt`), not merely its existence: a substrate that created the right
 * obligations at the wrong moments would otherwise fingerprint identically.
 */
export function runFingerprint(run: VentureScenarioRun): string {
  return JSON.stringify({
    runId: run.runId,
    cell: run.experimentalCellId,
    status: run.opportunity.status,
    verdict: {
      outcomeClass: run.verdict.outcomeClass,
      complete: run.verdict.complete,
      missing: run.verdict.missingChecks,
    },
    cost: aggregatePreparationCost(run.costEvents),
    obligations: run.ledger.obligations.map((o) => [
      o.obligationId,
      o.basis,
      o.amountMinorUnits,
      o.denomination,
      o.state,
      o.earnedAt,
      o.settledAt,
      o.compensationRegime,
    ]),
    budgets: run.ledger.budgets.map((b) => [b.budgetId, b.obligatedMinorUnits, b.settledMinorUnits, b.remainingMinorUnits]),
    receipts: run.journal.receipts.map((r) => [r.receiptRef, r.actionType, r.at, r.refusalKind ?? null]),
    checkpoints: run.journal.checkpoints.map((c) => [c.checkpointRef, c.eventCount, c.commitment]),
    standing: run.standingContributions.map((s) => [s.contributionType, s.weight, s.lane]),
    risk: run.riskSignals.map((r) => [r.kind, r.agentRef]),
  });
}

/** Two independent runs of the same scenario in the same cell must match. */
export function replayIsStable(scenario: VentureScenario, options?: RunOptions): boolean {
  return VENTURE_EXPERIMENT_CELLS.every((cell) => {
    const a = runFingerprint(runVentureScenario(scenario, cell, options));
    const b = runFingerprint(runVentureScenario(scenario, cell, options));
    return a === b;
  });
}
