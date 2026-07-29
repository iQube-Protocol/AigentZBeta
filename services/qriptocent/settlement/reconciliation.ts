/**
 * Presentation, bilateral reconciliation and supply reporting.
 *
 * ─── 1. PRESENTATION: a partial state may never be presented as settled ─────
 *
 * `presentSettlement` is the ONLY sanctioned way to describe a settlement to
 * anyone — an operator, a report, a receipt reader, a beneficiary. It exists
 * because the dangerous failure in an inter-ledger system is not a wrong number,
 * it is a wrong DISPOSITION: a settlement whose source debit is final and whose
 * destination credit failed is, in plain accounting terms, someone being owed
 * money. Describing that as "settled" or as "expired" both report an obligation
 * as a non-event.
 *
 * So `finalSettlement` is computed from `isFinalSettlement(state)` and nothing
 * else, and every state that is not `settled` produces a disposition that says
 * so. `reconciliationObligation` is populated whenever value has left the payer
 * and has not reached the beneficiary — the disclosure cannot describe that
 * situation without naming the obligation.
 *
 * ─── 2. FEES ARE DISCLOSED, NEVER ABSORBED ──────────────────────────────────
 *
 * The protocol settlement rate is cent-for-cent. The check that keeps it honest
 * compares two INDEPENDENTLY RECORDED ledger movements against the declared
 * intent:
 *
 *     sourceDebited        === amount + Σ disclosed fees
 *     destinationCredited  === amount                       (exactly, as a string)
 *
 * A fee shaved off the credit fails the second identity. A fee charged but not
 * declared fails the first. Neither can be hidden in a rate, because there is no
 * rate to hide it in.
 *
 * ─── 3. SETTLEMENT NEVER MINTS ──────────────────────────────────────────────
 *
 * A cross-chain payment REALLOCATES CAPACITY BETWEEN LEDGERS. `issuedMinorUnits`
 * is never written by this substrate, and `settlementMintsNothing` compares two
 * supply snapshots to prove it rather than assert it. The six figures the
 * constitution requires are reported SEPARATELY — collapsing native issued
 * supply, circulating balances and settlement liquidity into one "supply" number
 * is how a settlement network starts looking like an issuer.
 */

import {
  isFinalSettlement,
  TERMINAL_SETTLEMENT_STATES,
  type CrossDenominationSettlement,
  type NativeLedger,
  type QriptoDenomination,
  type SettlementFeeClass,
  type SettlementState,
} from './types';
import { allSettlements, totalDisclosedFees, valueHasLeftThePayer, type SettlementBook } from './settlement';

// ─── Presentation ───────────────────────────────────────────────────────────

export type SettlementDisposition =
  | 'in-flight'
  | 'settled'
  | 'obligation-outstanding'
  | 'terminated-without-effect'
  | 'reversed';

export interface DisclosedFee {
  feeClass: SettlementFeeClass;
  amountMinorUnits: string;
}

export interface ReconciliationObligation {
  /** Who is owed. A commitment, never a raw identifier. */
  owedToRef: string;
  amountMinorUnits: string;
  reason: string;
}

export interface SettlementDisclosure {
  settlementId: string;
  state: SettlementState;
  /** TRUE only for `settled`. Never inferred from anything else. */
  finalSettlement: boolean;
  disposition: SettlementDisposition;
  amountMinorUnits: string;
  sourceDebitedMinorUnits: string;
  destinationCreditedMinorUnits: string;
  protocolRate: '1:1';
  disclosedFees: DisclosedFee[];
  totalDisclosedFeesMinorUnits: string;
  /** Present whenever value left the payer and did not reach the beneficiary. */
  reconciliationObligation?: ReconciliationObligation;
  /** Present when the credit ran ahead of source finality under authorisation. */
  liquidityAdvanceOutstanding?: { advanceRef: string; authorisedByRef: string };
}

function dispositionFor(s: CrossDenominationSettlement): SettlementDisposition {
  switch (s.state) {
    case 'settled':
      return 'settled';
    case 'reversed':
      return 'reversed';
    case 'reconciliation-required':
      return 'obligation-outstanding';
    case 'expired':
    case 'failed':
    case 'source-failed':
    case 'destination-failed':
      // These states are reachable ONLY when no value left the payer — the
      // state machine escalates every value-committed failure to
      // `reconciliation-required` before it can land here.
      return 'terminated-without-effect';
    default:
      return 'in-flight';
  }
}

