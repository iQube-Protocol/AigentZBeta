/**
 * The cross-denomination settlement state machine.
 *
 * ─── WHAT THIS IS ───────────────────────────────────────────────────────────
 *
 * A DVN-mediated inter-ledger settlement, expressed as explicit state
 * transitions over two independent native ledgers. There is no bridge, no lock
 * pool, no wrapped asset and no rate: a payment is a source-side debit, a
 * DVN-verified message, and a destination-side credit from native settlement
 * liquidity, at cent-for-cent parity.
 *
 * ─── THE ACCOUNTING INVARIANT, AND WHERE IT IS ENFORCED ─────────────────────
 *
 *   > A destination credit may exist only against a finalised source debit OR an
 *   > explicitly authorised liquidity advance, and each settlement instruction
 *   > may be consumed EXACTLY ONCE.
 *
 * Six mechanisms hold it, and each one is separately defeatable, which is why
 * they are all present:
 *
 *  1. **Globally unique settlement ids** — `settlements[id]` is a claim; a
 *     second `initiateSettlement` with the same id is refused outright.
 *  2. **Instruction consumption** — `consumedInstructionRefs`. Consumed ON
 *     ACCEPTANCE only. A refusal does NOT consume, so a legitimate retry after
 *     a transient refusal still works, while an accepted instruction can never
 *     be presented again.
 *  3. **Nonce binding** — a nonce is bound to exactly one settlement at
 *     acceptance. A message carrying another settlement's nonce is refused.
 *  4. **Message consumption** — `consumedMessageRefs`. THE replay defence: a
 *     replayed DVN message is refused at verification and can never reach a
 *     credit.
 *  5. **Credit consumption + the state gate** — `consumedCreditRefs` AND
 *     `state === 'settled'` both block a second credit. Two independent checks,
 *     because a replay that defeats one must still defeat the other.
 *  6. **The finality gate** — `completeDestinationCredit` reads
 *     `sourceDebitFinalisedAt`, NOT the state label. State labels move on
 *     (`source-debit-final` → `message-verified`), so a gate reading the label
 *     would silently open the moment the label advanced. The timestamp is the
 *     fact; the label is a summary of where the process is.
 *
 * ─── CONSTITUTIONAL ATOMICITY ───────────────────────────────────────────────
 *
 * True atomicity between Bitcoin and Base is impossible, so atomicity is a rule
 * about how partial states are RECORDED and PRESENTED:
 *
 *   > A partial state may never be presented as final settlement. If a source
 *   > debit is final but the destination credit fails, the transaction becomes a
 *   > RECONCILIATION OBLIGATION, not a silent loss.
 *
 * Every failure path therefore branches on ONE question — *has value left the
 * payer's ledger?* — answered by `valueHasLeftThePayer`, which reads the
 * recorded debit rather than the state. If yes, the outcome is
 * `reconciliation-required`, never `expired` and never `destination-failed`.
 *
 * ─── DETERMINISM ────────────────────────────────────────────────────────────
 *
 * No clock, no randomness, no I/O. Every timestamp is passed in from a fixture
 * and every identifier is derived. Amounts are minor-unit decimal strings,
 * arithmetic in `BigInt`, and the protocol rate is the literal `'1:1'` — there
 * is no multiplication anywhere that could introduce drift.
 *
 * Phase 1 is SIMULATION: no LayerZero call, no Bitcoin transaction, no Base
 * transaction, no wallet.
 */

import {
  createSettlementJournal,
  emitSettlementReceipt,
  receiptsForSettlement,
  type SettlementReceiptJournal,
  type SettlementReceiptMode,
} from './receipts';
import {
  assessLiquidity,
  availableLiquidity,
  ILLUSTRATIVE_LIQUIDITY_POLICY,
  type LiquidityPolicy,
} from './liquidity';
import { containsRawIdentifier } from './refs';
import {
  DENOMINATION_HOME_NETWORK,
  PROTOCOL_SETTLEMENT_RATE,
  type CrossDenominationSettlement,
  type NativeLedger,
  type QriptoDenomination,
  type SettlementException,
  type SettlementFeeBreakdown,
  type SettlementNetwork,
  type SettlementOutcome,
  type SettlementRefusal,
} from './types';

// ─── Minor-unit arithmetic ──────────────────────────────────────────────────

/** A minor-unit amount: digits only. Never a float, never signed, never empty. */
export function isMinorUnitString(value: string): boolean {
  return /^[0-9]+$/.test(value);
}

function minor(value: string): bigint {
  return BigInt(value);
}

/** The sum of every DISCLOSED fee. The only place a fee may come from. */
export function totalDisclosedFees(fees: SettlementFeeBreakdown): bigint {
  return (
    minor(fees.networkFee ?? '0') +
    minor(fees.serviceFee ?? '0') +
    minor(fees.liquidityFee ?? '0') +
    minor(fees.reconciliationFee ?? '0')
  );
}

// ─── Finality policy ────────────────────────────────────────────────────────

/**
 * Confirmations required before a source debit is treated as FINAL.
 *
 * FLAGGED, NOT DECIDED. These are the substrate's DECLARED SIMULATION POLICY,
 * not a claim about what either network's real finality is. They are stated
 * explicitly and injectable so a scenario can drive the gate; the operative
 * values for any live phase are an operator ruling, recorded in the build doc.
 * A finality policy that is a hidden constant is a policy nobody reviews.
 */
