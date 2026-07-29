/**
 * QriptoCENT cross-denomination settlement — the shared primitives.
 *
 * Constitution: `codexes/packs/agentiq/updates/2026-07-29_qriptocent-supply-constitution.md`,
 * §"Interoperability is inter-ledger settlement, not token bridging".
 *
 * ─── THIS IS NOT A BRIDGE ───────────────────────────────────────────────────
 *
 * Base Q¢ and B¢ each keep their OWN native ledger, balances, issuance and
 * settlement on their own network. A cross-network payment is not a lock-and-mint:
 *
 *   payer debited on the SOURCE ledger
 *     → DVN-verified settlement message
 *     → destination credited from NATIVE settlement liquidity on the DESTINATION ledger
 *
 * The token does not move. What moves is an authenticated instruction. No wrapped
 * asset is created, no lock pool backs anything 1:1, and **settlement never
 * mints**: `issuedMinorUnits` on either ledger is untouched by every function in
 * this substrate. New issuance is a separate governed act.
 *
 * ─── THE ACCOUNTING INVARIANT ───────────────────────────────────────────────
 *
 * Because no source tokens are locked to represent destination tokens, the ONLY
 * thing standing between an inter-ledger payment and DUPLICATE SPENDABLE VALUE
 * is this rule:
 *
 *   > A destination credit may exist only against a finalised source debit OR an
 *   > explicitly authorised liquidity advance, and each settlement instruction
 *   > may be consumed EXACTLY ONCE.
 *
 * The schema below is shaped to make that rule checkable rather than asserted:
 * the actual ledger movements are recorded (`sourceDebitedMinorUnits`,
 * `destinationCreditedMinorUnits`) alongside the intent (`amountMinorUnits`,
 * `feeBreakdown`), so reconciliation compares two independently-recorded facts
 * instead of comparing a figure with itself.
 *
 * ─── PARITY ─────────────────────────────────────────────────────────────────
 *
 * `1 B¢ = 1 Base Q¢ = one cent of reference value`. `protocolRate` is the literal
 * type `'1:1'` — not a number, not a configurable field — so there is no rate
 * arithmetic anywhere in this substrate that could introduce drift, and no place
 * for a fee to hide inside a rate. Fees live in `feeBreakdown` and nowhere else.
 *
 * Amounts are minor-unit DECIMAL STRINGS throughout, converted to `BigInt` for
 * arithmetic and back. Never a float.
 *
 * T0/T2 (CLAUDE.md Identity & Access Spine): every `*Ref` here is a COMMITMENT.
 * A raw `personaId` must never reach a settlement record, a receipt payload or
 * any chain-bound field. Derive refs with `./refs.ts`.
 *
 * Phase 1 is SIMULATION ONLY: no LayerZero call, no Bitcoin transaction, no Base
 * transaction, no wallet. Every state transition below is a state transition.
 */

/** The two canonical QriptoCENT denominations with native ledgers today. */
export type QriptoDenomination = 'BCENT' | 'BASE_QC';

/** The settlement networks those denominations natively issue and settle on. */
export type SettlementNetwork = 'bitcoin' | 'base';

/**
 * The denomination↔network binding is a CONSTITUTIONAL fact, not a parameter: a
 * denomination has exactly one canonical issuance network. Instructions that
 * disagree with this table are refused rather than normalised — a settlement
 * that silently "corrects" its own network is a settlement whose provenance
 * cannot be reconstructed from its record.
 */
export const DENOMINATION_HOME_NETWORK: Record<QriptoDenomination, SettlementNetwork> = {
  BCENT: 'bitcoin',
  BASE_QC: 'base',
};

/** The protocol settlement rate. A literal type, so it cannot be arithmetic. */
export const PROTOCOL_SETTLEMENT_RATE = '1:1' as const;
export type ProtocolSettlementRate = typeof PROTOCOL_SETTLEMENT_RATE;

