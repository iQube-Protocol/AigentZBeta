/**
 * Governed replenishment — the THIRD constitutionally separate mechanism.
 *
 * ─── THIS IS ISSUANCE, AND IT SAYS SO ───────────────────────────────────────
 *
 * Replenishment creates NEW NATIVE SUPPLY. It is a governed act even when it is
 * automated, and it must NEVER be disguised as settlement. Every guard below
 * exists because the alternative — quietly topping up destination liquidity
 * inside the settlement path when a credit would otherwise fail — is the single
 * most attractive shortcut in this architecture and the one that would turn a
 * settlement network into an unaccountable issuer.
 *
 * The separation is structural, not stylistic:
 *
 *   - this module does not import `./settlement.ts`;
 *   - `./settlement.ts` does not import this module, and writes
 *     `issuedMinorUnits` nowhere;
 *   - `./liquidity.ts` can only TRIGGER replenishment, never perform it;
 *   - the mint amount is DERIVED from the frozen reference value in
 *     `./referenceValue.ts`, which nothing here may write.
 *
 * ─── THE SEQUENCE, AND WHY THE ORDER IS THE CONTROL ─────────────────────────
 *
 *   liquidity approaches threshold
 *     → liquidity proof confirms amber/red
 *     → RESERVE PROOF confirms finalised backing
 *     → replenishment policy authorises (caps, rate limits)
 *     → mint derived exactly from proven backing
 *     → issuance receipt + reserve proof
 *     → liquidity restored
 *
 * **Reserve proof PRECEDES minting.** Minting first and proving afterwards
 * produces the same final state on a good day and unbacked supply on a bad one,
 * and the difference is invisible in the resulting balances. So the proof is a
 * precondition checked here, in order, and a missing or invalid proof is a
 * refusal rather than a warning.
 *
 * ─── THE SECOND INVARIANT ───────────────────────────────────────────────────
 *
 *   > A destination credit exists only against a finalised source debit or an
 *   > explicitly authorised liquidity advance.        (settlement — ./settlement.ts)
 *
 *   > New issuance exists only against separately proven and governed backing.
 *                                                     (issuance — THIS MODULE)
 *
 * Two invariants, two mechanisms, side by side. Neither is a special case of the
 * other, and neither may be satisfied by the other's evidence.
 *
 * Phase 1 is SIMULATION: no reserve account, no mint execution, no chain call.
 */

import { emitSettlementReceipt, type SettlementReceiptJournal } from './receipts';
import { mintUnitsForProvenBacking, QRIPTOCENT_REFERENCE_VALUE } from './referenceValue';
import type { DestinationLiquidityProof, ReserveBackedReplenishmentProof } from './proofs';
import type { NativeLedger } from './types';

export interface ReplenishmentPolicy {
  /** Cap on a single authorisation. Minor units. */
  maxMintPerAuthorisationMinorUnits: string;
  /** Cap on cumulative minting within the window this controller governs. */
  maxCumulativeMintMinorUnits: string;
  /** Rate limit: authorisations permitted within the window. */
  maxAuthorisationsPerWindow: number;
}

/** FLAGGED, NOT DECIDED — illustrative caps pending operator calibration. */
export const ILLUSTRATIVE_REPLENISHMENT_POLICY: ReplenishmentPolicy = {
  maxMintPerAuthorisationMinorUnits: '5000000',
  maxCumulativeMintMinorUnits: '20000000',
  maxAuthorisationsPerWindow: 4,
};

export type ReplenishmentRefusal =
  | 'liquidity-not-constrained'
  | 'liquidity-proof-invalid'
  | 'reserve-proof-absent'
  | 'reserve-transfer-not-finalised'
  | 'projected-inflows-are-not-reserves'
  | 'backing-not-exactly-representable'
  | 'non-positive-backing'
  | 'mint-exceeds-policy-limit'
  | 'mint-exceeds-rate-limit'
  | 'mint-exceeds-denomination-maximum'
  | 'emergency-override-unattributed';

export interface ReplenishmentLedgerState {
  /** Cumulative minted through this controller, for the cap check. */
  cumulativeMintedMinorUnits: string;
  /** Authorisations already granted in this window, for the rate limit. */
  authorisationsInWindow: number;
}