export const DECLARED_FINALITY_POLICY: Record<SettlementNetwork, number> = {
  bitcoin: 3,
  base: 30,
};

// ─── The book ───────────────────────────────────────────────────────────────

export interface SettlementBook {
  bookId: string;
  ledgers: Record<QriptoDenomination, NativeLedger>;
  settlements: Record<string, CrossDenominationSettlement>;
  /** Insertion order — replay reproduces it, so reports are stable. */
  settlementOrder: string[];
  /** Exactly-once registers. */
  consumedInstructionRefs: Set<string>;
  consumedMessageRefs: Set<string>;
  consumedCreditRefs: Set<string>;
  /** nonce → settlementId. A nonce belongs to one settlement, forever. */
  nonceBindings: Record<string, string>;
  exceptions: SettlementException[];
  journal: SettlementReceiptJournal;
  finalityPolicy: Record<SettlementNetwork, number>;
  /**
   * The liquidity-assurance policy this book settles under. Held here, consulted
   * by the reserve step, and NEVER able to mint — mechanism 2 can slow or refuse
   * a settlement, it cannot manufacture the liquidity a settlement needs.
   */
  liquidityPolicy: LiquidityPolicy;
}

export interface OpenBookInput {
  bookId: string;
  ledgers: Record<QriptoDenomination, NativeLedger>;
  finalityPolicy?: Record<SettlementNetwork, number>;
  liquidityPolicy?: LiquidityPolicy;
  mode?: SettlementReceiptMode;
}

export function openSettlementBook(input: OpenBookInput): SettlementBook {
  return {
    bookId: input.bookId,
    // Deep-copied, so a scenario's fixture ledgers are never mutated by a run
    // and two runs from the same fixture start identical (replay depends on it).
    ledgers: {
      BCENT: cloneLedger(input.ledgers.BCENT),
      BASE_QC: cloneLedger(input.ledgers.BASE_QC),
    },
    settlements: {},
    settlementOrder: [],
    consumedInstructionRefs: new Set(),
    consumedMessageRefs: new Set(),
    consumedCreditRefs: new Set(),
    nonceBindings: {},
    exceptions: [],
    // FIXTURE, always and explicitly. A settlement run is a deterministic
    // replay; the guard in `receipts.ts` throws if anything tries to persist it.
    journal: createSettlementJournal(input.bookId, input.mode ?? 'fixture'),
    finalityPolicy: input.finalityPolicy ?? DECLARED_FINALITY_POLICY,
    liquidityPolicy: input.liquidityPolicy ?? ILLUSTRATIVE_LIQUIDITY_POLICY,
  };
}

function cloneLedger(l: NativeLedger): NativeLedger {
  return { ...l, balances: { ...l.balances } };
}

function refuse(refusal: SettlementRefusal, detail: string): SettlementOutcome {
  return { ok: false, refusal, detail };
}

function ledgerOf(book: SettlementBook, denomination: QriptoDenomination): NativeLedger {
  return book.ledgers[denomination];
}

function settlementRefOf(s: CrossDenominationSettlement): string {
  // The settlementId is already a derived, non-UUID identifier (see refs.ts and
  // the scenario fixtures); receipts carry it directly so a reader can join the
  // receipt stream to the settlement record without a second lookup table.
  return s.settlementId;
}

/**
 * ── THE ONE QUESTION EVERY FAILURE PATH ASKS ──
 *
 * Has value left the payer's ledger? Read from the RECORDED DEBIT, not from the
 * state label: labels advance, and a failure path that consulted the label would
 * classify a post-debit timeout as `expired` — i.e. as "nothing happened" — for
 * a payer whose balance is already gone.
 */
export function valueHasLeftThePayer(s: CrossDenominationSettlement): boolean {
  return s.sourceDebitedMinorUnits !== undefined;
}

function recordException(
  book: SettlementBook,
  s: CrossDenominationSettlement,
  refusal: SettlementException['refusal'],
  detail: string,
  at: string,
): void {
  const valueCommitted = valueHasLeftThePayer(s);
  book.exceptions.push({ settlementId: s.settlementId, refusal, detail, at, valueCommitted });
  s.exceptionReason = detail;
  emitSettlementReceipt(book.journal, {
    actionType: 'qriptocent_settlement_exception_recorded',
    at,
    settlementRef: settlementRefOf(s),
    network: 'both',
    summary: `Settlement exception recorded: ${refusal}`,
    evidenceRefs: [s.instructionRef],
    ...(valueCommitted ? { amountMinorUnits: s.amountMinorUnits } : {}),
    valueCommitted,
  });
  s.receiptRefs.push(book.journal.receipts[book.journal.receipts.length - 1].receiptRef);
}

// ─── 1. Payment instruction accepted ────────────────────────────────────────

export interface SettlementInstruction {
  settlementId: string;
  instructionRef: string;
  nonce: string;
  sourceDenomination: QriptoDenomination;
  destinationDenomination: QriptoDenomination;
  sourceNetwork: SettlementNetwork;
  destinationNetwork: SettlementNetwork;
  amountMinorUnits: string;
  payerRef: string;
  beneficiaryRef: string;
  delegationRef: string;
  feeBreakdown: SettlementFeeBreakdown;
  initiatedAt: string;
  expiresAt: string;
}

