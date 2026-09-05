/**
 * Case-context consultation adapter (Candidate Intake workspace upgrade,
 * 2026-09-05, requirement 7): "introduce or reuse a case-context
 * consultation adapter so generic advice cannot be confused with domain
 * mutations."
 *
 * Wraps the SAME, unchanged /api/assistant/ask-agent path every generic
 * specialist consult already uses — never a second consult endpoint, never
 * a fork of askSpecialist/specialistRouter.ts. This module's ONLY job is
 * (1) prefixing the operator's free-text question with a bounded,
 * clearly-labeled case-context block before it reaches the specialist, and
 * (2) returning a result CandidateIntakePanel.tsx renders as unambiguously
 * ADVISORY — distinct from the panel's real domain actions, which call the
 * actual Factor/Aegis/MoneyPenny REST endpoints directly and never go
 * through this adapter.
 *
 * Factor/Aegis's constitutional framing ("Factor cannot assess or admit";
 * "Aegis cannot self-assess or decide admission") is already encoded in
 * services/agents/specialistRouter.ts's system prompt / template responses
 * for these two specialists — this adapter does not re-derive or duplicate
 * that, it only adds the case identity so the specialist's advice is
 * actually grounded in the case at hand rather than generic.
 */

import { personaFetch } from '@/utils/personaSpine';
import type { SpecialistResponseData } from '@/components/metame/cards/SpecialistResponseCard';

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

export interface CaseContextConsultResult {
  data: SpecialistResponseData | null;
  error: string | null;
}

/**
 * Calls the canonical /api/assistant/ask-agent route via personaFetch
 * (CLAUDE.md PARAMOUNT — never a raw fetch against a spine endpoint), with
 * the operator's prompt prefixed by the bounded case-context block above.
 * Never mutates case/assessment state — it is the same generic advisory
 * path every other specialist consult in this codebase uses.
 */
export async function askCaseContextSpecialist(
  specialistId: 'factor' | 'aegis',
  basePrompt: string,
  ctx: CaseConsultationContext,
): Promise<CaseContextConsultResult> {
  try {
    const res = await personaFetch('/api/assistant/ask-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specialistId,
        prompt: buildCaseContextPrompt(basePrompt, ctx),
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
