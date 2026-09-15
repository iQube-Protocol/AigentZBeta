/**
 * Vela v0.2.0 fuel/fee accounting — client-boundary fee reservation
 * mirroring the MoneyPenny guest's own SELF-REPORTED fuel values, and the
 * deployed v0.2.0 error-code numbering (Vela/Horizen feedback, 2026-09-16).
 *
 * VELA V0.2.0 DOES NOT METER GUEST EXECUTION (Horizen's own finding 11, this
 * pass): the guest returns its own `Fuel` value on every successful call
 * (`Deploy`/`LoadModule`/`DepositFunds`/`ProcessRequest`), and the Executor
 * sums the applicable fuel and charges `fuel * EXECUTOR_FUEL_PRICE_PER_UNIT`,
 * subject to `minFeePerRequest`. The client can predict what the guest will
 * SELF-REPORT (this module's whole job), but cannot verify it was actually
 * metered — a compromised/buggy guest could misreport. That is a substrate
 * property, not something a client-side formula can close; this module never
 * claims otherwise.
 *
 * THE FORMULA IS A DIRECT MIRROR OF THE GUEST'S OWN SOURCE, cited by exact
 * line — `services/vela/wasm/projector/app/app.go` (verified against this
 * repository's own copy, not assumed from a paraphrase):
 *   - `Deploy`         (line 86):  `Fuel: types.NewUint256(5)`
 *   - `LoadModule`     (line 94):  `Fuel: types.NewUint256(5)`
 *   - `DepositFunds`   (line 103): `Fuel: types.NewUint256(5)`
 *   - `ProcessRequest` (line 168): `Fuel: types.NewUint256(25)` — the SAME
 *     flat value regardless of single-party vs multi-party shape or party
 *     count (the fork between the two only changes which `events` are
 *     built; both paths fall through to the ONE `return` statement at line
 *     165-169). If the guest is ever changed to scale fuel with party count
 *     or payload size, `GUEST_SELF_REPORTED_FUEL_UNITS.process` below MUST
 *     be updated to match — this module makes no claim it can detect that
 *     drift on its own; a proof test pins the current mirrored value.
 *
 * PRICE/MINIMUM PROVENANCE — NEVER UNIVERSAL CONSTANTS. `1 wei per fuel
 * unit` and a `10 wei` minimum are DEVNET OBSERVATIONS from one public
 * Synsema v0.2.0 devnet run (2026-09-14 — a request needing 25 wei failed
 * when only the bare `minFeePerRequest()` of 10 wei was supplied, then
 * completed once submitted with 25), not a documented protocol constant and
 * not a production value. `DEVNET_OBSERVED_FUEL_PRICE_WEI_PER_UNIT` below
 * exists ONLY as an explicitly-labelled fallback for callers with no live
 * on-chain read available — every caller SHOULD prefer a real
 * `minFeePerRequest()` read (already done in
 * `scripts/vela/public-devnet-smoke.ts`) and pass it in explicitly.
 */

/** Deployed v0.2.0 `ProcessorEndpoint`/Executor error-code numbering —
 *  PINNED to what Horizen's own devnet actually returns today. The
 *  unreleased v0.3.0 renumbers these; never use that numbering here. */
export const VELA_V0_2_0_ERROR_CODES = {
  /** "insufficient fuel: required X wei, provided Y wei" — observed live,
   *  2026-09-14 (`RES-2026-09-14-VELA-DEVNET-FUEL-ERRORCODE-MASKED-DISPOSITION-001`). */
  INSUFFICIENT_FUEL: 12,
} as const;

/** The four guest entry points that self-report `Fuel`, and the flat unit
 *  count each currently returns — mirrored, never re-derived, from
 *  `services/vela/wasm/projector/app/app.go` (see this file's own header
 *  for the exact cited lines). */
export const GUEST_SELF_REPORTED_FUEL_UNITS = {
  deploy: 5,
  loadModule: 5,
  depositFunds: 5,
  /** Flat for EVERY ProcessRequest call — single-party and multi-party
   *  alike, regardless of party count (app.go's own single `return`, see
   *  header). Not a function of payload shape today. */
  process: 25,
} as const;

export type VelaGuestOperation = keyof typeof GUEST_SELF_REPORTED_FUEL_UNITS;

/** A public-devnet OBSERVATION, not a protocol constant — see this file's
 *  header. Use only when no live `minFeePerRequest()`/on-chain price read is
 *  available; label the result's provenance honestly either way (see
 *  `FeeReservation.priceProvenance` below). */
export const DEVNET_OBSERVED_FUEL_PRICE_WEI_PER_UNIT = 1n;
export const DEVNET_OBSERVED_MIN_FEE_PER_REQUEST_WEI = 10n;

export type FuelPriceProvenance =
  | { source: 'onchain-read'; description: string }
  | { source: 'devnet-observed-fallback'; description: string }
  | { source: 'caller-supplied'; description: string };

