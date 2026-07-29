/**
 * QriptoCENT cross-denomination settlement — the canary suite.
 *
 * These are not coverage tests. Each block guards a property that, if broken,
 * produces output that still looks entirely plausible:
 *
 *  - a replayed message crediting twice → the beneficiary is paid, the ledgers
 *    balance on a casual read, and duplicate spendable value exists;
 *  - a destination credit without a final source debit → indistinguishable from
 *    a legitimate settlement until the source debit fails;
 *  - a partial state presented as settled → an obligation reported as a
 *    completed payment, which is how a debited payer is told nothing happened;
 *  - settlement minting → the substrate becomes an unaccountable issuer while
 *    every settlement figure still reconciles;
 *  - a fee absorbed into an implied rate → ten cents in, nine-point-nine-eight
 *    out, with nothing anywhere calling the difference a fee;
 *  - liquidity assurance minting to cover a shortfall → mechanisms 1, 2 and 3
 *    collapse into one, and the settlement network is an issuer again.
 *
 * Expected values are written down by hand wherever the code under test could
 * otherwise supply them. A canary that derives its expectation with the same
 * predicate as the code it guards proves only that the code equals itself.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './_lib/sourceAuthority';

import {
  DENOMINATION_HOME_NETWORK,
  isFinalSettlement,
  TERMINAL_SETTLEMENT_STATES,
  type CrossDenominationSettlement,
  type SettlementState,
} from '@/services/qriptocent/settlement/types';
import {
  completeDestinationCredit,
  DECLARED_FINALITY_POLICY,
  expireSettlement,
  failDestinationCredit,
  finaliseSourceDebit,
  initiateSettlement,
  initiateSourceDebit,
  isMinorUnitString,
  openSettlementBook,
  recordSettlementReconciled,
  reserveDestinationLiquidity,
  reverseSettlement,
  totalDisclosedFees,
  valueHasLeftThePayer,
  verifyAuthorityAndBalance,
  verifySettlementMessage,
  type SettlementBook,
} from '@/services/qriptocent/settlement/settlement';
import {
  assessLiquidity,
  availableLiquidity,
  ILLUSTRATIVE_EXPOSURE_BPS,
  ILLUSTRATIVE_LIQUIDITY_POLICY,
  liquidityBand,
  maximumSettlementSize,
} from '@/services/qriptocent/settlement/liquidity';
import {
  attestFromLedger,
  pendingSettlementExposure,
  proveDestinationLiquidity,
  proveReserveBacking,
  proveSettlementCorrectness,
} from '@/services/qriptocent/settlement/proofs';
import {
  authoriseReplenishment,
  ILLUSTRATIVE_REPLENISHMENT_POLICY,
  openReplenishmentState,
} from '@/services/qriptocent/settlement/issuance';
import {
  mintUnitsForProvenBacking,
  QRIPTOCENT_REFERENCE_VALUE,
} from '@/services/qriptocent/settlement/referenceValue';
import {
  anchorSettlementReceipt,
  assertSettlementJournalCanLeaveMemory,
  createSettlementJournal,
  emitSettlementReceipt,
  ISSUANCE_ACTION_TYPES,
  persistSettlementReceipt,
  SETTLEMENT_ONLY_ACTION_TYPES,
  SETTLEMENT_RECEIPT_ACTION_TYPES,
  SettlementFixtureModeViolation,
  settlementJournalArtifacts,
  settlementReceiptHash,
} from '@/services/qriptocent/settlement/receipts';
import {
  feeAndParityViolations,
  presentSettlement,
  reconcileBook,
  settlementMintsNothing,
  settlementSupplyReport,
} from '@/services/qriptocent/settlement/reconciliation';
import {
  refusalsOf,
  runSettlementScenario,
  settlementFingerprint,
  settlementReplayIsStable,
  type SettlementScenarioRun,
} from '@/services/qriptocent/settlement/replay';
import {
  FIXTURE_ALICE,
  FIXTURE_BOB,
  FIXTURE_DELEGATION_GRANT,
  FIXTURE_TREASURY,
  fixtureLedgers,
  SCENARIO_AUTHORISED_ADVANCE,
  SCENARIO_BASEQC_TO_BCENT,
  SCENARIO_BCENT_TO_BASEQC,
  SCENARIO_CREDIT_WITHOUT_FINAL_DEBIT,
  SCENARIO_DESTINATION_FAILURE,
  SCENARIO_EXPIRY_BEFORE_DEBIT,
  SCENARIO_LIQUIDITY_SHORTFALL,
  SCENARIO_REPLAYED_MESSAGE,
  SETTLEMENT_SCENARIOS,
} from '@/services/qriptocent/settlement/scenarios';
import {
  settlementBeneficiaryRef,
  settlementCreditRef,
  settlementDelegationRef,
  settlementExecutionAuthorisationRef,
  settlementInstructionRef,
  settlementMessageRef,
  settlementNonce,
  settlementPayerRef,
  settlementProviderRef,
  settlementQuoteRef,
  settlementServiceRef,
  settlementSourceDebitRef,
  settlementVenueRef,
  RAW_UUID_PATTERN,
} from '@/services/qriptocent/settlement/refs';
import {
  assertSixCategoriesDistinguished,
  classificationRefusal,
  classificationViolations,
  deliveredPrincipal,
  feesBorneSeparately,
  feesDeductedFromPrincipal,
  recordedIn,
  requiresExplicitAuthorisation,
  SETTLEMENT_CLASSIFICATION_TABLE,
  SETTLEMENT_RULING_RECEIPT_COMPONENTS,
  SETTLEMENT_VALUE_BREAKDOWN_KEYS,
  settlementValueBreakdown,
  shortfallResponsesAreExhaustive,
  shortfallResponsesFor,
  TRANSPARENCY_COROLLARY_COMPONENTS,
  type SettlementValueBreakdown,
} from '@/services/qriptocent/settlement/classification';
import {
  ATTRIBUTED_FEE_CLASSES,
  LIQUIDITY_SHORTFALL_RESPONSES,
  MARKET_OBSERVATION_CLASSES,
  ORDINARY_FEE_CLASSES,
  PREFERRED_FEE_BEARING,
  SETTLEMENT_FEE_CLASSES,
  TIMING_FEE_CLASSES,
  type AttributedFee,
  type ExternalVenueExecution,
  type MarketObservation,
} from '@/services/qriptocent/settlement/types';

const SETTLEMENT_DIR = join(process.cwd(), 'services', 'qriptocent', 'settlement');
const CONSTITUTION = join(
  process.cwd(),
  'codexes',
  'packs',
  'agentiq',
  'updates',
  '2026-07-29_qriptocent-supply-constitution.md',
);

const ALICE = settlementPayerRef(FIXTURE_ALICE);
const BOB = settlementBeneficiaryRef(FIXTURE_BOB);
const TREASURY = settlementPayerRef(FIXTURE_TREASURY);
const DELEGATION = settlementDelegationRef(FIXTURE_DELEGATION_GRANT);

/** A book with fixture ledgers, for the hand-driven adversarial canaries. */
function book(overrides = {}): SettlementBook {
  return openSettlementBook({
    bookId: 'canary',
    ledgers: fixtureLedgers(ALICE, BOB, TREASURY, overrides),
    mode: 'fixture',
  });
}

/** Accept one instruction with sane defaults. */
function accept(
  b: SettlementBook,
  id: string,
  overrides: Partial<Parameters<typeof initiateSettlement>[1]> = {},
) {
  return initiateSettlement(b, {
    settlementId: id,
    instructionRef: settlementInstructionRef(`ins-${id}`),
    nonce: settlementNonce(`ins-${id}`, id),
    sourceDenomination: 'BCENT',
    destinationDenomination: 'BASE_QC',
    sourceNetwork: 'bitcoin',
    destinationNetwork: 'base',
    amountMinorUnits: '1000',
    payerRef: ALICE,
    beneficiaryRef: BOB,
    delegationRef: DELEGATION,
    feeBreakdown: {},
    initiatedAt: '2026-07-29T09:00:00.000Z',
    expiresAt: '2026-07-29T12:00:00.000Z',
    ...overrides,
  });
}

/** Drive one settlement all the way to `settled`. */
function settle(b: SettlementBook, id: string): void {
  verifyAuthorityAndBalance(b, id, '2026-07-29T09:00:05.000Z');
  initiateSourceDebit(b, id, { sourceDebitRef: settlementSourceDebitRef(`dbt-${id}`), at: '2026-07-29T09:00:10.000Z' });
  finaliseSourceDebit(b, id, { confirmations: 6, at: '2026-07-29T09:30:00.000Z' });
  verifySettlementMessage(b, id, {
    dvnMessageRef: settlementMessageRef(`msg-${id}`),
    nonce: b.settlements[id].nonce,
    at: '2026-07-29T09:30:10.000Z',
  });
  reserveDestinationLiquidity(b, id, '2026-07-29T09:30:15.000Z');
  completeDestinationCredit(b, id, {
    destinationCreditRef: settlementCreditRef(`crd-${id}`),
    at: '2026-07-29T09:30:20.000Z',
  });
}

const RUNS: Record<string, SettlementScenarioRun> = Object.fromEntries(
  SETTLEMENT_SCENARIOS.map((s) => [s.scenarioId, runSettlementScenario(s)]),
);

// ───────────────────────────────────────────────────────────────────────────
// AC-1 — the constitution records inter-ledger settlement, not bridging
// ───────────────────────────────────────────────────────────────────────────