/**
 * ─── THE STATE MACHINE ──────────────────────────────────────────────────────
 *
 * True cross-chain atomicity between Bitcoin and Base is impossible, so
 * atomicity is CONSTITUTIONAL rather than technical: it is expressed as states,
 * and the rule that a partial state may never be presented as final settlement.
 *
 *   initiated
 *     → source-debit-pending → source-debit-final
 *     → message-verified
 *     → destination-credit-pending → settled
 *
 * Failure and exception states:
 *
 *   expired               — timed out with NO ledger effect
 *   source-failed         — the source debit never became final; no value left the payer
 *   destination-failed    — the destination credit failed; see below
 *   reconciliation-required — value LEFT the payer and did NOT reach the beneficiary
 *   reversed              — a compensating reversal returned the value to the payer
 *   failed                — refused before any ledger effect, for a reason that is
 *                           none of the above (kept so no exception is stateless)
 *
 * `destination-failed` and `reconciliation-required` are DIFFERENT and must never
 * be conflated: the first says the credit attempt failed, the second says the
 * system now OWES someone. A destination failure after a FINAL source debit is
 * always escalated to `reconciliation-required` — it is an obligation, never a
 * silent loss.
 */
export type SettlementState =
  | 'initiated'
  | 'source-debit-pending'
  | 'source-debit-final'
  | 'message-verified'
  | 'destination-credit-pending'
  | 'settled'
  | 'reconciliation-required'
  | 'reversed'
  | 'failed'
  | 'expired'
  | 'source-failed'
  | 'destination-failed';

/**
 * States from which nothing further will happen. `reconciliation-required` is
 * DELIBERATELY ABSENT — an outstanding obligation is not a resting place, and
 * treating it as terminal is how an obligation becomes a write-off.
 */
export const TERMINAL_SETTLEMENT_STATES: readonly SettlementState[] = [
  'settled',
  'reversed',
  'expired',
  'source-failed',
  'destination-failed',
  'failed',
];

/**
 * The ONE state that means the payment completed. Everything else — including
 * every in-flight state and every exception — is not settlement.
 */
export function isFinalSettlement(state: SettlementState): boolean {
  return state === 'settled';
}

/** States in which value has left the payer's ledger. */
export const VALUE_COMMITTED_STATES: readonly SettlementState[] = [
  'source-debit-final',
  'message-verified',
  'destination-credit-pending',
  'settled',
  'reconciliation-required',
  'destination-failed',
];

/**
 * Fee classes.
 *
 * Four categories, per the operator's extension: network, service, liquidity,
 * and reconciliation/exception.
 *
 *   > If 10.00 is debited and 9.98 credited, the 0.02 must be an explicit fee
 *   > with a payer, a beneficiary, a basis and a receipt. No spread, rate
 *   > adjustment or hidden conversion factor may substitute for an explicitly
 *   > named fee.
 *
 * FLAGGED, NOT DECIDED: the constitution also names `timing/finality premium`
 * and `market deviation outside the protocol rate` as classes into which a
 * difference may fall. Neither has a field here, and neither is silently mapped
 * onto `serviceFee` — mapping them would be exactly the misclassification the
 * constitution prohibits. A settlement that would need one is refused until the
 * operator rules on whether they are FEES (belonging in this breakdown) or
 * MARKET FACTS outside the protocol rate (belonging nowhere near it).
 */
export type SettlementFeeClass =
  | 'network-fee'
  | 'service-fee'
  | 'liquidity-fee'
  | 'reconciliation-fee';

export interface SettlementFeeBreakdown {
  networkFee?: string;
  serviceFee?: string;
  liquidityFee?: string;
  /** Reconciliation / exception handling. */
  reconciliationFee?: string;
}

/** A liquidity advance — the ONLY authorised alternative to a final source debit. */
export interface AuthorisedLiquidityAdvance {
  advanceRef: string;
  /** Commitment of the authority that authorised the advance. Never a raw id. */
  authorisedByRef: string;
  at: string;
}

/**
 * ─── THE SETTLEMENT RECORD ──────────────────────────────────────────────────
 *
 * One cross-denomination payment, from instruction to terminal state.
 */
export interface CrossDenominationSettlement {
  settlementId: string;
  sourceDenomination: QriptoDenomination;
  destinationDenomination: QriptoDenomination;
  sourceNetwork: SettlementNetwork;
  destinationNetwork: SettlementNetwork;
  /** The value being moved between ledgers. Minor units, decimal string. */
  amountMinorUnits: string;
  protocolRate: ProtocolSettlementRate;
  /** Commitments — see ./refs.ts. Never a raw personaId. */
  payerRef: string;
  beneficiaryRef: string;
  delegationRef: string;
  sourceDebitRef?: string;
  dvnMessageRef?: string;
  destinationCreditRef?: string;
  state: SettlementState;
  feeBreakdown: SettlementFeeBreakdown;
  receiptRefs: string[];

