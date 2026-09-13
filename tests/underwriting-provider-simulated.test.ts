/**
 * SimulatedUnderwritingProvider — the ONE UnderwritingProvider implementation
 * that exists today (Use Case Zero underwriting vertical slice, 2026-09-13).
 *
 * Proves: the deterministic lookup table exactly matches the operator's own
 * verbatim instruction (ACCEPTABLE -> low/eligible/fixed premium+limit;
 * UNACCEPTABLE -> high/not-eligible/conditions; UNRESOLVED -> unknown/not-
 * eligible/confidence 0), and that `providerMode` is structurally
 * unmissable — both at the TYPE level (gate 4: cannot construct an
 * `UnderwritingQuote` without it) and at the VALUE level (this provider
 * always stamps `'SIMULATED'`).
 */

import { describe, expect, it } from 'vitest';
import {
  SimulatedUnderwritingProvider,
  createUnderwritingProvider,
} from '@/services/financialServices/providers/underwriting/simulatedUnderwritingProvider';
import type { UnderwritingQuote } from '@/services/financialServices/providers/underwriting/underwritingProviderTypes';

describe('gate 1 — quoteForVerdict is structurally incapable of receiving raw financial inputs', () => {
  it('has arity 1 (a single parameter), never an options/inputs object', () => {
    const provider = new SimulatedUnderwritingProvider();
    expect(provider.quoteForVerdict.length).toBe(1);
  });

  it('the TypeScript signature rejects an object argument shaped like raw projection inputs', async () => {
    const provider = new SimulatedUnderwritingProvider();
    // @ts-expect-error — quoteForVerdict accepts only a ConfidentialProjectionDisposition
    // string; an object carrying financial fields must fail to typecheck. The
    // directive itself is the gate-1 proof (a full `tsc --noEmit` pass shows
    // zero errors in this file, meaning the expected error fired). The runtime
    // implementation fails closed on this malformed input (see the
    // "fail-closed on an unrecognised verdict" suite below) — caught here so
    // that expected rejection never surfaces as an unhandled rejection.
    await expect(
      provider.quoteForVerdict({ currentExposure: 0, proposedSpend: 800, privateSpendLimit: 1000, privateRiskLimit: 1000 }),
    ).rejects.toThrow(/unrecognised verdict/);
  });
});

describe('the deterministic lookup table — exactly the operator-specified shape', () => {
  it('ACCEPTABLE: low risk band, coverage eligible, fixed non-zero premium + coverageLimit, no conditions', async () => {
    const provider = new SimulatedUnderwritingProvider();
    const quote = await provider.quoteForVerdict('ACCEPTABLE');
    expect(quote.riskBand).toBe('LOW');
    expect(quote.coverageEligible).toBe(true);
    expect(quote.premium).toBeGreaterThan(0);
    expect(quote.coverageLimit).toBeGreaterThan(0);
    expect(quote.conditions).toEqual([]);
    expect(quote.confidence).toBeGreaterThan(0);
    expect(quote.estimatedExposure).not.toBeNull();
  });

  it('UNACCEPTABLE: high risk band, NOT eligible, zero premium/limit, non-empty conditions explaining why', async () => {
    const provider = new SimulatedUnderwritingProvider();
    const quote = await provider.quoteForVerdict('UNACCEPTABLE');
    expect(quote.riskBand).toBe('HIGH');
    expect(quote.coverageEligible).toBe(false);
    expect(quote.premium).toBe(0);
    expect(quote.coverageLimit).toBe(0);
    expect(quote.conditions.length).toBeGreaterThan(0);
    expect(quote.conditions[0]).toMatch(/UNACCEPTABLE/);
  });

  it('UNRESOLVED: unknown band, NOT eligible, confidence exactly 0, null estimatedExposure (honest absence, never a guessed number)', async () => {
    const provider = new SimulatedUnderwritingProvider();
    const quote = await provider.quoteForVerdict('UNRESOLVED');
    expect(quote.riskBand).toBe('UNKNOWN');
    expect(quote.coverageEligible).toBe(false);
    expect(quote.premium).toBe(0);
    expect(quote.coverageLimit).toBe(0);
    expect(quote.confidence).toBe(0);
    expect(quote.estimatedExposure).toBeNull();
    expect(quote.conditions.length).toBeGreaterThan(0);
  });

  it('every quote carries exactly the nine operator-specified fields, no more, no fewer', async () => {
    const provider = new SimulatedUnderwritingProvider();
    for (const verdict of ['ACCEPTABLE', 'UNACCEPTABLE', 'UNRESOLVED'] as const) {
      const quote = await provider.quoteForVerdict(verdict);
      expect(Object.keys(quote).sort()).toEqual(
        [
          'riskBand',
          'estimatedExposure',
          'riskOfRepair',
          'coverageEligible',
          'coverageLimit',
          'premium',
          'conditions',
          'confidence',
          'providerMode',
        ].sort(),
      );
    }
  });
});

describe('gate 4 — providerMode is structurally required and always SIMULATED for this provider', () => {
  it('a quote object cannot be constructed (typechecked) without providerMode', () => {
    // @ts-expect-error — providerMode is a required field on UnderwritingQuote.
    const incomplete: UnderwritingQuote = {
      riskBand: 'LOW',
      estimatedExposure: 1,
      riskOfRepair: 'LOW',
      coverageEligible: true,
      coverageLimit: 1,
      premium: 1,
      conditions: [],
      confidence: 1,
    };
    expect(incomplete).toBeDefined();
  });

  it('every quote this provider ever returns has providerMode === "SIMULATED"', async () => {
    const provider = new SimulatedUnderwritingProvider();
    for (const verdict of ['ACCEPTABLE', 'UNACCEPTABLE', 'UNRESOLVED'] as const) {
      const quote = await provider.quoteForVerdict(verdict);
      expect(quote.providerMode).toBe('SIMULATED');
    }
    expect(provider.mode).toBe('SIMULATED');
  });

  it('createUnderwritingProvider() — the one construction point — always resolves the simulated provider today', () => {
    const provider = createUnderwritingProvider();
    expect(provider.mode).toBe('SIMULATED');
    expect(provider).toBeInstanceOf(SimulatedUnderwritingProvider);
  });
});

describe('fail-closed on an unrecognised verdict', () => {
  it('throws rather than guessing a quote for a value outside the three-valued disposition', async () => {
    const provider = new SimulatedUnderwritingProvider();
    await expect(provider.quoteForVerdict('SOMETHING_ELSE' as any)).rejects.toThrow(/unrecognised verdict/);
  });
});
