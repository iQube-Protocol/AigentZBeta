/**
 * The three proof types — MODELLED AS INTERFACES, never called.
 *
 * Horizen-supported proving is the intended Phase 2 substrate. Phase 1 defines
 * the SHAPE of each proof and, more importantly, the shape of what each proof
 * must NOT disclose. Getting the disclosure boundary right is most of the work:
 * a proof that leaks the treasury while proving solvency has traded the secret
 * it existed to protect.
 *
 *   1. proof of destination liquidity
 *   2. proof of reserve-backed replenishment
 *   3. proof of settlement correctness + exactly-once consumption
 *
 * ─── THE DISCLOSURE RULE ────────────────────────────────────────────────────
 *
 * Each proof takes a PRIVATE ATTESTATION (server-internal, never serialised
 * anywhere) and returns a MINIMAL PUBLIC RESULT. For liquidity that public
 * result is exactly three facts:
 *
 *     liquidity sufficient: true · threshold state: healthy · proof valid: true
 *
 * Not the balance, not the buffer, not the pending exposure. A canary asserts
 * that no attestation figure appears anywhere in the emitted proof object —
 * because the natural way to write this is to pass the attestation through "for
 * debugging", and that is how a treasury ends up in a receipt payload.
 *
 * NO LIVE CALLS. These functions compute a verdict from data handed to them.
 * There is no prover, no circuit, no network. `proofValid` here means "the
 * attested facts support the claim", not "a cryptographic proof verified" — and
 * the field is named on the object so a Phase 2 implementation replaces the body
 * without changing a single consumer.
 */

import { availableLiquidity, liquidityBand, type LiquidityPolicy } from './liquidity';
import { totalDisclosedFees, valueHasLeftThePayer, type SettlementBook } from './settlement';
import type { NativeLedger, QriptoDenomination, SettlementNetwork } from './types';

// ─── 1. Proof of destination liquidity ──────────────────────────────────────

/**
 * SERVER-INTERNAL. Never serialised, never sent, never logged. The whole point
 * of the proof is that these figures stay here.
 */
export interface DestinationLiquidityAttestation {
  spendableLiquidityMinorUnits: string;
  reservedButUnsettledMinorUnits: string;
  minimumOperatingThresholdMinorUnits: string;
  pendingSettlementExposureMinorUnits: string;
  reserveBackingAvailableMinorUnits: string;
  /** Whether the requesting settlement is within the liquidity policy. */
  withinPolicy: boolean;
}

/** The MINIMAL public result. Three facts and no figures. */
export interface DestinationLiquidityProof {
  proofType: 'destination-liquidity';
  proofRef: string;
  denomination: QriptoDenomination;
  network: SettlementNetwork;
  liquiditySufficient: boolean;
  thresholdState: 'healthy' | 'constrained' | 'critical';
  proofValid: boolean;
  at: string;
}

const THRESHOLD_STATE = { green: 'healthy', amber: 'constrained', red: 'critical' } as const;

/**
 * Prove that available native liquidity ≥ required amount + safety buffer,
 * WITHOUT disclosing treasury detail.
 *
 * The safety buffer is part of the claim, not an afterthought: proving you can
 * cover exactly this payment and nothing else is proving you are about to be
 * insolvent.
 */
