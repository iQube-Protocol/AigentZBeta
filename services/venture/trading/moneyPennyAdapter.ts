/**
 * The thin MoneyPenny simulation adapter (operator RULING 6).
 *
 * MoneyPenny is the Constitutional Financial Services Agent
 * (`services/agents/specialistRouter.ts`, `MONEYPENNY_CARTRIDGE` in
 * `data/codex-configs.ts`). This connects her to the VL-CT-001 substrate so
 * that the chain can be exercised END TO END by an agent rather than only by a
 * test:
 *
 *   opportunity → preparation events → completeness verdict →
 *   correct refusal or execution → obligation → simulated settlement →
 *   DVN receipt artifact → Standing admission decision
 *
 * ─── What this is NOT ───────────────────────────────────────────────────────
 *
 * Not production orchestration. Explicitly out of scope, and the adapter is
 * shaped so that none of it can happen by accident:
 *
 *   live settlement          — settlement is a ledger state transition; there
 *                              is no wallet, no rail, no chain call anywhere
 *                              under this module, and `liveFunds` is a literal
 *                              `false` on every outcome.
 *   multi-agent orchestration— one submission runs one scenario. No router, no
 *                              handoff, no delegation.
 *   external agents          — the participating agents are scenario fixtures.
 *                              Nothing is called out of process.
 *   real funds               — the budget is a simulated operator-funded
 *                              allocation in minor units.
 *   dashboards               — this returns a value. It renders nothing.
 *
 * ─── One fixed opportunity ──────────────────────────────────────────────────
 *
 * There is no opportunity parameter. MoneyPenny submits THE fixed opportunity
 * or nothing — a Phase 1 adapter that accepted an arbitrary opportunity would
 * be the production intake surface with a different name. The fixed opportunity
 * is the correct-refusal one, because refusal is the load-bearing outcome for
 * H3 and it is the branch a commission-led system cannot express at all.
 *
 * ─── It reuses the engine, it does not fork it ──────────────────────────────
 *
 * `runVentureScenario` runs the chain and `reconcileRun` checks it. This module
 * adds NO simulation logic of its own: it selects the fixed opportunity, calls
 * the engine, and projects the run into a shape a conversational agent can
 * report. Any behaviour that looked like it belonged here would belong in the
 * engine, where the 24-run replay and every canary already cover it.
 *
 * Deterministic, like everything else in this directory: no clock, no
 * randomness. The submission reference derives from the opportunity and the
 * cell, so the same submission is the same reference forever.
 */

import type { SpecialistId } from '@/services/agents/specialistRouter';
import { parseVentureExperimentCellId, ventureExperimentCellId } from './experimentCells';
import { aggregatePreparationCost, type PreparationCostAggregate } from './preparationCost';
import { reconcileRun, type RunReconciliation } from './replay';
import { runVentureScenario, type VentureScenarioRun } from './runScenario';
import { SCENARIO_CORRECT_REFUSAL } from './scenarios';
import { describeObligationOutcome } from './serviceLedger';
import { ventureJournalArtifacts, type VentureJournalArtifacts } from './receipts';
import { ventureObligationRef } from './refs';
import type { CompensationDisclosure } from './compensationExtension';
import type {
  ConstitutionalCompletionCheck,
  ConstitutionalOutcomeClass,
  ServiceObligationBasis,
  StandingContributionType,
  StandingLane,
  VentureDenomination,
  VentureExperimentCell,
} from './types';

/** Versioned so a later, wider adapter is a new version rather than a silent change. */
export const MONEYPENNY_ADAPTER_VERSION = 'moneypenny-simulation/1';

/** The specialist this adapter speaks for — the id the router already uses. */
export const MONEYPENNY_SPECIALIST_ID: SpecialistId = 'moneypenny';

/** Her cartridge's slug, as registered in `data/codex-configs.ts`. */
export const MONEYPENNY_CARTRIDGE_SLUG = 'moneypenny';

/**
 * THE fixed opportunity. One, by design (see the header). The key is a stable
 * label, not the scenario's own id — so the adapter's public surface does not
 * hand callers the engine's internal fixture identifiers.
 */
export const MONEYPENNY_FIXED_OPPORTUNITY = 'mp-sim-001-suitability-refusal';

/** The cell a submission runs in when the caller does not name one. */
export const MONEYPENNY_DEFAULT_CELL_ID = 'USDC-SERVICE-COMPLETE';

/**
 * Resolved from the identifier, not written out a second time — the cell
 * configuration and its id are one source of truth (`experimentCells.ts`).
 */
