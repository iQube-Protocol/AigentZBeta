/**
 * Deterministic settlement scenarios.
 *
 * A scenario is a fixture pair of native ledgers plus an ordered SCRIPT of
 * steps. The runner interprets the script; the scenario contains no logic. That
 * separation is what makes the adversarial scenarios worth having: the replayed
 * message, the unbacked credit and the post-debit failure all run through the
 * SAME code path as the happy path, so a refusal is a property of the state
 * machine rather than of a branch written specially for the test.
 *
 * Raw UUIDs appear HERE, in the fixtures, and nowhere downstream — the runner
 * derives every commitment through `./refs.ts`. A canary asserts both halves:
 * the fixtures really do carry raw identifiers (so the derivation is doing
 * something), and nothing emitted by a run carries one.
 *
 * Deterministic: every timestamp is written down, every id is a fixture string.
 */

import type { NativeLedger, QriptoDenomination, SettlementFeeBreakdown } from './types';

// ─── Fixture personas (raw ids — converted to commitments by the runner) ─────

export const FIXTURE_ALICE = '3f2b1a90-5c47-4d18-9e63-1b7a0c5d8e42';
export const FIXTURE_BOB = 'a71c4e58-2d93-4f06-8b15-6c9e3d2a7f80';
export const FIXTURE_TREASURY = 'c95d7b21-6e38-4a72-9d04-5f8b1c3e6a97';
export const FIXTURE_ADVANCE_AUTHORITY = 'e18a3c60-7b45-4d29-8f31-2a6c9e5b0d74';
export const FIXTURE_DELEGATION_GRANT = 'd4e07f92-1a68-4c35-b7d9-3e5a8c2f6b01';

// ─── Fixture ledgers ────────────────────────────────────────────────────────

export interface LedgerFixtureOverrides {
  /** Native settlement liquidity on the Base ledger. Lowered to force a shortfall. */
  baseSettlementLiquidityMinorUnits?: string;
  /** Native settlement liquidity on the Bitcoin ledger. */
  bitcoinSettlementLiquidityMinorUnits?: string;
  /** Payer's starting balance on each ledger. */
  aliceBcentMinorUnits?: string;
  bobBaseQcMinorUnits?: string;
}

/**
 * Two independent native ledgers. They are NOT linked by a lock pool — the only
 * thing that will connect them is a settlement message.
 *
 * `issuedMinorUnits` is a DECLARED constant matching the constitution's record
 * (Base Q¢ 400,000,000 minted; B¢ 100,000,000 intended initial issuance). The
 * treasury balance is the residual that makes each ledger's conservation
 * identity hold at t0, so any later imbalance is attributable to the run.
 *
 * The minor unit here is one QriptoCENT — one cent of reference value.
 */
export function fixtureLedgers(
  alice: string,
  bob: string,
  treasury: string,
  overrides: LedgerFixtureOverrides = {},
): Record<QriptoDenomination, NativeLedger> {
  const bcentIssued = 100_000_000n;
  const baseIssued = 400_000_000n;
  const bcentLiquidity = BigInt(overrides.bitcoinSettlementLiquidityMinorUnits ?? '5000000');
  const baseLiquidity = BigInt(overrides.baseSettlementLiquidityMinorUnits ?? '10000000');
  const aliceBcent = BigInt(overrides.aliceBcentMinorUnits ?? '250000');
  const bobBaseQc = BigInt(overrides.bobBaseQcMinorUnits ?? '250000');

  const bcentTreasury = bcentIssued - bcentLiquidity - aliceBcent;
  const baseTreasury = baseIssued - baseLiquidity - bobBaseQc;
  if (bcentTreasury < 0n || baseTreasury < 0n) {
    throw new Error('fixture ledgers do not balance — a fixture that starts broken proves nothing');
  }

  return {
    BCENT: {
      denomination: 'BCENT',
      network: 'bitcoin',
      maxSupplyMinorUnits: '1000000000',
      issuedMinorUnits: bcentIssued.toString(),
      balances: { [alice]: aliceBcent.toString(), [bob]: '0', [treasury]: bcentTreasury.toString() },
      settlementLiquidityMinorUnits: bcentLiquidity.toString(),
      reservedLiquidityMinorUnits: '0',
      feesCollectedMinorUnits: '0',
    },
    BASE_QC: {
      denomination: 'BASE_QC',
      network: 'base',
      maxSupplyMinorUnits: '1000000000',
      issuedMinorUnits: baseIssued.toString(),
      balances: { [alice]: '0', [bob]: bobBaseQc.toString(), [treasury]: baseTreasury.toString() },
      settlementLiquidityMinorUnits: baseLiquidity.toString(),
      reservedLiquidityMinorUnits: '0',
      feesCollectedMinorUnits: '0',
    },
  };
}

