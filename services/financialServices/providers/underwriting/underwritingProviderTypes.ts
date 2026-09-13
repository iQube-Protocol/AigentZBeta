/**
 * Underwriting quote provider — the pluggable seam (Use Case Zero vertical
 * slice, 2026-09-13, operator ruling verbatim: "Keep the pricing/underwriting
 * formula in a replaceable module. The first vertical slice can use a simple
 * deterministic rule engine; later, an insurer/reinsurer or actuarial partner
 * can replace that module without changing the MoneyPenny/Vela orchestration
 * contract.").
 *
 * MIRRORS `services/financialServices/providers/bankr/` EXACTLY (operator's
 * explicit instruction) — a documented interface
 * (`UnderwritingProvider`, this file) + one concrete implementation today
 * (`simulatedUnderwritingProvider.ts`) + a construction point
 * (`createUnderwritingProvider`, in that same file, mirroring
 * `createBankrProviderAdapter`'s shape) that a future LIVE provider (a real
 * insurer/reinsurer integration) can slot in behind without any orchestration
 * caller changing. NO live provider exists yet — see that file's own header
 * for why no factory gating logic is built for a provider that does not
 * exist (CLAUDE.md "Change Sizing": no speculative features).
 *
 * THE CONSTITUTIONAL PROPERTY THIS INTERFACE ENFORCES STRUCTURALLY (gate 1,
 * 2026-09-13 acceptance gates): `quoteForVerdict`'s ONLY parameter is
 * `ConfidentialProjectionDisposition` — a three-value string union
 * ('ACCEPTABLE' | 'UNACCEPTABLE' | 'UNRESOLVED', types/confidentialProjection.ts).
 * This is not a convention this module merely documents — it is a structural
 * fact about the function's own type signature: there is nowhere in this
 * interface for a party's raw financial inputs (currentExposure, proposedSpend,
 * privateSpendLimit, privateRiskLimit — the `VelaProjectionInputs` shape
 * `services/vela/velaMultiPartyProjection.ts` carries) to travel through this
 * seam at all. A provider implementing this interface receives EXACTLY the
 * same three-valued verdict a human would see on a wall-mounted display —
 * nothing more, per the operator's own framing of what keeps "risk inputs
 * remain private" trivially true here.
 *
 * Server-side only. Never imported by client code.
 */

import type { ConfidentialProjectionDisposition } from '@/types/confidentialProjection';

/** Which side computed this quote. `LIVE` has no implementation yet — no
 *  provider in this codebase may ever return it (enforced by
 *  `SimulatedUnderwritingProvider` always returning `'SIMULATED'`, and by
 *  there being no other implementation to return anything else). */
export type UnderwritingProviderMode = 'SIMULATED' | 'LIVE';

/**
 * Coarse, deterministic risk classification — the underwriting-domain analog
 * of `ConfidentialProjectionDisposition`'s own three-way coarseness. Kept to
 * exactly the three bands the first, deterministic provider actually produces
 * (one per possible verdict) — no speculative finer-grained bands reserved
 * for a hypothetical future provider (CLAUDE.md "Change Sizing").
 */
export type UnderwritingRiskBand = 'LOW' | 'HIGH' | 'UNKNOWN';

/**
 * The underwriting quote shape — EXACTLY the nine fields the operator's
 * ruling specified, verbatim, in this order. `providerMode` is REQUIRED
 * (never optional) so a quote object can never exist without disclosing
 * whether it is simulated or live (gate 4: "clearly marked SIMULATED unless a
 * real provider is integrated" — enforced here as "cannot be constructed
 * without the field", not merely "usually set").
 */
export interface UnderwritingQuote {
  riskBand: UnderwritingRiskBand;
  /** A fixed, deterministic simulated placeholder tied to `riskBand` — NOT an
   *  actuarial estimate. `null` only for `UNKNOWN` (the UNRESOLVED case),
   *  where no honest number can be stated (CLAUDE.md No-Guessing rule: absence
   *  of information is reported as `null`, never defaulted to 0 or a
   *  plausible-looking figure). */
  estimatedExposure: number | null;
  /** A second, more specific risk-band read (distinct from the overall
   *  `riskBand`) — in this first, deliberately simple provider it mirrors
   *  `riskBand` 1:1, because the ONLY signal available is the same coarse
   *  verdict; a future, richer provider could legitimately diverge the two
   *  (e.g. an overall band driven by exposure vs. a repair-specific band
   *  driven by asset condition data this provider structurally cannot see). */
  riskOfRepair: UnderwritingRiskBand;
  coverageEligible: boolean;
  /** 0 whenever `coverageEligible` is false. */
  coverageLimit: number;
  /** 0 whenever `coverageEligible` is false. */
  premium: number;
  /** Human-readable reasons a quote was refused/limited — empty when none. */
  conditions: string[];
  /** 0 to 1. Exactly 0 for `UNRESOLVED` (operator's own explicit instruction:
   *  "UNRESOLVED → unknown band + not eligible + confidence 0"). */
  confidence: number;
  /** Explicit, required, structurally unmissable — see this file's header. */
  providerMode: UnderwritingProviderMode;
}

/**
 * The ONE seam MoneyPenny/Vela orchestration
 * (`services/vela/velaUnderwritingProjection.ts`) depends on — mirrors
 * `services/financialServices/providers/bankr/bankrTypes.ts`'s own
 * `BankrTransport`-style "one seam, live provider later" shape. Orchestration
 * code never branches on simulated-vs-live; it calls `quoteForVerdict` and
 * the configured provider decides.
 */
export interface UnderwritingProvider {
  readonly mode: UnderwritingProviderMode;
  /**
   * A version identifier for the pricing/policy formula this PROVIDER
   * implements — a property of the provider itself (which formula/model
   * generation is running), not of each individual quote it produces. Bound
   * verbatim onto downstream telemetry's `provenance.policyVersion` (see
   * `services/vela/velaUnderwritingRiskTelemetry.ts`) so a later change to
   * the underlying formula is distinguishable in evidence without touching
   * `UnderwritingQuote`'s own nine operator-specified fields.
   */
  readonly policyVersion: string;
  /**
   * The ONLY input is the Vela-disclosed coarse verdict — see this file's
   * header for why that is a structural, not merely documented, property.
   * Never throws on a well-formed `ConfidentialProjectionDisposition`; a
   * provider implementation MUST resolve every one of the three values to a
   * complete `UnderwritingQuote` (never partial, never a subset of fields).
   */
  quoteForVerdict(verdict: ConfidentialProjectionDisposition): Promise<UnderwritingQuote>;
}