export function presentSettlement(s: CrossDenominationSettlement): SettlementDisclosure {
  const fees: DisclosedFee[] = [];
  if (s.feeBreakdown.networkFee) fees.push({ feeClass: 'network-fee', amountMinorUnits: s.feeBreakdown.networkFee });
  if (s.feeBreakdown.serviceFee) fees.push({ feeClass: 'service-fee', amountMinorUnits: s.feeBreakdown.serviceFee });
  if (s.feeBreakdown.liquidityFee) fees.push({ feeClass: 'liquidity-fee', amountMinorUnits: s.feeBreakdown.liquidityFee });
  if (s.feeBreakdown.reconciliationFee)
    fees.push({ feeClass: 'reconciliation-fee', amountMinorUnits: s.feeBreakdown.reconciliationFee });

  const credited = s.destinationCreditedMinorUnits ?? '0';
  const owes = valueHasLeftThePayer(s) && s.destinationCreditedMinorUnits === undefined;

  return {
    settlementId: s.settlementId,
    state: s.state,
    finalSettlement: isFinalSettlement(s.state),
    disposition: dispositionFor(s),
    amountMinorUnits: s.amountMinorUnits,
    sourceDebitedMinorUnits: s.sourceDebitedMinorUnits ?? '0',
    destinationCreditedMinorUnits: credited,
    protocolRate: '1:1',
    disclosedFees: fees,
    totalDisclosedFeesMinorUnits: totalDisclosedFees(s.feeBreakdown).toString(),
    ...(owes
      ? {
          reconciliationObligation: {
            owedToRef: s.state === 'reconciliation-required' ? s.payerRef : s.beneficiaryRef,
            amountMinorUnits: s.amountMinorUnits,
            reason:
              s.exceptionReason ??
              'value left the payer and has not reached the beneficiary — this is an obligation, not a completed settlement',
          },
        }
      : {}),
    ...(s.liquidityAdvance
      ? {
          liquidityAdvanceOutstanding: {
            advanceRef: s.liquidityAdvance.advanceRef,
            authorisedByRef: s.liquidityAdvance.authorisedByRef,
          },
        }
      : {}),
  };
}

/**
 * The fee/parity identities, as a list of violations. Empty means the settlement
 * charged exactly what it disclosed and credited exactly what it promised.
 */
export function feeAndParityViolations(s: CrossDenominationSettlement): string[] {
  const violations: string[] = [];
  const amount = BigInt(s.amountMinorUnits);
  const fees = totalDisclosedFees(s.feeBreakdown);
  if (s.sourceDebitedMinorUnits !== undefined) {
    if (BigInt(s.sourceDebitedMinorUnits) !== amount + fees) {
      violations.push(
        `${s.settlementId}: debited ${s.sourceDebitedMinorUnits} but amount ${s.amountMinorUnits} + disclosed fees ${fees} = ${amount + fees} — an undisclosed charge is a fee hidden in an implied rate`,
      );
    }
  }
  if (s.destinationCreditedMinorUnits !== undefined) {
    // STRING equality, not numeric: the credited figure must BE the amount, not
    // merely equal it after arithmetic. Any rate multiplication would show here.
    if (s.destinationCreditedMinorUnits !== s.amountMinorUnits) {
      violations.push(
        `${s.settlementId}: credited ${s.destinationCreditedMinorUnits} against amount ${s.amountMinorUnits} — the protocol settlement rate is cent-for-cent and admits no slippage`,
      );
    }
  }
  return violations;
}

// ─── Supply reporting ───────────────────────────────────────────────────────

export interface DenominationFigures {
  BCENT: string;
  BASE_QC: string;
}

export interface SettlementSupplyReport {
  /** Never changed by settlement. */
  nativeIssuedSupply: DenominationFigures;
  maxSupply: DenominationFigures;
  circulatingWalletBalances: DenominationFigures;
  settlementLiquidityBalances: DenominationFigures;
  reservedSettlementLiquidity: DenominationFigures;
  feesCollected: DenominationFigures;
  pendingInterLedgerObligations: { count: number; amountMinorUnits: DenominationFigures };
  completedCrossNetworkFlows: { count: number; amountMinorUnits: DenominationFigures };
  unresolvedReconciliationExposure: { count: number; amountMinorUnits: DenominationFigures };
}

const DENOMINATIONS: QriptoDenomination[] = ['BCENT', 'BASE_QC'];

function sumBalances(ledger: NativeLedger): bigint {
  return Object.values(ledger.balances).reduce((acc, v) => acc + BigInt(v), 0n);
}

function figures(fn: (d: QriptoDenomination) => bigint): DenominationFigures {
  return { BCENT: fn('BCENT').toString(), BASE_QC: fn('BASE_QC').toString() };
}

