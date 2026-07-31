/**
 * VL-CT-001 — three deterministic scenarios.
 *
 * These are FIXTURES, not generated data. Every id and every timestamp is
 * written down here, so a replay of the same scenario in the same cell produces
 * byte-identical ledgers, receipts and costs. Nothing in the execution path may
 * call `Date.now()` or `Math.random()`; a source canary enforces that, because
 * a single clock read would make replay worthless while leaving every test
 * still passing.
 *
 * The persona ids below are deliberately UUID-SHAPED. That is what gives the
 * T0-leakage canary teeth: if a raw persona id ever reaches a receipt payload,
 * the UUID pattern catches it. A fixture using friendly strings would make the
 * canary pass vacuously.
 *
 * The three scenarios are chosen to exercise the three populations the charter
 * says must be measurable, INCLUDING the two that a trade-keyed system cannot
 * see at all:
 *
 *  S1  approved and executed        — cost capture, completion verdict, both
 *                                     compensation regimes, simulated
 *                                     settlement, Standing-safe contribution
 *  S2  correct refusal              — work is still measured; refusal is a
 *                                     completed service; completion-contingent
 *                                     compensation SURVIVES and
 *                                     execution-contingent does NOT; the
 *                                     refusal may generate Standing
 *  S3  unauthorised action          — no valid completion, no obligation in any
 *                                     cell, a compensation-refusal receipt, no
 *                                     positive Standing, and the risk signal
 *                                     kept separate from Standing
 */

import type { ServiceObligationBasis, StandingLane, VentureOpportunityStatus, VentureServiceType } from './types';
import type { ConstitutionalCompletionCheck } from './types';

export interface ScenarioService {
  key: string;
  agentKey: string;
  serviceType: VentureServiceType;
  startedAt: string;
  completedAt: string;
  elapsedMs: number;
  modelTokens: number;
  computeUnits: number;
  humanTimeMs: number;
  externalCostMinorUnits: string;
  evidence: string[];
  /** Price under per-service pricing, minor units. */
  priceMinorUnits: string;
  constitutionallyComplete: boolean;
  basis: ServiceObligationBasis;
  /** True for the service that IS the refusal (charter §8.8). */
  isRefusal?: boolean;
}

export interface ScenarioStandingClaim {
  agentKey: string;
  proposedBases: string[];
  lane: StandingLane;
  evidenceRefs: string[];
}

export interface VentureScenario {
  scenarioId: string;
  experimentId: string;
  title: string;
  /** What this scenario is designed to prove. */
  proves: string;
  opportunityId: string;
  principalPersonaId: string;
  funderPersonaId: string;
  agents: Record<string, string>;
  delegationGrantIds: string[];
  source: string;
  createdAt: string;
  requestedService: string;
  requestedOutcome?: string;
  notionalMinorUnits: string;
  budgetMinorUnits: string;
  bundlePriceMinorUnits: string;
  services: ScenarioService[];
  completion: {
    assessedAt: string;
    checksPerformed: ConstitutionalCompletionCheck[];
    executed: boolean;
    refusalWasCorrect?: boolean;
    unauthorisedExpansion?: boolean;
  };
  /** Present only when execution actually occurs. */
  executionAt?: string;
  approvalAt: string;
  settlementAt: string;
  closedAt: string;
  finalStatus: VentureOpportunityStatus;
  standingClaims: ScenarioStandingClaim[];
}

const ALL_CHECKS: ConstitutionalCompletionCheck[] = [
  'market-assessment',
  'authority-verification',
  'risk-review',
  'execution-eligibility-decision',
  'evidence-record',
  'dvn-receipt',
  'reconciliation-closure',
];

/**
 * S1 — approved and executed.
 *
 * The reference happy path. Note that it is NOT the privileged one: S2 scores
 * the same seven checks and reaches the same `complete` verdict, which is the
 * structural claim H3 makes.
 */
