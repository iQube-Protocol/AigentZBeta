/**
 * The denomination reference value — a FROZEN constitutional fact.
 *
 * `1 Q¢ = $0.01`. Everything downstream that needs to turn proven backing into a
 * quantity of native units DERIVES it from this table. Nothing in this substrate
 * writes it.
 *
 * ─── WHY THIS IS ITS OWN MODULE ─────────────────────────────────────────────
 *
 * The extension names one refusal that is easy to miss and catastrophic to get
 * wrong: **the liquidity controller altering the reference value.** A controller
 * that can move the peg can mint any quantity it likes while every arithmetic
 * check still passes — the numbers would reconcile perfectly against a reference
 * the controller chose. Separating the value into its own frozen module makes
 * that a structural impossibility rather than a rule someone has to remember:
 * `Object.freeze` makes the write fail, and a source canary asserts no
 * liquidity or issuance module even names it on the left of an assignment.
 *
 * ─── WHY THE MINT AMOUNT IS DERIVED, NEVER HARD-CODED ───────────────────────
 *
 * $10,000 of proven backing should authorise 1,000,000 Q¢ — but that figure must
 * FALL OUT of `1 Q¢ = $0.01`, not sit in the controller as a constant. A
 * hard-coded conversion desynchronises silently the moment the reference value
 * changes, and the failure is invisible: the controller keeps minting confidently
 * against a peg that no longer holds.
 */

import type { QriptoDenomination } from './types';

export interface DenominationReferenceValue {
  denomination: QriptoDenomination;
  /**
   * USD minor units (cents) per ONE minor unit of the denomination.
   * `1` means one QriptoCENT is worth one US cent — the canonical
   * `$1 = 100 Q¢` conversion, expressed so the arithmetic stays integral.
   */
  usdCentsPerMinorUnit: string;
  /** Human-readable statement of the same fact, for reports and receipts. */
  statement: string;
}

/**
 * FROZEN. Both canonical denominations share one reference value — that shared
 * value is exactly what makes the protocol settlement rate cent-for-cent.
 */
export const QRIPTOCENT_REFERENCE_VALUE: Readonly<
  Record<QriptoDenomination, DenominationReferenceValue>
> = Object.freeze({
  BCENT: Object.freeze({
    denomination: 'BCENT' as const,
    usdCentsPerMinorUnit: '1',
    statement: '1 B¢ = $0.01 = one cent of reference value',
  }),
  BASE_QC: Object.freeze({
    denomination: 'BASE_QC' as const,
    usdCentsPerMinorUnit: '1',
    statement: '1 Base Q¢ = $0.01 = one cent of reference value',
  }),
});

export type ReferenceConversion =
  | { ok: true; mintMinorUnits: string; derivation: string }
  | { ok: false; refusal: 'backing-not-exactly-representable' | 'non-positive-backing'; detail: string };

/**
 * Derive how many native minor units a proven USD backing authorises.
 *
 *     mintMinorUnits = backingUsdCents / usdCentsPerMinorUnit
 *
 * Exact integer division ONLY. A backing that does not divide evenly is REFUSED
 * rather than rounded: rounding down quietly strands backing, rounding up mints
 * against value that was never proven, and either way the mint no longer
 * "corresponds exactly to authorised backing" as the constitution requires.
 */
export function mintUnitsForProvenBacking(
  denomination: QriptoDenomination,
  backingUsdCents: string,
): ReferenceConversion {
  const reference = QRIPTOCENT_REFERENCE_VALUE[denomination];
  const backing = BigInt(backingUsdCents);
  if (backing <= 0n) {
    return { ok: false, refusal: 'non-positive-backing', detail: 'proven backing must be positive' };
  }
  const per = BigInt(reference.usdCentsPerMinorUnit);
  if (backing % per !== 0n) {
    return {
      ok: false,
      refusal: 'backing-not-exactly-representable',
      detail: `${backingUsdCents} USD cents does not divide evenly by ${reference.usdCentsPerMinorUnit} — a mint must correspond EXACTLY to authorised backing, so this is refused rather than rounded`,
    };
  }
  return {
    ok: true,
    mintMinorUnits: (backing / per).toString(),
    // The derivation travels with the result, so a receipt or a report can show
    // the arithmetic instead of asserting the figure.
    derivation: `${backingUsdCents} USD cents ÷ ${reference.usdCentsPerMinorUnit} USD cents per ${denomination} minor unit = ${(backing / per).toString()} ${denomination}`,
  };
}
