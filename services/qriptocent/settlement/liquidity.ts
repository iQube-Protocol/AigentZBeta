/**
 * Liquidity assurance — the SECOND of three constitutionally separate mechanisms.
 *
 * ─── THE SEPARATION, AND WHY COLLAPSING ANY TWO IS THE DEFECT ───────────────
 *
 *   1. SETTLEMENT           moves value between native ledgers. NEVER mints.
 *                           Requires a final source debit or an authorised
 *                           liquidity advance.  (`./settlement.ts`)
 *   2. LIQUIDITY ASSURANCE  proves the destination ledger has sufficient
 *                           available liquidity, controls transaction size, and
 *                           can slow or refuse settlement.  (THIS MODULE)
 *   3. ISSUANCE             creates new native supply against proven reserves. A
 *                           separate governed act EVEN WHEN AUTOMATED.
 *                           (`./issuance.ts`)
 *
 * The liquidity problem is real and it does NOT justify returning to
 * lock-and-mint. It justifies a control layer. But a control layer that can
 * mint is an issuer wearing a controller's name, and a settlement path that can
 * mint when liquidity is short is exactly the "silently create credit and call
 * it settlement" failure. So this module:
 *
 *   - never writes `issuedMinorUnits`;
 *   - never writes the reference value;
 *   - never credits anyone;
 *   - never imports the issuance module.
 *
 * It answers ONE question — *may this settlement proceed, and at what size?* —
 * and it can only ever answer with a permission, a queue, or a refusal.
 *
 * ─── BANDS, NOT ONE CLIFF ───────────────────────────────────────────────────
 *
 *   GREEN   available > target operating buffer
 *           ordinary settlement, normal limits, no replenishment
 *   AMBER   minimum < available ≤ target buffer
 *           reduced limits; larger transactions queued or split; replenishment
 *           triggered; proof frequency increased
 *   RED     available ≤ minimum
 *           no ordinary destination credits; only explicitly authorised
 *           emergency/priority settlements; otherwise FAIL CLOSED
 *
 * A single threshold would make the system healthy right up to the moment it is
 * insolvent. Bands give the replenishment path time to act, which is the whole
 * point of having one.
 *
 * ─── TRANSACTION-SIZE CONTROL ───────────────────────────────────────────────
 *
 *   maximum settlement = available liquidity × permitted exposure ratio
 *
 *   > No individual settlement may consume a constitutionally unsafe proportion
 *   > of destination liquidity.
 *
 * The ratio TIGHTENS as liquidity falls. Ratios are held in BASIS POINTS
 * (integers) so the calculation stays exact — a percentage in floating point is
 * a rounding error waiting to become a liquidity breach.
 */

import type { NativeLedger, SettlementRefusal } from './types';

export type LiquidityBand = 'green' | 'amber' | 'red';

/**
 * FLAGGED, NOT DECIDED — the percentages need calibration and are NOT ratified.
 *
 * The operator's extension gives them ILLUSTRATIVELY as Green ≤5%, Amber ≤1%,
 * Red 0% except explicit override. They are encoded here as basis points, named
 * as illustrative, and injectable per book so calibration is a policy change
 * rather than a code change. Shipping them as unlabelled constants is how an
 * illustration becomes a ratified figure without anyone ratifying it.
 */
export const ILLUSTRATIVE_EXPOSURE_BPS: Record<LiquidityBand, number> = {
  green: 500, // 5.00% — illustrative, requires calibration
  amber: 100, // 1.00% — illustrative, requires calibration
  red: 0, // no ordinary settlement; explicit override only
};

export interface LiquidityPolicy {
  /** Above this, the band is GREEN. Minor units. */
  targetOperatingBufferMinorUnits: string;
  /** At or below this, the band is RED. Minor units. */
  minimumOperatingThresholdMinorUnits: string;
  /** Permitted exposure ratio per band, in basis points of available liquidity. */
  permittedExposureBps: Record<LiquidityBand, number>;
}

/** The default policy. Illustrative, per-book overridable, never ratified here. */
export const ILLUSTRATIVE_LIQUIDITY_POLICY: LiquidityPolicy = {
  targetOperatingBufferMinorUnits: '5000000',
  minimumOperatingThresholdMinorUnits: '1000000',
  permittedExposureBps: ILLUSTRATIVE_EXPOSURE_BPS,
};

/** Available = held settlement liquidity − liquidity already earmarked. */
export function availableLiquidity(ledger: NativeLedger): bigint {
  return BigInt(ledger.settlementLiquidityMinorUnits) - BigInt(ledger.reservedLiquidityMinorUnits);
}