/**
 * Accept a cross-denomination payment instruction.
 *
 * Every refusal below leaves the book COMPLETELY unchanged — no settlement row,
 * no consumed instruction, no receipt. That matters for exactly-once: consuming
 * an instruction that was refused would turn a transient refusal into a
 * permanent one, and the operator would be told a legitimate payment "was
 * already made".
 */
export function initiateSettlement(
  book: SettlementBook,
  instruction: SettlementInstruction,
): SettlementOutcome {
  // T0 leakage first: a raw identifier must never reach a settlement record,
  // and a settlement message crosses a public network boundary.
  if (containsRawIdentifier(instruction)) {
    return refuse(
      'raw-identifier-in-instruction',
      'the instruction carries a raw identifier — payer, beneficiary and delegation must be commitments (services/qriptocent/settlement/refs.ts)',
    );
  }
  if (book.settlements[instruction.settlementId]) {
    return refuse('duplicate-settlement-id', `settlement ${instruction.settlementId} already exists`);
  }
  if (book.consumedInstructionRefs.has(instruction.instructionRef)) {
    return refuse(
      'instruction-already-consumed',
      `instruction ${instruction.instructionRef} has already been settled — replayed instructions are refused, not re-executed`,
    );
  }
  const boundTo = book.nonceBindings[instruction.nonce];
  if (boundTo !== undefined) {
    return refuse('nonce-already-consumed', `nonce is already bound to settlement ${boundTo}`);
  }
  if (instruction.sourceDenomination === instruction.destinationDenomination) {
    return refuse(
      'same-denomination',
      'a cross-denomination settlement moves value BETWEEN denomination ledgers; a same-denomination transfer is a native ledger operation, not a settlement',
    );
  }
  if (
    DENOMINATION_HOME_NETWORK[instruction.sourceDenomination] !== instruction.sourceNetwork ||
    DENOMINATION_HOME_NETWORK[instruction.destinationDenomination] !== instruction.destinationNetwork
  ) {
    return refuse(
      'denomination-network-mismatch',
      'a denomination has exactly one canonical issuance network; the instruction disagrees with the constitutional binding',
    );
  }
  const amounts = [
    instruction.amountMinorUnits,
    instruction.feeBreakdown.networkFee ?? '0',
    instruction.feeBreakdown.serviceFee ?? '0',
    instruction.feeBreakdown.liquidityFee ?? '0',
    instruction.feeBreakdown.reconciliationFee ?? '0',
  ];
  if (!amounts.every(isMinorUnitString)) {
    return refuse('malformed-amount', 'amounts must be minor-unit decimal strings of digits only');
  }
  if (minor(instruction.amountMinorUnits) <= 0n) {
    return refuse('non-positive-amount', 'a settlement must move a positive amount');
  }

  const settlement: CrossDenominationSettlement = {
    settlementId: instruction.settlementId,
    sourceDenomination: instruction.sourceDenomination,
    destinationDenomination: instruction.destinationDenomination,
    sourceNetwork: instruction.sourceNetwork,
    destinationNetwork: instruction.destinationNetwork,
    amountMinorUnits: instruction.amountMinorUnits,
    protocolRate: PROTOCOL_SETTLEMENT_RATE,
    payerRef: instruction.payerRef,
    beneficiaryRef: instruction.beneficiaryRef,
    delegationRef: instruction.delegationRef,
    state: 'initiated',
    feeBreakdown: { ...instruction.feeBreakdown },
    receiptRefs: [],
    instructionRef: instruction.instructionRef,
    nonce: instruction.nonce,
    initiatedAt: instruction.initiatedAt,
    expiresAt: instruction.expiresAt,
  };

  book.settlements[settlement.settlementId] = settlement;
  book.settlementOrder.push(settlement.settlementId);
  book.consumedInstructionRefs.add(instruction.instructionRef);
  book.nonceBindings[instruction.nonce] = settlement.settlementId;

  const receipt = emitSettlementReceipt(book.journal, {
    actionType: 'qriptocent_payment_instruction_accepted',
    at: instruction.initiatedAt,
    settlementRef: settlementRefOf(settlement),
    network: 'both',
    summary: `Cross-denomination payment instruction accepted: ${settlement.sourceDenomination} → ${settlement.destinationDenomination} at ${PROTOCOL_SETTLEMENT_RATE}`,
    evidenceRefs: [settlement.instructionRef, settlement.delegationRef],
    amountMinorUnits: settlement.amountMinorUnits,
  });
  settlement.receiptRefs.push(receipt.receiptRef);
  return { ok: true, settlement };
}

// ─── 2. Authority and balance verified ──────────────────────────────────────

/**
 * Verify the passport-backed delegated authority and that the payer can cover
 * amount + disclosed fees. Emits the second link of the evidence chain.
 *
 * State is unchanged: authority verification is a PRECONDITION, and the
 * source-debit step requires this receipt to exist. Making the receipt itself
 * the gate is deliberate — the receipt chain is the only evidence this
 * architecture has that a credit was backed, so a step that produced no receipt
 * must not be able to satisfy a later step.
 */