export function openReplenishmentState(): ReplenishmentLedgerState {
  return { cumulativeMintedMinorUnits: '0', authorisationsInWindow: 0 };
}

export interface ReplenishmentAuthorisation {
  authorisationRef: string;
  denomination: NativeLedger['denomination'];
  mintedMinorUnits: string;
  backingUsdCentsProven: string;
  /** The arithmetic, carried on the record. Never a bare figure. */
  derivation: string;
  reserveProofRef: string;
  liquidityProofRef: string;
  /** Commitment of the authority. Never a raw identifier. */
  authorisedByRef: string;
  at: string;
}

export type ReplenishmentOutcome =
  | { ok: true; authorisation: ReplenishmentAuthorisation }
  | { ok: false; refusal: ReplenishmentRefusal; detail: string };

export interface AuthoriseReplenishmentInput {
  authorisationRef: string;
  liquidityProof: DestinationLiquidityProof;
  reserveProof: ReserveBackedReplenishmentProof | null;
  policy?: ReplenishmentPolicy;
  /** Commitment of the authority granting this act. */
  authorisedByRef: string;
  at: string;
  /** Attributable emergency override, if the policy path is being exceeded. */
  emergencyOverrideRef?: string;
}

/**
 * Authorise and execute a governed replenishment.
 *
 * This is the ONLY function in the substrate that writes `issuedMinorUnits`, and
 * it writes it only after every precondition below has passed IN ORDER.
 */