// ─── The step script ────────────────────────────────────────────────────────

export type SettlementStep =
  | {
      kind: 'initiate';
      settlementId: string;
      instructionId: string;
      /** Reuse another step's instruction id to drive an instruction replay. */
      sourceDenomination: QriptoDenomination;
      destinationDenomination: QriptoDenomination;
      amountMinorUnits: string;
      payer: 'alice' | 'bob';
      beneficiary: 'alice' | 'bob';
      feeBreakdown?: SettlementFeeBreakdown;
      initiatedAt: string;
      expiresAt: string;
      /** Deliberately wrong network binding, for the refusal canary. */
      networkOverride?: { source?: 'bitcoin' | 'base'; destination?: 'bitcoin' | 'base' };
      /** Bypass the ref derivation to drive the T0 leakage refusal. */
      rawPayerId?: string;
      /** Reuse the nonce of another settlement, for the nonce-binding canary. */
      nonceFromSettlementId?: string;
    }
  | { kind: 'verify-authority'; settlementId: string; at: string }
  | { kind: 'source-debit'; settlementId: string; debitId: string; at: string }
  | { kind: 'finalise-debit'; settlementId: string; confirmations: number; at: string }
  | {
      kind: 'verify-message';
      settlementId: string;
      messageId: string;
      at: string;
      /** Replay another settlement's message reference. */
      messageIdFromSettlementId?: string;
      /** Present a nonce that belongs to another settlement. */
      nonceFromSettlementId?: string;
    }
  | { kind: 'reserve'; settlementId: string; at: string }
  | {
      kind: 'credit';
      settlementId: string;
      creditId: string;
      at: string;
      /** Reuse another settlement's credit reference. */
      creditIdFromSettlementId?: string;
      advance?: { advanceId: string; unauthorised?: boolean };
    }
  | { kind: 'fail-credit'; settlementId: string; detail: string; at: string }
  | { kind: 'fail-source-debit'; settlementId: string; detail: string; at: string }
  | { kind: 'expire'; settlementId: string; at: string }
  | { kind: 'reverse'; settlementId: string; reversalId: string; detail: string; at: string }
  | { kind: 'reconcile'; settlementId: string; at: string };

export interface SettlementScenario {
  scenarioId: string;
  description: string;
  ledgerOverrides?: LedgerFixtureOverrides;
  steps: SettlementStep[];
}

const T = (n: string) => `2026-07-29T${n}Z`;
const EXPIRY = T('12:00:00.000');

// ─── S1 — the happy path, B¢ → Base Q¢, with disclosed fees ─────────────────

export const SCENARIO_BCENT_TO_BASEQC: SettlementScenario = {
  scenarioId: 'S1-bcent-to-baseqc-settled',
  description:
    'A B¢ payer settles into Base Q¢. The payer is debited on Bitcoin, a DVN message is verified, ' +
    'and the beneficiary is credited from NATIVE Base Q¢ liquidity. No wrapped B¢ exists on Base.',
  steps: [
    {
      kind: 'initiate',
      settlementId: 'stl-s1-001',
      instructionId: 'ins-s1-001',
      sourceDenomination: 'BCENT',
      destinationDenomination: 'BASE_QC',
      amountMinorUnits: '10000',
      payer: 'alice',
      beneficiary: 'bob',
      feeBreakdown: { networkFee: '12', serviceFee: '25' },
      initiatedAt: T('09:00:00.000'),
      expiresAt: EXPIRY,
    },
    { kind: 'verify-authority', settlementId: 'stl-s1-001', at: T('09:00:05.000') },
    { kind: 'source-debit', settlementId: 'stl-s1-001', debitId: 'dbt-s1-001', at: T('09:00:10.000') },
    { kind: 'finalise-debit', settlementId: 'stl-s1-001', confirmations: 4, at: T('09:30:00.000') },
    { kind: 'verify-message', settlementId: 'stl-s1-001', messageId: 'msg-s1-001', at: T('09:30:20.000') },
    { kind: 'reserve', settlementId: 'stl-s1-001', at: T('09:30:25.000') },
    { kind: 'credit', settlementId: 'stl-s1-001', creditId: 'crd-s1-001', at: T('09:30:30.000') },
    { kind: 'reconcile', settlementId: 'stl-s1-001', at: T('09:31:00.000') },
  ],
};