export function verifyAuthorityAndBalance(
  book: SettlementBook,
  settlementId: string,
  at: string,
): SettlementOutcome {
  const s = book.settlements[settlementId];
  if (!s) return refuse('unknown-settlement', `no settlement ${settlementId}`);
  if (s.state !== 'initiated') return refuse('wrong-state', `authority is verified from 'initiated', not '${s.state}'`);

  const source = ledgerOf(book, s.sourceDenomination);
  const required = minor(s.amountMinorUnits) + totalDisclosedFees(s.feeBreakdown);
  const held = minor(source.balances[s.payerRef] ?? '0');
  if (held < required) {
    s.state = 'failed';
    recordException(
      book,
      s,
      'insufficient-payer-balance',
      `payer holds ${held} ${s.sourceDenomination} minor units; ${required} required (amount + disclosed fees)`,
      at,
    );
    return refuse('insufficient-payer-balance', `payer holds ${held}, needs ${required}`);
  }

  const receipt = emitSettlementReceipt(book.journal, {
    actionType: 'qriptocent_settlement_authority_verified',
    at,
    settlementRef: settlementRefOf(s),
    network: s.sourceNetwork,
    summary: 'Delegated authority and payer balance verified on the source ledger',
    evidenceRefs: [s.delegationRef, s.payerRef],
  });
  s.receiptRefs.push(receipt.receiptRef);
  return { ok: true, settlement: s };
}

function authorityVerified(book: SettlementBook, s: CrossDenominationSettlement): boolean {
  return receiptsForSettlement(book.journal, settlementRefOf(s)).some(
    (r) => r.actionType === 'qriptocent_settlement_authority_verified',
  );
}

// ─── 3. Source debit ────────────────────────────────────────────────────────

/**
 * Debit the payer on the SOURCE ledger.
 *
 * The debited value moves into the source ledger's own settlement liquidity —
 * it does NOT move to the destination network, because nothing moves between
 * networks. This is the "B¢ accumulates on the Bitcoin side" behaviour the
 * constitution describes, and it is why the source ledger's conservation
 * identity (Σ balances + settlement liquidity = issued) still holds afterwards.
 *
 * Fees leave the payer alongside the amount and land in `feesCollected`, held
 * SEPARATELY from settlement liquidity so a fee can never be mistaken for
 * backing.
 */
export function initiateSourceDebit(
  book: SettlementBook,
  settlementId: string,
  input: { sourceDebitRef: string; at: string },
): SettlementOutcome {
  const s = book.settlements[settlementId];
  if (!s) return refuse('unknown-settlement', `no settlement ${settlementId}`);
  if (s.state !== 'initiated') return refuse('wrong-state', `a source debit starts from 'initiated', not '${s.state}'`);
  if (!authorityVerified(book, s)) {
    return refuse('authority-not-verified', 'no authority-verified receipt exists for this settlement');
  }
  if (input.at >= s.expiresAt) {
    return refuse('expired', `settlement expired at ${s.expiresAt}`);
  }

  const source = ledgerOf(book, s.sourceDenomination);
  const fees = totalDisclosedFees(s.feeBreakdown);
  const amount = minor(s.amountMinorUnits);
  const debited = amount + fees;
  const held = minor(source.balances[s.payerRef] ?? '0');
  if (held < debited) return refuse('insufficient-payer-balance', `payer holds ${held}, needs ${debited}`);

  source.balances[s.payerRef] = (held - debited).toString();
  source.settlementLiquidityMinorUnits = (
    minor(source.settlementLiquidityMinorUnits) + amount
  ).toString();
  source.feesCollectedMinorUnits = (minor(source.feesCollectedMinorUnits) + fees).toString();

  s.sourceDebitRef = input.sourceDebitRef;
  // Recorded from the ACTUAL movement, so reconciliation compares two
  // independently-produced facts rather than a figure against itself.
  s.sourceDebitedMinorUnits = debited.toString();
  s.state = 'source-debit-pending';

  const receipt = emitSettlementReceipt(book.journal, {
    actionType: 'qriptocent_source_debit_initiated',
    at: input.at,
    settlementRef: settlementRefOf(s),
    network: s.sourceNetwork,
    summary: `Source ledger debit initiated on ${s.sourceNetwork} (amount + disclosed fees)`,
    evidenceRefs: [input.sourceDebitRef, s.payerRef],
    amountMinorUnits: debited.toString(),
  });
  s.receiptRefs.push(receipt.receiptRef);
  return { ok: true, settlement: s };
}

/**
 * States in which a source debit exists and can still reach finality. Finality
 * is an event on the SOURCE chain and arrives on its own schedule — it does not
 * wait for the settlement's own progress, and a settlement whose message was
 * already verified is still waiting for exactly the same confirmations.
 */
const FINALISABLE_STATES: readonly string[] = [
  'source-debit-pending',
  'message-verified',
  'destination-credit-pending',
];

/**
 * Finalise the source debit against the declared finality policy.
 *
 * `sourceDebitFinalisedAt` set HERE is the fact the credit gate reads. Nothing
 * else in this module writes it — and note that the STATE LABEL only advances
 * when the settlement was waiting on finality and nothing else. A settlement
 * that has already moved to `message-verified` keeps that label and simply
 * acquires the finality timestamp, because the label describes where the process
 * is while the timestamp records what is true. Coupling the gate to the label
 * instead would have made this ordering a source of silent unbacked credits.
 */