export function proveDestinationLiquidity(input: {
  proofRef: string;
  denomination: QriptoDenomination;
  network: SettlementNetwork;
  attestation: DestinationLiquidityAttestation;
  requiredMinorUnits: string;
  safetyBufferMinorUnits: string;
  at: string;
}): DestinationLiquidityProof {
  const { attestation } = input;
  const available =
    BigInt(attestation.spendableLiquidityMinorUnits) -
    BigInt(attestation.reservedButUnsettledMinorUnits) -
    BigInt(attestation.pendingSettlementExposureMinorUnits);
  const needed = BigInt(input.requiredMinorUnits) + BigInt(input.safetyBufferMinorUnits);
  const minimum = BigInt(attestation.minimumOperatingThresholdMinorUnits);

  const sufficient = available >= needed && attestation.withinPolicy;
  const thresholdState: DestinationLiquidityProof['thresholdState'] =
    available <= minimum ? 'critical' : available <= minimum * 2n ? 'constrained' : 'healthy';

  return {
    proofType: 'destination-liquidity',
    proofRef: input.proofRef,
    denomination: input.denomination,
    network: input.network,
    liquiditySufficient: sufficient,
    thresholdState,
    // `proofValid` is about the ATTESTATION being internally coherent; a
    // structurally valid proof can and should report `liquiditySufficient:
    // false`. Collapsing the two would make "insufficient liquidity" read as
    // "the proof failed", i.e. as a technical fault rather than a real state.
    proofValid: available >= 0n,
    at: input.at,
  };
}

/** Build the attestation from a ledger and a policy. Server-internal input only. */
export function attestFromLedger(
  ledger: NativeLedger,
  policy: LiquidityPolicy,
  pendingExposureMinorUnits: string,
  reserveBackingAvailableMinorUnits: string,
  withinPolicy: boolean,
): DestinationLiquidityAttestation {
  return {
    spendableLiquidityMinorUnits: ledger.settlementLiquidityMinorUnits,
    reservedButUnsettledMinorUnits: ledger.reservedLiquidityMinorUnits,
    minimumOperatingThresholdMinorUnits: policy.minimumOperatingThresholdMinorUnits,
    pendingSettlementExposureMinorUnits: pendingExposureMinorUnits,
    reserveBackingAvailableMinorUnits,
    withinPolicy,
  };
}

/** Convenience: the band a ledger is in, for callers that need the label only. */
export function ledgerThresholdState(
  ledger: NativeLedger,
  policy: LiquidityPolicy,
): DestinationLiquidityProof['thresholdState'] {
  return THRESHOLD_STATE[liquidityBand(availableLiquidity(ledger), policy)];
}

// ─── 2. Proof of reserve-backed replenishment ───────────────────────────────

/** SERVER-INTERNAL. The reserve position, in USD minor units (cents). */
export interface ReserveAttestation {
  /** Reserve transferred AND settled. The only thing that counts as backing. */
  settledReserveUsdCents: string;
  /**
   * Reserve movements initiated but not yet final. NOT backing.
   * Named so it cannot be quietly folded into the settled figure.
   */
  unfinalisedReserveTransferUsdCents: string;
  /**
   * Expected future inflows. NOT backing, NOT reserves, and the most tempting
   * of the three to count — a controller that mints against projected inflow is
   * minting against a forecast.
   */
  projectedInflowUsdCents: string;
  /** Whether the reserve transfer backing this replenishment is final. */
  reserveTransferFinalised: boolean;
}

export interface ReserveBackedReplenishmentProof {
  proofType: 'reserve-backed-replenishment';
  proofRef: string;
  reserveTransferFinalised: boolean;
  /** The ONLY figure a mint may be derived from. Settled reserve, nothing else. */
  backingUsdCentsProven: string;
  proofValid: boolean;
  /** Every excluded category, named. Silence about an exclusion is not an exclusion. */
  excluded: string[];
  at: string;
}

/**
 * Prove reserve backing for a replenishment.
 *
 * `backingUsdCentsProven` is the SETTLED reserve and nothing else. Unfinalised
 * transfers and projected inflows are excluded EXPLICITLY and listed on the
 * proof, so a reader can see what was left out rather than having to know what
 * should have been.
 */