const DEFAULT_CELL: VentureExperimentCell = (() => {
  const cell = parseVentureExperimentCellId(MONEYPENNY_DEFAULT_CELL_ID);
  if (!cell) throw new Error(`MoneyPenny default cell ${MONEYPENNY_DEFAULT_CELL_ID} is not a ratified cell`);
  return cell;
})();

export interface MoneyPennySubmission {
  /**
   * Which experiment cell to run in. Every one of the eight is valid — the cell
   * is a parameter of the engine, not a branch, so the adapter passes it
   * through rather than restricting it.
   */
  cell?: VentureExperimentCell;
  /** R-8 disclosure mode for compensation-bearing receipts. */
  disclosure?: CompensationDisclosure;
}

/** How the opportunity ended. Three outcomes, none of them a "failed trade". */
export type MoneyPennyTerminalDisposition =
  | 'correct-refusal'
  | 'execution'
  | 'no-valid-completion';

export interface MoneyPennyObligationView {
  /** Commitment, never the ledger row id. */
  obligationRef: string;
  /** The TERMINAL basis, always reported with its components (RULING 3). */
  terminalBasis: ServiceObligationBasis;
  components: string[];
  denomination: VentureDenomination;
  amountMinorUnits: string;
  state: string;
  earnedAt?: string;
}

export interface MoneyPennySimulationOutcome {
  adapter: typeof MONEYPENNY_ADAPTER_VERSION;
  specialistId: SpecialistId;
  cartridgeSlug: string;
  /** Deterministic — the same submission is the same reference forever. */
  submissionRef: string;
  opportunityKey: string;
  experimentalCellId: string;
  /** Literal falses. A reader never has to infer that nothing real moved. */
  liveFunds: false;
  externalAgents: false;

  // ── the chain, in order ────────────────────────────────────────────────
  opportunity: {
    opportunityRef: string;
    requestedService: string;
    status: string;
    notionalMinorUnits?: string;
  };
  preparation: {
    events: number;
    aggregate: PreparationCostAggregate;
  };
  completeness: {
    complete: boolean;
    outcomeClass: ConstitutionalOutcomeClass;
    linksPerformed: number;
    linksRequired: number;
    missingChecks: ConstitutionalCompletionCheck[];
  };
  terminal: {
    disposition: MoneyPennyTerminalDisposition;
    executed: boolean;
  };
  obligations: MoneyPennyObligationView[];
  settlement: {
    simulated: true;
    denomination: VentureDenomination;
    obligationsSettled: number;
    settledMinorUnits: string;
    remainingMinorUnits: string;
  };
  /** Generated and hashed; NOT persisted and NOT anchored (RULING 2). */
  receipts: VentureJournalArtifacts;
  standing: {
    decisions: number;
    admitted: { lane?: StandingLane; contributionType?: StandingContributionType; weight?: number }[];
    /**
     * Admitted here means "the gate did not refuse it". It is NOT an accrual:
     * these signals reach the Standing service only after Slice C defines how
     * an admitted signal maps into Personal / Delegated / Stewardship /
     * Capability Standing (RULING 4).
     */
    accrualDeferredUntil: 'slice-c';
  };
  /** The engine's own reconciliation. Empty `violations` = the run holds. */
  reconciliation: RunReconciliation;
}

/** Which of the seven constitutional links the opportunity received. */
const CONSTITUTIONAL_LINKS_REQUIRED = 7;

function terminalDisposition(run: VentureScenarioRun): MoneyPennyTerminalDisposition {
  if (!run.verdict.complete) return 'no-valid-completion';
  return run.verdict.outcomeClass === 'refused-complete' ? 'correct-refusal' : 'execution';
}

/**
 * Submit the fixed opportunity, run it through the existing scenario engine,
 * and return the reconciled outcome. Pure: no I/O, no clock, no funds.
 */