export function finaliseSourceDebit(
  book: SettlementBook,
  settlementId: string,
  input: { confirmations: number; at: string },
): SettlementOutcome {
  const s = book.settlements[settlementId];
  if (!s) return refuse('unknown-settlement', `no settlement ${settlementId}`);
  if (!FINALISABLE_STATES.includes(s.state)) {
    return refuse('wrong-state', `finality applies to a live source debit, not to '${s.state}'`);
  }
  if (s.sourceDebitFinalisedAt !== undefined) {
    return refuse('wrong-state', 'the source debit is already final');
  }
  const required = book.finalityPolicy[s.sourceNetwork];
  if (input.confirmations < required) {
    return refuse(
      'source-debit-not-final',
      `${input.confirmations} confirmations on ${s.sourceNetwork}; policy requires ${required}`,
    );
  }
  s.sourceDebitFinalisedAt = input.at;
  if (s.state === 'source-debit-pending') s.state = 'source-debit-final';

  const receipt = emitSettlementReceipt(book.journal, {
    actionType: 'qriptocent_source_debit_finalised',
    at: input.at,
    settlementRef: settlementRefOf(s),
    network: s.sourceNetwork,
    summary: `Source ledger debit final at ${input.confirmations} confirmations (policy: ${required})`,
    evidenceRefs: [s.sourceDebitRef ?? ''],
    amountMinorUnits: s.sourceDebitedMinorUnits,
  });
  s.receiptRefs.push(receipt.receiptRef);
  return { ok: true, settlement: s };
}

/** The source debit failed to finalise — no value reached the settlement pool. */
export function failSourceDebit(
  book: SettlementBook,
  settlementId: string,
  input: { detail: string; at: string },
): SettlementOutcome {
  const s = book.settlements[settlementId];
  if (!s) return refuse('unknown-settlement', `no settlement ${settlementId}`);
  if (s.state !== 'source-debit-pending') {
    return refuse('wrong-state', `a source failure applies to 'source-debit-pending', not '${s.state}'`);
  }
  // The debit was recorded on the source ledger, so it must be unwound rather
  // than forgotten — value that left the payer and has no destination is an
  // obligation even when the failure is on the source side.
  unwindSourceDebit(book, s);
  s.state = 'source-failed';
  recordException(book, s, 'source-debit-failed', input.detail, input.at);
  return { ok: true, settlement: s };
}

/** Return amount + fees from the source settlement pool to the payer. */
function unwindSourceDebit(book: SettlementBook, s: CrossDenominationSettlement): void {
  if (s.sourceDebitedMinorUnits === undefined) return;
  const source = ledgerOf(book, s.sourceDenomination);
  const amount = minor(s.amountMinorUnits);
  const fees = totalDisclosedFees(s.feeBreakdown);
  source.settlementLiquidityMinorUnits = (
    minor(source.settlementLiquidityMinorUnits) - amount
  ).toString();
  source.feesCollectedMinorUnits = (minor(source.feesCollectedMinorUnits) - fees).toString();
  source.balances[s.payerRef] = (
    minor(source.balances[s.payerRef] ?? '0') + amount + fees
  ).toString();
  s.sourceDebitedMinorUnits = undefined;
}

// ─── 4. DVN message verification ────────────────────────────────────────────

/**
 * Verify the authenticated settlement message.
 *
 * THE REPLAY DEFENCE. A message reference is consumed exactly once, and the
 * nonce must be the one bound to THIS settlement at acceptance. A replayed
 * message therefore cannot reach a credit — which is the difference between a
 * settlement network and a machine that mints value on demand.
 *
 * Verification is permitted from `source-debit-pending` as well as
 * `source-debit-final`: a message can legitimately be verified before the source
 * debit reaches finality. That is safe precisely because the finality gate is on
 * the CREDIT, not on the message.
 */
export function verifySettlementMessage(
  book: SettlementBook,
  settlementId: string,
  input: { dvnMessageRef: string; nonce: string; at: string },
): SettlementOutcome {
  const s = book.settlements[settlementId];
  if (!s) return refuse('unknown-settlement', `no settlement ${settlementId}`);
  if (s.state !== 'source-debit-pending' && s.state !== 'source-debit-final') {
    return refuse('wrong-state', `a settlement message is verified after a source debit, not in '${s.state}'`);
  }
  if (book.consumedMessageRefs.has(input.dvnMessageRef)) {
    return refuse(
      'message-already-consumed',
      `settlement message ${input.dvnMessageRef} has already been verified — a replayed message is refused, never re-credited`,
    );
  }
  if (input.nonce !== s.nonce) {
    return refuse(
      'nonce-already-consumed',
      'the message nonce is not the nonce bound to this settlement at acceptance',
    );
  }

  book.consumedMessageRefs.add(input.dvnMessageRef);
  s.dvnMessageRef = input.dvnMessageRef;
  s.state = 'message-verified';

  const receipt = emitSettlementReceipt(book.journal, {
    actionType: 'qriptocent_settlement_message_verified',
    at: input.at,
    settlementRef: settlementRefOf(s),
    network: 'both',
    summary: 'DVN settlement message verified — instruction authenticated across networks',
    evidenceRefs: [input.dvnMessageRef, s.instructionRef],
  });
  s.receiptRefs.push(receipt.receiptRef);
  return { ok: true, settlement: s };
}