export const SCENARIO_APPROVED_EXECUTED: VentureScenario = {
  scenarioId: 'vlct001-s1-approved-executed',
  experimentId: 'VL-CT-001',
  title: 'Approved and executed',
  proves:
    'cost capture across all six dimensions; a complete constitutional verdict; both compensation regimes producing a liability; simulated settlement; a Standing-safe contribution earned from constitutional properties rather than from profit',
  opportunityId: '7a1c9e30-4b52-4f18-9d61-2c8f0a5b7e41',
  principalPersonaId: 'c4e77f18-9a03-4d62-b5ef-1a0d83c94b27',
  funderPersonaId: 'f0b31d55-72ae-4c19-8e34-6d9b57a10c82',
  agents: {
    market: '2d6a8c41-5e7b-4390-a1c8-3f04b96d7e15',
    risk: '9e5b0c73-1d84-42af-b607-8c25f31a94d6',
    verifier: '58c2f9a4-6b31-4e07-9d52-0a4e86b17c93',
  },
  delegationGrantIds: ['3b8e5710-c4d9-4a26-81f3-72b0e69d5a04'],
  source: 'sim:market-feed:eurusd-band-01',
  createdAt: '2026-07-29T09:00:00.000Z',
  requestedService: 'constitutional-trade-preparation',
  requestedOutcome: 'execute-if-eligible',
  notionalMinorUnits: '2500000',
  budgetMinorUnits: '5000000',
  bundlePriceMinorUnits: '9000',
  services: [
    {
      key: 's1-discovery',
      agentKey: 'market',
      serviceType: 'discovery',
      startedAt: '2026-07-29T09:00:05.000Z',
      completedAt: '2026-07-29T09:01:20.000Z',
      elapsedMs: 75000,
      modelTokens: 4200,
      computeUnits: 18,
      humanTimeMs: 0,
      externalCostMinorUnits: '120',
      evidence: ['ev-s1-market-snapshot', 'ev-s1-band-analysis'],
      priceMinorUnits: '2000',
      constitutionallyComplete: true,
      basis: 'service-completed',
    },
    {
      key: 's1-analysis',
      agentKey: 'market',
      serviceType: 'analysis',
      startedAt: '2026-07-29T09:01:20.000Z',
      completedAt: '2026-07-29T09:03:00.000Z',
      elapsedMs: 100000,
      modelTokens: 7800,
      computeUnits: 26,
      humanTimeMs: 0,
      externalCostMinorUnits: '80',
      evidence: ['ev-s1-model-output'],
      priceMinorUnits: '2500',
      constitutionallyComplete: true,
      basis: 'service-completed',
    },
    {
      key: 's1-risk',
      agentKey: 'risk',
      serviceType: 'risk-review',
      startedAt: '2026-07-29T09:03:00.000Z',
      completedAt: '2026-07-29T09:04:30.000Z',
      elapsedMs: 90000,
      modelTokens: 3100,
      computeUnits: 12,
      humanTimeMs: 60000,
      externalCostMinorUnits: '0',
      evidence: ['ev-s1-risk-matrix', 'ev-s1-authority-check'],
      priceMinorUnits: '2000',
      constitutionallyComplete: true,
      basis: 'service-completed',
    },
    {
      key: 's1-verification',
      agentKey: 'verifier',
      serviceType: 'verification',
      startedAt: '2026-07-29T09:04:30.000Z',
      completedAt: '2026-07-29T09:05:15.000Z',
      elapsedMs: 45000,
      modelTokens: 1500,
      computeUnits: 6,
      humanTimeMs: 0,
      externalCostMinorUnits: '40',
      evidence: ['ev-s1-proof'],
      priceMinorUnits: '1500',
      constitutionallyComplete: true,
      basis: 'verification-completed',
    },
    {
      key: 's1-reconciliation',
      agentKey: 'verifier',
      serviceType: 'reconciliation',
      startedAt: '2026-07-29T09:06:00.000Z',
      completedAt: '2026-07-29T09:06:40.000Z',
      elapsedMs: 40000,
      modelTokens: 900,
      computeUnits: 4,
      humanTimeMs: 0,
      externalCostMinorUnits: '0',
      evidence: ['ev-s1-reconciliation'],
      priceMinorUnits: '1000',
      constitutionallyComplete: true,
      basis: 'reconciliation-completed',
    },
  ],
  completion: {
    assessedAt: '2026-07-29T09:05:30.000Z',
    checksPerformed: ALL_CHECKS,
    executed: true,
  },
  executionAt: '2026-07-29T09:05:45.000Z',
  approvalAt: '2026-07-29T09:07:00.000Z',
  settlementAt: '2026-07-29T09:07:30.000Z',
  closedAt: '2026-07-29T09:08:00.000Z',
  finalStatus: 'executed',
  standingClaims: [
    {
      agentKey: 'risk',
      // Constitutional bases only. The scenario deliberately does NOT offer
      // realised profit here; S3 is where a prohibited basis is offered and
      // must be refused.
      proposedBases: ['constitutional-completeness', 'authority-compliance', 'proof-quality'],
      lane: 'delegated',
      evidenceRefs: ['ev-s1-risk-matrix', 'ev-s1-authority-check'],
    },
  ],
};