  // ── Exactly-once identity ────────────────────────────────────────────────
  /**
   * The payment instruction's own identity. Consumed EXACTLY ONCE per book: a
   * second instruction carrying this ref is a replay and is refused, whatever
   * settlementId it claims.
   */
  instructionRef: string;
  /**
   * Replay nonce carried by the DVN settlement message. Consumed exactly once,
   * independently of `instructionRef`, because the instruction and the message
   * are two separate opportunities to replay.
   */
  nonce: string;

  // ── Observed ledger movements (recorded, never inferred) ──────────────────
  /** What the payer's ledger actually lost. Must equal amount + Σ disclosed fees. */
  sourceDebitedMinorUnits?: string;
  /** What the beneficiary's ledger actually gained. Must equal amount, exactly. */
  destinationCreditedMinorUnits?: string;

  // ── Timing (fixture timestamps — never a clock) ───────────────────────────
  initiatedAt: string;
  expiresAt: string;
  sourceDebitFinalisedAt?: string;
  destinationCreditedAt?: string;
  settledAt?: string;

  /** Present only when the destination credit ran ahead of source finality. */
  liquidityAdvance?: AuthorisedLiquidityAdvance;
  /** Why this settlement is in an exception state. Never empty when it is. */
  exceptionReason?: string;
}

/**
 * ─── A NATIVE LEDGER ────────────────────────────────────────────────────────
 *
 * One denomination's own ledger on its own network. There is one of these per
 * denomination and they are NOT connected by a lock pool — the only connection
 * is the settlement message.
 *
 * The conservation identity every ledger holds at all times:
 *
 *   Σ wallet balances + settlement liquidity  ===  issued supply
 *
 * A settlement moves value BETWEEN the two terms on each side; it never changes
 * `issuedMinorUnits`. That is the whole "settlement ≠ issuance" claim, expressed
 * as an identity a reconciler can check rather than a sentence in a document.
 */
export interface NativeLedger {
  denomination: QriptoDenomination;
  network: SettlementNetwork;
  /** Governed maximum. Settlement never reads it as headroom and never changes it. */
  maxSupplyMinorUnits: string;
  /** Native issued supply. NO function in this substrate writes this. */
  issuedMinorUnits: string;
  /** Circulating wallet balances, by holder commitment. */
  balances: Record<string, string>;
  /** Native settlement liquidity held on this ledger. */
  settlementLiquidityMinorUnits: string;
  /** Earmarked against in-flight destination credits. Subset of the above. */
  reservedLiquidityMinorUnits: string;
  /** Fees collected on this ledger, held separately from settlement liquidity. */
  feesCollectedMinorUnits: string;
}

/** Why a settlement operation was refused. Every one is a named, testable cause. */
export type SettlementRefusal =
  | 'duplicate-settlement-id'
  | 'instruction-already-consumed'
  | 'nonce-already-consumed'
  | 'message-already-consumed'
  | 'credit-already-consumed'
  | 'authority-not-verified'
  | 'same-denomination'
  | 'denomination-network-mismatch'
  | 'malformed-amount'
  | 'non-positive-amount'
  | 'raw-identifier-in-instruction'
  | 'unknown-settlement'
  | 'wrong-state'
  | 'expired'
  | 'insufficient-payer-balance'
  | 'source-debit-not-final'
  | 'unauthorised-liquidity-advance'
  | 'insufficient-settlement-liquidity'
  | 'undisclosed-fee'
  | 'rate-deviation'
  // ── Liquidity assurance (the SECOND control layer) ──────────────────────
  | 'liquidity-band-refused'
  | 'settlement-exceeds-exposure-limit'
  | 'liquidity-proof-invalid';

export type SettlementOutcome =
  | { ok: true; settlement: CrossDenominationSettlement }
  | { ok: false; refusal: SettlementRefusal; detail: string };

/** An exception the book recorded. Exceptions are records, never silent. */
export interface SettlementException {
  settlementId: string;
  refusal: SettlementRefusal | 'destination-credit-failed' | 'source-debit-failed';
  detail: string;
  at: string;
  /** True when value had already left the payer — i.e. this is an OBLIGATION. */
  valueCommitted: boolean;
}