// ─── 5. Destination liquidity ───────────────────────────────────────────────

/**
 * Earmark native destination liquidity for this credit.
 *
 * Reserving BEFORE crediting is what stops two concurrent settlements from both
 * reading the same available balance and both crediting it. There is no lock
 * pool to fall back on — if the destination ledger is short, the settlement
 * cannot proceed, and whether that is a failure or an OBLIGATION depends on the
 * one question: has value already left the payer?
 */
export interface ReserveLiquidityOptions {
  /**
   * Explicit, attributable emergency/priority authorisation. The ONLY thing
   * that moves a RED band off `refuse`, and never taken by the code itself.
   */
  emergencyOverrideRef?: string;
}

export function reserveDestinationLiquidity(
  book: SettlementBook,
  settlementId: string,
  at: string,
  options: ReserveLiquidityOptions = {},
): SettlementOutcome {
  const s = book.settlements[settlementId];
  if (!s) return refuse('unknown-settlement', `no settlement ${settlementId}`);
  if (s.state !== 'message-verified') {
    return refuse('wrong-state', `liquidity is reserved from 'message-verified', not '${s.state}'`);
  }
  const destination = ledgerOf(book, s.destinationDenomination);
  const amount = minor(s.amountMinorUnits);

  // ── MECHANISM 2: LIQUIDITY ASSURANCE ──
  //
  // Consulted BEFORE the reservation, and it can only ever slow or refuse. Note
  // what it deliberately cannot do: when the destination is short, this path
  // refuses. It does NOT reach for the issuance module to top the ledger up —
  // "destination liquidity low → silently create credit → call it settlement"
  // is the exact prohibited collapse of mechanisms 1, 2 and 3.
  const assessment = assessLiquidity(destination, s.amountMinorUnits, book.liquidityPolicy, {
    ...(options.emergencyOverrideRef ? { emergencyOverrideRef: options.emergencyOverrideRef } : {}),
  });
  emitSettlementReceipt(book.journal, {
    actionType: 'qriptocent_liquidity_proof_verified',
    at,
    settlementRef: settlementRefOf(s),
    network: s.destinationNetwork,
    summary: `Destination liquidity assessed: band ${assessment.band}, disposition ${assessment.disposition}`,
    evidenceRefs: [s.dvnMessageRef ?? ''],
  });
  s.receiptRefs.push(book.journal.receipts[book.journal.receipts.length - 1].receiptRef);

  if (!assessment.withinPolicy) {
    const detail = assessment.reasons.join('; ');
    s.state = valueHasLeftThePayer(s) ? 'reconciliation-required' : 'destination-failed';
    recordException(book, s, assessment.refusal ?? 'liquidity-band-refused', detail, at);
    return refuse(assessment.refusal ?? 'liquidity-band-refused', detail);
  }

  if (availableLiquidity(destination) < amount) {
    const detail = `destination settlement liquidity on ${s.destinationNetwork} is ${availableLiquidity(destination)}; ${amount} required`;
    // The partial-state rule: a shortfall AFTER the payer was debited is an
    // obligation, not a failed transaction.
    s.state = valueHasLeftThePayer(s) ? 'reconciliation-required' : 'destination-failed';
    recordException(book, s, 'insufficient-settlement-liquidity', detail, at);
    return refuse('insufficient-settlement-liquidity', detail);
  }

  destination.reservedLiquidityMinorUnits = (
    minor(destination.reservedLiquidityMinorUnits) + amount
  ).toString();
  s.state = 'destination-credit-pending';

  const receipt = emitSettlementReceipt(book.journal, {
    actionType: 'qriptocent_destination_liquidity_reserved',
    at,
    settlementRef: settlementRefOf(s),
    network: s.destinationNetwork,
    summary: `Native settlement liquidity reserved on ${s.destinationNetwork} — no wrapped asset is created`,
    evidenceRefs: [s.dvnMessageRef ?? ''],
    amountMinorUnits: s.amountMinorUnits,
  });
  s.receiptRefs.push(receipt.receiptRef);
  return { ok: true, settlement: s };
}

// ─── 6. Destination credit — THE GATE ───────────────────────────────────────

export interface CompleteCreditInput {
  destinationCreditRef: string;
  at: string;
  /**
   * The ONLY authorised alternative to a finalised source debit. Supplying one
   * is an explicit, attributable act by a named authority — it is not a fallback
   * the code takes on its own, and it leaves reconciliation exposure behind
   * until the source debit finalises.
   */
  advance?: { advanceRef: string; authorisedByRef: string };
}

/**
 * ── THE ACCOUNTING INVARIANT, ENFORCED ──
 *
 * A destination credit may exist only against a finalised source debit OR an
 * explicitly authorised liquidity advance, and may be consumed exactly once.
 *
 * Four independent refusals guard it. They are not redundant — each closes a
 * different attack:
 *
 *   state === 'settled'                → this settlement already credited
 *   consumedCreditRefs.has(ref)        → this credit reference already used
 *   !sourceDebitFinalisedAt && !advance → unbacked credit (duplicate value)
 *   advance without an authority ref    → an "advance" nobody authorised
 */