/**
 * S2 — correct refusal.
 *
 * The scenario the whole substrate exists for. The work is real and measured;
 * the refusal is a service with its own cost, its own receipt and its own
 * compensation basis; the verdict is COMPLETE (`refused-complete`), scored on
 * the same seven links S1 receives; and the compensation outcome differs
 * between the two regimes by construction — which is the experimental effect.
 */
export const SCENARIO_CORRECT_REFUSAL: VentureScenario = {
  scenarioId: 'vlct001-s2-correct-refusal',
  experimentId: 'VL-CT-001',
  title: 'Correct refusal',
  proves:
    'work is measured on a non-executed opportunity; refusal is a completed constitutional service with its own receipt and basis; completion-contingent compensation survives the refusal while execution-contingent compensation does not; the refusal may earn Standing',
  opportunityId: 'b3f5d802-6c17-4e9a-8035-91ad4e7b62c0',
  principalPersonaId: 'c4e77f18-9a03-4d62-b5ef-1a0d83c94b27',
  funderPersonaId: 'f0b31d55-72ae-4c19-8e34-6d9b57a10c82',
  agents: {
    market: '2d6a8c41-5e7b-4390-a1c8-3f04b96d7e15',
    risk: '9e5b0c73-1d84-42af-b607-8c25f31a94d6',
    verifier: '58c2f9a4-6b31-4e07-9d52-0a4e86b17c93',
  },
  delegationGrantIds: ['3b8e5710-c4d9-4a26-81f3-72b0e69d5a04'],
  source: 'sim:market-feed:illiquid-pair-07',
  createdAt: '2026-07-29T10:00:00.000Z',
  requestedService: 'constitutional-trade-preparation',
  requestedOutcome: 'execute-if-eligible',
  // Deliberately a SMALL notional. Under a commission-led system this is the
  // opportunity that would receive a thinner review; the coverage-by-size curve
  // is what makes that visible.
  notionalMinorUnits: '45000',
  budgetMinorUnits: '5000000',
  bundlePriceMinorUnits: '7500',
  services: [
    {
      key: 's2-discovery',
      agentKey: 'market',
      serviceType: 'discovery',
      startedAt: '2026-07-29T10:00:05.000Z',
      completedAt: '2026-07-29T10:01:05.000Z',
      elapsedMs: 60000,
      modelTokens: 3600,
      computeUnits: 14,
      humanTimeMs: 0,
      externalCostMinorUnits: '120',
      evidence: ['ev-s2-market-snapshot'],
      priceMinorUnits: '2000',
      constitutionallyComplete: true,
      basis: 'service-completed',
    },
    {
      key: 's2-analysis',
      agentKey: 'market',
      serviceType: 'analysis',
      startedAt: '2026-07-29T10:01:05.000Z',
      completedAt: '2026-07-29T10:02:35.000Z',
      elapsedMs: 90000,
      modelTokens: 6900,
      computeUnits: 23,
      humanTimeMs: 0,
      externalCostMinorUnits: '80',
      evidence: ['ev-s2-liquidity-analysis'],
      priceMinorUnits: '2500',
      constitutionallyComplete: true,
      basis: 'service-completed',
    },
    {
      key: 's2-risk',
      agentKey: 'risk',
      serviceType: 'risk-review',
      startedAt: '2026-07-29T10:02:35.000Z',
      completedAt: '2026-07-29T10:04:35.000Z',
      elapsedMs: 120000,
      modelTokens: 5200,
      computeUnits: 21,
      humanTimeMs: 120000,
      externalCostMinorUnits: '0',
      evidence: ['ev-s2-risk-matrix', 'ev-s2-suitability-finding'],
      priceMinorUnits: '2000',
      constitutionallyComplete: true,
      basis: 'service-completed',
    },
    {
      key: 's2-refusal',
      agentKey: 'risk',
      serviceType: 'refusal',
      startedAt: '2026-07-29T10:04:35.000Z',
      completedAt: '2026-07-29T10:05:20.000Z',
      elapsedMs: 45000,
      modelTokens: 1800,
      computeUnits: 7,
      humanTimeMs: 30000,
      externalCostMinorUnits: '0',
      evidence: ['ev-s2-refusal-basis', 'ev-s2-evidence-considered'],
      priceMinorUnits: '2000',
      constitutionallyComplete: true,
      basis: 'correct-refusal',
      isRefusal: true,
    },
    {
      key: 's2-reconciliation',
      agentKey: 'verifier',
      serviceType: 'reconciliation',
      startedAt: '2026-07-29T10:05:20.000Z',
      completedAt: '2026-07-29T10:06:00.000Z',
      elapsedMs: 40000,
      modelTokens: 900,
      computeUnits: 4,
      humanTimeMs: 0,
      externalCostMinorUnits: '0',
      evidence: ['ev-s2-reconciliation'],
      priceMinorUnits: '1000',
      constitutionallyComplete: true,
      basis: 'reconciliation-completed',
    },
  ],
  completion: {
    assessedAt: '2026-07-29T10:06:30.000Z',
    // The full seven. A refused opportunity receives the SAME constitutional
    // process as an executed one — that is the population H3 measures.
    checksPerformed: ALL_CHECKS,
    executed: false,
    refusalWasCorrect: true,
  },
  // No executionAt: nothing executed, and nothing back-fills one.
  approvalAt: '2026-07-29T10:07:00.000Z',
  settlementAt: '2026-07-29T10:07:30.000Z',
  closedAt: '2026-07-29T10:08:00.000Z',
  finalStatus: 'correctly-refused',
  standingClaims: [
    {
      agentKey: 'risk',
      proposedBases: ['correct-refusal', 'risk-detection', 'constitutional-completeness'],
      lane: 'delegated',
      evidenceRefs: ['ev-s2-refusal-basis', 'ev-s2-evidence-considered', 'ev-s2-risk-matrix'],
    },
  ],
};