// ─── S2 — the reverse direction, no fees ────────────────────────────────────

export const SCENARIO_BASEQC_TO_BCENT: SettlementScenario = {
  scenarioId: 'S2-baseqc-to-bcent-settled',
  description:
    'Base Q¢ → B¢, zero fees. Ten cents in, ten cents out: the credited figure IS the amount, ' +
    'with no rate arithmetic anywhere on the path.',
  steps: [
    {
      kind: 'initiate',
      settlementId: 'stl-s2-001',
      instructionId: 'ins-s2-001',
      sourceDenomination: 'BASE_QC',
      destinationDenomination: 'BCENT',
      amountMinorUnits: '10',
      payer: 'bob',
      beneficiary: 'alice',
      initiatedAt: T('10:00:00.000'),
      expiresAt: EXPIRY,
    },
    { kind: 'verify-authority', settlementId: 'stl-s2-001', at: T('10:00:05.000') },
    { kind: 'source-debit', settlementId: 'stl-s2-001', debitId: 'dbt-s2-001', at: T('10:00:10.000') },
    { kind: 'finalise-debit', settlementId: 'stl-s2-001', confirmations: 30, at: T('10:02:00.000') },
    { kind: 'verify-message', settlementId: 'stl-s2-001', messageId: 'msg-s2-001', at: T('10:02:10.000') },
    { kind: 'reserve', settlementId: 'stl-s2-001', at: T('10:02:15.000') },
    { kind: 'credit', settlementId: 'stl-s2-001', creditId: 'crd-s2-001', at: T('10:02:20.000') },
    { kind: 'reconcile', settlementId: 'stl-s2-001', at: T('10:03:00.000') },
  ],
};

// ─── S3 — a replayed settlement message must never credit twice ─────────────

export const SCENARIO_REPLAYED_MESSAGE: SettlementScenario = {
  scenarioId: 'S3-replayed-message-refused',
  description:
    'A settled payment, then the SAME DVN message replayed against a second settlement, then a ' +
    'second credit attempted on the settled one. Both are refused. This is the double-spend path.',
  steps: [
    ...SCENARIO_BCENT_TO_BASEQC.steps,
    // A second, independent instruction — reaching the point where a replayed
    // message could be presented.
    {
      kind: 'initiate',
      settlementId: 'stl-s3-002',
      instructionId: 'ins-s3-002',
      sourceDenomination: 'BCENT',
      destinationDenomination: 'BASE_QC',
      amountMinorUnits: '10000',
      payer: 'alice',
      beneficiary: 'bob',
      initiatedAt: T('09:40:00.000'),
      expiresAt: EXPIRY,
    },
    { kind: 'verify-authority', settlementId: 'stl-s3-002', at: T('09:40:05.000') },
    { kind: 'source-debit', settlementId: 'stl-s3-002', debitId: 'dbt-s3-002', at: T('09:40:10.000') },
    { kind: 'finalise-debit', settlementId: 'stl-s3-002', confirmations: 6, at: T('09:50:00.000') },
    // THE REPLAY — the first settlement's message, presented again.
    {
      kind: 'verify-message',
      settlementId: 'stl-s3-002',
      messageId: 'msg-s3-002',
      messageIdFromSettlementId: 'stl-s1-001',
      at: T('09:50:10.000'),
    },
    // THE SECOND CREDIT — against the already-settled first settlement.
    { kind: 'credit', settlementId: 'stl-s1-001', creditId: 'crd-s3-replay', at: T('09:50:20.000') },
    // And a credit reference lifted from the settled settlement.
    {
      kind: 'credit',
      settlementId: 'stl-s3-002',
      creditId: 'crd-s3-002',
      creditIdFromSettlementId: 'stl-s1-001',
      at: T('09:50:30.000'),
    },
    // The refused settlement is DISCHARGED, not abandoned: its payer was
    // debited, so leaving it in flight would be an obligation nobody owns.
    {
      kind: 'reverse',
      settlementId: 'stl-s3-002',
      reversalId: 'rev-s3-002',
      detail: 'compensating reversal after the replayed message was refused',
      at: T('09:55:00.000'),
    },
    { kind: 'reconcile', settlementId: 'stl-s3-002', at: T('09:56:00.000') },
  ],
};

// ─── S4 — no credit without a finalised source debit ────────────────────────