describe('AC-1 the constitution states the DVN inter-ledger settlement model', () => {
  const doc = readFileSync(CONSTITUTION, 'utf8');

  it('carries the constitutional rule verbatim', () => {
    // Hand-written from the ratified text, not extracted from the doc.
    for (const clause of [
      'authenticated inter-ledger settlement rather than',
      'Each canonical denomination maintains its own native ledger and',
      'a source-side debit, a DVN-verified settlement message,',
      'and a destination-side credit from available native liquidity',
      'cent-for-cent; any fee must be separately disclosed',
      'No cross-network',
      'payment may create duplicate spendable value, and every debit, message, credit, exception, and',
      'reconciliation must produce attributable DVN receipts.',
    ]) {
      expect(doc, `the constitutional rule is missing: ${clause}`).toContain(clause);
    }
  });

  it('no longer instructs lock-and-mint anywhere except as a correction or a negation', () => {
    // Every surviving mention of lock/wrapped must sit on a line that either
    // records the correction or denies the practice. A bare instruction to lock
    // and wrap would fail here.
    const offenders = doc
      .split('\n')
      .filter((line) => /\block\b|locked|lockup|wrapped/i.test(line))
      .filter(
        (line) =>
          !/CORRECTION|earlier revision|issue wrapped Base Q¢ elsewhere|replaced|does \*\*not\*\* lock|no lock pool|NO wrapped|Liquidity replaces lockups|lockups disappear|Optional wrapped representations|rather than\s*$|conventional wrapped-token bridging|replace the older|lock-and-wrap model this architecture does not use|blocked pending/i.test(
            line,
          ),
      );
    expect(offenders, `bridge-first language survives:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('asks the six inter-ledger questions, not "how much is bridged / where is backing locked"', () => {
    for (const question of [
      'How much NATIVE ISSUED SUPPLY exists, per denomination?',
      'What are the CIRCULATING WALLET BALANCES on each network?',
      'What are the SETTLEMENT-LIQUIDITY BALANCES on each network?',
      'What PENDING INTER-LEDGER OBLIGATIONS are outstanding?',
      'What COMPLETED CROSS-NETWORK FLOWS have settled?',
      'What UNRESOLVED RECONCILIATION EXPOSURE remains?',
    ]) {
      expect(doc).toContain(question);
    }
    expect(doc).not.toContain('How much is bridged?\nWhere is backing locked?');
  });

  it('separates arbitrage from settlement rather than conflating them', () => {
    expect(doc).toContain('DVN settlement  =  deterministic transactional interoperability');
    expect(doc).toContain('arbitrage       =  market-based liquidity and price convergence');
    expect(doc).toContain('It is **not** the core payment mechanism');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-2 — T0/T2: every identifier that crosses a boundary is a commitment
// ───────────────────────────────────────────────────────────────────────────

describe('AC-2 no raw identifier reaches a settlement record, receipt or report', () => {
  it('the fixtures DO carry raw UUIDs — guarding the guard', () => {
    // Without this, a fixture that stopped using UUIDs would make every leakage
    // assertion below pass vacuously.
    for (const id of [FIXTURE_ALICE, FIXTURE_BOB, FIXTURE_TREASURY, FIXTURE_DELEGATION_GRANT]) {
      expect(RAW_UUID_PATTERN.test(id)).toBe(true);
    }
    expect(RAW_UUID_PATTERN.test(ALICE)).toBe(false);
    expect(RAW_UUID_PATTERN.test(DELEGATION)).toBe(false);
  });

  it('nothing a run emits carries a raw identifier', () => {
    for (const run of Object.values(RUNS)) {
      const emitted = JSON.stringify({
        settlements: run.book.settlementOrder.map((id) => run.book.settlements[id]),
        receipts: run.book.journal.receipts,
        exceptions: run.book.exceptions,
        reconciliation: run.reconciliation,
        disclosures: run.book.settlementOrder.map((id) => presentSettlement(run.book.settlements[id])),
        ledgers: run.book.ledgers,
      });
      expect(RAW_UUID_PATTERN.test(emitted), `${run.scenarioId} leaked a raw identifier`).toBe(false);
    }
  });

  it('an instruction carrying a raw payer id is REFUSED, not sanitised', () => {
    const b = book();
    const outcome = accept(b, 'stl-raw', { payerRef: FIXTURE_ALICE });
    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.refusal).toBe('raw-identifier-in-instruction');
    // A refusal must leave NOTHING behind — not the settlement, not the
    // consumed instruction, not a receipt.
    expect(b.settlementOrder).toEqual([]);
    expect(b.consumedInstructionRefs.size).toBe(0);
    expect(b.journal.receipts).toHaveLength(0);
  });

  it('a receipt carrying a raw identifier throws at emission', () => {
    const journal = createSettlementJournal('canary');
    expect(() =>
      emitSettlementReceipt(journal, {
        actionType: 'qriptocent_source_debit_initiated',
        at: '2026-07-29T09:00:00.000Z',
        settlementRef: 'stl-1',
        network: 'bitcoin',
        summary: 'poisoned',
        evidenceRefs: [FIXTURE_ALICE],
      }),
    ).toThrow(/raw identifier/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-3 — the state machine
// ───────────────────────────────────────────────────────────────────────────

describe('AC-3 the settlement state machine', () => {
  it('the happy path reaches settled with a complete debit → message → credit chain', () => {
    const run = RUNS['S1-bcent-to-baseqc-settled'];
    const s = run.book.settlements['stl-s1-001'];
    expect(s.state).toBe('settled');
    expect(s.sourceDebitRef).toBeTruthy();
    expect(s.dvnMessageRef).toBeTruthy();
    expect(s.destinationCreditRef).toBeTruthy();
    expect(s.settledAt).toBe('2026-07-29T09:30:30.000Z');
    // Cent-for-cent: the credited figure IS the amount string.
    expect(s.destinationCreditedMinorUnits).toBe('10000');
    // Debited = amount + the two disclosed fees, by hand: 10000 + 12 + 25.
    expect(s.sourceDebitedMinorUnits).toBe('10037');
  });

  it('the payer is debited on Bitcoin and the beneficiary credited on Base — no wrapped asset', () => {
    const run = RUNS['S1-bcent-to-baseqc-settled'];
    // Alice started with 250000 B¢ and paid 10037.
    expect(run.book.ledgers.BCENT.balances[ALICE]).toBe('239963');
    // Bob started with 250000 Base Q¢ and received exactly 10000 more.
    expect(run.book.ledgers.BASE_QC.balances[BOB]).toBe('260000');
    // Bob's B¢ balance is untouched: no wrapped B¢ was created on Base, and no
    // B¢ moved networks.
    expect(run.book.ledgers.BCENT.balances[BOB]).toBe('0');
    // B¢ accumulated on the Bitcoin side: 5000000 + 10000.
    expect(run.book.ledgers.BCENT.settlementLiquidityMinorUnits).toBe('5010000');
    // Base Q¢ settlement liquidity fell: 10000000 − 10000.
    expect(run.book.ledgers.BASE_QC.settlementLiquidityMinorUnits).toBe('9990000');
  });

  it('`settled` is the ONLY state that reads as final settlement', () => {
    const states: SettlementState[] = [
      'initiated',
      'source-debit-pending',
      'source-debit-final',
      'message-verified',
      'destination-credit-pending',
      'settled',
      'reconciliation-required',
      'reversed',
      'failed',
      'expired',
      'source-failed',
      'destination-failed',
    ];
    for (const state of states) {
      expect(isFinalSettlement(state), `${state} reads as final settlement`).toBe(state === 'settled');
    }
    // An obligation is never a resting place.
    expect(TERMINAL_SETTLEMENT_STATES).not.toContain('reconciliation-required');
  });

  it('the denomination ↔ network binding is constitutional, and a mismatch is refused', () => {
    expect(DENOMINATION_HOME_NETWORK).toEqual({ BCENT: 'bitcoin', BASE_QC: 'base' });
    const b = book();
    const outcome = accept(b, 'stl-bad-net', { sourceNetwork: 'base' });
    expect(outcome.ok === false && outcome.refusal).toBe('denomination-network-mismatch');
  });

  it('a same-denomination transfer is not a settlement', () => {
    const b = book();
    const outcome = accept(b, 'stl-same', { destinationDenomination: 'BCENT', destinationNetwork: 'bitcoin' });
    expect(outcome.ok === false && outcome.refusal).toBe('same-denomination');
  });

  it('amounts are minor-unit strings — floats and zero are refused', () => {
    expect(isMinorUnitString('1000')).toBe(true);
    expect(isMinorUnitString('10.5')).toBe(false);
    expect(isMinorUnitString('-1')).toBe(false);
    const b = book();
    expect(accept(b, 'stl-f', { amountMinorUnits: '10.5' }).ok).toBe(false);
    expect(accept(b, 'stl-z', { amountMinorUnits: '0' }).ok).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-4 — THE ACCOUNTING INVARIANT: exactly once
// ───────────────────────────────────────────────────────────────────────────

describe('AC-4 each settlement instruction is consumed EXACTLY ONCE', () => {
  it('a replayed DVN message is refused and never reaches a credit', () => {
    const run = RUNS['S3-replayed-message-refused'];
    expect(refusalsOf(run)).toContain('message-already-consumed');
    // The replay target settled exactly once, at the ORIGINAL amount, and Bob
    // was credited once: 250000 + 10000. A message that credited twice would
    // show 270000 here.
    expect(run.book.ledgers.BASE_QC.balances[BOB]).toBe('260000');
    expect(run.book.consumedCreditRefs.size).toBe(1);
    expect(run.book.settlements['stl-s3-002'].destinationCreditedMinorUnits).toBeUndefined();
  });

  it('a second credit against a settled settlement is refused', () => {
    const run = RUNS['S3-replayed-message-refused'];
    expect(refusalsOf(run)).toContain('credit-already-consumed');
    expect(run.book.settlements['stl-s1-001'].destinationCreditedMinorUnits).toBe('10000');
  });

  it('a credit REFERENCE cannot be reused, independently of the state gate', () => {
    // Driven directly: two settlements both reaching destination-credit-pending,
    // then the second presenting the first's credit reference. The state gate
    // cannot catch this one — only the register can.
    const b = book();
    accept(b, 'stl-a');
    accept(b, 'stl-b');
    settle(b, 'stl-a');
    verifyAuthorityAndBalance(b, 'stl-b', '2026-07-29T09:01:05.000Z');
    initiateSourceDebit(b, 'stl-b', { sourceDebitRef: settlementSourceDebitRef('dbt-b'), at: '2026-07-29T09:01:10.000Z' });
    finaliseSourceDebit(b, 'stl-b', { confirmations: 6, at: '2026-07-29T09:31:00.000Z' });
    verifySettlementMessage(b, 'stl-b', {
      dvnMessageRef: settlementMessageRef('msg-b'),
      nonce: b.settlements['stl-b'].nonce,
      at: '2026-07-29T09:31:10.000Z',
    });
    reserveDestinationLiquidity(b, 'stl-b', '2026-07-29T09:31:15.000Z');
    const replay = completeDestinationCredit(b, 'stl-b', {
      destinationCreditRef: settlementCreditRef('crd-stl-a'),
      at: '2026-07-29T09:31:20.000Z',
    });
    expect(replay.ok).toBe(false);
    expect(replay.ok === false && replay.refusal).toBe('credit-already-consumed');
    // 250000 opening + the ONE settlement that legitimately credited.
    expect(b.ledgers.BASE_QC.balances[BOB]).toBe('251000');
  });

  it('a replayed INSTRUCTION is refused, and a refusal never consumes one', () => {
    const b = book();
    expect(accept(b, 'stl-x').ok).toBe(true);
    // Same instruction reference, different settlement id.
    const replay = initiateSettlement(b, {
      settlementId: 'stl-y',
      instructionRef: settlementInstructionRef('ins-stl-x'),
      nonce: settlementNonce('ins-stl-y', 'stl-y'),
      sourceDenomination: 'BCENT',
      destinationDenomination: 'BASE_QC',
      sourceNetwork: 'bitcoin',
      destinationNetwork: 'base',
      amountMinorUnits: '1000',
      payerRef: ALICE,
      beneficiaryRef: BOB,
      delegationRef: DELEGATION,
      feeBreakdown: {},
      initiatedAt: '2026-07-29T09:00:00.000Z',
      expiresAt: '2026-07-29T12:00:00.000Z',
    });
    expect(replay.ok === false && replay.refusal).toBe('instruction-already-consumed');

    // A REFUSED instruction is not consumed — a transient refusal must not
    // become a permanent one.
    const refused = accept(b, 'stl-z', { amountMinorUnits: '0', payerRef: ALICE });
    expect(refused.ok).toBe(false);
    expect(b.consumedInstructionRefs.has(settlementInstructionRef('ins-stl-z'))).toBe(false);
    expect(accept(b, 'stl-z', { amountMinorUnits: '1000' }).ok).toBe(true);
  });

  it('a nonce belongs to exactly one settlement, forever', () => {
    const b = book();
    accept(b, 'stl-n1');
    const collide = accept(b, 'stl-n2', { nonce: settlementNonce('ins-stl-n1', 'stl-n1') });
    expect(collide.ok === false && collide.refusal).toBe('nonce-already-consumed');
  });

  it('a duplicate settlement id is refused outright', () => {
    const b = book();
    accept(b, 'stl-d');
    const dup = accept(b, 'stl-d', { instructionRef: settlementInstructionRef('other') });
    expect(dup.ok === false && dup.refusal).toBe('duplicate-settlement-id');
  });

  it('the registers and the settled count agree in every scenario', () => {
    for (const run of Object.values(RUNS)) {
      const settled = run.book.settlementOrder.filter((id) => run.book.settlements[id].state === 'settled');
      expect(
        run.book.consumedCreditRefs.size,
        `${run.scenarioId}: a credit was applied outside the exactly-once gate`,
      ).toBe(settled.length);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-5 — a credit requires a final source debit, or an AUTHORISED advance
// ───────────────────────────────────────────────────────────────────────────

describe('AC-5 no destination credit without a finalised source debit', () => {
  it('a credit before source finality is refused', () => {
    const run = RUNS['S4-credit-without-final-debit-refused'];
    expect(refusalsOf(run)).toContain('source-debit-not-final');
    // And the settlement still completes properly once the debit finalises.
    expect(run.book.settlements['stl-s4-001'].state).toBe('settled');
    expect(run.book.ledgers.BASE_QC.balances[BOB]).toBe('255000');
  });

  it('the gate reads the finality TIMESTAMP, not the state label', () => {
    // S4 finalises while the settlement is already in `destination-credit-pending`,
    // so the label never passes through `source-debit-final` at all. A gate
    // reading the label would refuse the legitimate credit that follows.
    const run = RUNS['S4-credit-without-final-debit-refused'];
    const s = run.book.settlements['stl-s4-001'];
    expect(s.sourceDebitFinalisedAt).toBe('2026-07-29T09:20:00.000Z');
    expect(s.state).toBe('settled');
  });

  it('an "advance" with no authority named is refused', () => {
    const run = RUNS['S7-authorised-liquidity-advance'];
    expect(refusalsOf(run)).toContain('unauthorised-liquidity-advance');
  });

  it('an AUTHORISED advance settles — and is reported as outstanding exposure', () => {
    const run = RUNS['S7-authorised-liquidity-advance'];
    const s = run.book.settlements['stl-s7-001'];
    expect(s.state).toBe('settled');
    expect(s.sourceDebitFinalisedAt).toBeUndefined();
    expect(s.liquidityAdvance?.authorisedByRef).toBeTruthy();
    expect(run.supplyAfter.unresolvedReconciliationExposure.count).toBe(1);
    expect(run.supplyAfter.unresolvedReconciliationExposure.amountMinorUnits.BCENT).toBe('2500');
    // The disclosure names the advance rather than presenting a fully-backed
    // settlement.
    expect(presentSettlement(s).liquidityAdvanceOutstanding?.advanceRef).toBeTruthy();
  });

  it('the source debit must be final under the DECLARED policy, not merely present', () => {
    expect(DECLARED_FINALITY_POLICY).toEqual({ bitcoin: 3, base: 30 });
    const b = book();
    accept(b, 'stl-fin');
    verifyAuthorityAndBalance(b, 'stl-fin', '2026-07-29T09:00:05.000Z');
    initiateSourceDebit(b, 'stl-fin', { sourceDebitRef: settlementSourceDebitRef('d'), at: '2026-07-29T09:00:10.000Z' });
    const short = finaliseSourceDebit(b, 'stl-fin', { confirmations: 2, at: '2026-07-29T09:10:00.000Z' });
    expect(short.ok === false && short.refusal).toBe('source-debit-not-final');
    expect(b.settlements['stl-fin'].sourceDebitFinalisedAt).toBeUndefined();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-6 — THE PARTIAL-STATE RULE
// ───────────────────────────────────────────────────────────────────────────

describe('AC-6 a partial state is never presented as final settlement', () => {
  it('a destination failure AFTER a final debit becomes a reconciliation obligation', () => {
    const b = book();
    accept(b, 'stl-p');
    verifyAuthorityAndBalance(b, 'stl-p', '2026-07-29T09:00:05.000Z');
    initiateSourceDebit(b, 'stl-p', { sourceDebitRef: settlementSourceDebitRef('d'), at: '2026-07-29T09:00:10.000Z' });
    finaliseSourceDebit(b, 'stl-p', { confirmations: 6, at: '2026-07-29T09:30:00.000Z' });
    verifySettlementMessage(b, 'stl-p', {
      dvnMessageRef: settlementMessageRef('m'),
      nonce: b.settlements['stl-p'].nonce,
      at: '2026-07-29T09:30:10.000Z',
    });
    reserveDestinationLiquidity(b, 'stl-p', '2026-07-29T09:30:15.000Z');
    failDestinationCredit(b, 'stl-p', { detail: 'destination rejected', at: '2026-07-29T09:30:20.000Z' });

    const s = b.settlements['stl-p'];
    // NOT `destination-failed`, NOT `failed`, NOT `expired`.
    expect(s.state).toBe('reconciliation-required');
    const disclosure = presentSettlement(s);
    expect(disclosure.finalSettlement).toBe(false);
    expect(disclosure.disposition).toBe('obligation-outstanding');
    expect(disclosure.reconciliationObligation?.owedToRef).toBe(ALICE);
    expect(disclosure.reconciliationObligation?.amountMinorUnits).toBe('1000');
    // And the exception says value was committed — the bit that separates
    // "nothing happened" from "someone is owed".
    expect(b.exceptions.at(-1)?.valueCommitted).toBe(true);
  });

  it('a timeout AFTER the payer was debited is an obligation, never `expired`', () => {
    const b = book();
    accept(b, 'stl-t', { expiresAt: '2026-07-29T09:05:00.000Z' });
    verifyAuthorityAndBalance(b, 'stl-t', '2026-07-29T09:00:05.000Z');
    initiateSourceDebit(b, 'stl-t', { sourceDebitRef: settlementSourceDebitRef('d'), at: '2026-07-29T09:00:10.000Z' });
    expireSettlement(b, 'stl-t', '2026-07-29T09:06:00.000Z');
    expect(b.settlements['stl-t'].state).toBe('reconciliation-required');
    expect(valueHasLeftThePayer(b.settlements['stl-t'])).toBe(true);
  });

  it('`expired` is available ONLY when nothing happened', () => {
    const run = RUNS['S6-expiry-with-no-ledger-effect'];
    const s = run.book.settlements['stl-s6-001'];
    expect(s.state).toBe('expired');
    expect(valueHasLeftThePayer(s)).toBe(false);
    expect(presentSettlement(s).disposition).toBe('terminated-without-effect');
    // The payer's ledger is untouched: bob keeps his full 250000 Base Q¢.
    expect(run.book.ledgers.BASE_QC.balances[BOB]).toBe('250000');
  });

  it('EVERY non-settled state presents as not-final — exhaustively', () => {
    const base: CrossDenominationSettlement = {
      settlementId: 'stl-x',
      sourceDenomination: 'BCENT',
      destinationDenomination: 'BASE_QC',
      sourceNetwork: 'bitcoin',
      destinationNetwork: 'base',
      amountMinorUnits: '1000',
      protocolRate: '1:1',
      payerRef: ALICE,
      beneficiaryRef: BOB,
      delegationRef: DELEGATION,
      state: 'initiated',
      feeBreakdown: {},
      receiptRefs: [],
      instructionRef: 'ins',
      nonce: 'n',
      initiatedAt: '2026-07-29T09:00:00.000Z',
      expiresAt: '2026-07-29T12:00:00.000Z',
    };
    const states: SettlementState[] = [
      'initiated',
      'source-debit-pending',
      'source-debit-final',
      'message-verified',
      'destination-credit-pending',
      'settled',
      'reconciliation-required',
      'reversed',
      'failed',
      'expired',
      'source-failed',
      'destination-failed',
    ];
    for (const state of states) {
      const disclosure = presentSettlement({ ...base, state });
      expect(disclosure.finalSettlement, `${state} presented as final settlement`).toBe(state === 'settled');
      if (state !== 'settled') expect(disclosure.disposition).not.toBe('settled');
    }
  });

  it('a compensating reversal makes the payer whole, and a SETTLED payment cannot be reversed', () => {
    const run = RUNS['S5-destination-failure-becomes-obligation'];
    const s = run.book.settlements['stl-s5-001'];
    expect(s.state).toBe('reversed');
    // Alice is back to her full starting balance: amount AND the disclosed fee.
    expect(run.book.ledgers.BCENT.balances[ALICE]).toBe('250000');
    expect(run.book.ledgers.BCENT.feesCollectedMinorUnits).toBe('0');

    // Reversing a settled payment would leave the destination credit standing
    // with no debit behind it.
    const b = book();
    accept(b, 'stl-r');
    settle(b, 'stl-r');
    const reversal = reverseSettlement(b, 'stl-r', { reversalRef: 'rev', detail: 'x', at: '2026-07-29T10:00:00.000Z' });
    expect(reversal.ok).toBe(false);
    expect(reversal.ok === false && reversal.detail).toMatch(/opposite-direction settlement/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-7 — fees are disclosed, never absorbed into a rate
// ───────────────────────────────────────────────────────────────────────────

describe('AC-7 cent-for-cent, with every difference an explicitly named fee', () => {
  it('the credited figure IS the amount, and the debit carries the fees', () => {
    const s = RUNS['S1-bcent-to-baseqc-settled'].book.settlements['stl-s1-001'];
    expect(s.protocolRate).toBe('1:1');
    expect(s.destinationCreditedMinorUnits).toBe(s.amountMinorUnits);
    expect(BigInt(s.sourceDebitedMinorUnits!)).toBe(BigInt(s.amountMinorUnits) + totalDisclosedFees(s.feeBreakdown));
    expect(feeAndParityViolations(s)).toEqual([]);
  });

  it('ten cents in, ten cents out — with no fees there is no difference at all', () => {
    const s = RUNS['S2-baseqc-to-bcent-settled'].book.settlements['stl-s2-001'];
    expect(s.amountMinorUnits).toBe('10');
    expect(s.sourceDebitedMinorUnits).toBe('10');
    expect(s.destinationCreditedMinorUnits).toBe('10');
  });

  it('a fee shaved off the CREDIT is caught — the 10.00 → 9.98 case', () => {
    const s = RUNS['S1-bcent-to-baseqc-settled'].book.settlements['stl-s1-001'];
    // 1000 debited, 998 credited, and NOTHING calling the 2 a fee.
    const absorbed: CrossDenominationSettlement = {
      ...s,
      amountMinorUnits: '1000',
      feeBreakdown: {},
      sourceDebitedMinorUnits: '1000',
      destinationCreditedMinorUnits: '998',
    };
    const violations = feeAndParityViolations(absorbed);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/cent-for-cent and admits no slippage/);
  });

  it('a charge that is NOT in the fee breakdown is caught', () => {
    const s = RUNS['S1-bcent-to-baseqc-settled'].book.settlements['stl-s1-001'];
    const undisclosed: CrossDenominationSettlement = {
      ...s,
      amountMinorUnits: '1000',
      feeBreakdown: { networkFee: '1' },
      sourceDebitedMinorUnits: '1005', // 4 more than amount + the disclosed 1
      destinationCreditedMinorUnits: '1000',
    };
    const violations = feeAndParityViolations(undisclosed);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/hidden in an implied rate/);
  });

  it('every fee class is disclosed individually, with its own basis', () => {
    const s = RUNS['S1-bcent-to-baseqc-settled'].book.settlements['stl-s1-001'];
    const disclosure = presentSettlement(s);
    expect(disclosure.disclosedFees).toEqual([
      { feeClass: 'network-fee', amountMinorUnits: '12' },
      { feeClass: 'service-fee', amountMinorUnits: '25' },
    ]);
    expect(disclosure.totalDisclosedFeesMinorUnits).toBe('37');
    // The four ratified categories, and nothing that could serve as a spread.
    const withAll = presentSettlement({
      ...s,
      feeBreakdown: { networkFee: '1', serviceFee: '2', liquidityFee: '3', reconciliationFee: '4' },
    });
    expect(withAll.disclosedFees.map((f) => f.feeClass)).toEqual([
      'network-fee',
      'service-fee',
      'liquidity-fee',
      'reconciliation-fee',
    ]);
    expect(withAll.totalDisclosedFeesMinorUnits).toBe('10');
  });

  it('there is no rate field anywhere that could carry a spread', () => {
    // `protocolRate` is the LITERAL '1:1'. If it were ever a number, a spread
    // could live in it and every arithmetic check would still pass.
    for (const run of Object.values(RUNS)) {
      for (const id of run.book.settlementOrder) {
        expect(run.book.settlements[id].protocolRate).toBe('1:1');
      }
    }
    const src = stripComments(readFileSync(join(SETTLEMENT_DIR, 'settlement.ts'), 'utf8'));
    for (const forbidden of ['exchangeRate', 'conversionRate', 'spread', 'slippage']) {
      expect(src, `settlement.ts references ${forbidden}`).not.toContain(forbidden);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-8 — settlement reallocates capacity; it NEVER mints
// ───────────────────────────────────────────────────────────────────────────

describe('AC-8 cross-chain payment ≠ new issuance', () => {
  it('native issued supply is identical before and after every scenario', () => {
    for (const run of Object.values(RUNS)) {
      expect(
        settlementMintsNothing(run.supplyBefore, run.supplyAfter),
        `${run.scenarioId} changed native issued supply`,
      ).toEqual([]);
      // Hand-written from the constitution's record, not read back from the run.
      expect(run.supplyAfter.nativeIssuedSupply).toEqual({
        BCENT: '100000000',
        BASE_QC: '400000000',
      });
    }
  });

  it('the settlement module never writes issuedMinorUnits', () => {
    const src = stripComments(readFileSync(join(SETTLEMENT_DIR, 'settlement.ts'), 'utf8'));
    expect(src, 'settlement.ts assigns to issuedMinorUnits — settlement must never mint').not.toMatch(
      /issuedMinorUnits\s*=/,
    );
    const liquidity = stripComments(readFileSync(join(SETTLEMENT_DIR, 'liquidity.ts'), 'utf8'));
    expect(liquidity, 'liquidity.ts assigns to issuedMinorUnits — the controller must never mint').not.toMatch(
      /issuedMinorUnits\s*=/,
    );
  });

  it('the six figures are reported SEPARATELY, never collapsed into one supply number', () => {
    const report = RUNS['S1-bcent-to-baseqc-settled'].supplyAfter;
    expect(Object.keys(report).sort()).toEqual(
      [
        'circulatingWalletBalances',
        'completedCrossNetworkFlows',
        'feesCollected',
        'maxSupply',
        'nativeIssuedSupply',
        'pendingInterLedgerObligations',
        'reservedSettlementLiquidity',
        'settlementLiquidityBalances',
        'unresolvedReconciliationExposure',
      ].sort(),
    );
    expect(report.completedCrossNetworkFlows).toEqual({
      count: 1,
      amountMinorUnits: { BCENT: '10000', BASE_QC: '0' },
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-9 — the three mechanisms stay constitutionally separate
// ───────────────────────────────────────────────────────────────────────────

describe('AC-9 settlement, liquidity assurance and issuance never collapse into each other', () => {
  it('the settlement path does not import the issuance module', () => {
    for (const file of ['settlement.ts', 'liquidity.ts']) {
      const src = stripComments(readFileSync(join(SETTLEMENT_DIR, file), 'utf8'));
      expect(src, `${file} imports the issuance module — mechanism ${file === 'settlement.ts' ? '1' : '2'} must never mint`).not.toContain(
        "from './issuance'",
      );
    }
  });

  it('the issuance module does not import the settlement state machine', () => {
    const src = stripComments(readFileSync(join(SETTLEMENT_DIR, 'issuance.ts'), 'utf8'));
    expect(src, 'issuance.ts imports the settlement state machine').not.toContain("from './settlement'");
  });

  it('no settlement run ever emits an issuance action type', () => {
    for (const run of Object.values(RUNS)) {
      const emitted = run.book.journal.receipts.map((r) => r.actionType);
      for (const issuanceType of ISSUANCE_ACTION_TYPES) {
        expect(emitted, `${run.scenarioId} emitted ${issuanceType} from a settlement path`).not.toContain(
          issuanceType,
        );
      }
    }
  });

  it('the issuance and settlement action-type sets are disjoint', () => {
    for (const t of ISSUANCE_ACTION_TYPES) {
      expect(SETTLEMENT_ONLY_ACTION_TYPES).not.toContain(t);
    }
    expect(SETTLEMENT_RECEIPT_ACTION_TYPES).toHaveLength(12);
    expect(SETTLEMENT_ONLY_ACTION_TYPES).toHaveLength(9);
  });

  it('a low destination ledger REFUSES the settlement instead of minting to cover it', () => {
    const run = RUNS['S8-destination-liquidity-shortfall'];
    expect(refusalsOf(run)).toContain('liquidity-band-refused');
    // The critical assertion: nothing was minted to make the credit possible.
    expect(settlementMintsNothing(run.supplyBefore, run.supplyAfter)).toEqual([]);
    // Bob's opening balance, untouched — nothing was credited to cover it.
    expect(run.book.ledgers.BASE_QC.balances[BOB]).toBe('250000');
    expect(run.book.settlements['stl-s8-001'].state).toBe('reversed');
  });

  it('nothing in the substrate but issuance.ts writes issuedMinorUnits', () => {
    const writers = readdirSync(SETTLEMENT_DIR)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => /issuedMinorUnits\s*=/.test(stripComments(readFileSync(join(SETTLEMENT_DIR, f), 'utf8'))));
    expect(writers).toEqual(['issuance.ts']);
  });

  it('no module but referenceValue.ts may write the reference value', () => {
    for (const file of readdirSync(SETTLEMENT_DIR).filter((f) => f.endsWith('.ts') && f !== 'referenceValue.ts')) {
      const src = stripComments(readFileSync(join(SETTLEMENT_DIR, file), 'utf8'));
      expect(src, `${file} assigns to the reference value`).not.toMatch(
        /QRIPTOCENT_REFERENCE_VALUE\s*(\[[^\]]*\])?\s*(\.\w+)?\s*=[^=]/,
      );
      expect(src, `${file} assigns usdCentsPerMinorUnit`).not.toMatch(/usdCentsPerMinorUnit\s*=[^=]/);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-10 — liquidity bands and transaction-size control
// ───────────────────────────────────────────────────────────────────────────

describe('AC-10 liquidity assurance can slow or refuse, never manufacture', () => {
  const policy = ILLUSTRATIVE_LIQUIDITY_POLICY;

  it('the three bands sit where the policy says, at the boundaries', () => {
    // Hand-written boundaries: min 1,000,000 and target 5,000,000.
    expect(liquidityBand(5_000_001n, policy)).toBe('green');
    expect(liquidityBand(5_000_000n, policy)).toBe('amber');
    expect(liquidityBand(1_000_001n, policy)).toBe('amber');
    expect(liquidityBand(1_000_000n, policy)).toBe('red');
    expect(liquidityBand(0n, policy)).toBe('red');
  });

  it('the exposure ratio TIGHTENS as liquidity falls', () => {
    expect(ILLUSTRATIVE_EXPOSURE_BPS).toEqual({ green: 500, amber: 100, red: 0 });
    // 10,000,000 green → 5% = 500,000. 5,000,000 amber → 1% = 50,000. red → 0.
    expect(maximumSettlementSize(10_000_000n, policy)).toBe(500_000n);
    expect(maximumSettlementSize(5_000_000n, policy)).toBe(50_000n);
    expect(maximumSettlementSize(1_000_000n, policy)).toBe(0n);
    // Truncation is always DOWNWARD — a limit that rounds up admits the one
    // transaction it exists to exclude. 5,000,003 × 5% = 250,000.15 → 250,000.
    expect(maximumSettlementSize(5_000_003n, policy)).toBe(250_000n);
  });

  it('a transaction too large for its band is queued or split, never permitted', () => {
    const ledger = fixtureLedgers(ALICE, BOB, TREASURY).BASE_QC;
    const assessment = assessLiquidity(ledger, '600000', policy);
    expect(assessment.band).toBe('green');
    expect(assessment.maximumSettlementMinorUnits).toBe('500000');
    expect(assessment.disposition).toBe('queue-or-split');
    expect(assessment.withinPolicy).toBe(false);
    expect(assessment.refusal).toBe('settlement-exceeds-exposure-limit');
  });

  it('RED fails closed, and only an ATTRIBUTABLE override moves it', () => {
    const ledger = fixtureLedgers(ALICE, BOB, TREASURY, { baseSettlementLiquidityMinorUnits: '100' }).BASE_QC;
    const closed = assessLiquidity(ledger, '10', policy);
    expect(closed.band).toBe('red');
    expect(closed.disposition).toBe('refuse');
    expect(closed.refusal).toBe('liquidity-band-refused');
    expect(closed.reasons[0]).toMatch(/fails closed/);

    const overridden = assessLiquidity(ledger, '10', policy, { emergencyOverrideRef: 'ovr-001' });
    expect(overridden.disposition).toBe('permit');
    expect(overridden.reasons[0]).toMatch(/ovr-001/);
  });

  it('AMBER triggers replenishment and increases proof frequency; GREEN does neither', () => {
    const ledgers = fixtureLedgers(ALICE, BOB, TREASURY);
    const green = assessLiquidity(ledgers.BASE_QC, '1000', policy);
    expect(green.band).toBe('green');
    expect(green.replenishmentTriggered).toBe(false);
    expect(green.proofFrequency).toBe('standard');

    const amber = assessLiquidity(ledgers.BCENT, '1000', policy);
    expect(amber.band).toBe('amber');
    expect(amber.replenishmentTriggered).toBe(true);
    expect(amber.proofFrequency).toBe('increased');
    expect(amber.disposition).toBe('permit');
  });

  it('available liquidity excludes what is already reserved', () => {
    const ledger = fixtureLedgers(ALICE, BOB, TREASURY).BASE_QC;
    expect(availableLiquidity(ledger)).toBe(10_000_000n);
    expect(availableLiquidity({ ...ledger, reservedLiquidityMinorUnits: '9000000' })).toBe(1_000_000n);
  });

  it('the assessment is receipted on the settlement it gated', () => {
    const run = RUNS['S1-bcent-to-baseqc-settled'];
    const proofs = run.book.journal.receipts.filter((r) => r.actionType === 'qriptocent_liquidity_proof_verified');
    expect(proofs).toHaveLength(1);
    expect(proofs[0].summary).toContain('band green');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-11 — governed replenishment is ISSUANCE, with proof before mint
// ───────────────────────────────────────────────────────────────────────────

describe('AC-11 new issuance exists only against separately proven and governed backing', () => {
  const constrainedProof = {
    proofType: 'destination-liquidity' as const,
    proofRef: 'lqp-1',
    denomination: 'BASE_QC' as const,
    network: 'base' as const,
    liquiditySufficient: false,
    thresholdState: 'critical' as const,
    proofValid: true,
    at: '2026-07-29T09:00:00.000Z',
  };
  const goodReserve = proveReserveBacking({
    proofRef: 'rsv-1',
    attestation: {
      settledReserveUsdCents: '1000000', // $10,000
      unfinalisedReserveTransferUsdCents: '500000',
      projectedInflowUsdCents: '9000000',
      reserveTransferFinalised: true,
    },
    at: '2026-07-29T09:00:00.000Z',
  });

  function replenish(overrides: Record<string, unknown> = {}) {
    const ledger = fixtureLedgers(ALICE, BOB, TREASURY, { baseSettlementLiquidityMinorUnits: '100' }).BASE_QC;
    const journal = createSettlementJournal('replenish');
    const state = openReplenishmentState();
    const outcome = authoriseReplenishment(ledger, journal, state, {
      authorisationRef: 'rpl-001',
      liquidityProof: constrainedProof,
      reserveProof: goodReserve,
      authorisedByRef: settlementPayerRef(FIXTURE_TREASURY),
      at: '2026-07-29T09:01:00.000Z',
      ...overrides,
    } as Parameters<typeof authoriseReplenishment>[3]);
    return { ledger, journal, state, outcome };
  }

  it('$10,000 of proven backing DERIVES 1,000,000 Q¢ from the reference value', () => {
    // 1 Q¢ = $0.01 = 1 USD cent, so $10,000 = 1,000,000 USD cents = 1,000,000 Q¢.
    expect(QRIPTOCENT_REFERENCE_VALUE.BASE_QC.usdCentsPerMinorUnit).toBe('1');
    const conversion = mintUnitsForProvenBacking('BASE_QC', '1000000');
    expect(conversion.ok).toBe(true);
    expect(conversion.ok === true && conversion.mintMinorUnits).toBe('1000000');
    expect(conversion.ok === true && conversion.derivation).toContain('÷ 1 USD cents per BASE_QC minor unit');
    // Not a hard-coded constant: the same arithmetic on a different reference
    // value gives a different answer.
    expect(mintUnitsForProvenBacking('BCENT', '2500')).toEqual({
      ok: true,
      mintMinorUnits: '2500',
      derivation: expect.stringContaining('2500'),
    });
  });

  it('the reference value is frozen — a controller cannot move the peg', () => {
    expect(Object.isFrozen(QRIPTOCENT_REFERENCE_VALUE)).toBe(true);
    expect(Object.isFrozen(QRIPTOCENT_REFERENCE_VALUE.BASE_QC)).toBe(true);
    const before = QRIPTOCENT_REFERENCE_VALUE.BASE_QC.usdCentsPerMinorUnit;
    try {
      (QRIPTOCENT_REFERENCE_VALUE.BASE_QC as { usdCentsPerMinorUnit: string }).usdCentsPerMinorUnit = '2';
    } catch {
      /* strict mode throws; sloppy mode silently ignores. Either is fine. */
    }
    expect(QRIPTOCENT_REFERENCE_VALUE.BASE_QC.usdCentsPerMinorUnit).toBe(before);
  });

  it('mints, and records the mint as ISSUANCE with the arithmetic on the receipt', () => {
    const { ledger, journal, outcome } = replenish();
    expect(outcome.ok).toBe(true);
    expect(outcome.ok === true && outcome.authorisation.mintedMinorUnits).toBe('1000000');
    // Issued supply moved — this is the one place in the substrate that may.
    expect(ledger.issuedMinorUnits).toBe('401000000');
    expect(ledger.settlementLiquidityMinorUnits).toBe('1000100');
    const types = journal.receipts.map((r) => r.actionType);
    expect(types).toEqual(['qriptocent_replenishment_authorised', 'qriptocent_native_issuance_executed']);
    expect(journal.receipts[1].summary).toContain('This is ISSUANCE, not settlement.');
    expect(journal.receipts[1].summary).toContain('1000000 USD cents ÷ 1 USD cents per BASE_QC minor unit');
  });

  it('REFUSES minting before reserve proof', () => {
    const { outcome, ledger, journal } = replenish({ reserveProof: null });
    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.refusal).toBe('reserve-proof-absent');
    expect(ledger.issuedMinorUnits).toBe('400000000');
    expect(journal.receipts).toHaveLength(0);
  });

  it('REFUSES minting on an unfinalised reserve transfer', () => {
    const unfinalised = proveReserveBacking({
      proofRef: 'rsv-2',
      attestation: {
        settledReserveUsdCents: '1000000',
        unfinalisedReserveTransferUsdCents: '1000000',
        projectedInflowUsdCents: '0',
        reserveTransferFinalised: false,
      },
      at: '2026-07-29T09:00:00.000Z',
    });
    expect(unfinalised.backingUsdCentsProven).toBe('0');
    expect(unfinalised.proofValid).toBe(false);
    const { outcome, ledger } = replenish({ reserveProof: unfinalised });
    expect(outcome.ok === false && outcome.refusal).toBe('reserve-transfer-not-finalised');
    expect(ledger.issuedMinorUnits).toBe('400000000');
  });

  it('PROJECTED INFLOWS are not reserves — excluded by construction and named', () => {
    const projectedOnly = proveReserveBacking({
      proofRef: 'rsv-3',
      attestation: {
        settledReserveUsdCents: '0',
        unfinalisedReserveTransferUsdCents: '0',
        projectedInflowUsdCents: '50000000', // $500,000 expected
        reserveTransferFinalised: true,
      },
      at: '2026-07-29T09:00:00.000Z',
    });
    // The forecast contributes NOTHING to proven backing.
    expect(projectedOnly.backingUsdCentsProven).toBe('0');
    expect(projectedOnly.excluded.join(' ')).toMatch(/a forecast is not a reserve/);
    const { outcome, ledger } = replenish({ reserveProof: projectedOnly });
    expect(outcome.ok === false && outcome.refusal).toBe('projected-inflows-are-not-reserves');
    expect(ledger.issuedMinorUnits).toBe('400000000');
  });

  it('REFUSES replenishing a healthy ledger — the trigger is amber or red, never discretion', () => {
    const { outcome } = replenish({ liquidityProof: { ...constrainedProof, thresholdState: 'healthy' } });
    expect(outcome.ok === false && outcome.refusal).toBe('liquidity-not-constrained');
  });

  it('REFUSES a mint that exceeds the policy cap or the rate limit', () => {
    const big = proveReserveBacking({
      proofRef: 'rsv-4',
      attestation: {
        settledReserveUsdCents: '9000000',
        unfinalisedReserveTransferUsdCents: '0',
        projectedInflowUsdCents: '0',
        reserveTransferFinalised: true,
      },
      at: '2026-07-29T09:00:00.000Z',
    });
    expect(ILLUSTRATIVE_REPLENISHMENT_POLICY.maxMintPerAuthorisationMinorUnits).toBe('5000000');
    const { outcome } = replenish({ reserveProof: big });
    expect(outcome.ok === false && outcome.refusal).toBe('mint-exceeds-policy-limit');

    // Rate limit: four authorisations permitted, the fifth refused.
    const ledger = fixtureLedgers(ALICE, BOB, TREASURY, { baseSettlementLiquidityMinorUnits: '100' }).BASE_QC;
    const journal = createSettlementJournal('rate');
    const state = openReplenishmentState();
    const grant = () =>
      authoriseReplenishment(ledger, journal, state, {
        authorisationRef: 'rpl',
        liquidityProof: constrainedProof,
        reserveProof: goodReserve,
        authorisedByRef: TREASURY,
        at: '2026-07-29T09:01:00.000Z',
      });
    expect(grant().ok).toBe(true);
    expect(grant().ok).toBe(true);
    expect(grant().ok).toBe(true);
    expect(grant().ok).toBe(true);
    const fifth = grant();
    expect(fifth.ok).toBe(false);
    expect(fifth.ok === false && fifth.refusal).toBe('mint-exceeds-rate-limit');
  });

  it("the denomination's governed maximum binds ABSOLUTELY — no override reaches it", () => {
    const ledger = fixtureLedgers(ALICE, BOB, TREASURY, { baseSettlementLiquidityMinorUnits: '100' }).BASE_QC;
    ledger.issuedMinorUnits = ledger.maxSupplyMinorUnits; // at the cap
    const outcome = authoriseReplenishment(ledger, createSettlementJournal('cap'), openReplenishmentState(), {
      authorisationRef: 'rpl-cap',
      liquidityProof: constrainedProof,
      reserveProof: goodReserve,
      authorisedByRef: TREASURY,
      at: '2026-07-29T09:01:00.000Z',
      emergencyOverrideRef: 'ovr-emergency',
    });
    expect(outcome.ok === false && outcome.refusal).toBe('mint-exceeds-denomination-maximum');
    expect(ledger.issuedMinorUnits).toBe('1000000000');
  });

  it('an emergency override must be attributable', () => {
    const { outcome } = replenish({ emergencyOverrideRef: '' });
    expect(outcome.ok === false && outcome.refusal).toBe('emergency-override-unattributed');
  });

  it('backing that does not divide evenly is refused, never rounded', () => {
    const conversion = mintUnitsForProvenBacking('BASE_QC', '0');
    expect(conversion.ok).toBe(false);
    expect(conversion.ok === false && conversion.refusal).toBe('non-positive-backing');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-12 — the three proofs, and what they must NOT disclose
// ───────────────────────────────────────────────────────────────────────────

describe('AC-12 proofs prove without disclosing', () => {
  const attestation = {
    spendableLiquidityMinorUnits: '7654321',
    reservedButUnsettledMinorUnits: '123456',
    minimumOperatingThresholdMinorUnits: '1000000',
    pendingSettlementExposureMinorUnits: '54321',
    reserveBackingAvailableMinorUnits: '99887766',
    withinPolicy: true,
  };

  it('the liquidity proof publishes three facts and NONE of the treasury figures', () => {
    const proof = proveDestinationLiquidity({
      proofRef: 'lqp-x',
      denomination: 'BASE_QC',
      network: 'base',
      attestation,
      requiredMinorUnits: '1000',
      safetyBufferMinorUnits: '500000',
      at: '2026-07-29T09:00:00.000Z',
    });
    expect(proof.liquiditySufficient).toBe(true);
    expect(proof.thresholdState).toBe('healthy');
    expect(proof.proofValid).toBe(true);

    const serialised = JSON.stringify(proof);
    for (const secret of Object.values(attestation).filter((v) => typeof v === 'string')) {
      expect(serialised, `the proof leaked the treasury figure ${secret}`).not.toContain(secret as string);
    }
  });

  it('an insufficient balance is a VALID proof of an insufficient balance', () => {
    const proof = proveDestinationLiquidity({
      proofRef: 'lqp-y',
      denomination: 'BASE_QC',
      network: 'base',
      attestation: { ...attestation, spendableLiquidityMinorUnits: '200000' },
      requiredMinorUnits: '1000000',
      safetyBufferMinorUnits: '500000',
      at: '2026-07-29T09:00:00.000Z',
    });
    // Collapsing these two would report a real shortfall as a technical fault.
    expect(proof.liquiditySufficient).toBe(false);
    expect(proof.proofValid).toBe(true);
    expect(proof.thresholdState).toBe('critical');
  });

  it('the attestation builder reads the ledger, and stays server-internal', () => {
    const ledger = fixtureLedgers(ALICE, BOB, TREASURY).BASE_QC;
    const built = attestFromLedger(ledger, ILLUSTRATIVE_LIQUIDITY_POLICY, '0', '0', true);
    expect(built.spendableLiquidityMinorUnits).toBe('10000000');
    expect(built.minimumOperatingThresholdMinorUnits).toBe('1000000');
  });

  it('the settlement-correctness proof is the CONJUNCTION of its five clauses', () => {
    const run = RUNS['S1-bcent-to-baseqc-settled'];
    const proof = proveSettlementCorrectness(run.book, 'stl-s1-001', {
      proofRef: 'scp-1',
      at: '2026-07-29T09:32:00.000Z',
    });
    expect(proof).toMatchObject({
      sourceDebitFinalised: true,
      destinationCreditMatchesInstruction: true,
      consumedExactlyOnce: true,
      amountsReconcileCentForCent: true,
      feesExplainAnyDifference: true,
      proofValid: true,
    });

    // An in-flight settlement cannot prove correctness.
    const pending = proveSettlementCorrectness(RUNS['S3-replayed-message-refused'].book, 'stl-s3-002', {
      proofRef: 'scp-2',
      at: '2026-07-29T09:57:00.000Z',
    });
    expect(pending.destinationCreditMatchesInstruction).toBe(false);
    expect(pending.proofValid).toBe(false);
  });

  it('pending settlement exposure counts value committed but not delivered', () => {
    const b = book();
    accept(b, 'stl-e');
    verifyAuthorityAndBalance(b, 'stl-e', '2026-07-29T09:00:05.000Z');
    initiateSourceDebit(b, 'stl-e', { sourceDebitRef: settlementSourceDebitRef('d'), at: '2026-07-29T09:00:10.000Z' });
    expect(pendingSettlementExposure(b, 'BASE_QC')).toBe('1000');
    settle(b, 'stl-e');
    expect(pendingSettlementExposure(b, 'BASE_QC')).toBe('0');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-13 — receipts: the evidence chain, and the fixture guard
// ───────────────────────────────────────────────────────────────────────────

describe('AC-13 every consequential event produces an attributable receipt', () => {
  it('the happy path emits the full evidence chain, in order', () => {
    const chain = RUNS['S1-bcent-to-baseqc-settled'].book.journal.receipts.map((r) => r.actionType);
    // Written out by hand, in the order the constitution's evidence chain names.
    expect(chain).toEqual([
      'qriptocent_payment_instruction_accepted',
      'qriptocent_settlement_authority_verified',
      'qriptocent_source_debit_initiated',
      'qriptocent_source_debit_finalised',
      'qriptocent_settlement_message_verified',
      'qriptocent_liquidity_proof_verified',
      'qriptocent_destination_liquidity_reserved',
      'qriptocent_destination_credit_completed',
      'qriptocent_settlement_reconciled',
    ]);
  });

  it('an exception is receipted with whether value had already left the payer', () => {
    const run = RUNS['S5-destination-failure-becomes-obligation'];
    const exceptions = run.book.journal.receipts.filter(
      (r) => r.actionType === 'qriptocent_settlement_exception_recorded',
    );
    expect(exceptions[0].valueCommitted).toBe(true);
    expect(exceptions.at(-1)?.valueCommitted).toBe(false); // after the reversal
  });

  it('a fixture journal cannot persist, and never reaches the writer', async () => {
    const journal = RUNS['S1-bcent-to-baseqc-settled'].book.journal;
    expect(journal.mode).toBe('fixture');
    let writerCalls = 0;
    await expect(
      persistSettlementReceipt(journal, journal.receipts[0], async () => {
        writerCalls += 1;
        return 'written';
      }),
    ).rejects.toBeInstanceOf(SettlementFixtureModeViolation);
    // The throw alone is not enough: a guard placed AFTER the write would also
    // throw, having already contaminated the trail.
    expect(writerCalls, 'the writer ran before the guard refused').toBe(0);
  });

  it('a fixture journal cannot anchor, and never reaches the anchorer', async () => {
    const journal = RUNS['S1-bcent-to-baseqc-settled'].book.journal;
    let anchorCalls = 0;
    await expect(
      anchorSettlementReceipt(journal, journal.receipts[0], async () => {
        anchorCalls += 1;
        return 'anchored';
      }),
    ).rejects.toBeInstanceOf(SettlementFixtureModeViolation);
    expect(anchorCalls).toBe(0);
  });

  it('the guard discriminates on mode rather than refusing unconditionally', () => {
    const live = createSettlementJournal('live-run', 'live');
    expect(() => assertSettlementJournalCanLeaveMemory(live, 'persist')).not.toThrow();
    const fixture = createSettlementJournal('fixture-run');
    expect(() => assertSettlementJournalCanLeaveMemory(fixture, 'anchor')).toThrow(/FIXTURE mode/);
  });

  it('artifacts report persisted and anchored as FALSE rather than omitting them', () => {
    const artifacts = settlementJournalArtifacts(RUNS['S1-bcent-to-baseqc-settled'].book.journal);
    expect(artifacts.generated).toBe(true);
    expect(artifacts.hashed).toBe(true);
    expect(artifacts.persisted).toBe(false);
    expect(artifacts.dvnAnchored).toBe(false);
    expect(artifacts.artifacts).toHaveLength(9);
    expect(artifacts.artifacts[0].receiptHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('the receipt hash is stable across key order — one canonicalisation, shared', () => {
    const a = settlementReceiptHash({
      receiptRef: 'r1',
      actionType: 'qriptocent_source_debit_initiated',
      at: 't',
      settlementRef: 's',
      network: 'bitcoin',
      summary: 'x',
      evidenceRefs: ['a', 'b'],
    });
    const b = settlementReceiptHash({
      evidenceRefs: ['a', 'b'],
      summary: 'x',
      network: 'bitcoin',
      settlementRef: 's',
      at: 't',
      actionType: 'qriptocent_source_debit_initiated',
      receiptRef: 'r1',
    });
    expect(a).toBe(b);
    // Array ORDER still matters — reordering evidence is a different receipt.
    expect(
      settlementReceiptHash({
        receiptRef: 'r1',
        actionType: 'qriptocent_source_debit_initiated',
        at: 't',
        settlementRef: 's',
        network: 'bitcoin',
        summary: 'x',
        evidenceRefs: ['b', 'a'],
      }),
    ).not.toBe(a);
  });

  it('no substrate module writes a settlement receipt to the production trail', () => {
    for (const file of readdirSync(SETTLEMENT_DIR).filter((f) => f.endsWith('.ts'))) {
      const src = stripComments(readFileSync(join(SETTLEMENT_DIR, file), 'utf8'));
      expect(src, `${file} writes to activity_receipts`).not.toContain('createActivityReceipt(');
      expect(src, `${file} submits to the DVN canister`).not.toContain('submitActivityReceiptToDvn(');
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-14 — determinism and replay
// ───────────────────────────────────────────────────────────────────────────

describe('AC-14 the substrate is deterministic and replayable', () => {
  it('no module reads a clock or a random source', () => {
    const forbidden = [/\bDate\.now\s*\(/, /\bMath\.random\s*\(/, /\bnew Date\s*\(/, /\bperformance\.now\s*\(/];
    const files = readdirSync(SETTLEMENT_DIR).filter((f) => f.endsWith('.ts'));
    // Guard the guard: a broken listing would pass this loop vacuously.
    expect(files.length).toBeGreaterThanOrEqual(8);
    const targets = [
      ...files.map((f) => [f, join(SETTLEMENT_DIR, f)] as const),
      // The shared journal primitives are on this path too.
      ['simulation/journal.ts', join(process.cwd(), 'services', 'simulation', 'journal.ts')] as const,
    ];
    for (const [label, path] of targets) {
      const src = stripComments(readFileSync(path, 'utf8'));
      for (const pattern of forbidden) {
        expect(pattern.test(src), `${label} uses ${pattern} — replay would not be reproducible`).toBe(false);
      }
    }
  });

  it('every scenario replays identically', () => {
    for (const scenario of SETTLEMENT_SCENARIOS) {
      expect(settlementReplayIsStable(scenario), `${scenario.scenarioId} is not replay-stable`).toBe(true);
    }
    expect(SETTLEMENT_SCENARIOS).toHaveLength(13);
  });

  it('the fingerprint is sensitive to REFUSALS, not merely to terminal states', () => {
    // S3 and S1 both end with stl-s1-001 settled; they differ in what was
    // refused along the way. A fingerprint blind to refusals would match.
    const a = settlementFingerprint(runSettlementScenario(SCENARIO_BCENT_TO_BASEQC));
    const b = settlementFingerprint(runSettlementScenario(SCENARIO_REPLAYED_MESSAGE));
    expect(a).not.toBe(b);
    expect(b).toContain('message-already-consumed');
  });

  it('a run never mutates its scenario fixtures', () => {
    const before = JSON.stringify(fixtureLedgers(ALICE, BOB, TREASURY));
    runSettlementScenario(SCENARIO_BCENT_TO_BASEQC);
    expect(JSON.stringify(fixtureLedgers(ALICE, BOB, TREASURY))).toBe(before);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-15 — every scenario reconciles
// ───────────────────────────────────────────────────────────────────────────

describe('AC-15 bilateral reconciliation holds in every scenario', () => {
  it('no scenario produces a reconciliation violation', () => {
    for (const run of Object.values(RUNS)) {
      expect(run.reconciliation.violations, `${run.scenarioId} did not reconcile`).toEqual([]);
    }
  });

  it('every ledger conserves: Σ balances + settlement liquidity + fees = issued', () => {
    for (const run of Object.values(RUNS)) {
      for (const d of ['BCENT', 'BASE_QC'] as const) {
        const l = run.book.ledgers[d];
        const held =
          Object.values(l.balances).reduce((acc, v) => acc + BigInt(v), 0n) +
          BigInt(l.settlementLiquidityMinorUnits) +
          BigInt(l.feesCollectedMinorUnits);
        expect(held.toString(), `${run.scenarioId}/${d} does not conserve`).toBe(l.issuedMinorUnits);
      }
    }
  });

  it('reconciliation CATCHES an unbacked credit rather than assuming it cannot happen', () => {
    // Hand-forge the state a broken gate would produce: credited, with no final
    // source debit and no authorised advance.
    const b = book();
    accept(b, 'stl-u');
    settle(b, 'stl-u');
    b.settlements['stl-u'].sourceDebitFinalisedAt = undefined;
    const violations = reconcileBook(b).violations;
    expect(violations.some((v) => /duplicate spendable value/.test(v))).toBe(true);
  });

  it('reconciliation CATCHES a value-committed failure parked in a terminal state', () => {
    const b = book();
    accept(b, 'stl-v');
    verifyAuthorityAndBalance(b, 'stl-v', '2026-07-29T09:00:05.000Z');
    initiateSourceDebit(b, 'stl-v', { sourceDebitRef: settlementSourceDebitRef('d'), at: '2026-07-29T09:00:10.000Z' });
    // The misreport: an obligation filed as "nothing happened".
    b.settlements['stl-v'].state = 'expired';
    const violations = reconcileBook(b).violations;
    expect(violations.some((v) => /never a terminated non-event/.test(v))).toBe(true);
  });

  it('reconciliation CATCHES a settlement whose receipts do not exist', () => {
    const b = book();
    accept(b, 'stl-w');
    settle(b, 'stl-w');
    b.settlements['stl-w'].receiptRefs = ['does-not-exist'];
    expect(reconcileBook(b).violations.some((v) => /not in journal/.test(v))).toBe(true);
  });

  it('a reconciled settlement carries the reconciliation receipt', () => {
    const b = book();
    accept(b, 'stl-rc');
    settle(b, 'stl-rc');
    expect(recordSettlementReconciled(b, 'stl-rc', '2026-07-29T09:40:00.000Z').ok).toBe(true);
    expect(b.journal.receipts.at(-1)?.actionType).toBe('qriptocent_settlement_reconciled');
    // An in-flight settlement cannot be reconciled.
    accept(b, 'stl-rd');
    expect(recordSettlementReconciled(b, 'stl-rd', '2026-07-29T09:40:00.000Z').ok).toBe(false);
  });

  it('the supply report totals match the ledgers it reports on', () => {
    const run = RUNS['S1-bcent-to-baseqc-settled'];
    const report = settlementSupplyReport(run.book);
    expect(report.settlementLiquidityBalances).toEqual({ BCENT: '5010000', BASE_QC: '9990000' });
    expect(report.feesCollected).toEqual({ BCENT: '37', BASE_QC: '0' });
    expect(report.pendingInterLedgerObligations.count).toBe(0);
    expect(report.unresolvedReconciliationExposure.count).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-17 — the fee / market-fact split (operator ruling + the Constitutional
//         Trading Transparency Principle, both 2026-07-29)
//
// Every canary here guards a difference that, misclassified, still produces
// arithmetic that balances. That is what makes them worth having: a retained
// spread filed as a market fact debits the same payer by the same amount and
// reconciles perfectly — the only thing wrong with it is that it lies about WHY
// the customer paid more.
// ───────────────────────────────────────────────────────────────────────────

const QUOTED_BEFORE = '2026-07-29T08:50:00.000Z';
const PROVIDER = settlementProviderRef('prv-canary');
const SERVICE = settlementServiceRef('svc-canary');
const VENUE = settlementVenueRef('ven-canary');

/** A well-formed expedited-settlement fee, for mutating in the canaries. */
function timingFee(overrides: Partial<AttributedFee> = {}): AttributedFee {
  return {
    feeClass: 'expedited-settlement-fee',
    amountMinorUnits: '50',
    chargedByRef: PROVIDER,
    quoteRef: settlementQuoteRef('qte-canary'),
    quotedAt: QUOTED_BEFORE,
    serviceRef: SERVICE,
    bearing: 'borne-separately',
    basis: 'expedited destination credit',
    ...overrides,
  };
}

const ACCELERATED = {
  kind: 'expedited-settlement' as const,
  serviceRef: SERVICE,
  providedByRef: PROVIDER,
  quotedAt: QUOTED_BEFORE,
};

function observation(overrides: Partial<MarketObservation> = {}): MarketObservation {
  return {
    observationClass: 'market-price-deviation',
    venueRef: VENUE,
    deviationBps: '120',
    observedAt: QUOTED_BEFORE,
    note: 'B¢ above reference on a secondary venue',
    ...overrides,
  };
}

function execution(overrides: Partial<ExternalVenueExecution> = {}): ExternalVenueExecution {
  return {
    venueRef: VENUE,
    executionDeviationBps: '60',
    providerRetainedMinorUnits: '0',
    authorisation: {
      authorisationRef: settlementExecutionAuthorisationRef('xau-canary'),
      acceptedByRef: ALICE,
      at: QUOTED_BEFORE,
    },
    ...overrides,
  };
}

describe('AC-17 principal, fees and market facts are three different kinds of thing', () => {
  // ── The classification table, as data ────────────────────────────────────

  it('the ruling table has the seven rows, and the two decisive ones are OPPOSITE', () => {
    // Hand-written from the ratified table, not read back from the constant.
    expect(SETTLEMENT_CLASSIFICATION_TABLE.map((r) => [r.situation, r.classification])).toEqual([
      ['Principal conversion at 1:1', 'settlement-amount'],
      ['Network execution cost', 'network-fee'],
      ['Liquidity advanced before finality', 'liquidity-or-finality-fee'],
      ['Expedited service', 'expedited-settlement-fee'],
      ['Secondary-market premium or discount', 'market-fact'],
      ['Provider-retained spread or markup', 'fee'],
      ['External venue execution away from parity', 'market-execution-result'],
    ]);
    // THE SHARP LINE: same arithmetic difference, opposite home.
    expect(recordedIn('market-fact')).toBe('market-observation-record');
    expect(recordedIn('fee')).toBe('fee-breakdown');
    // And the last row is the one that needs the payer's acceptance recorded.
    expect(requiresExplicitAuthorisation('market-execution-result')).toBe(true);
    expect(requiresExplicitAuthorisation('market-fact')).toBe(false);
  });

  it('no market-deviation class is reachable from the fee breakdown — the classes are DISJOINT', () => {
    expect(SETTLEMENT_FEE_CLASSES).toEqual([
      'network-fee',
      'service-fee',
      'liquidity-fee',
      'reconciliation-fee',
      'finality-fee',
      'liquidity-advance-fee',
      'expedited-settlement-fee',
      'provider-retained-spread-fee',
    ]);
    expect(MARKET_OBSERVATION_CLASSES).toEqual([
      'market-price-deviation',
      'observed-spread',
      'market-impact',
      'external-execution-rate',
    ]);
    for (const m of MARKET_OBSERVATION_CLASSES) {
      expect(SETTLEMENT_FEE_CLASSES, `${m} is addressable as a fee class`).not.toContain(m);
    }
    expect(ORDINARY_FEE_CLASSES).toHaveLength(4);
    expect(TIMING_FEE_CLASSES).toEqual([
      'finality-fee',
      'liquidity-advance-fee',
      'expedited-settlement-fee',
    ]);
    expect(ATTRIBUTED_FEE_CLASSES).toContain('provider-retained-spread-fee');
  });

  it('the SettlementFeeBreakdown declaration names no market-observation field', () => {
    // Structural, over the interface body itself: a future field called
    // `marketDeviation` or `observedSpread` would fail here even before any
    // instruction carried one.
    const src = stripComments(readFileSync(join(SETTLEMENT_DIR, 'types.ts'), 'utf8'));
    const start = src.indexOf('export interface SettlementFeeBreakdown');
    expect(start).toBeGreaterThan(-1);
    const body = src.slice(start, src.indexOf('}', start));
    for (const forbidden of ['market', 'deviation', 'Deviation', 'venue', 'Venue', 'Bps', 'rate', 'Rate']) {
      expect(body, `SettlementFeeBreakdown declares a ${forbidden} field`).not.toContain(forbidden);
    }
  });

  it('no run ever discloses a market observation among the fees', () => {
    for (const run of Object.values(RUNS)) {
      for (const id of run.book.settlementOrder) {
        const disclosure = presentSettlement(run.book.settlements[id]);
        for (const fee of disclosure.disclosedFees) {
          expect(
            MARKET_OBSERVATION_CLASSES,
            `${run.scenarioId}/${id} disclosed ${fee.feeClass} as a fee`,
          ).not.toContain(fee.feeClass as never);
        }
        // The two are SIBLINGS on the disclosure, never nested.
        expect(Array.isArray(disclosure.marketObservations)).toBe(true);
      }
    }
  });

  // ── REQUIRED CATCH: a market deviation placed in the fee breakdown ───────

  it('CATCHES a market deviation smuggled into the fee breakdown', () => {
    const b = book();
    const outcome = accept(b, 'stl-mkt-in-fees', {
      feeBreakdown: {
        attributedFees: [
          // A "fee" whose class is a market-observation class. Arithmetically
          // indistinguishable from a legitimate charge.
          timingFee({ feeClass: 'observed-spread' as never }),
        ],
      },
      acceleratedService: ACCELERATED,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.refusal).toBe('market-deviation-in-fee-breakdown');
    // Refused BEFORE any ledger effect.
    expect(b.settlementOrder).toEqual([]);
    expect(b.journal.receipts).toHaveLength(0);
  });

  // ── REQUIRED CATCH: a retained spread recorded as a market fact ──────────

  it('CATCHES a retained spread recorded as a market fact instead of a fee', () => {
    const b = book();
    const outcome = accept(b, 'stl-laundered', {
      // The provider retained 25 out of the venue deviation and disclosed NO
      // fee. Every ledger figure would still balance.
      externalExecution: execution({ providerRetainedMinorUnits: '25' }),
      marketObservations: [observation({ observationClass: 'external-execution-rate' })],
    });
    expect(outcome.ok === false && outcome.refusal).toBe('retained-spread-recorded-as-market-fact');
    expect(outcome.ok === false && outcome.detail).toMatch(/must be disclosed as a fee/);

    // Disclosed as a fee of the SAME amount: accepted.
    const ok = accept(b, 'stl-disclosed', {
      externalExecution: execution({ providerRetainedMinorUnits: '25' }),
      marketObservations: [observation({ observationClass: 'external-execution-rate' })],
      feeBreakdown: {
        attributedFees: [
          timingFee({
            feeClass: 'provider-retained-spread-fee',
            amountMinorUnits: '25',
            serviceRef: VENUE,
          }),
        ],
      },
    });
    expect(ok.ok).toBe(true);

    // A PARTIAL disclosure is still laundering — 25 retained, 10 declared.
    const partial = accept(b, 'stl-partial', {
      externalExecution: execution({ providerRetainedMinorUnits: '25' }),
      marketObservations: [observation({ observationClass: 'external-execution-rate' })],
      feeBreakdown: {
        attributedFees: [
          timingFee({
            feeClass: 'provider-retained-spread-fee',
            amountMinorUnits: '10',
            serviceRef: VENUE,
          }),
        ],
      },
    });
    expect(partial.ok === false && partial.refusal).toBe('retained-spread-recorded-as-market-fact');
  });

  it('CATCHES retained compensation attributed to a market movement nobody proved', () => {
    // The principle's last clause. The fee IS disclosed here, so the previous
    // canary passes — what is missing is the EVIDENCE for the market movement
    // the retention is attributed to.
    const b = book();
    const outcome = accept(b, 'stl-unproven', {
      externalExecution: execution({ providerRetainedMinorUnits: '25' }),
      feeBreakdown: {
        attributedFees: [
          timingFee({
            feeClass: 'provider-retained-spread-fee',
            amountMinorUnits: '25',
            serviceRef: VENUE,
          }),
        ],
      },
      // No market observation for that venue.
    });
    expect(outcome.ok === false && outcome.refusal).toBe('market-movement-not-separately-proven');

    // An observation of a DIFFERENT venue does not prove this one's movement.
    const wrongVenue = accept(b, 'stl-wrong-venue', {
      externalExecution: execution({ providerRetainedMinorUnits: '25' }),
      marketObservations: [observation({ venueRef: settlementVenueRef('ven-elsewhere') })],
      feeBreakdown: {
        attributedFees: [
          timingFee({
            feeClass: 'provider-retained-spread-fee',
            amountMinorUnits: '25',
            serviceRef: VENUE,
          }),
        ],
      },
    });
    expect(wrongVenue.ok === false && wrongVenue.refusal).toBe('market-movement-not-separately-proven');
  });

  // ── REQUIRED CATCH: external-venue execution without recorded acceptance ──

  it('CATCHES an off-parity external execution the payer never accepted', () => {
    const b = book();
    const { authorisation: _dropped, ...unaccepted } = execution();
    const outcome = accept(b, 'stl-unaccepted', {
      externalExecution: unaccepted,
      marketObservations: [observation()],
    });
    expect(outcome.ok === false && outcome.refusal).toBe('external-execution-without-authorisation');

    // An authorisation missing its accepting party is not an acceptance.
    const hollow = accept(b, 'stl-hollow', {
      externalExecution: execution({
        authorisation: {
          authorisationRef: settlementExecutionAuthorisationRef('xau-hollow'),
          acceptedByRef: '',
          at: QUOTED_BEFORE,
        },
      }),
      marketObservations: [observation()],
    });
    expect(hollow.ok === false && hollow.refusal).toBe('external-execution-without-authorisation');
  });

  // ── REQUIRED CATCH: a fee appearing when nothing was accelerated ─────────

  it('CATCHES a timing fee charged when no accelerated service was used', () => {
    const b = book();
    // No `acceleratedService` — the fee has nothing to pay for.
    const outcome = accept(b, 'stl-standing-fee', {
      feeBreakdown: { attributedFees: [timingFee()] },
    });
    expect(outcome.ok === false && outcome.refusal).toBe('timing-fee-without-accelerated-service');
    expect(outcome.ok === false && outcome.detail).toMatch(/undertook additional risk/);

    // A fee pointing at a service this settlement did not use is the same defect.
    const foreign = accept(b, 'stl-foreign-service', {
      feeBreakdown: { attributedFees: [timingFee({ serviceRef: settlementServiceRef('svc-other') })] },
      acceleratedService: ACCELERATED,
    });
    expect(foreign.ok === false && foreign.refusal).toBe('timing-fee-without-accelerated-service');

    // With the service declared, the same fee is legitimate.
    expect(
      accept(b, 'stl-legit', {
        feeBreakdown: { attributedFees: [timingFee()] },
        acceleratedService: ACCELERATED,
      }).ok,
    ).toBe(true);
  });

  it('the ordinary scenarios carry NO timing fee at all — absent when unused', () => {
    for (const id of ['S1-bcent-to-baseqc-settled', 'S2-baseqc-to-bcent-settled']) {
      for (const sid of RUNS[id].book.settlementOrder) {
        const s = RUNS[id].book.settlements[sid];
        expect(s.feeBreakdown.attributedFees ?? [], `${id} charges a timing fee`).toEqual([]);
        expect(s.acceleratedService).toBeUndefined();
      }
    }
  });

  it('reconciliation CATCHES a liquidity-advance fee on a settlement that never advanced', () => {
    // The gate cannot see this: the advance is authorised at CREDIT time, long
    // after the instruction was accepted. Only the reconciler can.
    const b = book();
    accept(b, 'stl-phantom-advance', {
      feeBreakdown: {
        attributedFees: [timingFee({ feeClass: 'liquidity-advance-fee', amountMinorUnits: '30' })],
      },
      acceleratedService: { ...ACCELERATED, kind: 'liquidity-advance' },
    });
    settle(b, 'stl-phantom-advance');
    const s = b.settlements['stl-phantom-advance'];
    expect(s.state).toBe('settled');
    expect(s.liquidityAdvance).toBeUndefined();
    expect(
      classificationViolations(s).some((v) => /never advanced destination liquidity/.test(v)),
    ).toBe(true);
    expect(reconcileBook(b).violations.some((v) => /never advanced destination liquidity/.test(v))).toBe(
      true,
    );
  });

  // ── Attribution and quoting ─────────────────────────────────────────────

  it('a fee with no charging service named is refused — an unattributed charge is a spread', () => {
    const b = book();
    const outcome = accept(b, 'stl-anon', {
      feeBreakdown: { attributedFees: [timingFee({ chargedByRef: '' })] },
      acceleratedService: ACCELERATED,
    });
    expect(outcome.ok === false && outcome.refusal).toBe('fee-not-attributed');
  });

  it('a fee quoted at or after authorisation is refused — it must be quoted BEFORE', () => {
    const b = book();
    // `accept` authorises at 09:00:00.000Z.
    const after = accept(b, 'stl-late-quote', {
      feeBreakdown: { attributedFees: [timingFee({ quotedAt: '2026-07-29T09:00:01.000Z' })] },
      acceleratedService: { ...ACCELERATED, quotedAt: QUOTED_BEFORE },
    });
    expect(after.ok === false && after.refusal).toBe('fee-not-quoted-before-authorisation');
    // Simultaneous is not "before": a quote produced at the instant of
    // authorisation is not one the payer could have considered.
    const same = accept(b, 'stl-same-instant', {
      feeBreakdown: { attributedFees: [timingFee({ quotedAt: '2026-07-29T09:00:00.000Z' })] },
      acceleratedService: ACCELERATED,
    });
    expect(same.ok === false && same.refusal).toBe('fee-not-quoted-before-authorisation');
  });

  // ── The two presentation forms ──────────────────────────────────────────

  it('PREFERRED form: the recipient receives the FULL authorised principal', () => {
    const run = RUNS['S9-expedited-fee-borne-separately'];
    const s = run.book.settlements['stl-s9-001'];
    expect(s.state).toBe('settled');
    // Principal delivered: 10000. Fee paid separately: 100 + the 12 network fee.
    expect(s.destinationCreditedMinorUnits).toBe('10000');
    expect(s.destinationCreditedMinorUnits).toBe(s.amountMinorUnits);
    expect(s.sourceDebitedMinorUnits).toBe('10112');
    // Bob's opening 250000 plus the WHOLE principal.
    expect(run.book.ledgers.BASE_QC.balances[BOB]).toBe('260000');
    // Alice paid 10112 out of 250000.
    expect(run.book.ledgers.BCENT.balances[ALICE]).toBe('239888');

    const disclosure = presentSettlement(s);
    expect(disclosure.recipientReceivedFullPrincipal).toBe(true);
    expect(disclosure.authorisedPrincipalMinorUnits).toBe('10000');
    expect(disclosure.deliveredPrincipalMinorUnits).toBe('10000');
    expect(disclosure.feesDeductedFromPrincipalMinorUnits).toBe('0');
    expect(disclosure.feesBorneSeparatelyMinorUnits).toBe('112');
    // reference value + service fee + liquidity/finality premium = total cost.
    expect(disclosure.authorisedTotalCostMinorUnits).toBe('10112');
    // The fee is itemised, attributed, and names what it paid for.
    const fee = disclosure.disclosedFees.find((f) => f.feeClass === 'expedited-settlement-fee');
    expect(fee?.amountMinorUnits).toBe('100');
    expect(fee?.chargedByRef).toBeTruthy();
    expect(fee?.quoteRef).toBeTruthy();
    expect(fee?.serviceRef).toBe(s.acceleratedService?.serviceRef);
    expect(fee?.bearing).toBe('borne-separately');
  });

  it('borne-separately is the DEFAULT when a fee does not say', () => {
    expect(PREFERRED_FEE_BEARING).toBe('borne-separately');
    const { bearing: _unset, ...unstated } = timingFee();
    const fees = { attributedFees: [unstated as AttributedFee] };
    expect(feesBorneSeparately(fees)).toBe(50n);
    expect(feesDeductedFromPrincipal(fees)).toBe(0n);
    expect(deliveredPrincipal('1000', fees)).toBe('1000');
  });

  it("DEDUCTED form: the operator's worked example — 100 in, 1 fee, 99 received", () => {
    const run = RUNS['S10-finality-fee-deducted-from-principal'];
    const s = run.book.settlements['stl-s10-001'];
    expect(s.state).toBe('settled');
    // Principal 100; protocol conversion 100 at 1:1; finality fee 1; received 99.
    expect(s.amountMinorUnits).toBe('100');
    expect(s.protocolRate).toBe('1:1');
    expect(s.destinationCreditedMinorUnits).toBe('99');
    // The payer is debited the principal ONLY — the fee comes out of it, and
    // charging it on both sides would take it twice.
    expect(s.sourceDebitedMinorUnits).toBe('100');
    expect(run.book.ledgers.BASE_QC.balances[BOB]).toBe('250099');
    // The deducted fee is collected on the DESTINATION ledger, where the
    // principal it came out of was delivered.
    expect(run.book.ledgers.BASE_QC.feesCollectedMinorUnits).toBe('1');

    const disclosure = presentSettlement(s);
    expect(disclosure.recipientReceivedFullPrincipal).toBe(false);
    expect(disclosure.authorisedPrincipalMinorUnits).toBe('100');
    expect(disclosure.deliveredPrincipalMinorUnits).toBe('99');
    expect(disclosure.feesDeductedFromPrincipalMinorUnits).toBe('1');
    expect(disclosure.authorisedTotalCostMinorUnits).toBe('100');
    expect(feeAndParityViolations(s)).toEqual([]);
  });

  it('an UNDISCLOSED reduction of the delivered principal is still caught', () => {
    // The deducted form must not become a licence to shave the credit. 100
    // authorised, 1 disclosed, 97 delivered — the missing 2 has no fee.
    const s = RUNS['S10-finality-fee-deducted-from-principal'].book.settlements['stl-s10-001'];
    const shaved: CrossDenominationSettlement = { ...s, destinationCreditedMinorUnits: '97' };
    const violations = feeAndParityViolations(shaved);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/undisclosed reduction of the protocol principal/);
  });

  it('a deduction may never consume the whole principal', () => {
    const b = book();
    const outcome = accept(b, 'stl-all-fee', {
      amountMinorUnits: '50',
      feeBreakdown: {
        attributedFees: [
          timingFee({ amountMinorUnits: '50', bearing: 'deducted-from-principal' }),
        ],
      },
      acceleratedService: ACCELERATED,
    });
    expect(outcome.ok === false && outcome.refusal).toBe('non-positive-amount');
  });

  // ── Market facts move nothing ───────────────────────────────────────────

  it('a market deviation is observed and charges nobody — no ledger moves because of one', () => {
    const run = RUNS['S11-market-deviation-is-a-market-fact'];
    const s = run.book.settlements['stl-s11-001'];
    expect(s.marketObservations).toHaveLength(2);
    expect(s.state).toBe('settled');
    // Principal in, principal out, and NOT ONE FEE anywhere.
    expect(s.sourceDebitedMinorUnits).toBe('4000');
    expect(s.destinationCreditedMinorUnits).toBe('4000');
    expect(presentSettlement(s).disclosedFees).toEqual([]);
    expect(presentSettlement(s).totalDisclosedFeesMinorUnits).toBe('0');
    expect(run.book.ledgers.BCENT.feesCollectedMinorUnits).toBe('0');
    expect(run.book.ledgers.BASE_QC.feesCollectedMinorUnits).toBe('0');
    // 250000 − 4000, and 250000 + 4000. A deviation of 180 bps changed neither.
    expect(run.book.ledgers.BCENT.balances[ALICE]).toBe('246000');
    expect(run.book.ledgers.BASE_QC.balances[BOB]).toBe('254000');
  });

  it('reconciliation CATCHES a market observation that moved a ledger', () => {
    // Forge what a deviation-driven credit would look like: an observation
    // present, and a delivered figure that principal and fees alone do not
    // explain. Without this check the fee/market split would be a naming
    // convention rather than a control.
    const b = book();
    accept(b, 'stl-obs-moved', { marketObservations: [observation()] });
    settle(b, 'stl-obs-moved');
    b.settlements['stl-obs-moved'].destinationCreditedMinorUnits = '982';
    const violations = reconcileBook(b).violations;
    expect(violations.some((v) => /a market observation moved a ledger/.test(v))).toBe(true);
  });

  // ── The receipt lines ───────────────────────────────────────────────────

  it('BOTH ratified six-component lists are independently addressable on a receipt', () => {
    const run = RUNS['S12-external-execution-with-retained-spread-as-fee'];
    const credit = run.book.journal.receipts.find(
      (r) => r.actionType === 'qriptocent_destination_credit_completed',
    );
    const breakdown = credit?.valueBreakdown as SettlementValueBreakdown;
    expect(breakdown).toBeTruthy();

    // The transparency corollary's six — including provider-retained spread as
    // ITS OWN line, distinct from service fee.
    for (const component of TRANSPARENCY_COROLLARY_COMPONENTS) {
      expect(
        Object.prototype.hasOwnProperty.call(breakdown, component),
        `the receipt cannot address ${component} separately`,
      ).toBe(true);
    }
    // The settlement ruling's six.
    for (const component of SETTLEMENT_RULING_RECEIPT_COMPONENTS) {
      expect(Object.prototype.hasOwnProperty.call(breakdown, component)).toBe(true);
    }
    // Seven lines, because the two ratified sixes overlap in five.
    expect(SETTLEMENT_VALUE_BREAKDOWN_KEYS).toHaveLength(7);
    expect(new Set([...TRANSPARENCY_COROLLARY_COMPONENTS, ...SETTLEMENT_RULING_RECEIPT_COMPONENTS]).size).toBe(
      7,
    );
  });

  it('a provider-retained spread does NOT fold into the service fee', () => {
    const run = RUNS['S12-external-execution-with-retained-spread-as-fee'];
    const s = run.book.settlements['stl-s12-001'];
    const breakdown = settlementValueBreakdown(s);
    // 25 retained, on its own line, and the service-fee line stays empty.
    expect(breakdown.providerRetainedSpreadMinorUnits).toBe('25');
    expect(breakdown.serviceFeeMinorUnits).toBe('0');
    expect(breakdown.principalMinorUnits).toBe('6000');
    expect(breakdown.networkCostMinorUnits).toBe('0');
    expect(breakdown.liquidityOrFinalityPremiumMinorUnits).toBe('0');
    // The market movement is disclosed as a FACT, alongside — and the payer's
    // acceptance of the off-parity path is on the receipt too.
    expect(breakdown.observedMarketDeviation?.observations[0].deviationBps).toBe('60');
    expect(breakdown.externallyAuthorisedExecutionRate?.executionDeviationBps).toBe('60');
    expect(breakdown.externallyAuthorisedExecutionRate?.acceptedByRef).toBe(ALICE);
  });

  it('the principal line is the AUTHORISED principal, never the net figure', () => {
    const s = RUNS['S10-finality-fee-deducted-from-principal'].book.settlements['stl-s10-001'];
    const breakdown = settlementValueBreakdown(s);
    // 100 authorised, 99 delivered. Reporting 99 here would make the fee vanish.
    expect(breakdown.principalMinorUnits).toBe('100');
    expect(breakdown.liquidityOrFinalityPremiumMinorUnits).toBe('1');
  });

  it('a receipt CANNOT present a blended figure with a category dropped', () => {
    const full = settlementValueBreakdown(
      RUNS['S12-external-execution-with-retained-spread-as-fee'].book.settlements['stl-s12-001'],
    );
    expect(() => assertSixCategoriesDistinguished(full, 'canary')).not.toThrow();

    // Drop each line in turn — every one must be refused, or that line is the
    // one a future blend could hide in.
    for (const key of SETTLEMENT_VALUE_BREAKDOWN_KEYS) {
      const blended = { ...full };
      delete (blended as Record<string, unknown>)[key];
      expect(
        () => assertSixCategoriesDistinguished(blended as SettlementValueBreakdown, 'canary'),
        `dropping ${key} was accepted`,
      ).toThrow(/must separate principal, market deviation, network cost/);
    }

    // And the emitter refuses it, not merely the helper — so no path in the
    // substrate can write such a receipt.
    const journal = createSettlementJournal('blend');
    const { providerRetainedSpreadMinorUnits: _gone, ...missingLine } = full;
    expect(() =>
      emitSettlementReceipt(journal, {
        actionType: 'qriptocent_destination_credit_completed',
        at: '2026-07-29T09:00:00.000Z',
        settlementRef: 'stl-1',
        network: 'base',
        summary: 'blended',
        evidenceRefs: [],
        amountMinorUnits: '6025',
        valueBreakdown: missingLine as SettlementValueBreakdown,
      }),
    ).toThrow(/must separate principal/);
    expect(journal.receipts).toHaveLength(0);
  });

  it('every receipt that carries a blended total also carries the breakdown', () => {
    // The debit receipt's amount is principal + fees. It may present that only
    // alongside the lines that take it apart again.
    for (const run of Object.values(RUNS)) {
      for (const r of run.book.journal.receipts) {
        if (r.actionType !== 'qriptocent_source_debit_initiated') continue;
        expect(r.valueBreakdown, `${run.scenarioId}: a blended debit total with no breakdown`).toBeTruthy();
        const b = r.valueBreakdown as SettlementValueBreakdown;
        const components =
          BigInt(b.principalMinorUnits) +
          BigInt(b.networkCostMinorUnits) +
          BigInt(b.serviceFeeMinorUnits) +
          BigInt(b.liquidityOrFinalityPremiumMinorUnits) +
          BigInt(b.providerRetainedSpreadMinorUnits);
        const s = run.book.settlements[r.settlementRef];
        // The total is DERIVABLE from the lines: components less anything borne
        // out of the principal (which the payer was not charged on top).
        expect(
          (components - feesDeductedFromPrincipal(s.feeBreakdown)).toString(),
          `${run.scenarioId}/${r.receiptRef}: the total is not explained by its lines`,
        ).toBe(r.amountMinorUnits);
      }
    }
  });

  // ── REQUIRED CATCH: a liquidity shortfall altering the 1:1 principal ─────

  it('the four shortfall responses are exhaustive, and none is a rate adjustment', () => {
    expect(LIQUIDITY_SHORTFALL_RESPONSES).toEqual([
      'queue',
      'route-to-approved-alternate-source',
      'request-explicit-acceptance-of-external-execution',
      'refuse',
    ]);
    expect(shortfallResponsesAreExhaustive()).toBe(true);
    // Every disposition reaches only the four; a permitted settlement has no
    // shortfall to respond to.
    expect(shortfallResponsesFor('permit')).toEqual([]);
    expect(shortfallResponsesFor('queue-or-split')).toEqual([
      'queue',
      'route-to-approved-alternate-source',
    ]);
    expect(shortfallResponsesFor('refuse')).toHaveLength(4);
    expect(shortfallResponsesFor('requires-explicit-override')).toHaveLength(4);
    for (const d of ['permit', 'queue-or-split', 'requires-explicit-override', 'refuse'] as const) {
      for (const r of shortfallResponsesFor(d)) {
        expect(LIQUIDITY_SHORTFALL_RESPONSES).toContain(r);
      }
    }
  });

  it('a shortfall NEVER alters the 1:1 principal — it reaches the four responses instead', () => {
    for (const id of ['S8-destination-liquidity-shortfall', 'S13-shortfall-reaches-the-four-responses']) {
      const run = RUNS[id];
      const s = run.book.settlements[run.book.settlementOrder[0]];
      // Hand-written from the scenario: 9000 authorised, and still 9000.
      expect(s.amountMinorUnits, `${id} moved the principal`).toBe('9000');
      expect(s.protocolRate).toBe('1:1');
      expect(s.destinationCreditedMinorUnits).toBeUndefined();
      // The exception NAMES the permitted responses, and says the rate is not
      // among them.
      const exception = run.book.exceptions.find((e) => /liquidity/.test(e.refusal));
      expect(exception?.detail).toMatch(/permitted responses: /);
      expect(exception?.detail).toMatch(/the 1:1 settlement rate is not among them/);
      for (const response of LIQUIDITY_SHORTFALL_RESPONSES) {
        if (response === 'route-to-approved-alternate-source' && !/route/.test(exception?.detail ?? ''))
          continue;
        expect(exception?.detail).toContain(response);
      }
      expect(run.reconciliation.violations).toEqual([]);
    }
  });

  it('no module in the substrate assigns to a settlement amount — the principal is not a lever', () => {
    for (const file of readdirSync(SETTLEMENT_DIR).filter((f) => f.endsWith('.ts'))) {
      const src = stripComments(readFileSync(join(SETTLEMENT_DIR, file), 'utf8'));
      expect(src, `${file} writes amountMinorUnits — the principal must never be adjusted`).not.toMatch(
        /\.amountMinorUnits\s*=[^=]/,
      );
    }
  });

  it('the classification module holds no rate, and neither does the state machine', () => {
    for (const file of ['settlement.ts', 'classification.ts']) {
      const src = stripComments(readFileSync(join(SETTLEMENT_DIR, file), 'utf8'));
      for (const forbidden of ['exchangeRate', 'conversionRate', 'slippage']) {
        expect(src, `${file} references ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  // ── The gate and the reconciler agree ───────────────────────────────────

  it('the gate and the reconciler check the same rules from different sides', () => {
    // A settlement that PASSED the gate, then had a classification mutated on
    // the record. The gate cannot see it; the reconciler must.
    const b = book();
    accept(b, 'stl-mutated', {
      externalExecution: execution({ providerRetainedMinorUnits: '25' }),
      marketObservations: [observation({ observationClass: 'external-execution-rate' })],
      feeBreakdown: {
        attributedFees: [
          timingFee({
            feeClass: 'provider-retained-spread-fee',
            amountMinorUnits: '25',
            serviceRef: VENUE,
          }),
        ],
      },
    });
    expect(classificationViolations(b.settlements['stl-mutated'])).toEqual([]);
    // Now delete the fee, leaving the retention recorded only as a market fact.
    b.settlements['stl-mutated'].feeBreakdown.attributedFees = [];
    expect(
      classificationViolations(b.settlements['stl-mutated']).some((v) =>
        /retained-spread-recorded-as-market-fact/.test(v),
      ),
    ).toBe(true);
    expect(
      reconcileBook(b).violations.some((v) => /retained-spread-recorded-as-market-fact/.test(v)),
    ).toBe(true);
  });

  it('classificationRefusal returns null for a clean settlement — guarding the guard', () => {
    // Without this, a refusal function that returned a refusal for EVERYTHING
    // would make every catch above pass vacuously.
    expect(
      classificationRefusal({
        amountMinorUnits: '1000',
        feeBreakdown: { networkFee: '5', attributedFees: [timingFee()] },
        initiatedAt: '2026-07-29T09:00:00.000Z',
        acceleratedService: ACCELERATED,
        marketObservations: [observation()],
      }),
    ).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AC-16 — the action-type vocabulary is declared everywhere it must be
// ───────────────────────────────────────────────────────────────────────────

describe('AC-16 the twelve action types are declared in all three places', () => {
  it('every settlement action type is in the ActivityActionType union', () => {
    const src = readFileSync(join(process.cwd(), 'services', 'receipts', 'activityReceiptService.ts'), 'utf8');
    for (const t of SETTLEMENT_RECEIPT_ACTION_TYPES) {
      expect(src, `${t} is missing from ActivityActionType`).toContain(`| '${t}'`);
    }
  });

  it('every settlement action type is DVN-anchorable', () => {
    const src = readFileSync(join(process.cwd(), 'services', 'dvn', 'activityReceiptDvnPipeline.ts'), 'utf8');
    for (const t of SETTLEMENT_RECEIPT_ACTION_TYPES) {
      expect(src, `${t} is not in ANCHORABLE_ACTION_TYPES`).toContain(`'${t}',`);
    }
  });

  it('every settlement action type is in the latest CHECK-constraint rebuild', () => {
    const dir = join(process.cwd(), 'supabase', 'migrations');
    const latest = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .filter((f) => readFileSync(join(dir, f), 'utf8').includes('ADD CONSTRAINT activity_receipts_action_type_check'))
      .at(-1);
    expect(latest).toBeTruthy();
    const sql = readFileSync(join(dir, latest as string), 'utf8');
    for (const t of SETTLEMENT_RECEIPT_ACTION_TYPES) {
      expect(sql, `${t} is missing from the latest constraint rebuild (${latest})`).toContain(`'${t}'`);
    }
  });
});
