/**
 * SimulatedUnderwritingProvider — the FIRST, and today ONLY,
 * `UnderwritingProvider` implementation (see `underwritingProviderTypes.ts`).
 *
 * Deterministic lookup table keyed ONLY on the Vela-disclosed coarse verdict
 * — per the operator's own ruling: "make the underwriting logic deterministic
 * and intentionally simple. The goal is not actuarial sophistication yet; it
 * is to prove the full constitutional loop and the separation of concerns."
 *
 *   ACCEPTABLE  -> low risk band, coverage eligible, a fixed/deterministic
 *                  premium + coverageLimit, no conditions.
 *   UNACCEPTABLE -> high risk band, NOT eligible, conditions explaining why,
 *                  zero premium/coverageLimit.
 *   UNRESOLVED  -> unknown band, NOT eligible, confidence 0, zero
 *                  premium/coverageLimit, null estimatedExposure (no honest
 *                  number can be stated — CLAUDE.md No-Guessing rule).
 *
 * The numeric placeholders below are named, simulated constants — never
 * actuarial figures, never derived from any real financial input (this
 * module structurally cannot see one; see `underwritingProviderTypes.ts`'s
 * header). Mirrors the "named tunables, not magic numbers" discipline
 * `services/financialServices/riskEnvelope.ts` already establishes elsewhere
 * in this codebase (a different, unrelated module — reused only as a naming
 * convention, never imported from).
 *
 * `providerMode` is stamped `'SIMULATED'` unconditionally by this class —
 * never read from anywhere else, never overridable by a caller — so gate 4
 * ("premium/coverage output is clearly marked SIMULATED unless a real
 * provider is integrated") holds for every quote this implementation ever
 * produces, structurally, not by convention.
 *
 * Server-side only.
 */

import type { ConfidentialProjectionDisposition } from '@/types/confidentialProjection';
import type {
  UnderwritingProvider,
  UnderwritingProviderMode,
  UnderwritingQuote,
} from './underwritingProviderTypes';

// ── Named simulated constants (never actuarial — see this file's header) ──

const SIMULATED_ACCEPTABLE_EXPOSURE = 500;
const SIMULATED_ACCEPTABLE_COVERAGE_LIMIT = 5_000;
const SIMULATED_ACCEPTABLE_PREMIUM = 50;
const SIMULATED_ACCEPTABLE_CONFIDENCE = 0.75;

const SIMULATED_UNACCEPTABLE_EXPOSURE = 5_000;
const SIMULATED_UNACCEPTABLE_CONFIDENCE = 0.75;

const UNACCEPTABLE_CONDITION =
  'Joint risk calculation resolved UNACCEPTABLE — this application exceeds the ' +
  'acceptable combined exposure; coverage is not offered under this simulated policy.';

const UNRESOLVED_CONDITION =
  'The underlying confidential joint computation resolved UNRESOLVED — cannot safely ' +
  'quote; coverage is not offered until the joint verdict resolves to ACCEPTABLE or ' +
  'UNACCEPTABLE.';

/** One complete, immutable quote per possible verdict — a Record so `Object.keys`
 *  and exhaustiveness are structurally guaranteed by TypeScript (a verdict not
 *  covered here fails to compile, rather than silently falling through). */
const SIMULATED_QUOTE_TABLE: Record<ConfidentialProjectionDisposition, Omit<UnderwritingQuote, 'providerMode'>> = {
  ACCEPTABLE: {
    riskBand: 'LOW',
    estimatedExposure: SIMULATED_ACCEPTABLE_EXPOSURE,
    riskOfRepair: 'LOW',
    coverageEligible: true,
    coverageLimit: SIMULATED_ACCEPTABLE_COVERAGE_LIMIT,
    premium: SIMULATED_ACCEPTABLE_PREMIUM,
    conditions: [],
    confidence: SIMULATED_ACCEPTABLE_CONFIDENCE,
  },
  UNACCEPTABLE: {
    riskBand: 'HIGH',
    estimatedExposure: SIMULATED_UNACCEPTABLE_EXPOSURE,
    riskOfRepair: 'HIGH',
    coverageEligible: false,
    coverageLimit: 0,
    premium: 0,
    conditions: [UNACCEPTABLE_CONDITION],
    confidence: SIMULATED_UNACCEPTABLE_CONFIDENCE,
  },
  UNRESOLVED: {
    riskBand: 'UNKNOWN',
    estimatedExposure: null,
    riskOfRepair: 'UNKNOWN',
    coverageEligible: false,
    coverageLimit: 0,
    premium: 0,
    conditions: [UNRESOLVED_CONDITION],
    confidence: 0,
  },
};

export class SimulatedUnderwritingProvider implements UnderwritingProvider {
  readonly mode: UnderwritingProviderMode = 'SIMULATED';
  /** Named constant identifying this deterministic formula generation — see
   *  `UnderwritingProvider.policyVersion`'s own doc comment. */
  readonly policyVersion = 'vela-use-case-zero-underwriting-simulated-v1';

  /**
   * `async` to match the `UnderwritingProvider` interface contract (a future
   * LIVE provider will genuinely await a network call) even though this
   * implementation's own lookup is synchronous. Arity 1, parameter type
   * `ConfidentialProjectionDisposition` — see `underwritingProviderTypes.ts`'s
   * header for why that alone is the gate-1 structural proof.
   */
  async quoteForVerdict(verdict: ConfidentialProjectionDisposition): Promise<UnderwritingQuote> {
    const base = SIMULATED_QUOTE_TABLE[verdict];
    if (!base) {
      // Fails closed on an unrecognised verdict string rather than guessing —
      // mirrors `parseConfidentialVerdict`'s own fail-closed discipline
      // (services/vela/velaProjectionProvider.ts), applied here to a value
      // this function trusts came from that same fail-closed decoder.
      throw new Error(`SimulatedUnderwritingProvider.quoteForVerdict: unrecognised verdict "${String(verdict)}".`);
    }
    return { ...base, providerMode: 'SIMULATED' };
  }
}

/**
 * The ONE construction point — mirrors
 * `services/financialServices/providers/bankr/bankrProviderAdapter.ts`'s
 * `createBankrProviderAdapter` shape exactly (operator's explicit
 * instruction to mirror the Bankr pattern). Unlike Bankr's factory, this one
 * has no live-vs-fake branch to make: NO `LIVE` `UnderwritingProvider`
 * implementation exists anywhere in this codebase today, so there is nothing
 * to gate on env vars or a live-mode flag — building that gate now, for a
 * provider that does not exist, would be exactly the "speculative feature"
 * CLAUDE.md's Change Sizing section forbids. When a real insurer/reinsurer
 * integration is built, THIS is the one place a live-vs-simulated decision
 * would be added (mirroring `isBankrConfigured(...) && config.liveModeEnabled`)
 * — every caller of `createUnderwritingProvider()` would need no change.
 */
export function createUnderwritingProvider(): UnderwritingProvider {
  return new SimulatedUnderwritingProvider();
}
