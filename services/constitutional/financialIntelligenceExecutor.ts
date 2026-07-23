/**
 * financialIntelligenceExecutor — the Financial Services capability executors
 * (CRP-003a; CRP-003 §2–4). Domain-parameterised over the three capability
 * domains, each with its own candidate invariants:
 *
 *   - intelligence (Domain 3) — F-201 Source Diversity · F-202 Evidence
 *     Attribution · F-203 Confidence Calibration. Read-only.
 *   - investment  (Domain 1) — F-001 Verifiable State Before Action · F-002
 *     Explainable Allocation · F-003 Delegation Boundaries. Recommendation-only.
 *   - market      (Domain 2) — F-101 Separation of Advice & Execution · F-102
 *     Standing-Weighted Selection · F-103 Verification Before Standing.
 *     Orchestration/advice — never fund movement (F-003/F-101).
 *
 * All executors are ADVICE/INTELLIGENCE producers: they recommend, they do not
 * move funds (CRP-003 F-003 "agents may recommend but cannot execute beyond
 * delegated authority"). Fund movement is the SETTLEMENT step (settlementExecutor),
 * gated by the P3 spend cap — never the executor.
 *
 * Two layers, both INJECTED so the executor stays node-testable without
 * Supabase/LLM:
 *   1. grounding (deterministic) — the engine's Reasoning face (`groundReasoning`)
 *      retrieves the relevant constitutional invariants → sources + evidence.
 *   2. analysis (LLM, optional) — `callSovereign('analysis', …)` reasons OVER the
 *      grounded evidence to produce the brief + a calibrated confidence. If
 *      absent/failed, the executor falls back to the grounded summary (honest —
 *      never a fabricated analysis).
 */

export type IntelligenceConfidence = 'low' | 'medium' | 'high';
export type FinancialDomain = 'intelligence' | 'investment' | 'market';

/** Injected grounding — the invariants relevant to the request. */
export type GroundingFn = (namespaces: string[], limit: number) => Promise<{ id: string; statement: string }[]>;

/** Injected analysis — LLM reasoning over the grounded evidence. Returns null
 *  when unavailable (the executor then keeps the grounded summary). */
export type AnalyzeFn = (
  intent: string,
  evidence: { id: string; statement: string }[],
  domain: FinancialDomain,
) => Promise<{ summary: string; confidence: IntelligenceConfidence } | null>;

// PRD-MPY-001 Phase 3 (P3-3) — includes `finance` (the FS Invariant Library
// derived from the QriptoCENT Corpus) so every domain (intelligence,
// investment, market) grounds step 7 execution in real financial-services
// invariants, not just the platform-general namespaces.
export const FINANCIAL_GROUNDING_NAMESPACES = ['constitutional', 'epistemology', 'engineering', 'finance'];

const DOMAIN_LABEL: Record<FinancialDomain, string> = {
  intelligence: 'Financial Intelligence',
  investment: 'Investment Operations',
  market: 'Market Operations',
};

export interface FinancialIntelligenceRequest {
  intent: string;
  governingInvariants: string[];
}

export interface FinancialIntelligenceResult {
  domain: FinancialDomain;
  summary: string;
  /** F-201/F-001 — independent evidence sources (invariant statements). */
  sources: string[];
  /** F-202/F-002 — traceable evidence refs (invariant ids). */
  evidenceRefs: string[];
  /** F-203 — confidence calibrated to evidence (LLM-refined when analysed). */
  confidence: IntelligenceConfidence;
  /** Grounding produced evidence. */
  live: boolean;
  /** The analysis layer ran (LLM reasoned over the evidence). */
  analysed: boolean;
}

