/**
 * services/vela/velaFuelAccounting.ts — mirrors the MoneyPenny guest's own
 * self-reported fuel (never host-metered on v0.2.0) at the client fee-
 * reservation boundary, and pins the deployed v0.2.0 error-code numbering.
 */
import { describe, expect, it } from 'vitest';
import {
  computeVelaFeeReservation,
  devnetObservedFuelPriceProvenance,
  onChainFuelPriceProvenance,
  GUEST_SELF_REPORTED_FUEL_UNITS,
  VELA_V0_2_0_ERROR_CODES,
  DEVNET_OBSERVED_FUEL_PRICE_WEI_PER_UNIT,
  DEVNET_OBSERVED_MIN_FEE_PER_REQUEST_WEI,
} from '@/services/vela/velaFuelAccounting';

describe('GUEST_SELF_REPORTED_FUEL_UNITS — mirrors app.go verbatim', () => {
  it('pins the exact values app.go currently returns for each entry point', () => {
    expect(GUEST_SELF_REPORTED_FUEL_UNITS).toEqual({
      deploy: 5,
      loadModule: 5,
      depositFunds: 5,
      process: 25,
    });
  });
});

describe('VELA_V0_2_0_ERROR_CODES — deployed v0.2.0 numbering, never v0.3.0', () => {
  it('pins INSUFFICIENT_FUEL to 12', () => {
    expect(VELA_V0_2_0_ERROR_CODES.INSUFFICIENT_FUEL).toBe(12);
  });
});

describe('computeVelaFeeReservation — deterministic fuel/fee calculation', () => {
  it('is deterministic: identical inputs produce identical output', () => {
    const params = {
      operation: 'process' as const,
      priceWeiPerFuelUnit: 1n,
      priceProvenance: devnetObservedFuelPriceProvenance(),
      minFeePerRequestWei: 10n,
      headroomMultiplier: 2,
    };
    const a = computeVelaFeeReservation(params);
    const b = computeVelaFeeReservation(params);
    expect(a).toEqual(b);
  });

  it('computes base fee as expectedFuelUnits * price for the "process" operation', () => {
    const r = computeVelaFeeReservation({
      operation: 'process',
      priceWeiPerFuelUnit: 1n,
      priceProvenance: devnetObservedFuelPriceProvenance(),
      minFeePerRequestWei: 10n,
      headroomMultiplier: 1,
    });
    expect(r.expectedFuelUnits).toBe(25);
    expect(r.baseFeeWei).toBe(25n);
    // 25 > minFee(10) -> floored fee is the base fee, unaffected by the floor.
    expect(r.flooredFeeWei).toBe(25n);
    expect(r.reservedFeeWei).toBe(25n); // headroom 1x
  });

  it('respects minFeePerRequest when the computed base fee is below it', () => {
    const r = computeVelaFeeReservation({
      operation: 'depositFunds', // 5 fuel units
      priceWeiPerFuelUnit: 1n,
      priceProvenance: devnetObservedFuelPriceProvenance(),
      minFeePerRequestWei: 10n,
      headroomMultiplier: 1,
    });
    expect(r.baseFeeWei).toBe(5n);
    expect(r.flooredFeeWei).toBe(10n); // floored up to the minimum
    expect(r.reservedFeeWei).toBe(10n);
  });

  it('applies explicit headroom AFTER the minimum floor, never bypassing it', () => {
    const r = computeVelaFeeReservation({
      operation: 'process',
      priceWeiPerFuelUnit: 1n,
      priceProvenance: devnetObservedFuelPriceProvenance(),
      minFeePerRequestWei: 10n,
      headroomMultiplier: 2,
    });
    expect(r.flooredFeeWei).toBe(25n);
    expect(r.reservedFeeWei).toBe(50n); // 25 * 2
  });

  it('rounds headroom UP, never leaving the reservation short of the intended multiplier', () => {
    const r = computeVelaFeeReservation({
      operation: 'depositFunds',
      priceWeiPerFuelUnit: 1n,
      priceProvenance: devnetObservedFuelPriceProvenance(),
      minFeePerRequestWei: 1n,
      headroomMultiplier: 1.5,
    });
    expect(r.flooredFeeWei).toBe(5n);
    expect(r.reservedFeeWei).toBe(8n); // ceil(5 * 1.5) = 8 (7.5 rounds up)
  });

  it('carries priceProvenance through unchanged, distinguishing on-chain reads from devnet fallback', () => {
    const onChain = computeVelaFeeReservation({
      operation: 'process',
      priceWeiPerFuelUnit: 1n,
      priceProvenance: onChainFuelPriceProvenance('read from processor.minFeePerRequest()'),
      minFeePerRequestWei: 10n,
      headroomMultiplier: 1,
    });
    expect(onChain.priceProvenance.source).toBe('onchain-read');

    const fallback = computeVelaFeeReservation({
      operation: 'process',
      priceWeiPerFuelUnit: DEVNET_OBSERVED_FUEL_PRICE_WEI_PER_UNIT,
      priceProvenance: devnetObservedFuelPriceProvenance(),
      minFeePerRequestWei: DEVNET_OBSERVED_MIN_FEE_PER_REQUEST_WEI,
      headroomMultiplier: 1,
    });
    expect(fallback.priceProvenance.source).toBe('devnet-observed-fallback');
    // Honestly disclaims the value's provenance — never claims it as a universal/production constant.
    expect(fallback.priceProvenance.description).toMatch(/not a documented protocol constant/i);
    expect(fallback.priceProvenance.description).toMatch(/not a production value/i);
  });

  it('refuses a headroomMultiplier below 1', () => {
    expect(() =>
      computeVelaFeeReservation({
        operation: 'process',
        priceWeiPerFuelUnit: 1n,
        priceProvenance: devnetObservedFuelPriceProvenance(),
        minFeePerRequestWei: 10n,
        headroomMultiplier: 0.5,
      }),
    ).toThrow(/headroomMultiplier must be >= 1/);
  });

  it('refuses negative price or minimum inputs', () => {
    expect(() =>
      computeVelaFeeReservation({
        operation: 'process',
        priceWeiPerFuelUnit: -1n,
        priceProvenance: devnetObservedFuelPriceProvenance(),
        minFeePerRequestWei: 10n,
        headroomMultiplier: 1,
      }),
    ).toThrow(/non-negative/);
  });

  it('reproduces the devnet-observed 25-wei outcome from the recorded 2026-09-14 incident, without hardcoding 25 at the call site', () => {
    // The incident: bare minFeePerRequest() (10 wei) failed with
    // INSUFFICIENT_FUEL; the request later completed once submitted with 25
    // wei. This proves the SAME 25 figure is now reached by formula
    // (25 fuel units * 1 wei/unit), not by a magic literal.
    const r = computeVelaFeeReservation({
      operation: 'process',
      priceWeiPerFuelUnit: DEVNET_OBSERVED_FUEL_PRICE_WEI_PER_UNIT,
      priceProvenance: devnetObservedFuelPriceProvenance(),
      minFeePerRequestWei: DEVNET_OBSERVED_MIN_FEE_PER_REQUEST_WEI,
      headroomMultiplier: 1,
    });
    expect(r.reservedFeeWei).toBe(25n);
  });
});