export function completeDestinationCredit(
  book: SettlementBook,
  settlementId: string,
  input: CompleteCreditInput,
): SettlementOutcome {
  const s = book.settlements[settlementId];
  if (!s) return refuse('unknown-settlement', `no settlement ${settlementId}`);
  if (s.state === 'settled') {
    return refuse(
      'credit-already-consumed',
      `settlement ${settlementId} is already settled — a second credit would be duplicate spendable value`,
    );
  }
  if (s.state !== 'destination-credit-pending') {
    return refuse('wrong-state', `a credit completes from 'destination-credit-pending', not '${s.state}'`);
  }
  if (book.consumedCreditRefs.has(input.destinationCreditRef)) {
    return refuse(
      'credit-already-consumed',
      `destination credit ${input.destinationCreditRef} has already been applied`,
    );
  }

  // The gate reads the RECORDED FINALITY FACT, never the state label.
  const debitIsFinal = s.sourceDebitFinalisedAt !== undefined;
  if (!debitIsFinal) {
    if (!input.advance) {
      return refuse(
        'source-debit-not-final',
        'a destination credit requires a finalised source debit or an explicitly authorised liquidity advance — crediting without either creates duplicate spendable value',
      );
    }
    if (!input.advance.authorisedByRef || !input.advance.advanceRef) {
      return refuse(
        'unauthorised-liquidity-advance',
        'a liquidity advance must name both the advance and the authority that authorised it',
      );
    }
  }

  const destination = ledgerOf(book, s.destinationDenomination);
  const amount = minor(s.amountMinorUnits);

  destination.reservedLiquidityMinorUnits = (
    minor(destination.reservedLiquidityMinorUnits) - amount
  ).toString();
  destination.settlementLiquidityMinorUnits = (
    minor(destination.settlementLiquidityMinorUnits) - amount
  ).toString();
  destination.balances[s.beneficiaryRef] = (
    minor(destination.balances[s.beneficiaryRef] ?? '0') + amount
  ).toString();

  book.consumedCreditRefs.add(input.destinationCreditRef);
  s.destinationCreditRef = input.destinationCreditRef;
  // Cent-for-cent: the credited figure is the amount STRING itself. There is no
  // rate multiplication anywhere on this path, so there is nothing to round.
  s.destinationCreditedMinorUnits = s.amountMinorUnits;
  s.destinationCreditedAt = input.at;
  s.settledAt = input.at;
  s.state = 'settled';
  if (!debitIsFinal && input.advance) {
    s.liquidityAdvance = {
      advanceRef: input.advance.advanceRef,
      authorisedByRef: input.advance.authorisedByRef,
      at: input.at,
    };
  }

  const receipt = emitSettlementReceipt(book.journal, {
    actionType: 'qriptocent_destination_credit_completed',
    at: input.at,
    settlementRef: settlementRefOf(s),
    network: s.destinationNetwork,
    summary: `Beneficiary credited from native ${s.destinationDenomination} liquidity at ${PROTOCOL_SETTLEMENT_RATE} — settlement reallocates capacity, it does not mint`,
    evidenceRefs: [input.destinationCreditRef, s.beneficiaryRef],
    amountMinorUnits: s.amountMinorUnits,
  });
  s.receiptRefs.push(receipt.receiptRef);
  return { ok: true, settlement: s };
}

/**
 * The destination credit failed.
 *
 * ── THE PARTIAL-STATE RULE ──
 *
 * If value has left the payer, this is a RECONCILIATION OBLIGATION, never a
 * silent loss and never a state that reads as "nothing happened". The reserve is
 * released either way, because a reserve against a credit that will not happen
 * would strand destination liquidity that other settlements need.
 */
export function failDestinationCredit(
  book: SettlementBook,
  settlementId: string,
  input: { detail: string; at: string },
): SettlementOutcome {
  const s = book.settlements[settlementId];
  if (!s) return refuse('unknown-settlement', `no settlement ${settlementId}`);
  if (s.state !== 'destination-credit-pending' && s.state !== 'message-verified') {
    return refuse('wrong-state', `a destination failure applies before settlement, not in '${s.state}'`);
  }
  releaseReservation(book, s);
  s.state = valueHasLeftThePayer(s) ? 'reconciliation-required' : 'destination-failed';
  recordException(book, s, 'destination-credit-failed', input.detail, input.at);
  return { ok: true, settlement: s };
}

function releaseReservation(book: SettlementBook, s: CrossDenominationSettlement): void {
  if (s.state !== 'destination-credit-pending') return;
  const destination = ledgerOf(book, s.destinationDenomination);
  destination.reservedLiquidityMinorUnits = (
    minor(destination.reservedLiquidityMinorUnits) - minor(s.amountMinorUnits)
  ).toString();
}

// ─── 7. Timeout ─────────────────────────────────────────────────────────────

/**
 * Expire a settlement that ran out of time.
 *
 * `expired` means NOTHING HAPPENED. It is therefore available only when nothing
 * happened: a timeout after the payer was debited becomes
 * `reconciliation-required`, because presenting it as `expired` would report an
 * obligation as a non-event — the single most dangerous misreport this substrate
 * can produce.
 */