export function settlementSupplyReport(book: SettlementBook): SettlementSupplyReport {
  const settlements = allSettlements(book);

  // In flight, value already committed: the payer is debited and the
  // beneficiary is not yet credited.
  const pending = settlements.filter(
    (s) => valueHasLeftThePayer(s) && s.state !== 'settled' && s.state !== 'reconciliation-required',
  );
  const completed = settlements.filter((s) => s.state === 'settled');
  // Exposure is BOTH kinds of unresolved obligation: a value-committed failure
  // awaiting reconciliation, and a credit issued against an unfinalised source
  // debit under an authorised advance. Reporting only the first would let an
  // advance-backed credit look fully backed.
  const exposed = settlements.filter(
    (s) => s.state === 'reconciliation-required' || s.liquidityAdvance !== undefined,
  );

  const sumBy = (rows: CrossDenominationSettlement[], d: QriptoDenomination): bigint =>
    rows.filter((s) => s.sourceDenomination === d).reduce((acc, s) => acc + BigInt(s.amountMinorUnits), 0n);

  return {
    nativeIssuedSupply: figures((d) => BigInt(book.ledgers[d].issuedMinorUnits)),
    maxSupply: figures((d) => BigInt(book.ledgers[d].maxSupplyMinorUnits)),
    circulatingWalletBalances: figures((d) => sumBalances(book.ledgers[d])),
    settlementLiquidityBalances: figures((d) => BigInt(book.ledgers[d].settlementLiquidityMinorUnits)),
    reservedSettlementLiquidity: figures((d) => BigInt(book.ledgers[d].reservedLiquidityMinorUnits)),
    feesCollected: figures((d) => BigInt(book.ledgers[d].feesCollectedMinorUnits)),
    pendingInterLedgerObligations: { count: pending.length, amountMinorUnits: figures((d) => sumBy(pending, d)) },
    completedCrossNetworkFlows: { count: completed.length, amountMinorUnits: figures((d) => sumBy(completed, d)) },
    unresolvedReconciliationExposure: { count: exposed.length, amountMinorUnits: figures((d) => sumBy(exposed, d)) },
  };
}

/**
 * SETTLEMENT NEVER MINTS. Compares two snapshots and reports every denomination
 * whose native issued supply moved. Proof, not assertion — the sentence "a
 * cross-chain payment is not new issuance" is worth nothing without a check that
 * fails when it stops being true.
 */
export function settlementMintsNothing(
  before: SettlementSupplyReport,
  after: SettlementSupplyReport,
): string[] {
  return DENOMINATIONS.filter((d) => before.nativeIssuedSupply[d] !== after.nativeIssuedSupply[d]).map(
    (d) =>
      `${d}: native issued supply moved from ${before.nativeIssuedSupply[d]} to ${after.nativeIssuedSupply[d]} — settlement reallocates capacity between ledgers and must never mint`,
  );
}

// ─── Bilateral reconciliation ───────────────────────────────────────────────

export interface BookReconciliation {
  bookId: string;
  /** Every violated identity. Empty = reconciled. */
  violations: string[];
  settlementCount: number;
  settledCount: number;
  obligationCount: number;
  receiptCount: number;
  supply: SettlementSupplyReport;
}

/**
 * Reconcile the whole book.
 *
 * Every check is an identity that must hold in every run, whatever the scenario
 * — so a violation is a defect in the substrate, never an experimental result.
 * The identities are grouped by what they would let through if removed.
 */