export function authoriseReplenishment(
  ledger: NativeLedger,
  journal: SettlementReceiptJournal,
  state: ReplenishmentLedgerState,
  input: AuthoriseReplenishmentInput,
): ReplenishmentOutcome {
  const policy = input.policy ?? ILLUSTRATIVE_REPLENISHMENT_POLICY;

  // 1. Liquidity must actually be constrained. Replenishing a healthy ledger is
  //    issuance with no trigger — i.e. discretionary minting wearing the
  //    controller's authority.
  if (!input.liquidityProof.proofValid) {
    return { ok: false, refusal: 'liquidity-proof-invalid', detail: 'the liquidity proof is not valid' };
  }
  if (input.liquidityProof.thresholdState === 'healthy') {
    return {
      ok: false,
      refusal: 'liquidity-not-constrained',
      detail: 'the destination ledger is healthy — replenishment is triggered by amber or red, never by discretion',
    };
  }

  // 2. RESERVE PROOF PRECEDES MINTING. Absent proof is a refusal, not a delay.
  if (!input.reserveProof) {
    return {
      ok: false,
      refusal: 'reserve-proof-absent',
      detail: 'no reserve proof — minting before reserve proof is unbacked issuance whatever the balances end up looking like',
    };
  }
  if (!input.reserveProof.reserveTransferFinalised || !input.reserveProof.proofValid) {
    return {
      ok: false,
      refusal: 'reserve-transfer-not-finalised',
      detail: 'the reserve transfer is not final — a transfer that can still fail is not backing',
    };
  }
  if (BigInt(input.reserveProof.backingUsdCentsProven) <= 0n) {
    return {
      ok: false,
      refusal: 'projected-inflows-are-not-reserves',
      detail: 'no settled reserve was proven — unfinalised transfers and projected inflows are excluded by construction',
    };
  }

  // 3. Derive the mint from the FROZEN reference value. `$10,000 ÷ $0.01 =
  //    1,000,000 Q¢` falls out of `1 Q¢ = $0.01`; it is never a constant here,
  //    so a reference-value change cannot silently desynchronise this
  //    controller.
  const conversion = mintUnitsForProvenBacking(
    ledger.denomination,
    input.reserveProof.backingUsdCentsProven,
  );
  if (!conversion.ok) {
    return { ok: false, refusal: conversion.refusal, detail: conversion.detail };
  }
  const mint = BigInt(conversion.mintMinorUnits);

  // 4. Policy caps and rate limits. An emergency override may exceed them, but
  //    only when it is ATTRIBUTABLE — an override with no reference is an
  //    unsigned exemption.
  const override = input.emergencyOverrideRef;
  if (override !== undefined && override.length === 0) {
    return {
      ok: false,
      refusal: 'emergency-override-unattributed',
      detail: 'an emergency override must name the authority exercising it',
    };
  }
  if (!override) {
    if (mint > BigInt(policy.maxMintPerAuthorisationMinorUnits)) {
      return {
        ok: false,
        refusal: 'mint-exceeds-policy-limit',
        detail: `mint ${mint} exceeds the per-authorisation cap ${policy.maxMintPerAuthorisationMinorUnits}`,
      };
    }
    if (BigInt(state.cumulativeMintedMinorUnits) + mint > BigInt(policy.maxCumulativeMintMinorUnits)) {
      return {
        ok: false,
        refusal: 'mint-exceeds-policy-limit',
        detail: `cumulative mint would exceed the window cap ${policy.maxCumulativeMintMinorUnits}`,
      };
    }
    if (state.authorisationsInWindow >= policy.maxAuthorisationsPerWindow) {
      return {
        ok: false,
        refusal: 'mint-exceeds-rate-limit',
        detail: `${state.authorisationsInWindow} authorisations already granted in this window (limit ${policy.maxAuthorisationsPerWindow})`,
      };
    }
  }

  // 5. The denomination's governed maximum supply binds ABSOLUTELY. No override
  //    reaches it — the maximum is a constitutional figure, not a policy knob.
  if (BigInt(ledger.issuedMinorUnits) + mint > BigInt(ledger.maxSupplyMinorUnits)) {
    return {
      ok: false,
      refusal: 'mint-exceeds-denomination-maximum',
      detail: `minting ${mint} would take ${ledger.denomination} issuance past its governed maximum ${ledger.maxSupplyMinorUnits}`,
    };
  }

  // 6. Execute. New supply enters as SETTLEMENT LIQUIDITY, so the ledger's
  //    conservation identity (Σ balances + liquidity + fees = issued) still
  //    holds and the new units are attributable to the replenishment rather
  //    than appearing in somebody's wallet.
  ledger.issuedMinorUnits = (BigInt(ledger.issuedMinorUnits) + mint).toString();
  ledger.settlementLiquidityMinorUnits = (
    BigInt(ledger.settlementLiquidityMinorUnits) + mint
  ).toString();
  state.cumulativeMintedMinorUnits = (BigInt(state.cumulativeMintedMinorUnits) + mint).toString();
  state.authorisationsInWindow += 1;

  // 7. Receipt it AS ISSUANCE. Two receipts, distinct action types, and neither
  //    is a settlement action type — the record must never let a mint be read
  //    as a payment.
  emitSettlementReceipt(journal, {
    actionType: 'qriptocent_replenishment_authorised',
    at: input.at,
    settlementRef: input.authorisationRef,
    network: ledger.network,
    summary: `Replenishment authorised against proven reserves (${input.liquidityProof.thresholdState} liquidity)`,
    evidenceRefs: [input.reserveProof.proofRef, input.liquidityProof.proofRef, input.authorisedByRef],
    amountMinorUnits: mint.toString(),
  });
  emitSettlementReceipt(journal, {
    actionType: 'qriptocent_native_issuance_executed',
    at: input.at,
    settlementRef: input.authorisationRef,
    network: ledger.network,
    summary: `Native ${ledger.denomination} issuance executed — ${conversion.derivation} (${QRIPTOCENT_REFERENCE_VALUE[ledger.denomination].statement}). This is ISSUANCE, not settlement.`,
    evidenceRefs: [input.reserveProof.proofRef],
    amountMinorUnits: mint.toString(),
  });

  return {
    ok: true,
    authorisation: {
      authorisationRef: input.authorisationRef,
      denomination: ledger.denomination,
      mintedMinorUnits: mint.toString(),
      backingUsdCentsProven: input.reserveProof.backingUsdCentsProven,
      derivation: conversion.derivation,
      reserveProofRef: input.reserveProof.proofRef,
      liquidityProofRef: input.liquidityProof.proofRef,
      authorisedByRef: input.authorisedByRef,
      at: input.at,
    },
  };
}