export function submitMoneyPennyOpportunity(
  submission: MoneyPennySubmission = {},
): MoneyPennySimulationOutcome {
  const cell = submission.cell ?? DEFAULT_CELL;
  const experimentalCellId = ventureExperimentCellId(cell);

  // The engine, unforked. Everything below this line is projection.
  const run = runVentureScenario(SCENARIO_CORRECT_REFUSAL, cell, {
    ...(submission.disclosure ? { disclosure: submission.disclosure } : {}),
  });
  const reconciliation = reconcileRun(run);
  const budget = run.ledger.budgets[0];

  return {
    adapter: MONEYPENNY_ADAPTER_VERSION,
    specialistId: MONEYPENNY_SPECIALIST_ID,
    cartridgeSlug: MONEYPENNY_CARTRIDGE_SLUG,
    submissionRef: `${MONEYPENNY_FIXED_OPPORTUNITY}--${experimentalCellId}`,
    opportunityKey: MONEYPENNY_FIXED_OPPORTUNITY,
    experimentalCellId,
    liveFunds: false,
    externalAgents: false,

    opportunity: {
      // The commitment the receipts carry — never the raw opportunity id.
      opportunityRef: run.journal.receipts[0]?.opportunityRef ?? '',
      requestedService: run.opportunity.requestedService,
      status: run.opportunity.status,
      ...(run.opportunity.notionalMinorUnits
        ? { notionalMinorUnits: run.opportunity.notionalMinorUnits }
        : {}),
    },
    preparation: {
      events: run.costEvents.length,
      aggregate: aggregatePreparationCost(run.costEvents),
    },
    completeness: {
      complete: run.verdict.complete,
      outcomeClass: run.verdict.outcomeClass,
      linksPerformed: CONSTITUTIONAL_LINKS_REQUIRED - run.verdict.missingChecks.length,
      linksRequired: CONSTITUTIONAL_LINKS_REQUIRED,
      missingChecks: [...run.verdict.missingChecks],
    },
    terminal: {
      disposition: terminalDisposition(run),
      executed: run.verdict.outcomeClass === 'executed-complete',
    },
    obligations: run.ledger.obligations.map((o) => {
      const described = describeObligationOutcome(o);
      return {
        obligationRef: ventureObligationRef(o.obligationId),
        terminalBasis: described.terminalBasis,
        components: described.components,
        denomination: o.denomination,
        amountMinorUnits: o.amountMinorUnits,
        state: o.state,
        ...(o.earnedAt ? { earnedAt: o.earnedAt } : {}),
      };
    }),
    settlement: {
      simulated: true,
      denomination: cell.denomination,
      obligationsSettled: run.ledger.obligations.filter((o) => o.state === 'settled').length,
      settledMinorUnits: budget?.settledMinorUnits ?? '0',
      remainingMinorUnits: budget?.remainingMinorUnits ?? '0',
    },
    receipts: ventureJournalArtifacts(run.journal),
    standing: {
      decisions: run.standingDecisions.length,
      admitted: run.standingContributions.map((c) => ({
        ...(c.lane ? { lane: c.lane } : {}),
        ...(c.contributionType ? { contributionType: c.contributionType } : {}),
        ...(c.weight === undefined ? {} : { weight: c.weight }),
      })),
      accrualDeferredUntil: 'slice-c',
    },
    reconciliation,
  };
}

/**
 * The outcome as lines MoneyPenny can say. T1-safe: commitments and vocabulary
 * only, no raw identifier and no amount beyond what the ledger already holds in
 * simulated minor units.
 *
 * Every line that could be misread as a real-world claim carries its
 * qualification IN the line — "simulated", "not anchored", "not an accrual" —
 * because a summary is the surface most likely to be quoted out of context.
 */
export function summariseMoneyPennySimulation(outcome: MoneyPennySimulationOutcome): string[] {
  const lines = [
    `Opportunity ${outcome.opportunityKey} submitted in cell ${outcome.experimentalCellId} (simulation — no live funds, no external agents).`,
    `Preparation: ${outcome.preparation.events} measured service events, ${outcome.preparation.aggregate.elapsedMs}ms elapsed, ${outcome.preparation.aggregate.evidenceCount} evidence records.`,
    `Constitutional completeness: ${outcome.completeness.outcomeClass} (${outcome.completeness.linksPerformed}/${outcome.completeness.linksRequired} links).`,
    `Terminal disposition: ${outcome.terminal.disposition}.`,
  ];
  for (const o of outcome.obligations) {
    lines.push(
      `Obligation ${o.obligationRef} — terminal basis: ${o.terminalBasis}; components: ${o.components.join(' · ')}.`,
    );
  }
  if (outcome.obligations.length === 0) {
    lines.push('No compensation liability arose in this cell — the regime defers liability to execution.');
  }
  lines.push(
    `Settlement: ${outcome.settlement.obligationsSettled} obligation(s) settled, ${outcome.settlement.settledMinorUnits} ${outcome.settlement.denomination} minor units against the operator-funded budget (SIMULATED — a ledger state transition, no transfer).`,
    `Receipts: ${outcome.receipts.artifacts.length} generated and hashed; NOT persisted, NOT DVN-anchored.`,
    `Standing: ${outcome.standing.admitted.length} of ${outcome.standing.decisions} signal(s) admitted by the neutrality gate — an admission, not an accrual; accrual waits on Slice C.`,
    outcome.reconciliation.violations.length === 0
      ? 'Reconciliation: clean.'
      : `Reconciliation: ${outcome.reconciliation.violations.length} violation(s) — ${outcome.reconciliation.violations.join('; ')}.`,
  );
  return lines;
}