export const SCENARIO_CREDIT_WITHOUT_FINAL_DEBIT: SettlementScenario = {
  scenarioId: 'S4-credit-without-final-debit-refused',
  description:
    'A credit is attempted while the source debit is still pending finality, with no authorised ' +
    'advance. Refused. The debit then finalises and the same settlement completes normally.',
  steps: [
    {
      kind: 'initiate',
      settlementId: 'stl-s4-001',
      instructionId: 'ins-s4-001',
      sourceDenomination: 'BCENT',
      destinationDenomination: 'BASE_QC',
      amountMinorUnits: '5000',
      payer: 'alice',
      beneficiary: 'bob',
      initiatedAt: T('09:00:00.000'),
      expiresAt: EXPIRY,
    },
    { kind: 'verify-authority', settlementId: 'stl-s4-001', at: T('09:00:05.000') },
    { kind: 'source-debit', settlementId: 'stl-s4-001', debitId: 'dbt-s4-001', at: T('09:00:10.000') },
    // Message verified BEFORE finality — legitimate, and safe, because the gate
    // is on the credit.
    { kind: 'verify-message', settlementId: 'stl-s4-001', messageId: 'msg-s4-001', at: T('09:00:20.000') },
    { kind: 'reserve', settlementId: 'stl-s4-001', at: T('09:00:25.000') },
    // THE UNBACKED CREDIT — refused.
    { kind: 'credit', settlementId: 'stl-s4-001', creditId: 'crd-s4-early', at: T('09:00:30.000') },
    { kind: 'finalise-debit', settlementId: 'stl-s4-001', confirmations: 3, at: T('09:20:00.000') },
    { kind: 'credit', settlementId: 'stl-s4-001', creditId: 'crd-s4-001', at: T('09:20:10.000') },
    { kind: 'reconcile', settlementId: 'stl-s4-001', at: T('09:21:00.000') },
  ],
};

// ─── S5 — a destination failure AFTER a final debit is an obligation ────────

export const SCENARIO_DESTINATION_FAILURE: SettlementScenario = {
  scenarioId: 'S5-destination-failure-becomes-obligation',
  description:
    'The source debit is final and the destination credit fails. The settlement becomes a ' +
    'RECONCILIATION OBLIGATION, never a silent loss, and is discharged by a compensating reversal.',
  steps: [
    {
      kind: 'initiate',
      settlementId: 'stl-s5-001',
      instructionId: 'ins-s5-001',
      sourceDenomination: 'BCENT',
      destinationDenomination: 'BASE_QC',
      amountMinorUnits: '7500',
      payer: 'alice',
      beneficiary: 'bob',
      feeBreakdown: { networkFee: '10' },
      initiatedAt: T('09:00:00.000'),
      expiresAt: EXPIRY,
    },
    { kind: 'verify-authority', settlementId: 'stl-s5-001', at: T('09:00:05.000') },
    { kind: 'source-debit', settlementId: 'stl-s5-001', debitId: 'dbt-s5-001', at: T('09:00:10.000') },
    { kind: 'finalise-debit', settlementId: 'stl-s5-001', confirmations: 5, at: T('09:25:00.000') },
    { kind: 'verify-message', settlementId: 'stl-s5-001', messageId: 'msg-s5-001', at: T('09:25:10.000') },
    { kind: 'reserve', settlementId: 'stl-s5-001', at: T('09:25:15.000') },
    {
      kind: 'fail-credit',
      settlementId: 'stl-s5-001',
      detail: 'destination ledger rejected the credit',
      at: T('09:25:20.000'),
    },
    {
      kind: 'reverse',
      settlementId: 'stl-s5-001',
      reversalId: 'rev-s5-001',
      detail: 'compensating reversal after an undeliverable destination credit',
      at: T('09:40:00.000'),
    },
    { kind: 'reconcile', settlementId: 'stl-s5-001', at: T('09:41:00.000') },
  ],
};

// ─── S6 — expiry before any ledger effect ───────────────────────────────────

export const SCENARIO_EXPIRY_BEFORE_DEBIT: SettlementScenario = {
  scenarioId: 'S6-expiry-with-no-ledger-effect',
  description:
    'An accepted instruction times out before the payer is debited. `expired` is available here ' +
    'precisely because nothing happened — and only here.',
  steps: [
    {
      kind: 'initiate',
      settlementId: 'stl-s6-001',
      instructionId: 'ins-s6-001',
      sourceDenomination: 'BASE_QC',
      destinationDenomination: 'BCENT',
      amountMinorUnits: '1000',
      payer: 'bob',
      beneficiary: 'alice',
      initiatedAt: T('09:00:00.000'),
      expiresAt: T('09:05:00.000'),
    },
    { kind: 'verify-authority', settlementId: 'stl-s6-001', at: T('09:00:05.000') },
    { kind: 'expire', settlementId: 'stl-s6-001', at: T('09:06:00.000') },
  ],
};

