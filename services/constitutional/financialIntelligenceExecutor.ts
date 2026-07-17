/**
 * financialIntelligenceExecutor — the Domain 3 (Financial Intelligence)
 * read-only capability executor (CRP-003a Increment 2; CRP-003 §4).
 *
 * Domain 3 is deliberately FIRST (CRP-003a §5 consequence ordering): it is
 * intelligence, not fund movement — no settlement, no enforced spend cap (P3),
 * no money at risk. That makes it the safe surface to run the full canonical
 * service pattern end-to-end while the pipeline is in shadow.
 *
 * HONEST SCOPE (N2): this executor is a STRUCTURED STUB. It shapes a financial-
 * intelligence result to the domain's candidate invariants — F-201 Source
 * Diversity, F-202 Evidence Attribution, F-203 Confidence Calibration (CRP-003
 * §4) — so the Verification step has real requirements to check, but it does NOT
 * yet run a live LLM/research call (that needs a provider + credits and is the
 * named follow-on). It returns `confidence: 'low'` and empty sources on purpose:
 * an un-grounded brief SHOULD fail F-201/F-202 at Verification — the pipeline
 * observing that failure in shadow is the point, not a fabricated pass.
 *
 * Pure + isomorphic: no I/O, no clock, no provider. The live executor swaps in
 * behind this same signature (Extend-don't-duplicate).
 */

export type IntelligenceConfidence = 'low' | 'medium' | 'high';

export interface FinancialIntelligenceRequest {
  intent: string;
  /** Governing invariants carried by the agreement (F-201..F-203, CFI-*). */
  governingInvariants: string[];
}

export interface FinancialIntelligenceResult {
  summary: string;
  /** F-201 Source Diversity — independent evidence sources. */
  sources: string[];
  /** F-202 Evidence Attribution — traceable evidence refs. */
  evidenceRefs: string[];
  /** F-203 Confidence Calibration — reflects evidence quality, not model certainty. */
  confidence: IntelligenceConfidence;
  /** Whether a live intelligence provider produced this (false = structured stub). */
  live: boolean;
}

/** The Domain-3 read-only executor. Pure. Structured stub in N2 (see file docs). */
export function runFinancialIntelligence(req: FinancialIntelligenceRequest): FinancialIntelligenceResult {
  const intent = req.intent.trim().slice(0, 400);
  return {
    summary:
      `Financial-intelligence brief requested: "${intent}". ` +
      `Structured-stub executor (CRP-003a N2) — a live, invariant-grounded intelligence run ` +
      `(source retrieval + analysis) is the named follow-on. No fund movement (Domain 3, read-only).`,
    sources: [],
    evidenceRefs: [],
    confidence: 'low',
    live: false,
  };
}

// ── Verification (canonical step 8) — the Domain-3 checks, PURE ────────────────

export interface VerificationRequirementResult {
  requirement: string; // e.g. 'F-201 Source Diversity'
  passed: boolean;
  detail: string;
}

export interface VerificationResult {
  passed: boolean;
  requirements: VerificationRequirementResult[];
}

/** Verify a financial-intelligence result against Domain-3's candidate invariants.
 *  Pure. In shadow a failure is OBSERVED (recorded), never a fabricated pass. */
export function verifyFinancialIntelligence(result: FinancialIntelligenceResult): VerificationResult {
  const requirements: VerificationRequirementResult[] = [
    {
      requirement: 'F-201 Source Diversity',
      passed: result.sources.length >= 2,
      detail: `${result.sources.length} independent source(s) (≥2 required)`,
    },
    {
      requirement: 'F-202 Evidence Attribution',
      passed: result.evidenceRefs.length >= 1,
      detail: `${result.evidenceRefs.length} evidence ref(s) attributed`,
    },
    {
      requirement: 'F-203 Confidence Calibration',
      passed: result.confidence === 'low' ? result.sources.length === 0 : result.sources.length > 0,
      detail: `confidence '${result.confidence}' ${result.confidence === 'low' && result.sources.length === 0 ? 'consistent with' : 'vs'} evidence`,
    },
  ];
  return { passed: requirements.every((r) => r.passed), requirements };
}