/** General Domain executor — grounded, optionally analysed. Advice only. */
export async function runFinancialCapability(
  domain: FinancialDomain,
  req: FinancialIntelligenceRequest,
  ground?: GroundingFn,
  analyze?: AnalyzeFn,
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
  let confidence: IntelligenceConfidence = evidenceRefs.length >= 3 ? 'high' : evidenceRefs.length >= 1 ? 'medium' : 'low';

  let summary =
    `${DOMAIN_LABEL[domain]} brief for: "${intent}". ` +
    (evidenceRefs.length > 0
      ? `Grounded in ${evidenceRefs.length} constitutional invariant(s).`
      : `No grounding available — un-grounded (fails verification). Advice only, no fund movement.`);
  let analysed = false;

  // Analysis layer — LLM reasons over the grounded evidence (never fabricates:
  // only runs when there IS evidence, falls back to the grounded summary).
  if (analyze && items.length > 0) {
    try {
      const a = await analyze(intent, items, domain);
      if (a && a.summary.trim()) {
        summary = a.summary.trim();
        confidence = a.confidence;
        analysed = true;
      }
    } catch {
      /* keep grounded summary */
    }
  }

  return { domain, summary, sources, evidenceRefs, confidence, live: evidenceRefs.length > 0, analysed };
}

/** Domain-3 entry (back-compat). */
export async function runFinancialIntelligence(
  req: FinancialIntelligenceRequest,
  ground?: GroundingFn,
  analyze?: AnalyzeFn,
): Promise<FinancialIntelligenceResult> {
  return runFinancialCapability('intelligence', req, ground, analyze);
}

// ── Verification (canonical step 8) — per-domain, PURE ─────────────────────────

export interface VerificationRequirementResult {
  requirement: string;
  passed: boolean;
  detail: string;
}
export interface VerificationResult {
  passed: boolean;
  requirements: VerificationRequirementResult[];
}

/** Per-domain candidate-invariant checks. Evidence-backed where the result can
 *  show it; STRUCTURAL (passed-by-construction of the advice-only executor)
 *  where honesty requires saying so — the detail names which. Pure. */
export function verifyFinancialCapability(domain: FinancialDomain, result: FinancialIntelligenceResult): VerificationResult {
  const hasSources2 = result.sources.length >= 2;
  const hasEvidence = result.evidenceRefs.length >= 1;
  const calibrated = result.confidence === 'low' ? result.evidenceRefs.length === 0 : result.evidenceRefs.length > 0;

  let requirements: VerificationRequirementResult[];
  if (domain === 'investment') {
    requirements = [
      { requirement: 'F-001 Verifiable State Before Action', passed: hasEvidence, detail: `${result.evidenceRefs.length} verified evidence ref(s)` },
      { requirement: 'F-002 Explainable Allocation', passed: result.summary.trim().length > 0 && hasEvidence, detail: 'rationale + evidence present' },
      { requirement: 'F-003 Delegation Boundaries', passed: true, detail: 'structural — executor recommends only, never executes beyond authority' },
    ];
  } else if (domain === 'market') {
    requirements = [
      { requirement: 'F-101 Separation of Advice & Execution', passed: true, detail: 'structural — advice only; execution is a separately-attributable step' },
      { requirement: 'F-102 Standing-Weighted Selection', passed: hasEvidence, detail: 'evidence-grounded selection basis present' },
      { requirement: 'F-103 Verification Before Standing', passed: true, detail: 'structural — the pipeline verifies before any Standing accrual' },
    ];
  } else {
    requirements = [
      { requirement: 'F-201 Source Diversity', passed: hasSources2, detail: `${result.sources.length} source(s) (≥2 required)` },
      { requirement: 'F-202 Evidence Attribution', passed: hasEvidence, detail: `${result.evidenceRefs.length} evidence ref(s)` },
      { requirement: 'F-203 Confidence Calibration', passed: calibrated, detail: `confidence '${result.confidence}' vs evidence` },
    ];
  }
  return { passed: requirements.every((r) => r.passed), requirements };
}

/** Domain-3 verify (back-compat). */
export function verifyFinancialIntelligence(result: FinancialIntelligenceResult): VerificationResult {
  return verifyFinancialCapability('intelligence', result);
}