/**
 * S3 — incomplete and unauthorised.
 *
 * An agent acted beyond its delegated authority and the process has holes. The
 * scenario carries NO execution event: the unauthorised action was caught, so
 * the opportunity fails rather than executing. That matters for the ledger — it
 * is why zero obligations arise in ALL EIGHT cells rather than only in the
 * completion-contingent four.
 *
 * The Standing claim here deliberately offers PROHIBITED bases (realised
 * profit, executed-trade count) alongside no valid completion. It is the
 * negative half of the V-10 paired canary.
 */
export const SCENARIO_UNAUTHORISED_INCOMPLETE: VentureScenario = {
  scenarioId: 'vlct001-s3-unauthorised-incomplete',
  experimentId: 'VL-CT-001',
  title: 'Incomplete or unauthorised action',
  proves:
    'no valid constitutional completion; no obligation in any cell; a compensation-refusal receipt; no positive Standing signal; and the penalty/risk signal recorded separately from Standing rather than as negative Standing',
  opportunityId: 'd91e4a6b-38c2-4750-b1fe-05a7c26d84f3',
  principalPersonaId: 'c4e77f18-9a03-4d62-b5ef-1a0d83c94b27',
  funderPersonaId: 'f0b31d55-72ae-4c19-8e34-6d9b57a10c82',
  agents: {
    market: '2d6a8c41-5e7b-4390-a1c8-3f04b96d7e15',
    rogue: '6f24b0d8-9c53-4e1a-8b76-4d0e93a51c27',
  },
  delegationGrantIds: ['3b8e5710-c4d9-4a26-81f3-72b0e69d5a04'],
  source: 'sim:market-feed:out-of-mandate-14',
  createdAt: '2026-07-29T11:00:00.000Z',
  requestedService: 'constitutional-trade-preparation',
  requestedOutcome: 'execute-if-eligible',
  notionalMinorUnits: '8000000',
  budgetMinorUnits: '5000000',
  bundlePriceMinorUnits: '9000',
  services: [
    {
      key: 's3-discovery',
      agentKey: 'market',
      serviceType: 'discovery',
      startedAt: '2026-07-29T11:00:05.000Z',
      completedAt: '2026-07-29T11:00:50.000Z',
      elapsedMs: 45000,
      modelTokens: 2600,
      computeUnits: 10,
      humanTimeMs: 0,
      externalCostMinorUnits: '120',
      evidence: ['ev-s3-market-snapshot'],
      priceMinorUnits: '2000',
      constitutionallyComplete: true,
      basis: 'service-completed',
    },
    {
      key: 's3-execution-prep',
      agentKey: 'rogue',
      serviceType: 'execution-preparation',
      startedAt: '2026-07-29T11:00:50.000Z',
      completedAt: '2026-07-29T11:02:00.000Z',
      elapsedMs: 70000,
      modelTokens: 4100,
      computeUnits: 16,
      humanTimeMs: 0,
      externalCostMinorUnits: '0',
      evidence: ['ev-s3-prep-log'],
      priceMinorUnits: '2500',
      // The work happened and cost real resources — it is measured. What it is
      // NOT is constitutionally complete.
      constitutionallyComplete: false,
      basis: 'service-completed',
    },
  ],
  completion: {
    assessedAt: '2026-07-29T11:02:30.000Z',
    // Risk review, eligibility decision and reconciliation never happened.
    checksPerformed: ['market-assessment', 'authority-verification', 'evidence-record', 'dvn-receipt'],
    executed: false,
    unauthorisedExpansion: true,
  },
  approvalAt: '2026-07-29T11:03:00.000Z',
  settlementAt: '2026-07-29T11:03:30.000Z',
  closedAt: '2026-07-29T11:04:00.000Z',
  finalStatus: 'failed',
  standingClaims: [
    {
      agentKey: 'rogue',
      // Both prohibited. Offered exactly as a real caller would offer them, so
      // the guard is tested against the shape it actually has to refuse.
      proposedBases: ['realised-profit', 'executed-trade-count'],
      lane: 'delegated',
      evidenceRefs: ['ev-s3-prep-log'],
    },
  ],
};

export const VENTURE_SCENARIOS: readonly VentureScenario[] = [
  SCENARIO_APPROVED_EXECUTED,
  SCENARIO_CORRECT_REFUSAL,
  SCENARIO_UNAUTHORISED_INCOMPLETE,
];