export function proveReserveBacking(input: {
  proofRef: string;
  attestation: ReserveAttestation;
  at: string;
}): ReserveBackedReplenishmentProof {
  const { attestation } = input;
  return {
    proofType: 'reserve-backed-replenishment',
    proofRef: input.proofRef,
    reserveTransferFinalised: attestation.reserveTransferFinalised,
    backingUsdCentsProven: attestation.reserveTransferFinalised
      ? attestation.settledReserveUsdCents
      : '0',
    // An unfinalised transfer proves nothing: the reserve can still fail to
    // arrive, and the minted units would then be backed by an expectation.
    proofValid: attestation.reserveTransferFinalised,
    excluded: [
      `unfinalised reserve transfers (${attestation.unfinalisedReserveTransferUsdCents} USD cents) — a transfer that can still fail is not backing`,
      `projected inflows (${attestation.projectedInflowUsdCents} USD cents) — a forecast is not a reserve`,
    ],
    at: input.at,
  };
}

// ─── 3. Proof of settlement correctness + exactly-once consumption ──────────

export interface SettlementCorrectnessProof {
  proofType: 'settlement-correctness';
  proofRef: string;
  settlementRef: string;
  sourceDebitFinalised: boolean;
  destinationCreditMatchesInstruction: boolean;
  consumedExactlyOnce: boolean;
  amountsReconcileCentForCent: boolean;
  feesExplainAnyDifference: boolean;
  /** The conjunction of all five. Never asserted independently of them. */
  proofValid: boolean;
  at: string;
}

/**
 * Prove one settlement was correct and consumed exactly once.
 *
 * Every clause is computed from the book, and `proofValid` is their conjunction
 * rather than a separately-set flag — a proof whose verdict can disagree with
 * its own clauses is a proof of nothing.
 */
export function proveSettlementCorrectness(
  book: SettlementBook,
  settlementId: string,
  input: { proofRef: string; at: string },
): SettlementCorrectnessProof {
  const s = book.settlements[settlementId];
  const debitFinal = Boolean(s?.sourceDebitFinalisedAt) || Boolean(s?.liquidityAdvance);
  const creditMatches =
    s?.destinationCreditedMinorUnits !== undefined &&
    s.destinationCreditedMinorUnits === s.amountMinorUnits &&
    s.dvnMessageRef !== undefined &&
    s.sourceDebitRef !== undefined;
  // Exactly once, checked from the registers rather than from the record: the
  // record could be rewritten, the registers are what the gate consulted.
  const consumedOnce =
    s !== undefined &&
    book.consumedInstructionRefs.has(s.instructionRef) &&
    (s.destinationCreditRef === undefined || book.consumedCreditRefs.has(s.destinationCreditRef)) &&
    book.settlementOrder.filter((id) => id === settlementId).length === 1;
  const centForCent =
    s !== undefined &&
    (s.destinationCreditedMinorUnits === undefined ||
      s.destinationCreditedMinorUnits === s.amountMinorUnits);
  const feesExplain =
    s !== undefined &&
    (s.sourceDebitedMinorUnits === undefined ||
      BigInt(s.sourceDebitedMinorUnits) === BigInt(s.amountMinorUnits) + totalDisclosedFees(s.feeBreakdown));

  const clauses = [debitFinal, creditMatches, consumedOnce, centForCent, feesExplain];
  return {
    proofType: 'settlement-correctness',
    proofRef: input.proofRef,
    settlementRef: settlementId,
    sourceDebitFinalised: debitFinal,
    destinationCreditMatchesInstruction: creditMatches,
    consumedExactlyOnce: consumedOnce,
    amountsReconcileCentForCent: centForCent,
    feesExplainAnyDifference: feesExplain,
    proofValid: clauses.every(Boolean),
    at: input.at,
  };
}

/** Total value committed but not yet delivered — the pending settlement exposure. */
export function pendingSettlementExposure(
  book: SettlementBook,
  denomination: QriptoDenomination,
): string {
  return book.settlementOrder
    .map((id) => book.settlements[id])
    .filter(
      (s) =>
        s.destinationDenomination === denomination &&
        valueHasLeftThePayer(s) &&
        s.destinationCreditedMinorUnits === undefined,
    )
    .reduce((acc, s) => acc + BigInt(s.amountMinorUnits), 0n)
    .toString();
}