export function liquidityBand(available: bigint, policy: LiquidityPolicy): LiquidityBand {
  if (available <= BigInt(policy.minimumOperatingThresholdMinorUnits)) return 'red';
  if (available <= BigInt(policy.targetOperatingBufferMinorUnits)) return 'amber';
  return 'green';
}

/**
 * The largest single settlement this band permits.
 *
 * Integer basis-point arithmetic: `available × bps / 10_000`, truncating. The
 * truncation is deliberate and always downward — a maximum that rounds UP is a
 * maximum that admits the one transaction the limit existed to exclude.
 */
export function maximumSettlementSize(available: bigint, policy: LiquidityPolicy): bigint {
  const band = liquidityBand(available, policy);
  const bps = BigInt(policy.permittedExposureBps[band]);
  if (available <= 0n || bps <= 0n) return 0n;
  return (available * bps) / 10_000n;
}

export type LiquidityDisposition =
  | 'permit'
  | 'queue-or-split'
  | 'requires-explicit-override'
  | 'refuse';

export interface LiquidityAssessment {
  band: LiquidityBand;
  availableMinorUnits: string;
  maximumSettlementMinorUnits: string;
  requiredMinorUnits: string;
  disposition: LiquidityDisposition;
  /** True only for `permit`. Every other disposition stops the settlement. */
  withinPolicy: boolean;
  /** AMBER and RED trigger replenishment — which is ISSUANCE, not settlement. */
  replenishmentTriggered: boolean;
  proofFrequency: 'standard' | 'increased';
  /** Every reason, stated. A refusal with no reason is unreviewable. */
  reasons: string[];
  /** The refusal a caller should surface if it proceeds anyway. */
  refusal?: SettlementRefusal;
}

export interface AssessLiquidityOptions {
  /**
   * An explicit, attributable emergency/priority authorisation. Only this can
   * move a RED band off `refuse`, and it is never taken by the code on its own.
   */
  emergencyOverrideRef?: string;
}

/**
 * Assess whether a destination credit of `requiredMinorUnits` may proceed.
 *
 * FAIL CLOSED. Every path that is not an affirmative permission is a stop:
 * `queue-or-split` for a transaction too large for the band,
 * `requires-explicit-override` for RED with no override, `refuse` otherwise.
 * A controller that returns "probably fine" under pressure is a controller that
 * does nothing under pressure.
 */
export function assessLiquidity(
  ledger: NativeLedger,
  requiredMinorUnits: string,
  policy: LiquidityPolicy = ILLUSTRATIVE_LIQUIDITY_POLICY,
  options: AssessLiquidityOptions = {},
): LiquidityAssessment {
  const available = availableLiquidity(ledger);
  const required = BigInt(requiredMinorUnits);
  const band = liquidityBand(available, policy);
  const maximum = maximumSettlementSize(available, policy);
  const reasons: string[] = [];

  const base = {
    band,
    availableMinorUnits: available.toString(),
    maximumSettlementMinorUnits: maximum.toString(),
    requiredMinorUnits,
    replenishmentTriggered: band !== 'green',
    proofFrequency: (band === 'green' ? 'standard' : 'increased') as 'standard' | 'increased',
  };

  if (band === 'red') {
    if (!options.emergencyOverrideRef) {
      reasons.push(
        `available liquidity ${available} is at or below the minimum operating threshold ${policy.minimumOperatingThresholdMinorUnits} — ordinary destination credits are refused and the system fails closed`,
      );
      return {
        ...base,
        disposition: 'refuse',
        withinPolicy: false,
        reasons,
        refusal: 'liquidity-band-refused',
      };
    }
    reasons.push(
      `RED band settlement proceeding under explicit emergency authorisation ${options.emergencyOverrideRef} — attributable, and outside ordinary policy`,
    );
    return { ...base, disposition: 'permit', withinPolicy: true, reasons };
  }

  if (available < required) {
    reasons.push(`available liquidity ${available} is below the required ${required}`);
    return {
      ...base,
      disposition: 'refuse',
      withinPolicy: false,
      reasons,
      refusal: 'liquidity-band-refused',
    };
  }

  if (required > maximum) {
    reasons.push(
      `a single settlement of ${required} exceeds the ${band}-band exposure limit of ${maximum} (${policy.permittedExposureBps[band]} bps of ${available}) — queue or split rather than consuming an unsafe proportion of destination liquidity`,
    );
    return {
      ...base,
      disposition: 'queue-or-split',
      withinPolicy: false,
      reasons,
      refusal: 'settlement-exceeds-exposure-limit',
    };
  }

  if (band === 'amber') {
    reasons.push(
      `AMBER: available ${available} is within the target operating buffer ${policy.targetOperatingBufferMinorUnits}; reduced limits apply, replenishment is triggered and proof frequency is increased`,
    );
  }
  return { ...base, disposition: 'permit', withinPolicy: true, reasons };
}
