/**
 * Grounded-consultation adapter (Candidate Intake workspace upgrade,
 * 2026-09-05 requirement 7; extended, 2026-09-05, for the Factor/Aegis
 * specialist-surfaces separation).
 *
 * Wraps the SAME, unchanged /api/assistant/ask-agent path every generic
 * specialist consult already uses — never a second consult endpoint, never
 * a fork of askSpecialist/specialistRouter.ts. This module's ONLY job is
 * (1) prefixing the operator's free-text question with a bounded,
 * clearly-labeled context block before it reaches the specialist, and
 * (2) returning a result the calling panel renders as unambiguously
 * ADVISORY — distinct from a panel's real domain actions, which call the
 * actual Factor/Aegis/MoneyPenny REST endpoints directly and never go
 * through this adapter.
 *
 * `askGroundedSpecialist` is the one generic primitive (any specialist, any
 * pre-built context block); `askCaseContextSpecialist` (Factor/Aegis case
 * consult) and `askAssessmentContextSpecialist` (Aegis assessment consult)
 * are thin, typed wrappers over it — extending, not duplicating, the single
 * fetch/error-handling path.
 *
 * Factor/Aegis's constitutional framing ("Factor cannot assess or admit";
 * "Aegis cannot self-assess or decide admission") is already encoded in
 * services/agents/specialistRouter.ts's system prompt / template responses
 * for these two specialists — this adapter does not re-derive or duplicate
 * that, it only adds the bounded identity so the specialist's advice is
 * actually grounded in the case/assessment at hand rather than generic.
 */

import { personaFetch } from '@/utils/personaSpine';
import type { SpecialistResponseData } from '@/components/metame/cards/SpecialistResponseCard';

export interface GroundedConsultResult {
  data: SpecialistResponseData | null;
  error: string | null;
}

/**
 * Calls the canonical /api/assistant/ask-agent route via personaFetch
 * (CLAUDE.md PARAMOUNT — never a raw fetch against a spine endpoint), with
 * the operator's prompt prefixed by a caller-supplied bounded context block.
 * Never mutates any domain state — it is the same generic advisory path
 * every other specialist consult in this codebase uses.
 */
export async function askGroundedSpecialist(
  specialistId: string,
  basePrompt: string,
  contextBlock: string,
): Promise<GroundedConsultResult> {
  try {
    const res = await personaFetch('/api/assistant/ask-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specialistId,
        prompt: `${contextBlock}\n\n${basePrompt.trim()}`,
        cartridge: 'moneypenny',
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = json && typeof json === 'object' && typeof (json as { error?: unknown }).error === 'string' ? (json as { error: string }).error : null;
      return { data: null, error: detail ?? `Consult failed (${res.status}).` };
    }
    return { data: json as SpecialistResponseData, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Factor/Aegis case-grounded consult (unchanged shape from the 2026-09-05
// Candidate Intake workspace upgrade).
// ─────────────────────────────────────────────────────────────────────────

export interface CaseConsultationContext {
  caseId: string;
  candidateDisplayName: string;
  state: string;
  currentAssessmentId: string | null;
  currentAegisDecision: string | null;
}

/** Exported for tests — the exact bounded text sent as the specialist
 *  prompt, never the raw operator text alone. */
export function buildCaseContextPrompt(basePrompt: string, ctx: CaseConsultationContext): string {
  return (
    'Case context (advisory only — this consult cannot mutate the case): ' +
    `caseId=${ctx.caseId}, candidate="${ctx.candidateDisplayName}", state=${ctx.state}, ` +
    `currentAssessmentId=${ctx.currentAssessmentId ?? 'none'}, currentAegisDecision=${ctx.currentAegisDecision ?? 'none'}.\n\n` +
    basePrompt.trim()
  );
}

export type CaseContextConsultResult = GroundedConsultResult;

export async function askCaseContextSpecialist(
  specialistId: 'factor' | 'aegis',
  basePrompt: string,
  ctx: CaseConsultationContext,
): Promise<CaseContextConsultResult> {
  // buildCaseContextPrompt already includes the "advisory only" preface and
  // a trailing blank line before basePrompt — askGroundedSpecialist would
  // add a SECOND blank line if given the same basePrompt twice, so build
  // the full prompt here and pass it through as both context and prompt is
  // avoided by inlining the exact prior behavior directly.
  const contextLine =
    'Case context (advisory only — this consult cannot mutate the case): ' +
    `caseId=${ctx.caseId}, candidate="${ctx.candidateDisplayName}", state=${ctx.state}, ` +
    `currentAssessmentId=${ctx.currentAssessmentId ?? 'none'}, currentAegisDecision=${ctx.currentAegisDecision ?? 'none'}.`;
  return askGroundedSpecialist(specialistId, basePrompt, contextLine);
}

// ─────────────────────────────────────────────────────────────────────────
// Aegis assessment-grounded consult (Factor/Aegis specialist-surfaces
// separation, 2026-09-05) — same shape, a different bounded subject: an
// Aegis assessment may exist without any Factor case at all (a direct
// external-subject assessment), so this context never assumes a caseId.
// ─────────────────────────────────────────────────────────────────────────

export interface AssessmentConsultationContext {
  assessmentId: string;
  subjectType: 'factor_case' | 'agent';
  subjectRef: string;
  state: string;
  decision: string | null;
  caseId: string | null;
}

export function buildAssessmentContextPrompt(basePrompt: string, ctx: AssessmentConsultationContext): string {
  return (
    'Assessment context (advisory only — this consult cannot mutate the assessment): ' +
    `assessmentId=${ctx.assessmentId}, subjectType=${ctx.subjectType}, subjectRef=${ctx.subjectRef}, ` +
    `state=${ctx.state}, decision=${ctx.decision ?? 'none'}, caseId=${ctx.caseId ?? 'none'}.\n\n` +
    basePrompt.trim()
  );
}

export async function askAssessmentContextSpecialist(
  basePrompt: string,
  ctx: AssessmentConsultationContext,
): Promise<GroundedConsultResult> {
  const contextLine =
    'Assessment context (advisory only — this consult cannot mutate the assessment): ' +
    `assessmentId=${ctx.assessmentId}, subjectType=${ctx.subjectType}, subjectRef=${ctx.subjectRef}, ` +
    `state=${ctx.state}, decision=${ctx.decision ?? 'none'}, caseId=${ctx.caseId ?? 'none'}.`;
  return askGroundedSpecialist('aegis', basePrompt, contextLine);
}