export interface ComputeVelaFeeReservationParams {
  operation: VelaGuestOperation;
  /**
   * Price per fuel unit, in wei. REQUIRED — this module never silently
   * defaults to the devnet-observed value; a caller that has no live
   * on-chain read must explicitly pass `DEVNET_OBSERVED_FUEL_PRICE_WEI_PER_UNIT`
   * itself, together with `priceProvenance` naming that choice, so the
   * resulting `FeeReservation` is always honest about where its price came
   * from.
   */
  priceWeiPerFuelUnit: bigint;
  /** How `priceWeiPerFuelUnit` was obtained — carried through onto the result unchanged. */
  priceProvenance: FuelPriceProvenance;
  /** `ProcessorEndpoint.minFeePerRequest()` — a real on-chain read wherever possible. */
  minFeePerRequestWei: bigint;
  /**
   * Multiplicative headroom over the computed base fee, applied AFTER the
   * `minFeePerRequestWei` floor (never bypasses it) — guards against the
   * guest's self-reported fuel drifting upward without this module's own
   * mirror being updated in lockstep, and against price fluctuation between
   * reservation and execution. Explicit, never an implicit hardcoded
   * multiplier baked into the formula itself. Must be >= 1.
   */
  headroomMultiplier: number;
}

export interface VelaFeeReservation {
  operation: VelaGuestOperation;
  expectedFuelUnits: number;
  priceWeiPerFuelUnit: bigint;
  priceProvenance: FuelPriceProvenance;
  minFeePerRequestWei: bigint;
  headroomMultiplier: number;
  /** `expectedFuelUnits * priceWeiPerFuelUnit`, before the minimum floor or headroom. */
  baseFeeWei: bigint;
  /** `max(baseFeeWei, minFeePerRequestWei)`, before headroom. */
  flooredFeeWei: bigint;
  /** The reservation to actually submit as `maxFeeValue` — `flooredFeeWei * headroomMultiplier`, rounded up. */
  reservedFeeWei: bigint;
}

/**
 * Deterministic, pure fee-reservation calculation — the single source-
 * verifiable contract between the guest's self-reported fuel and the
 * client's `maxFeeValue` reservation. Never hardcodes 25 (or any fuel
 * count) inline at a call site; every caller reads
 * `GUEST_SELF_REPORTED_FUEL_UNITS` through this function.
 */
export function computeVelaFeeReservation(params: ComputeVelaFeeReservationParams): VelaFeeReservation {
  if (params.headroomMultiplier < 1) {
    throw new Error(
      `computeVelaFeeReservation: headroomMultiplier must be >= 1 (got ${params.headroomMultiplier}) — ` +
        'a reservation below the computed floored fee would risk INSUFFICIENT_FUEL by construction.',
    );
  }
  if (params.priceWeiPerFuelUnit < 0n || params.minFeePerRequestWei < 0n) {
    throw new Error('computeVelaFeeReservation: priceWeiPerFuelUnit and minFeePerRequestWei must be non-negative.');
  }

  const expectedFuelUnits = GUEST_SELF_REPORTED_FUEL_UNITS[params.operation];
  const baseFeeWei = BigInt(expectedFuelUnits) * params.priceWeiPerFuelUnit;
  const flooredFeeWei = baseFeeWei > params.minFeePerRequestWei ? baseFeeWei : params.minFeePerRequestWei;

  // Integer headroom application without floating-point wei arithmetic:
  // scale by round(headroomMultiplier * 1000), then divide by 1000, rounding
  // UP so the reservation is never short of the intended multiplier.
  const scaledMultiplier = BigInt(Math.round(params.headroomMultiplier * 1000));
  const scaledNumerator = flooredFeeWei * scaledMultiplier;
  const reservedFeeWei = (scaledNumerator + 999n) / 1000n;

  return {
    operation: params.operation,
    expectedFuelUnits,
    priceWeiPerFuelUnit: params.priceWeiPerFuelUnit,
    priceProvenance: params.priceProvenance,
    minFeePerRequestWei: params.minFeePerRequestWei,
    headroomMultiplier: params.headroomMultiplier,
    baseFeeWei,
    flooredFeeWei,
    reservedFeeWei,
  };
}

/** Convenience: the devnet-observed price/label, for a caller with no live
 *  on-chain read. Never used silently — the caller must opt in explicitly. */
export function devnetObservedFuelPriceProvenance(): FuelPriceProvenance {
  return {
    source: 'devnet-observed-fallback',
    description:
      'No live on-chain price read was available; using the public Synsema v0.2.0 devnet\'s OBSERVED price ' +
      '(1 wei/fuel unit, 10 wei minimum, 2026-09-14) — not a documented protocol constant, not a production value.',
  };
}

export function onChainFuelPriceProvenance(sourceDescription: string): FuelPriceProvenance {
  return { source: 'onchain-read', description: sourceDescription };
}