export function reconcileBook(book: SettlementBook): BookReconciliation {
  const violations: string[] = [];
  const settlements = allSettlements(book);
  const receiptRefs = new Set(book.journal.receipts.map((r) => r.receiptRef));

  for (const d of DENOMINATIONS) {
    const l = book.ledgers[d];
    // Identity 1 — the ledger conserves. Every unit is in a wallet, in
    // settlement liquidity, or in collected fees. If this fails, value was
    // created or destroyed by a settlement, which is the whole thing the
    // architecture must not do.
    const held = sumBalances(l) + BigInt(l.settlementLiquidityMinorUnits) + BigInt(l.feesCollectedMinorUnits);
    if (held !== BigInt(l.issuedMinorUnits)) {
      violations.push(
        `${d}: Σ balances + settlement liquidity + fees = ${held} != issued ${l.issuedMinorUnits}`,
      );
    }
    // Identity 2 — issuance stays within its governed maximum.
    if (BigInt(l.issuedMinorUnits) > BigInt(l.maxSupplyMinorUnits)) {
      violations.push(`${d}: issued ${l.issuedMinorUnits} exceeds governed maximum ${l.maxSupplyMinorUnits}`);
    }
    // Identity 3 — a reservation is an earmark against liquidity actually held.
    const reserved = BigInt(l.reservedLiquidityMinorUnits);
    if (reserved < 0n || reserved > BigInt(l.settlementLiquidityMinorUnits)) {
      violations.push(`${d}: reserved ${reserved} is negative or exceeds held liquidity ${l.settlementLiquidityMinorUnits}`);
    }
    // Identity 4 — no negative wallet balance. A negative balance is spending
    // value the holder never had, on a ledger with no lock pool behind it.
    for (const [holder, balance] of Object.entries(l.balances)) {
      if (BigInt(balance) < 0n) violations.push(`${d}: holder ${holder} has a negative balance ${balance}`);
    }
  }

  for (const s of settlements) {
    // Identity 5 — cent-for-cent, and every fee disclosed.
    violations.push(...feeAndParityViolations(s));

    // Identity 6 — THE ACCOUNTING INVARIANT, checked after the fact. A credit
    // exists only against a final source debit or an authorised advance.
    if (s.destinationCreditedMinorUnits !== undefined) {
      if (s.sourceDebitFinalisedAt === undefined && s.liquidityAdvance === undefined) {
        violations.push(
          `${s.settlementId}: destination credited with no finalised source debit and no authorised liquidity advance — duplicate spendable value`,
        );
      }
      // Identity 7 — a credit is evidenced end to end. Without the message
      // reference there is nothing tying the credit to the debit, and in an
      // architecture with no lock pool the receipt chain IS the backing.
      if (!s.sourceDebitRef || !s.dvnMessageRef || !s.destinationCreditRef) {
        violations.push(`${s.settlementId}: settled without a complete debit → message → credit reference chain`);
      }
    }

    // Identity 8 — settlement and its timestamp agree.
    if (s.state === 'settled' && !s.settledAt) violations.push(`${s.settlementId}: settled with no settledAt`);
    if (s.state !== 'settled' && s.destinationCreditedMinorUnits !== undefined && s.state !== 'reversed') {
      violations.push(`${s.settlementId}: credited but not in a settled state ('${s.state}')`);
    }

    // Identity 9 — THE PARTIAL-STATE RULE, checked structurally.
    //
    // A settlement that has come to REST with value gone from the payer and
    // never delivered must be `reconciliation-required` and nothing else.
    // `expired`, `destination-failed`, `source-failed` and `failed` all read as
    // "nothing happened", which for a debited payer is the single most
    // dangerous misreport this substrate can produce.
    //
    // In-flight states are deliberately exempt: value is legitimately committed
    // while a settlement is moving. Those are reported as PENDING obligations by
    // the supply report — pending is not a violation, resting-and-lost is.
    const atRest = TERMINAL_SETTLEMENT_STATES.includes(s.state);
    if (atRest && valueHasLeftThePayer(s) && s.state !== 'settled') {
      violations.push(
        `${s.settlementId}: value left the payer but the settlement came to rest in '${s.state}' — a value-committed failure is a reconciliation obligation, never a terminated non-event`,
      );
    }
    if (s.state === 'reconciliation-required') {
      if (!book.exceptions.some((e) => e.settlementId === s.settlementId && e.valueCommitted)) {
        violations.push(`${s.settlementId}: an outstanding obligation with no value-committed exception record`);
      }
    }

    // Identity 10 — the record never asserts what the receipt stream cannot
    // corroborate.
    if (s.receiptRefs.length === 0) violations.push(`${s.settlementId}: no receipt reference`);
    for (const ref of s.receiptRefs) {
      if (!receiptRefs.has(ref)) violations.push(`${s.settlementId}: receipt ${ref} not in journal`);
    }

    // Identity 11 — the denomination↔network binding is constitutional.
    if (s.sourceDenomination === s.destinationDenomination) {
      violations.push(`${s.settlementId}: source and destination denominations are the same`);
    }
  }

  // Identity 12 — EXACTLY ONCE, checked at the register level rather than only
  // at the gate. Every settled settlement consumed exactly one credit
  // reference, so the register size and the settled count must agree; a
  // divergence means a credit was applied outside the gate.
  const settled = settlements.filter((s) => s.state === 'settled');
  if (book.consumedCreditRefs.size !== settled.length) {
    violations.push(
      `consumed credit references (${book.consumedCreditRefs.size}) != settled settlements (${settled.length}) — a credit was applied outside the exactly-once gate`,
    );
  }
  const messaged = settlements.filter((s) => s.dvnMessageRef !== undefined);
  if (book.consumedMessageRefs.size !== messaged.length) {
    violations.push(
      `consumed message references (${book.consumedMessageRefs.size}) != settlements carrying a message (${messaged.length})`,
    );
  }
  // Identity 13 — one instruction, one settlement.
  if (new Set(book.settlementOrder).size !== book.settlementOrder.length) {
    violations.push('a settlement id appears more than once in the book order');
  }
  const instructionRefs = settlements.map((s) => s.instructionRef);
  if (new Set(instructionRefs).size !== instructionRefs.length) {
    violations.push('two settlements share an instruction reference — an instruction was consumed twice');
  }

  return {
    bookId: book.bookId,
    violations,
    settlementCount: settlements.length,
    settledCount: settled.length,
    obligationCount: settlements.filter((s) => s.state === 'reconciliation-required').length,
    receiptCount: book.journal.receipts.length,
    supply: settlementSupplyReport(book),
  };
}