export function expireSettlement(
  book: SettlementBook,
  settlementId: string,
  at: string,
): SettlementOutcome {
  const s = book.settlements[settlementId];
  if (!s) return refuse('unknown-settlement', `no settlement ${settlementId}`);
  if (s.state === 'settled') return refuse('wrong-state', 'a settled settlement cannot expire');
  if (at < s.expiresAt) return refuse('wrong-state', `settlement does not expire until ${s.expiresAt}`);
  releaseReservation(book, s);
  s.state = valueHasLeftThePayer(s) ? 'reconciliation-required' : 'expired';
  recordException(book, s, 'expired', `settlement timed out at ${at} (expiry ${s.expiresAt})`, at);
  return { ok: true, settlement: s };
}

/** Expire every eligible in-flight settlement, in insertion order. */
export function sweepExpired(book: SettlementBook, at: string): string[] {
  const expired: string[] = [];
  for (const id of book.settlementOrder) {
    const s = book.settlements[id];
    if (s.state === 'settled' || s.state === 'reversed' || s.state === 'expired') continue;
    if (s.state === 'failed' || s.state === 'source-failed' || s.state === 'destination-failed') continue;
    if (s.state === 'reconciliation-required') continue;
    if (at < s.expiresAt) continue;
    expireSettlement(book, id, at);
    expired.push(id);
  }
  return expired;
}

// ─── 8. Compensating reversal ───────────────────────────────────────────────

/**
 * Discharge a reconciliation obligation by returning amount + fees to the payer
 * on the SOURCE ledger.
 *
 * A SETTLED settlement can never be reversed here. Value has already reached a
 * third party on another ledger; "reversing" the record would leave the credit
 * standing with no debit behind it — duplicate spendable value produced by the
 * remedy rather than by the payment. The correction for a settled payment is a
 * NEW settlement in the opposite direction, which is exactly why the refusal is
 * a refusal and not a special case.
 */
export function reverseSettlement(
  book: SettlementBook,
  settlementId: string,
  input: { reversalRef: string; detail: string; at: string },
): SettlementOutcome {
  const s = book.settlements[settlementId];
  if (!s) return refuse('unknown-settlement', `no settlement ${settlementId}`);
  if (s.state === 'settled') {
    return refuse(
      'wrong-state',
      'a settled settlement is corrected by a new opposite-direction settlement, never by reversing the record — reversing it would leave the destination credit standing with no debit behind it',
    );
  }
  if (s.state === 'reversed') return refuse('wrong-state', 'already reversed');
  if (!valueHasLeftThePayer(s)) {
    return refuse('wrong-state', 'nothing to reverse — no value left the payer');
  }
  releaseReservation(book, s);
  unwindSourceDebit(book, s);
  s.state = 'reversed';
  s.exceptionReason = input.detail;
  book.exceptions.push({
    settlementId: s.settlementId,
    refusal: 'destination-credit-failed',
    detail: `compensating reversal: ${input.detail}`,
    at: input.at,
    valueCommitted: false,
  });

  const receipt = emitSettlementReceipt(book.journal, {
    actionType: 'qriptocent_settlement_exception_recorded',
    at: input.at,
    settlementRef: settlementRefOf(s),
    network: s.sourceNetwork,
    summary: 'Compensating reversal completed — payer made whole on the source ledger',
    evidenceRefs: [input.reversalRef, s.payerRef],
    amountMinorUnits: s.amountMinorUnits,
    valueCommitted: false,
  });
  s.receiptRefs.push(receipt.receiptRef);
  return { ok: true, settlement: s };
}

// ─── 9. Reconciled ──────────────────────────────────────────────────────────

/**
 * Record that a settlement's two sides have been bilaterally reconciled — the
 * source debit, the message and the destination credit all agree. This is the
 * last link of the evidence chain, and it is emitted per settlement rather than
 * per batch so a single unreconciled settlement is findable.
 */
export function recordSettlementReconciled(
  book: SettlementBook,
  settlementId: string,
  at: string,
): SettlementOutcome {
  const s = book.settlements[settlementId];
  if (!s) return refuse('unknown-settlement', `no settlement ${settlementId}`);
  if (s.state !== 'settled' && s.state !== 'reversed') {
    return refuse('wrong-state', `only a settled or reversed settlement reconciles, not '${s.state}'`);
  }
  const receipt = emitSettlementReceipt(book.journal, {
    actionType: 'qriptocent_settlement_reconciled',
    at,
    settlementRef: settlementRefOf(s),
    network: 'both',
    summary: `Bilateral inter-ledger reconciliation complete (${s.state})`,
    evidenceRefs: [s.sourceDebitRef ?? '', s.dvnMessageRef ?? '', s.destinationCreditRef ?? ''].filter(
      (r) => r.length > 0,
    ),
    amountMinorUnits: s.amountMinorUnits,
  });
  s.receiptRefs.push(receipt.receiptRef);
  return { ok: true, settlement: s };
}

/** Every settlement, in insertion order. */
export function allSettlements(book: SettlementBook): CrossDenominationSettlement[] {
  return book.settlementOrder.map((id) => book.settlements[id]);
}