// ─── S7 — an authorised liquidity advance, and its exposure ─────────────────

export const SCENARIO_AUTHORISED_ADVANCE: SettlementScenario = {
  scenarioId: 'S7-authorised-liquidity-advance',
  description:
    'A credit ahead of source finality under an EXPLICITLY AUTHORISED advance — the only ' +
    'alternative the invariant permits. It settles, and it leaves reconciliation exposure behind.',
  steps: [
    {
      kind: 'initiate',
      settlementId: 'stl-s7-001',
      instructionId: 'ins-s7-001',
      sourceDenomination: 'BCENT',
      destinationDenomination: 'BASE_QC',
      amountMinorUnits: '2500',
      payer: 'alice',
      beneficiary: 'bob',
      initiatedAt: T('09:00:00.000'),
      expiresAt: EXPIRY,
    },
    { kind: 'verify-authority', settlementId: 'stl-s7-001', at: T('09:00:05.000') },
    { kind: 'source-debit', settlementId: 'stl-s7-001', debitId: 'dbt-s7-001', at: T('09:00:10.000') },
    { kind: 'verify-message', settlementId: 'stl-s7-001', messageId: 'msg-s7-001', at: T('09:00:20.000') },
    { kind: 'reserve', settlementId: 'stl-s7-001', at: T('09:00:25.000') },
    // An advance with no authority named — refused.
    {
      kind: 'credit',
      settlementId: 'stl-s7-001',
      creditId: 'crd-s7-unauth',
      at: T('09:00:30.000'),
      advance: { advanceId: 'adv-s7-unauth', unauthorised: true },
    },
    // The authorised advance — permitted.
    {
      kind: 'credit',
      settlementId: 'stl-s7-001',
      creditId: 'crd-s7-001',
      at: T('09:00:40.000'),
      advance: { advanceId: 'adv-s7-001' },
    },
    { kind: 'reconcile', settlementId: 'stl-s7-001', at: T('09:01:00.000') },
  ],
};

// ─── S8 — destination liquidity shortfall after a final debit ───────────────

export const SCENARIO_LIQUIDITY_SHORTFALL: SettlementScenario = {
  scenarioId: 'S8-destination-liquidity-shortfall',
  description:
    'Base Q¢ settlement liquidity is exhausted. With the payer already debited on Bitcoin, the ' +
    'shortfall is an OBLIGATION — liquidity, not a lock pool, is what this architecture needs.',
  ledgerOverrides: { baseSettlementLiquidityMinorUnits: '100' },
  steps: [
    {
      kind: 'initiate',
      settlementId: 'stl-s8-001',
      instructionId: 'ins-s8-001',
      sourceDenomination: 'BCENT',
      destinationDenomination: 'BASE_QC',
      amountMinorUnits: '9000',
      payer: 'alice',
      beneficiary: 'bob',
      initiatedAt: T('09:00:00.000'),
      expiresAt: EXPIRY,
    },
    { kind: 'verify-authority', settlementId: 'stl-s8-001', at: T('09:00:05.000') },
    { kind: 'source-debit', settlementId: 'stl-s8-001', debitId: 'dbt-s8-001', at: T('09:00:10.000') },
    { kind: 'finalise-debit', settlementId: 'stl-s8-001', confirmations: 3, at: T('09:20:00.000') },
    { kind: 'verify-message', settlementId: 'stl-s8-001', messageId: 'msg-s8-001', at: T('09:20:10.000') },
    { kind: 'reserve', settlementId: 'stl-s8-001', at: T('09:20:15.000') },
    {
      kind: 'reverse',
      settlementId: 'stl-s8-001',
      reversalId: 'rev-s8-001',
      detail: 'compensating reversal after a destination liquidity shortfall',
      at: T('09:35:00.000'),
    },
    { kind: 'reconcile', settlementId: 'stl-s8-001', at: T('09:36:00.000') },
  ],
};

export const SETTLEMENT_SCENARIOS: SettlementScenario[] = [
  SCENARIO_BCENT_TO_BASEQC,
  SCENARIO_BASEQC_TO_BCENT,
  SCENARIO_REPLAYED_MESSAGE,
  SCENARIO_CREDIT_WITHOUT_FINAL_DEBIT,
  SCENARIO_DESTINATION_FAILURE,
  SCENARIO_EXPIRY_BEFORE_DEBIT,
  SCENARIO_AUTHORISED_ADVANCE,
  SCENARIO_LIQUIDITY_SHORTFALL,
];
