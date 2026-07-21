/**
 * constitutionalDecision — the Constitutional Decision stage (operator
 * direction 2026-07-13, CFS-029): BEFORE an Implementation Pack is drafted,
 * the pipeline explicitly decides HOW a capability should be realized —
 * over the nine implementation mechanisms plus the tenth answer, `none`:
 * the capability already exists and the correct realization is composition,
 * not construction.
 *
 * "Here's what constitutional capability should emerge", not "here's what
 * to build": code is one mechanism among nine, and sometimes the decision
 * is that NO build is required. The decision is evidence-informed — it reads
 * the persisted Capability Evidence (existing capabilities with reuse
 * dispositions, genuinely missing ones, hard boundaries) — and it is
 * recorded ON the pack (`constitutionalDecision`) so the choice, its
 * rationale, and the alternatives weighed are auditable, never implicit.
 *
 * Two-tier resolution (the pack generator's own pattern):
 *   1. LLM decision through the constitutional router (`callStage
 *      'capability'`) — full mechanism vocabulary + evidence in the prompt.
 *   2. Deterministic heuristic fallback (`heuristicDecision`, pure +
 *      canary-pinned) — never fabricates: with no evidence it defaults to
 *      'code' and says so.
 */

import { callStage } from '@/services/constitutional/modelRouter';
import { parseJsonLenient } from '@/services/experiments/llm';
import {
  IMPLEMENTATION_MECHANISMS,
  type ImplementationMechanism,
  type CapabilityEvidence,
  capabilityEvidenceBlock,
} from '@/services/constitutional/capabilityEvidence';

/** The decision vocabulary: the nine mechanisms + 'none' (capability exists). */
export type RealizationMechanism = ImplementationMechanism | 'none';

export interface ConstitutionalDecision {
  mechanism: RealizationMechanism;
  /** True when the capability already exists — compose it, build nothing. */
  noBuildRequired: boolean;
  rationale: string;
  /** Mechanisms weighed and set aside, with the reason each lost. */
  alternatives: { mechanism: RealizationMechanism; reason: string }[];
  decidedBy: 'llm' | 'heuristic';
}

export function isRealizationMechanism(v: unknown): v is RealizationMechanism {
  return v === 'none' || (typeof v === 'string' && (IMPLEMENTATION_MECHANISMS as readonly string[]).includes(v));
}

/**
 * Deterministic decision floor — PURE, canary-pinned, never fabricates:
 *   - every needed capability exists `use_directly` and nothing is missing
 *     → 'none' (compose, build nothing)
 *   - capabilities exist but ≥1 needs extension, or missing items point at
 *     code locations → 'code'
 *   - no evidence → 'code' with the honest default rationale.
 */
export function heuristicDecision(evidence?: CapabilityEvidence): ConstitutionalDecision {
  const existing = evidence?.existing ?? [];
  const missing = evidence?.missing ?? [];
  if (existing.length > 0 && missing.length === 0) {
    const allDirect = existing.every((e) => (e.disposition ?? '') === 'use_directly');
    if (allDirect) {
      return {
        mechanism: 'none',
        noBuildRequired: true,
        rationale:
          'every capability the goal needs already exists with a use_directly disposition — the constitutional realization is composition, not construction',
        alternatives: [{ mechanism: 'code', reason: 'building would duplicate existing capability (constitutional drift)' }],
        decidedBy: 'heuristic',
      };
    }
    return {
      mechanism: 'code',
      noBuildRequired: false,
      rationale: 'existing capabilities cover the goal but at least one carries an extend/wrap/adapt disposition — a code delta on the named targets',
      alternatives: [{ mechanism: 'none', reason: 'not all needed capability is directly usable as-is' }],
      decidedBy: 'heuristic',
    };
  }
  if (missing.length > 0) {
    return {
      mechanism: 'code',
      noBuildRequired: false,
      rationale: `the evidence names ${missing.length} genuinely missing capabilit${missing.length === 1 ? 'y' : 'ies'} with suggested locations — new construction at the session-named paths`,
      alternatives: [{ mechanism: 'none', reason: 'the gap analysis found real gaps' }],
      decidedBy: 'heuristic',
    };
  }
  return {
    mechanism: 'code',
    noBuildRequired: false,
    rationale: 'no capability evidence available — defaulting to code pending richer constitutional grounding (honest default, not a judgement)',
    alternatives: [],
    decidedBy: 'heuristic',
  };
}

const DECISION_SYSTEM = `You are the Constitutional Decision stage of a Constitutional Capability Pipeline.
Decide HOW a capability should be realized BEFORE any implementation plan is drafted.
The vocabulary (choose exactly one "mechanism"):
- none — the capability ALREADY EXISTS; the correct realization is composing existing assets. Choose this whenever the evidence shows the goal is coverable without new construction. Duplicating existing capability is constitutional drift — a defect.
- ${IMPLEMENTATION_MECHANISMS.join(' | ')} — the nine construction mechanisms; code is only one of them. Prefer the lightest mechanism that genuinely realizes the capability (configuration over code, registry over configuration where the registry already models the concept, documentation/knowledge when the gap is understanding, policy when the gap is governance).
Respond with STRICT JSON: {"mechanism": string, "rationale": string, "alternatives": [{"mechanism": string, "reason": string}]} — 1-2 sentence rationale; 1-3 alternatives you weighed. Never invent capabilities not present in the evidence.`;

/**
 * Decide the realization mechanism — LLM through the constitutional router,
 * heuristic floor on any failure. Never throws.
 */
export async function decideRealizationMechanism(
  goal: string,
  evidence?: CapabilityEvidence,
): Promise<ConstitutionalDecision> {
  const fallback = heuristicDecision(evidence);
  try {
    const evidenceLines = capabilityEvidenceBlock(evidence);
    const user = [
      `Capability goal:\n${goal}`,
      evidenceLines.length ? evidenceLines.join('\n') : 'No capability evidence is available for this goal.',
      'Decide the realization mechanism now.',
    ].join('\n\n');
    const routed = await callStage('capability', DECISION_SYSTEM, user, 400);
    const draft = parseJsonLenient<{
      mechanism?: unknown;
      rationale?: unknown;
      alternatives?: unknown;
    }>(routed.text);
    if (!isRealizationMechanism(draft.mechanism)) return fallback;
    const alternatives = Array.isArray(draft.alternatives)
      ? draft.alternatives
          .filter(
            (a): a is { mechanism: string; reason: string } =>
              !!a && typeof a === 'object' && isRealizationMechanism((a as Record<string, unknown>).mechanism) &&
              typeof (a as Record<string, unknown>).reason === 'string',
          )
          .slice(0, 3)
          .map((a) => ({ mechanism: a.mechanism as RealizationMechanism, reason: a.reason }))
      : [];
    return {
      mechanism: draft.mechanism,
      noBuildRequired: draft.mechanism === 'none',
      rationale: typeof draft.rationale === 'string' && draft.rationale.trim() ? draft.rationale.trim() : fallback.rationale,
      alternatives,
      decidedBy: 'llm',
    };
  } catch {
    return fallback;
  }
}
