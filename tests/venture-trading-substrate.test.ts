/**
 * VL-CT-001 venture substrate — V-1, V-2 and V-10 as one integrated chain.
 *
 *   opportunity → work performed → preparation cost measured →
 *   constitutional completion/refusal determined → liability created →
 *   ledger entry → DVN receipt → Standing-safe outcome
 *
 * These are not coverage tests. Each block below is a CANARY over a property
 * that, if broken, produces output that still looks entirely plausible:
 *
 *  - liability created at the wrong moment → both regimes measure the same
 *    thing and the experiment silently measures nothing;
 *  - a refusal producing no obligation under completion-contingency → the one
 *    measurement H3 turns on disappears;
 *  - a raw personaId on a receipt → a T0 identifier crosses the chain boundary;
 *  - a clock read in the replay path → replay stops being replay;
 *  - Standing admitting profit/volume/execution-count → the execution bias
 *    removed from the payment system re-enters through the reputation system,
 *    and the experiment's own result masks it.
 *
 * Expected values are written down here by hand wherever the code under test
 * could otherwise supply them. A canary that derives its expectation with the
 * same predicate as the code it guards proves only that the code equals itself.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './_lib/sourceAuthority';

import {
  VENTURE_EXPERIMENT_CELLS,
  VENTURE_EXPERIMENT_CELL_IDS,
  parseVentureExperimentCellId,
  ventureExperimentCellId,
} from '@/services/venture/trading/experimentCells';
import {
  evaluateTradingStandingSignal,
  PROHIBITED_STANDING_BASES,
} from '@/services/venture/trading/standingAdmission';
import {
  aggregatePreparationCost,
  costByServiceType,
  costOfCorrectlyRefusedOpportunities,
  costOfExecutedOpportunities,
  costPerAgent,
  costPerConstitutionallyCompletedService,
  costPerOpportunity,
} from '@/services/venture/trading/preparationCost';
import { assessConstitutionalCompletion } from '@/services/venture/trading/completionVerdict';
import { liabilityArisesAt } from '@/services/venture/trading/serviceLedger';
import { buildCompensationExtension } from '@/services/venture/trading/compensationExtension';
import { emitVentureReceipt, VENTURE_RECEIPT_ACTION_TYPES } from '@/services/venture/trading/receipts';
import { runVentureScenario } from '@/services/venture/trading/runScenario';
import {
  reconcileMatrix,
  replayIsStable,
  runFingerprint,
  runFullVentureMatrix,
  runScenarioAcrossCells,
} from '@/services/venture/trading/replay';
import {
  SCENARIO_APPROVED_EXECUTED,
  SCENARIO_CORRECT_REFUSAL,
  SCENARIO_UNAUTHORISED_INCOMPLETE,
  VENTURE_SCENARIOS,
} from '@/services/venture/trading/scenarios';
import { RAW_UUID_PATTERN } from '@/services/venture/trading/refs';
import type { VentureExperimentCell } from '@/services/venture/trading/types';

const TRADING_DIR = join(process.cwd(), 'services', 'venture', 'trading');

const cellById = (id: string): VentureExperimentCell => {
  const cell = parseVentureExperimentCellId(id);
  if (!cell) throw new Error(`unknown cell ${id}`);
  return cell;
};

// ───────────────────────────────────────────────────────────────────────────
// AC-1 — the experiment cube: eight derived cells, no bare arm letters
// ───────────────────────────────────────────────────────────────────────────

describe('AC-1 experiment cells are derived, and bare arm letters are prohibited', () => {
  it('derives exactly the eight ratified cell identifiers', () => {
    // Hand-written, in the charter's own order. NOT computed from the module
    // under test — that would assert the derivation equals itself.
    const expected = [
      'USDC-BUNDLED-EXEC',
      'USDC-BUNDLED-COMPLETE',
      'USDC-SERVICE-EXEC',
      'USDC-SERVICE-COMPLETE',
      'BASEQC-BUNDLED-EXEC',
      'BASEQC-BUNDLED-COMPLETE',
      'BASEQC-SERVICE-EXEC',
      'BASEQC-SERVICE-COMPLETE',
    ];
    expect([...VENTURE_EXPERIMENT_CELL_IDS].sort()).toEqual([...expected].sort());
    expect(VENTURE_EXPERIMENT_CELLS).toHaveLength(8);
  });

  it('round-trips every identifier back to its configuration', () => {
    for (const cell of VENTURE_EXPERIMENT_CELLS) {
      const id = ventureExperimentCellId(cell);
      expect(parseVentureExperimentCellId(id)).toEqual(cell);
    }
    expect(parseVentureExperimentCellId('ARM-A')).toBeNull();
  });

  it('no substrate source or scenario record uses a bare arm letter as a cell id', () => {
    // The prohibition is on A/B/C/D standing IN FOR a cell. Grep for the shapes
    // that would express that: `arm: 'A'`, `"cell": "B"`, `ARM_C`, `cell-D`.
    const bareArm = /\b(?:arm|cell)\s*[:=-]\s*['"]?[A-D]['"]?(?![\w-])/i;
    for (const file of readdirSync(TRADING_DIR)) {
      const src = stripComments(readFileSync(join(TRADING_DIR, file), 'utf8'));
      expect(bareArm.test(src), `${file} names a cell by a bare arm letter`).toBe(false);
    }
    // And every cell id a run actually stamps is one of the eight derived ones.
    for (const run of runScenarioAcrossCells(SCENARIO_APPROVED_EXECUTED)) {
      expect(VENTURE_EXPERIMENT_CELL_IDS).toContain(run.experimentalCellId);
      expect(run.experimentalCellId).not.toMatch(/^[A-D]$/);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-2 — V-10 Standing guard: prohibited bases refused
// ───────────────────────────────────────────────────────────────────────────

describe('AC-2 Standing refuses commercial metrics as constitutional signals', () => {
  // Hand-written. If the module's own list shrank, this test still demands all
  // seven be refused.
  const commercialMetrics = [
    'transaction-volume',
    'executed-trade-count',
    'revenue-generated',
    'fees-generated',
    'realised-profit',
    'notional-value',
    'execution-frequency',
  ];

  it('refuses a signal whose only bases are commercial metrics', () => {
    for (const basis of commercialMetrics) {
      const decision = evaluateTradingStandingSignal({
        opportunityId: 'opp-1',
        agentRef: 'a1b2c3d4e5f60718',
        proposedBases: [basis],
        lane: 'delegated',
        evidenceRefs: ['ev-1'],
      });
      expect(decision.admissible, `${basis} was admitted into Standing`).toBe(false);
      expect(decision.weight ?? 0).toBe(0);
      expect(decision.refusalReasons).toContain(`prohibited-basis:${basis}`);
    }
  });

  it('the module declares every commercial metric as prohibited', () => {
    for (const basis of commercialMetrics) {
      expect([...PROHIBITED_STANDING_BASES]).toContain(basis);
    }
  });

  it('strips a prohibited basis from a mixed claim rather than letting it add weight', () => {
    const clean = evaluateTradingStandingSignal({
      opportunityId: 'opp-1',
      agentRef: 'a1b2c3d4e5f60718',
      proposedBases: ['correct-refusal'],
      lane: 'delegated',
      evidenceRefs: ['ev-1'],
    });
    const contaminated = evaluateTradingStandingSignal({
      opportunityId: 'opp-1',
      agentRef: 'a1b2c3d4e5f60718',
      proposedBases: ['correct-refusal', 'realised-profit', 'notional-value'],
      lane: 'delegated',
      evidenceRefs: ['ev-1'],
    });
    // Adding profit and notional must not move the number by a single unit.
    expect(contaminated.weight).toBe(clean.weight);
    expect(contaminated.refusalReasons).toContain('prohibited-basis:realised-profit');
    expect(contaminated.refusalReasons).toContain('prohibited-basis:notional-value');
  });

  it('permits the constitutional bases, and requires evidence', () => {
    const permitted = evaluateTradingStandingSignal({
      opportunityId: 'opp-1',
      agentRef: 'a1b2c3d4e5f60718',
      proposedBases: ['correctness', 'proof-quality'],
      lane: 'personal',
      evidenceRefs: ['ev-1'],
    });
    expect(permitted.admissible).toBe(true);
    expect(permitted.weight).toBeGreaterThan(0);

    const unevidenced = evaluateTradingStandingSignal({
      opportunityId: 'opp-1',
      agentRef: 'a1b2c3d4e5f60718',
      proposedBases: ['correctness'],
      lane: 'personal',
      evidenceRefs: [],
    });
    expect(unevidenced.admissible).toBe(false);
    expect(unevidenced.refusalReasons).toContain('no-evidence');
  });

  it('refuses an unauthorised expansion EVEN when the caller claims completeness', () => {
    // Isolating canary. In practice `assessConstitutionalCompletion` already
    // forces `complete: false` whenever authority was exceeded, so the two
    // guards overlap and either alone would refuse the S3 fixture. That overlap
    // is exactly what makes this branch untested by scenario runs — and it is
    // the branch that protects the gate from a caller who computes completeness
    // some other way. So drive it directly with the shape only such a caller
    // could produce.
    const decision = evaluateTradingStandingSignal({
      opportunityId: 'opp-x',
      agentRef: 'eeee5555ffff6666',
      proposedBases: ['correctness', 'constitutional-completeness'],
      lane: 'delegated',
      evidenceRefs: ['ev-x'],
      verdict: { complete: true, outcomeClass: 'executed-complete', unauthorisedExpansion: true },
    });
    expect(decision.admissible).toBe(false);
    expect(decision.weight ?? 0).toBe(0);
    expect(decision.refusalReasons).toContain('unauthorised-authority-expansion');
  });

  it('refuses a signal carrying a raw persona identifier instead of a commitment', () => {
    const decision = evaluateTradingStandingSignal({
      opportunityId: 'opp-1',
      agentRef: '9e5b0c73-1d84-42af-b607-8c25f31a94d6',
      proposedBases: ['correctness'],
      lane: 'personal',
      evidenceRefs: ['ev-1'],
    });
    expect(decision.admissible).toBe(false);
    expect(decision.refusalReasons).toContain('agentRef-is-a-raw-identifier-not-a-commitment');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-3 — THE V-10 PAIRED CANARY. The one that proves V-10 is real.
// ───────────────────────────────────────────────────────────────────────────

describe('AC-3 a profitable-but-incomplete execution must not outrank a correct refusal', () => {
  // Agent A: executed a profitable transaction. The process has a hole — no
  // risk review, no reconciliation. This is the agent a commission-led system
  // rewards most.
  const agentAVerdict = assessConstitutionalCompletion({
    opportunityId: 'opp-A',
    experimentalCellId: 'USDC-SERVICE-EXEC',
    assessedAt: '2026-07-29T12:00:00.000Z',
    checksPerformed: ['market-assessment', 'authority-verification', 'evidence-record', 'dvn-receipt'],
    executed: true,
    evidenceRefs: ['ev-A-execution'],
    receiptRef: 'rcpt-A',
  });

  // Agent B: correctly refused an unsuitable opportunity, with the full seven
  // links and complete evidence. Zero revenue generated.
  const agentBVerdict = assessConstitutionalCompletion({
    opportunityId: 'opp-B',
    experimentalCellId: 'USDC-SERVICE-EXEC',
    assessedAt: '2026-07-29T12:00:00.000Z',
    checksPerformed: [
      'market-assessment',
      'authority-verification',
      'risk-review',
      'execution-eligibility-decision',
      'evidence-record',
      'dvn-receipt',
      'reconciliation-closure',
    ],
    executed: false,
    refusalWasCorrect: true,
    evidenceRefs: ['ev-B-refusal-basis', 'ev-B-evidence-considered'],
    receiptRef: 'rcpt-B',
  });

  const agentA = evaluateTradingStandingSignal({
    opportunityId: 'opp-A',
    agentRef: 'aaaa1111bbbb2222',
    proposedBases: ['realised-profit', 'executed-trade-count', 'revenue-generated'],
    lane: 'delegated',
    evidenceRefs: ['ev-A-execution'],
    verdict: agentAVerdict,
  });

  const agentB = evaluateTradingStandingSignal({
    opportunityId: 'opp-B',
    agentRef: 'cccc3333dddd4444',
    proposedBases: ['correct-refusal', 'risk-detection', 'constitutional-completeness'],
    lane: 'delegated',
    evidenceRefs: ['ev-B-refusal-basis', 'ev-B-evidence-considered'],
    verdict: agentBVerdict,
  });

  it('the verdicts are what the pairing claims (guard against a vacuous pairing)', () => {
    expect(agentAVerdict.complete).toBe(false);
    expect(agentAVerdict.outcomeClass).toBe('incomplete');
    expect(agentBVerdict.complete).toBe(true);
    expect(agentBVerdict.outcomeClass).toBe('refused-complete');
  });

  it('Agent A gains NO Standing from profit or execution alone', () => {
    expect(agentA.admissible).toBe(false);
    expect(agentA.weight ?? 0).toBe(0);
    expect(agentA.refusalReasons).toContain('prohibited-basis:realised-profit');
    expect(agentA.refusalReasons).toContain('prohibited-basis:executed-trade-count');
  });

  it('Agent B CAN earn Standing for the evidenced refusal', () => {
    expect(agentB.admissible).toBe(true);
    expect(agentB.weight ?? 0).toBeGreaterThan(0);
    expect(agentB.contributionType).toBe('correct-refusal');
  });

  it('the correct refusal outranks the profitable-but-incomplete execution', () => {
    expect(agentB.weight ?? 0).toBeGreaterThan(agentA.weight ?? 0);
  });

  it('even offering only CONSTITUTIONAL bases, an incomplete execution earns nothing', () => {
    // Closes the obvious escape: relabel the profit claim as constitutional and
    // it must still fail, because the process itself was incomplete.
    const relabelled = evaluateTradingStandingSignal({
      opportunityId: 'opp-A',
      agentRef: 'aaaa1111bbbb2222',
      proposedBases: ['correctness', 'constitutional-completeness'],
      lane: 'delegated',
      evidenceRefs: ['ev-A-execution'],
      verdict: agentAVerdict,
    });
    expect(relabelled.admissible).toBe(false);
    expect(relabelled.refusalReasons).toContain('constitutionally-incomplete');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-4 — the liability-timing seam
// ───────────────────────────────────────────────────────────────────────────

describe('AC-4 liability comes into existence at DIFFERENT events in the two regimes', () => {
  it('the seam predicate admits different events per regime', () => {
    // Execution-contingent: completed service creates nothing; execution does.
    expect(liabilityArisesAt('execution-contingent', 'constitutional-completion', true)).toBe(false);
    expect(liabilityArisesAt('execution-contingent', 'execution', true)).toBe(true);
    // Completion-contingent: the mirror image.
    expect(liabilityArisesAt('constitutional-completion-contingent', 'constitutional-completion', true)).toBe(true);
    expect(liabilityArisesAt('constitutional-completion-contingent', 'execution', true)).toBe(false);
    // And completion-contingency requires the completion to be constitutional.
    expect(liabilityArisesAt('constitutional-completion-contingent', 'constitutional-completion', false)).toBe(false);
  });

  it('under completion-contingency the obligation is earned AT THE VERDICT, before execution', () => {
    const run = runVentureScenario(SCENARIO_APPROVED_EXECUTED, cellById('USDC-SERVICE-COMPLETE'));
    expect(run.ledger.obligations.length).toBeGreaterThan(0);
    for (const o of run.ledger.obligations) {
      // The fixture's verdict time, written down in the scenario — not read
      // back from the ledger. This is what makes the timing observable rather
      // than merely inferable.
      expect(o.earnedAt).toBe('2026-07-29T09:05:30.000Z');
      expect(o.earnedAt).not.toBe(SCENARIO_APPROVED_EXECUTED.executionAt);
    }
  });

  it('under execution-contingency the obligation is earned AT EXECUTION, not at completion', () => {
    const run = runVentureScenario(SCENARIO_APPROVED_EXECUTED, cellById('USDC-SERVICE-EXEC'));
    expect(run.ledger.obligations.length).toBeGreaterThan(0);
    for (const o of run.ledger.obligations) {
      expect(o.earnedAt).toBe('2026-07-29T09:05:45.000Z');
      expect(o.earnedAt).not.toBe(SCENARIO_APPROVED_EXECUTED.completion.assessedAt);
    }
    // And the ledger records WHY it declined at the completion event, rather
    // than silently doing nothing.
    expect(run.ledger.declined.some((d) => d.event === 'constitutional-completion')).toBe(true);
  });

  it('the two regimes stamp DIFFERENT earnedAt for the same scenario (they are not identical)', () => {
    const complete = runVentureScenario(SCENARIO_APPROVED_EXECUTED, cellById('USDC-SERVICE-COMPLETE'));
    const exec = runVentureScenario(SCENARIO_APPROVED_EXECUTED, cellById('USDC-SERVICE-EXEC'));
    const completeTimes = new Set(complete.ledger.obligations.map((o) => o.earnedAt));
    const execTimes = new Set(exec.ledger.obligations.map((o) => o.earnedAt));
    expect(completeTimes).not.toEqual(execTimes);
  });

  it('holds for bundled pricing too — pricing structure does not touch timing', () => {
    const complete = runVentureScenario(SCENARIO_APPROVED_EXECUTED, cellById('BASEQC-BUNDLED-COMPLETE'));
    const exec = runVentureScenario(SCENARIO_APPROVED_EXECUTED, cellById('BASEQC-BUNDLED-EXEC'));
    expect(complete.ledger.obligations.every((o) => o.earnedAt === '2026-07-29T09:05:30.000Z')).toBe(true);
    expect(exec.ledger.obligations.every((o) => o.earnedAt === '2026-07-29T09:05:45.000Z')).toBe(true);
    // Bundled yields ONE obligation; per-service yields one per service.
    expect(complete.ledger.obligations).toHaveLength(1);
    const perService = runVentureScenario(SCENARIO_APPROVED_EXECUTED, cellById('BASEQC-SERVICE-COMPLETE'));
    expect(perService.ledger.obligations).toHaveLength(SCENARIO_APPROVED_EXECUTED.services.length);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-5 — refusal survives completion-contingency and does NOT survive
//        execution-contingency. The single measurement H3 turns on.
// ───────────────────────────────────────────────────────────────────────────

describe('AC-5 a correct refusal earns compensation under completion-contingency only', () => {
  const completionCells = VENTURE_EXPERIMENT_CELL_IDS.filter((id) => id.endsWith('-COMPLETE'));
  const executionCells = VENTURE_EXPERIMENT_CELL_IDS.filter((id) => id.endsWith('-EXEC'));

  it('the two cell groups are four and four (guard against an empty group)', () => {
    expect(completionCells).toHaveLength(4);
    expect(executionCells).toHaveLength(4);
  });

  it('in ALL FOUR completion-contingent cells the refusal creates an obligation', () => {
    for (const id of completionCells) {
      const run = runVentureScenario(SCENARIO_CORRECT_REFUSAL, cellById(id));
      expect(run.ledger.obligations.length, `${id} created no obligation for a correct refusal`).toBeGreaterThan(0);
      // Earned at the verdict, with no execution anywhere in the scenario.
      expect(run.ledger.obligations.every((o) => o.earnedAt === '2026-07-29T10:06:30.000Z')).toBe(true);
      expect(SCENARIO_CORRECT_REFUSAL.executionAt).toBeUndefined();
      // The obligation is classified as a refusal, not as a generic completion.
      expect(run.ledger.obligations.some((o) => o.basis === 'correct-refusal')).toBe(true);
    }
  });

  it('in ALL FOUR execution-contingent cells the refusal creates NO obligation', () => {
    for (const id of executionCells) {
      const run = runVentureScenario(SCENARIO_CORRECT_REFUSAL, cellById(id));
      expect(run.ledger.obligations, `${id} compensated a refusal under execution-contingency`).toHaveLength(0);
      expect(run.ledger.declined.length).toBeGreaterThan(0);
    }
  });

  it('the refused opportunity reaches a COMPLETE constitutional verdict either way', () => {
    for (const id of VENTURE_EXPERIMENT_CELL_IDS) {
      const run = runVentureScenario(SCENARIO_CORRECT_REFUSAL, cellById(id));
      expect(run.verdict.complete).toBe(true);
      expect(run.verdict.outcomeClass).toBe('refused-complete');
      expect(run.opportunity.status).toBe('correctly-refused');
    }
  });

  it('the refusal earns Standing in every cell — Standing is regime-independent', () => {
    for (const id of VENTURE_EXPERIMENT_CELL_IDS) {
      const run = runVentureScenario(SCENARIO_CORRECT_REFUSAL, cellById(id));
      expect(run.standingContributions).toHaveLength(1);
      expect(run.standingContributions[0].contributionType).toBe('correct-refusal');
      expect(run.standingContributions[0].weight ?? 0).toBeGreaterThan(0);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-6 — preparation cost is measured on every population and never collapsed
// ───────────────────────────────────────────────────────────────────────────

describe('AC-6 preparation cost is measured per opportunity, including refusals', () => {
  const run = runVentureScenario(SCENARIO_CORRECT_REFUSAL, cellById('BASEQC-SERVICE-COMPLETE'));

  it('a refused opportunity has a NON-ZERO measured cost in every dimension it consumed', () => {
    const agg = aggregatePreparationCost(run.costEvents);
    // Hand-computed from the S2 fixture: 60000+90000+120000+45000+40000.
    expect(agg.elapsedMs).toBe(355000);
    expect(agg.modelTokens).toBe(3600 + 6900 + 5200 + 1800 + 900);
    expect(agg.computeUnits).toBe(14 + 23 + 21 + 7 + 4);
    expect(agg.humanTimeMs).toBe(120000 + 30000);
    expect(agg.externalCostMinorUnits).toBe('200');
    expect(agg.events).toBe(5);
    expect(agg.opportunities).toBe(1);
  });

  it('the refusal itself is a measured service type, not an absence', () => {
    const byType = costByServiceType(run.costEvents);
    const refusal = byType.get('refusal');
    expect(refusal).toBeDefined();
    expect(refusal!.elapsedMs).toBe(45000);
    expect(refusal!.evidenceCount).toBe(2);
  });

  it('cost aggregates keep six dimensions separate — no single monetary figure', () => {
    const agg = aggregatePreparationCost(run.costEvents);
    // A `total`/`costMinorUnits` scalar would be the one-way door the charter
    // warns against: the pricing model can be revised, discarded evidence cannot.
    expect(Object.keys(agg).sort()).toEqual(
      [
        'computeUnits',
        'elapsedMs',
        'evidenceCount',
        'events',
        'externalCostMinorUnits',
        'humanTimeMs',
        'modelTokens',
        'opportunities',
      ].sort(),
    );
  });

  it('separates executed from correctly-refused populations', () => {
    const executed = runVentureScenario(SCENARIO_APPROVED_EXECUTED, cellById('BASEQC-SERVICE-COMPLETE'));
    const all = [...executed.costEvents, ...run.costEvents];
    const opps = [executed.opportunity, run.opportunity];

    const executedCost = costOfExecutedOpportunities(all, opps);
    const refusedCost = costOfCorrectlyRefusedOpportunities(all, opps);

    expect(executedCost.opportunities).toBe(1);
    expect(refusedCost.opportunities).toBe(1);
    // Both non-zero: the refusal's cost is NOT hidden inside the executed total.
    expect(refusedCost.elapsedMs).toBe(355000);
    expect(executedCost.elapsedMs).toBe(350000);
    expect(executedCost.elapsedMs + refusedCost.elapsedMs).toBe(aggregatePreparationCost(all).elapsedMs);
  });

  it('computes cost per opportunity, per agent, and per constitutionally-completed service', () => {
    const perOpportunity = costPerOpportunity(run.costEvents);
    expect(perOpportunity.size).toBe(1);

    const perAgent = costPerAgent(run.costEvents);
    // S2 uses three distinct agents (market, risk, verifier).
    expect(perAgent.size).toBe(3);

    const perCompleted = costPerConstitutionallyCompletedService(run.costEvents, [run.verdict]);
    expect(perCompleted).not.toBeNull();
    expect(perCompleted!.completed).toBe(1);
    expect(perCompleted!.perCompleted.elapsedMs).toBe(355000);

    // Nothing completed → null, never a zero that reads as "free".
    const incomplete = runVentureScenario(SCENARIO_UNAUTHORISED_INCOMPLETE, cellById('USDC-SERVICE-COMPLETE'));
    expect(costPerConstitutionallyCompletedService(incomplete.costEvents, [incomplete.verdict])).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-7 — the unauthorised/incomplete scenario
// ───────────────────────────────────────────────────────────────────────────

describe('AC-7 an unauthorised or incomplete opportunity earns nothing anywhere', () => {
  it('produces no valid completion and NO obligation in any of the eight cells', () => {
    for (const id of VENTURE_EXPERIMENT_CELL_IDS) {
      const run = runVentureScenario(SCENARIO_UNAUTHORISED_INCOMPLETE, cellById(id));
      expect(run.verdict.complete).toBe(false);
      expect(run.verdict.outcomeClass).toBe('unauthorised');
      expect(run.ledger.obligations, `${id} created an obligation on an unauthorised opportunity`).toHaveLength(0);
      expect(run.ledger.budgets[0].settledMinorUnits).toBe('0');
    }
  });

  it('emits a compensation-refusal receipt, distinct from a constitutional service refusal', () => {
    const run = runVentureScenario(SCENARIO_UNAUTHORISED_INCOMPLETE, cellById('USDC-BUNDLED-COMPLETE'));
    const refusals = run.journal.receipts.filter((r) => r.actionType === 'venture_refusal_recorded');
    expect(refusals).toHaveLength(1);
    expect(refusals[0].refusalKind).toBe('compensation-refused-no-valid-completion');

    // S2's refusal carries the OTHER kind. Conflating them would let an audit
    // read a process failure as a constitutional success.
    const good = runVentureScenario(SCENARIO_CORRECT_REFUSAL, cellById('USDC-BUNDLED-COMPLETE'));
    const goodRefusals = good.journal.receipts.filter((r) => r.actionType === 'venture_refusal_recorded');
    expect(goodRefusals).toHaveLength(1);
    expect(goodRefusals[0].refusalKind).toBe('constitutional-service-refusal');
  });

  it('produces NO positive Standing, and keeps the risk signal separate', () => {
    for (const id of VENTURE_EXPERIMENT_CELL_IDS) {
      const run = runVentureScenario(SCENARIO_UNAUTHORISED_INCOMPLETE, cellById(id));
      expect(run.standingContributions).toHaveLength(0);
      expect(run.standingDecisions).toHaveLength(1);
      expect(run.standingDecisions[0].admissible).toBe(false);
      // The penalty exists — on its own channel, never as negative Standing.
      expect(run.riskSignals).toHaveLength(1);
      expect(run.riskSignals[0].kind).toBe('unauthorised-authority-expansion');
      expect(run.standingContributions.every((c) => (c.weight ?? 0) >= 0)).toBe(true);
    }
  });

  it('still measures the cost of the work that was performed', () => {
    const run = runVentureScenario(SCENARIO_UNAUTHORISED_INCOMPLETE, cellById('USDC-SERVICE-EXEC'));
    const agg = aggregatePreparationCost(run.costEvents);
    expect(agg.elapsedMs).toBe(45000 + 70000);
    expect(agg.events).toBe(2);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-8 — DVN receipts for all nine consequential events
// ───────────────────────────────────────────────────────────────────────────

describe('AC-8 every consequential event is receipted and anchor-eligible', () => {
  it('declares exactly the nine required action types', () => {
    expect([...VENTURE_RECEIPT_ACTION_TYPES].sort()).toEqual(
      [
        'venture_completion_assessed',
        'venture_obligation_approved',
        'venture_obligation_earned',
        'venture_obligation_reversed',
        'venture_opportunity_closed',
        'venture_opportunity_opened',
        'venture_refusal_recorded',
        'venture_service_completed',
        'venture_settlement_simulated',
      ].sort(),
    );
  });

  it('every venture action type is DVN-anchorable and declared in the receipt union', () => {
    const pipeline = readFileSync(
      join(process.cwd(), 'services', 'dvn', 'activityReceiptDvnPipeline.ts'),
      'utf8',
    );
    const anchorableStart = pipeline.indexOf('const ANCHORABLE_ACTION_TYPES');
    const anchorableEnd = pipeline.indexOf(']);', anchorableStart);
    expect(anchorableStart).toBeGreaterThan(-1);
    const anchorableBlock = stripComments(pipeline.slice(anchorableStart, anchorableEnd));

    const service = readFileSync(
      join(process.cwd(), 'services', 'receipts', 'activityReceiptService.ts'),
      'utf8',
    );
    const unionStart = service.indexOf('export type ActivityActionType =');
    const unionEnd = service.indexOf('export type ReceiptStatus');
    const unionBlock = service.slice(unionStart, unionEnd);

    for (const t of VENTURE_RECEIPT_ACTION_TYPES) {
      // Match the ASSIGNMENT/membership, not a mention: a quoted member inside
      // the set literal and a union arm, not the word appearing in prose.
      expect(anchorableBlock, `${t} is not in ANCHORABLE_ACTION_TYPES`).toContain(`'${t}',`);
      expect(unionBlock, `${t} is not in ActivityActionType`).toMatch(
        new RegExp(`^\\s*\\|\\s*'${t}'`, 'm'),
      );
    }
  });

  it('a full happy-path run receipts all of opened/service/assessed/earned/approved/settled/closed', () => {
    const run = runVentureScenario(SCENARIO_APPROVED_EXECUTED, cellById('USDC-SERVICE-COMPLETE'));
    const types = new Set(run.journal.receipts.map((r) => r.actionType));
    for (const required of [
      'venture_opportunity_opened',
      'venture_service_completed',
      'venture_completion_assessed',
      'venture_obligation_earned',
      'venture_obligation_approved',
      'venture_settlement_simulated',
      'venture_opportunity_closed',
    ]) {
      expect(types.has(required as never), `${required} was never receipted`).toBe(true);
    }
  });

  it('checkpoints ordinary cost lines into one recomputable commitment', () => {
    const run = runVentureScenario(SCENARIO_APPROVED_EXECUTED, cellById('USDC-SERVICE-COMPLETE'));
    expect(run.journal.checkpoints).toHaveLength(1);
    expect(run.journal.checkpoints[0].eventCount).toBe(run.costEvents.length);
    expect(run.journal.checkpoints[0].commitment).toMatch(/^[0-9a-f]{32}$/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-9 — the R-8 compensation extension
// ───────────────────────────────────────────────────────────────────────────

describe('AC-9 the compensation extension encodes a refusal as a success, and is versioned', () => {
  it('classifies a correct refusal as `refusal`, never as a failed trade', () => {
    const run = runVentureScenario(SCENARIO_CORRECT_REFUSAL, cellById('USDC-SERVICE-COMPLETE'));
    const earned = run.journal.receipts.filter((r) => r.actionType === 'venture_obligation_earned');
    expect(earned.length).toBeGreaterThan(0);
    const refusalReceipt = earned.find((r) => r.compensation?.compensationBasis === 'correct-refusal');
    expect(refusalReceipt).toBeDefined();
    expect(refusalReceipt!.compensation!.classification).toBe('refusal');
    expect(refusalReceipt!.compensation!.liabilityCreationEvent).toBe('constitutional-completion');
    expect(refusalReceipt!.compensation!.version).toBe('partner-service-compensation/1');
    expect(refusalReceipt!.compensation!.experimentalCellId).toBe('USDC-SERVICE-COMPLETE');
  });

  it('restricted disclosure carries a commitment and a private ledger ref, not the amount', () => {
    const open = runVentureScenario(SCENARIO_CORRECT_REFUSAL, cellById('USDC-SERVICE-COMPLETE'), {
      disclosure: 'open',
    });
    const restricted = runVentureScenario(SCENARIO_CORRECT_REFUSAL, cellById('USDC-SERVICE-COMPLETE'), {
      disclosure: 'restricted',
    });
    const openExt = open.journal.receipts.find((r) => r.compensation)!.compensation!;
    const restrictedExt = restricted.journal.receipts.find((r) => r.compensation)!.compensation!;

    expect(openExt.amountMinorUnits).toBeDefined();
    expect(openExt.amountCommitment).toBeUndefined();

    expect(restrictedExt.amountMinorUnits).toBeUndefined();
    expect(restrictedExt.amountCommitment).toMatch(/^[0-9a-f]{16}$/);
    expect(restrictedExt.privateLedgerRef).toMatch(/^[0-9a-f]{16}$/);
  });

  it('the amount commitment is deterministic, so a later disclosure is checkable', () => {
    const obligation = {
      obligationId: 'obl-1',
      opportunityId: 'opp-1',
      beneficiaryAgentRef: 'aaaa1111bbbb2222',
      funderRef: 'cccc3333dddd4444',
      basis: 'correct-refusal' as const,
      denomination: 'BASE_QC' as const,
      amountMinorUnits: '2000',
      compensationRegime: 'constitutional-completion-contingent' as const,
      state: 'earned' as const,
      createdAt: '2026-07-29T10:06:30.000Z',
      earnedAt: '2026-07-29T10:06:30.000Z',
      receiptRefs: ['r1'],
      experimentalCellId: 'BASEQC-SERVICE-COMPLETE',
    };
    const a = buildCompensationExtension(obligation, {
      disclosure: 'restricted',
      liabilityCreationEvent: 'constitutional-completion',
    });
    const b = buildCompensationExtension(obligation, {
      disclosure: 'restricted',
      liabilityCreationEvent: 'constitutional-completion',
    });
    expect(a.amountCommitment).toBe(b.amountCommitment);
    // A different amount must commit differently, or the commitment is inert.
    const c = buildCompensationExtension(
      { ...obligation, amountMinorUnits: '2001' },
      { disclosure: 'restricted', liabilityCreationEvent: 'constitutional-completion' },
    );
    expect(c.amountCommitment).not.toBe(a.amountCommitment);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-14 — RULING 1. R-8 stays receipt-carried; the promotion boundary is a
//         canary, not a comment.
// ───────────────────────────────────────────────────────────────────────────

describe('AC-14 the compensation object is never a top-level canister payload field', () => {
  const pipeline = readFileSync(
    join(process.cwd(), 'services', 'dvn', 'activityReceiptDvnPipeline.ts'),
    'utf8',
  );

  /** The object literal passed to JSON.stringify for the canister call. */
  const canisterPayloadBlock = (): string => {
    const start = pipeline.indexOf('const payload = JSON.stringify({');
    expect(start, 'the canister payload literal moved — re-point this canary').toBeGreaterThan(-1);
    const end = pipeline.indexOf('});', start);
    expect(end).toBeGreaterThan(start);
    return stripComments(pipeline.slice(start, end));
  };

  it('the canister payload carries exactly the pinned top-level keys', () => {
    // Hand-written, in the pipeline's own order. Pinning the SET is what makes
    // this catch a promotion: adding `compensation` (under any name) changes
    // the set and fails here, so a payload-shape change cannot land as a side
    // effect of venture work. Changing this list is a payload-shape review.
    const expected = [
      'action',
      'receiptId',
      'personaRef',
      'activeCartridge',
      'actionType',
      'summary',
      'agentsInvoked',
      'toolsUsed',
      'iqubesUsed',
      'contextShared',
      'artifactsCreated',
      'approvalsGranted',
      'timestamp',
    ];
    const keys = [...canisterPayloadBlock().matchAll(/^\s{6}([A-Za-z][A-Za-z0-9_]*):/gm)].map((m) => m[1]);
    expect(keys.sort()).toEqual([...expected].sort());
  });

  it('names no compensation-class field anywhere in the canister payload', () => {
    const block = canisterPayloadBlock();
    for (const forbidden of [
      'compensation',
      'partner-service-compensation',
      'obligationRef',
      'amountMinorUnits',
      'amountCommitment',
      'settlementState',
    ]) {
      expect(block, `the canister payload promoted \`${forbidden}\` to a top-level field`).not.toContain(
        forbidden,
      );
    }
  });

  it('the extension is reachable ONLY through the receipt body that carries it', () => {
    // Behavioural half: the object exists on `receipt.compensation` and nowhere
    // else on the receipt. A sibling top-level field on the venture receipt
    // would be the same promotion, one layer earlier.
    const run = runVentureScenario(SCENARIO_CORRECT_REFUSAL, cellById('USDC-SERVICE-COMPLETE'));
    const bearing = run.journal.receipts.filter((r) => r.compensation);
    expect(bearing.length).toBeGreaterThan(0);
    for (const receipt of bearing) {
      expect(receipt.compensation!.ext).toBe('partner-service-compensation');
      const topLevel = Object.keys(receipt);
      for (const extensionField of ['obligationRef', 'amountMinorUnits', 'settlementState', 'classification']) {
        expect(topLevel, `${extensionField} was hoisted out of the extension`).not.toContain(extensionField);
      }
    }
  });

  it('the module records the promotion boundary rather than leaving it to memory', () => {
    const src = readFileSync(join(TRADING_DIR, 'compensationExtension.ts'), 'utf8');
    expect(src).toContain('THE PROMOTION BOUNDARY');
    expect(src).toContain('settlement indexing');
    expect(src).toContain('public verification');
    expect(src).toContain('cross-runtime reconciliation');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-10 — T0/T2 isolation
// ───────────────────────────────────────────────────────────────────────────

describe('AC-10 no raw identifier reaches a receipt, ledger ref field or chain-bound value', () => {
  const allRuns = runFullVentureMatrix();

  it('the fixtures really do use UUID-shaped persona ids (guard against a vacuous canary)', () => {
    for (const s of VENTURE_SCENARIOS) {
      expect(RAW_UUID_PATTERN.test(s.principalPersonaId)).toBe(true);
      expect(RAW_UUID_PATTERN.test(s.opportunityId)).toBe(true);
      for (const id of Object.values(s.agents)) expect(RAW_UUID_PATTERN.test(id)).toBe(true);
    }
  });

  it('no receipt in any of the 24 runs contains a UUID anywhere in its payload', () => {
    for (const run of allRuns) {
      for (const receipt of run.journal.receipts) {
        const serialised = JSON.stringify(receipt);
        expect(
          RAW_UUID_PATTERN.test(serialised),
          `${run.runId} receipt ${receipt.actionType} leaked a raw identifier`,
        ).toBe(false);
      }
    }
  });

  it('every commitment field on the opportunity and the ledger is a 16-hex commitment', () => {
    const commitment = /^[0-9a-f]{16}$/;
    for (const run of allRuns) {
      const o = run.opportunity;
      expect(o.principalRef).toMatch(commitment);
      expect(o.sourceCommitment).toMatch(commitment);
      for (const r of o.delegationRefs) expect(r).toMatch(commitment);
      for (const r of o.participatingAgentRefs) expect(r).toMatch(commitment);
      for (const ob of run.ledger.obligations) {
        expect(ob.beneficiaryAgentRef).toMatch(commitment);
        expect(ob.funderRef).toMatch(commitment);
      }
      for (const b of run.ledger.budgets) expect(b.funderRef).toMatch(commitment);
      for (const e of run.costEvents) expect(e.agentRef).toMatch(commitment);
    }
  });

  it('the emitter REFUSES a receipt carrying a raw identifier rather than scrubbing it', () => {
    // Drive the emitter directly with a poisoned payload — a behavioural check,
    // not a source grep.
    const run = runVentureScenario(SCENARIO_APPROVED_EXECUTED, cellById('USDC-SERVICE-COMPLETE'));
    expect(() =>
      emitVentureReceipt(run.journal, {
        actionType: 'venture_opportunity_opened',
        at: '2026-07-29T09:00:00.000Z',
        experimentalCellId: 'USDC-SERVICE-COMPLETE',
        opportunityRef: '7a1c9e30-4b52-4f18-9d61-2c8f0a5b7e41',
        summary: 'poisoned',
        evidenceRefs: [],
      }),
    ).toThrow(/raw identifier/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-11 — determinism and replay
// ───────────────────────────────────────────────────────────────────────────

describe('AC-11 the execution and replay path is deterministic', () => {
  it('no substrate module reads a clock or a random source', () => {
    const forbidden = [/\bDate\.now\s*\(/, /\bMath\.random\s*\(/, /\bnew Date\s*\(/, /\bperformance\.now\s*\(/];
    const files = readdirSync(TRADING_DIR).filter((f) => f.endsWith('.ts'));
    // Guard the guard: if the directory listing broke, the loop below would
    // pass vacuously.
    expect(files.length).toBeGreaterThanOrEqual(9);
    for (const file of files) {
      const src = stripComments(readFileSync(join(TRADING_DIR, file), 'utf8'));
      for (const pattern of forbidden) {
        expect(pattern.test(src), `${file} uses ${pattern} — replay would not be reproducible`).toBe(false);
      }
    }
  });

  it('replaying any scenario in any cell reproduces an identical run', () => {
    for (const scenario of VENTURE_SCENARIOS) {
      expect(replayIsStable(scenario), `${scenario.scenarioId} is not replay-stable`).toBe(true);
    }
  });

  it('the fingerprint is sensitive to obligation TIMING, not merely existence', () => {
    // If the fingerprint ignored earnedAt, the two regimes would fingerprint the
    // same for S1 and replay stability would prove nothing about the seam.
    const a = runFingerprint(runVentureScenario(SCENARIO_APPROVED_EXECUTED, cellById('USDC-SERVICE-COMPLETE')));
    const b = runFingerprint(runVentureScenario(SCENARIO_APPROVED_EXECUTED, cellById('USDC-SERVICE-EXEC')));
    expect(a).not.toBe(b);
    expect(a).toContain('2026-07-29T09:05:30.000Z');
    expect(b).toContain('2026-07-29T09:05:45.000Z');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-12 — the 24-run matrix reconciles
// ───────────────────────────────────────────────────────────────────────────

describe('AC-12 three scenarios across eight cells reconcile without code changes', () => {
  const runs = runFullVentureMatrix();
  const reconciliation = reconcileMatrix(runs);

  it('runs exactly 24 combinations, one per (scenario, cell)', () => {
    expect(runs).toHaveLength(24);
    expect(VENTURE_SCENARIOS).toHaveLength(3);
    const keys = new Set(runs.map((r) => `${r.scenarioId}|${r.experimentalCellId}`));
    expect(keys.size).toBe(24);
  });

  it('every run reconciles — budgets balance, no negatives, ledger matches receipts', () => {
    expect(reconciliation.violations).toEqual([]);
    expect(reconciliation.reconciledRuns).toBe(24);
  });

  it('every obligation is attributable to its cell and its regime', () => {
    for (const run of runs) {
      for (const o of run.ledger.obligations) {
        expect(o.experimentalCellId).toBe(run.experimentalCellId);
        expect(o.compensationRegime).toBe(run.cell.compensationContingency);
        expect(o.denomination).toBe(run.cell.denomination);
      }
    }
  });

  it('compensation earned on a NON-EXECUTED outcome appears in exactly the four completion cells', () => {
    const withRefusalCompensation = runs.filter(
      (r) => r.scenarioId === SCENARIO_CORRECT_REFUSAL.scenarioId && r.ledger.obligations.length > 0,
    );
    expect(withRefusalCompensation).toHaveLength(4);
    expect(withRefusalCompensation.map((r) => r.experimentalCellId).sort()).toEqual(
      ['BASEQC-BUNDLED-COMPLETE', 'BASEQC-SERVICE-COMPLETE', 'USDC-BUNDLED-COMPLETE', 'USDC-SERVICE-COMPLETE'].sort(),
    );
  });

  it('simulated settlement moves no live value — only state', () => {
    for (const run of runs) {
      for (const o of run.ledger.obligations) {
        expect(['earned', 'approved', 'settled']).toContain(o.state);
        if (o.state === 'settled') expect(o.settledAt).toBeTruthy();
      }
      // The budget can only ever be drawn down within its allocation.
      const b = run.ledger.budgets[0];
      expect(BigInt(b.remainingMinorUnits) >= 0n).toBe(true);
      expect(BigInt(b.settledMinorUnits) <= BigInt(b.allocatedMinorUnits)).toBe(true);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-13 — existing Standing behaviour is untouched
// ───────────────────────────────────────────────────────────────────────────

describe('AC-13 the guard is an admission gate in front of Standing, not a change to it', () => {
  it('does not import or modify the existing Standing scorers', () => {
    const src = stripComments(
      readFileSync(join(TRADING_DIR, 'standingAdmission.ts'), 'utf8'),
    );
    expect(src).not.toContain('computeStandingScore');
    expect(src).not.toContain('accrueStanding');
    expect(src).not.toContain('crm_persona_reputation');
  });

  it('standingScore.ts still composes veracity-led, with volume counting FACTS not transactions', () => {
    const src = readFileSync(
      join(process.cwd(), 'services', 'standing', 'standingScore.ts'),
      'utf8',
    );
    // The existing formula, pinned. If a trading-outcome term were ever added
    // to this composition, this canary fails and the operator is told before
    // the contamination is unreversible.
    expect(src).toContain('veracityScore * 0.7 + contributionScore * 0.3');
    expect(src).toContain('Math.min(1, verifiedFactCount / 12)');
    for (const forbidden of ['tradeCount', 'notional', 'realisedProfit', 'feesGenerated', 'executedTrades']) {
      expect(src, `standingScore.ts now references ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('no substrate module writes to the Standing accrual path', () => {
    for (const file of readdirSync(TRADING_DIR).filter((f) => f.endsWith('.ts'))) {
      const src = stripComments(readFileSync(join(TRADING_DIR, file), 'utf8'));
      expect(src, `${file} writes to the Standing accrual path`).not.toContain('accrueStanding(');
    }
  });
});
