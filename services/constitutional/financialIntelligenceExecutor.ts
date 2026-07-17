/**
 * financialIntelligenceExecutor — the Domain 3 (Financial Intelligence)
 * read-only capability executor (CRP-003a Increment 2; CRP-003 §4).
 *
 * Domain 3 is deliberately FIRST (CRP-003a §5 consequence ordering): it is
 * intelligence, not fund movement — no settlement, no enforced spend cap (P3),
 * no money at risk. That makes it the safe surface to run the full canonical
 * service pattern end-to-end while the pipeline is in shadow.
 *
 * SCOPE (N2b): the executor is now INVARIANT-GROUNDED. Given a grounding
 * function (the engine's Reasoning face, `groundReasoning`, injected by the
 * pipeline), it retrieves the constitutional invariants relevant to the intent
 * and shapes them into the result's sources (F-201) + evidence refs (F-202),
 * with confidence calibrated to the evidence count (F-203). Grounding is
 * deterministic (no LLM/provider call) — a live LLM ANALYSIS layer on top of the
 * grounded evidence is the remaining follow-on. When no grounding fn is supplied
 * (or it returns nothing) the result is honestly empty and FAILS F-201/F-202 at
 * Verification — never a fabricated pass.
 *
 * The grounding fn is INJECTED so the executor stays node-testable without
 * Supabase; the pipeline's default deps wire the real `groundReasoning`.
 */

export type IntelligenceConfidence = 'low' | 'medium' | 'high';

/** Injected grounding — returns the invariants relevant to the request.
 *  The pipeline default wires this to the engine's `groundReasoning`. */
export type GroundingFn = (namespaces: string[], limit: number) => Promise<{ id: string; statement: string }[]>;

/** Namespaces the financial-intelligence executor grounds in. No `finance`
 *  namespace is seeded yet (CRP-003's candidate invariants are unseeded), so it
 *  grounds in the constitutional / epistemology / engineering evidence base. */
export const FINANCIAL_GROUNDING_NAMESPACES = ['constitutional', 'epistemology', 'engineering'];

export interface FinancialIntelligenceRequest {
  intent: string;
  /** Governing invariants carried by the agreement (F-201..F-203, CFI-*). */
  governingInvariants: string[];
}

export interface FinancialIntelligenceResult {
  summary: string;
  /** F-201 Source Diversity — independent evidence sources. */
  sources: string[];
  /** F-202 Evidence Attribution — traceable evidence refs (invariant ids). */
  evidenceRefs: string[];
  /** F-203 Confidence Calibration — reflects evidence quality, not model certainty. */
  confidence: IntelligenceConfidence;
  /** Whether grounding produced evidence (false = un-grounded, fails verification). */
  live: boolean;
}

/** The Domain-3 read-only executor. Invariant-grounded via the injected `ground`
 *  fn; async I/O only through that fn (testable with a stub). */
export async function runFinancialIntelligence(
  req: FinancialIntelligenceRequest,
  ground?: GroundingFn,
): Promise<FinancialIntelligenceResult> {
  const intent = req.intent.trim().slice(0, 400);
  let items: { id: string; statement: string }[] = [];
  if (ground) {
    try {
      items = await ground(FINANCIAL_GROUNDING_NAMESPACES, 6);
    } catch {
      items = [];
    }
  }
  const sources = items.map((i) => i.statement).filter(Boolean).slice(0, 6);
  const evidenceRefs = items.map((i) => i.id).filter(Boolean).slice(0, 6);
  const confidence: IntelligenceConfidence = evidenceRefs.length >= 3 ? 'high' : evidenceRefs.length >= 1 ? 'medium' : 'low';
  return {
    summary:
      `Financial-intelligence brief for: "${intent}". ` +
      (evidenceRefs.length > 0
        ? `Grounded in ${evidenceRefs.length} constitutional invariant(s); a live LLM analysis layer over this evidence is the remaining follow-on.`
        : `No grounding available — un-grounded (fails F-201/F-202). No fund movement (Domain 3, read-only).`),
    sources,
    evidenceRefs,
    confidence,
    live: evidenceRefs.length > 0,
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
