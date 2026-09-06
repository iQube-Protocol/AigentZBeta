/**
 * MoneyPenny left-pane -> Factor/Aegis specialist delegation (Candidate
 * Intake workspace upgrade, 2026-09-05, requirement 3: "allow MoneyPenny to
 * delegate a question to Factor or Aegis; render the attributed specialist
 * reply in the left-pane conversation").
 *
 * A sibling to services/smarttriad/mediaProviders.ts's provider abstraction,
 * NOT a fork of it: that system resolves MEDIA (validated rich blocks,
 * never model-authored); this one resolves a SPECIALIST CONSULT (plain,
 * attributed text), so it deliberately does not force itself through
 * SmartTriadMediaProvider's `blocks`-shaped contract or its media-specific
 * "nothing published yet" fallback (which would be a category error for a
 * consult that isn't about published content at all).
 *
 * Reuses `askSpecialist()` from services/agents/specialistRouter.ts —
 * the SAME specialist-consult engine app/api/assistant/ask-agent/route.ts
 * calls — never a second LLM-calling path. This module only decides WHEN
 * to call it (deterministic trigger, evaluated BEFORE the LLM ever runs,
 * mirroring the media-provider precedent) and how to attribute the reply
 * in MoneyPenny's own conversation.
 *
 * Never a domain mutation: the resulting SpecialistContext.userPrompt is
 * built from the SAME advisory framing services/agents/specialistRouter.ts
 * already encodes for factor/aegis (Factor cannot assess/admit; Aegis
 * cannot self-assess/decide admission), and the reply is always rendered
 * attributed and clearly advisory — never as a stand-in for the real
 * domain actions this Candidate Case workspace exposes via the actual
 * Factor/Aegis/MoneyPenny REST endpoints.
 */

import { askSpecialist, type SpecialistId } from '@/services/agents/specialistRouter';

export interface CandidateCaseGroundContext {
  caseId: string;
  candidateDisplayName: string;
  state: string;
  currentAegisDecision: string | null;
}

// Requires "Aigent Factor" or "ask/Ask Factor" — a proper-noun mention,
// capital "F" required on "Factor" — rather than the bare word "factor",
// which previously false-positived on ordinary phrases like "risk factor"
// (Factor cognitive-runtime fix, 2026-09-05).
const FACTOR_TRIGGER = /\b(?:Aigent Factor|[Aa]sk Factor)\b/;
const AEGIS_TRIGGER = /\baegis\b/i;
const REQUEST_VERB = /(ask|check|consult|what does|what would|tell me|status|say about)/i;

/** The exact deterministic prompts the Candidate Intake workspace's
 *  "Ask Factor about this case" / "Ask Aegis about this case" quick prompts
 *  send — kept as exact strings for repeatable testing, mirroring
 *  MONEYPENNY_LEARN_VIDEO_PROMPT's own precedent. Natural phrasing that
 *  names the specialist plus a request verb also matches (see
 *  resolveSpecialistFromMessage) — an exact-match magic phrase is not
 *  required to use this. */
export const ASK_FACTOR_ABOUT_CASE_PROMPT = 'Ask Factor about this case.';
export const ASK_AEGIS_ABOUT_CASE_PROMPT = 'Ask Aegis about this case.';

function resolveSpecialistFromMessage(message: string): SpecialistId | null {
  const trimmed = message.trim();
  if (trimmed === ASK_FACTOR_ABOUT_CASE_PROMPT) return 'factor';
  if (trimmed === ASK_AEGIS_ABOUT_CASE_PROMPT) return 'aegis';
  const mentionsFactor = FACTOR_TRIGGER.test(trimmed);
  const mentionsAegis = AEGIS_TRIGGER.test(trimmed);
  // Both or neither named -> refuse to guess which specialist is meant;
  // the operator can use a quick-prompt chip or name exactly one.
  if (mentionsFactor === mentionsAegis) return null;
  if (!REQUEST_VERB.test(trimmed)) return null;
  return mentionsFactor ? 'factor' : 'aegis';
}

function readCandidateCase(groundContext: Record<string, unknown> | undefined): CandidateCaseGroundContext | null {
  const raw = groundContext?.candidateCase;
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.caseId !== 'string' || typeof c.candidateDisplayName !== 'string' || typeof c.state !== 'string') return null;
  return {
    caseId: c.caseId,
    candidateDisplayName: c.candidateDisplayName,
    state: c.state,
    currentAegisDecision: typeof c.currentAegisDecision === 'string' ? c.currentAegisDecision : null,
  };
}

export interface SpecialistDelegationResolution {
  matched: boolean;
  specialistId?: SpecialistId;
  /** Attributed, advisory-framed reply text — includes a trailing
   *  [layout:factor|...] or [layout:aegis|...] tag (whichever specialist
   *  answered) the caller's existing inferSuggestedLayouts/stripLayoutTags
   *  pass handles exactly like every other layout tag in this codebase (no
   *  special-casing needed there). */
  response?: string;
}

/** Reads an explicit specialist target passed by a UI chip/card via ground
 *  context (`groundContext.targetSpecialistId`) — the strongest signal, on
 *  par with an explicit `targetSpecialistId` argument (kept separate so
 *  callers that already resolve the target themselves — e.g. a future
 *  Home/Plan/Markets "Ask Factor" chip — need not thread a new argument
 *  through every call site). */
function readExplicitTargetSpecialist(groundContext: Record<string, unknown> | undefined): SpecialistId | null {
  const v = groundContext?.targetSpecialistId;
  return v === 'factor' || v === 'aegis' ? v : null;
}

/**
 * The one call app/api/codex/chat/route.ts makes for this capability,
 * mirroring resolveSmartTriadMedia's own call-site shape.
 *
 * Generalized (Factor cognitive-runtime fix, 2026-09-05, requirement 6) so
 * MoneyPenny can consult Factor/Aegis from ANY MoneyPenny surface — Home,
 * Plan, Markets, Service Orchestration — not only from inside their own
 * panel with a candidate case already open:
 *   - An explicit `targetSpecialistId` (from a chip/card the operator
 *     clicked, or `groundContext.targetSpecialistId`) is honored from any
 *     MoneyPenny panel — the strongest signal.
 *   - Otherwise, the natural-language trigger ("Aigent Factor" / "ask
 *     Factor" / "aegis" + a request verb) is only recognized while already
 *     on Factor's or Aegis's own panel — the same scoping as before, so an
 *     ambient mention elsewhere in MoneyPenny does not hijack the reply.
 * A candidate case is now OPTIONAL grounding, never required — Factor/Aegis
 * can be consulted with no case open at all.
 */
export async function resolveSmartTriadSpecialistDelegation(
  message: string,
  groundContext: Record<string, unknown> | undefined,
  targetSpecialistId?: SpecialistId,
): Promise<SpecialistDelegationResolution> {
  if (groundContext?.cartridge !== 'moneypenny') return { matched: false };

  const explicitTarget = targetSpecialistId ?? readExplicitTargetSpecialist(groundContext);
  const onSpecialistPanel = groundContext?.activePanel === 'factor' || groundContext?.activePanel === 'aegis';

  const specialistId: SpecialistId | null =
    explicitTarget ?? (onSpecialistPanel ? resolveSpecialistFromMessage(message) : null);
  if (!specialistId) return { matched: false };

  const candidateCase = readCandidateCase(groundContext);
  const label = specialistId === 'factor' ? 'Aigent Factor' : 'Aegis';
  const caseLine = candidateCase
    ? `Case context (advisory only — you may not mutate it): caseId=${candidateCase.caseId}, ` +
      `candidate="${candidateCase.candidateDisplayName}", state=${candidateCase.state}, ` +
      `currentAegisDecision=${candidateCase.currentAegisDecision ?? 'none'}.\n\n`
    : '';
  const boundedContext = `${caseLine}Operator's question, asked through MoneyPenny: ${message.trim()}`;

  const result = await askSpecialist({
    specialistId,
    context: {
      activeCartridge: 'moneypenny',
      experienceName: null,
      experienceType: candidateCase ? 'candidate_case' : 'venture_building',
      primaryGoal: null,
      currentStage: candidateCase?.state ?? 'general',
      activeCartridges: ['moneypenny'],
      intentName: candidateCase ? 'candidate_case_consult' : 'general_consult',
      intentRationale: null,
      userPrompt: boundedContext,
    },
  });

  const recs = result.recommendations.length > 0 ? `\n\n${result.recommendations.map((r) => `- ${r}`).join('\n')}` : '';
  const scopedLabel = candidateCase ? `${label}** (advisory, case "${candidateCase.candidateDisplayName}")` : `${label}** (advisory)`;
  // The affordance line — server-derived (Factor only; Aegis carries none) so
  // this THIRD delegation consumer never independently asserts "advisory
  // only" for a response the server itself marked ACTION_AVAILABLE/BLOCKED
  // (the same hardcoded-badge-vs-real-affordance contradiction Phase 1
  // closed in SpecialistWorkspace.tsx, 2026-09-05). Aegis, and any Factor
  // response with no affordance, keep the original generic wording.
  const affordanceNote =
    result.affordance === 'ACTION_AVAILABLE'
      ? '_This is actionable — approval may still be required before it executes._'
      : result.affordance === 'PREPARABLE'
        ? '_Some of this is real and reachable; the rest is not yet wired end-to-end._'
        : result.affordance === 'BLOCKED'
          ? `_Blocked: ${(result.blockers ?? []).join(' ') || 'a prerequisite is unmet.'}_`
          : '_Advisory guidance only — never a case mutation._';
  const closing = candidateCase
    ? `${affordanceNote} Open the case to take a real action. [layout:${specialistId}|Review the ${candidateCase.candidateDisplayName} case]`
    : `${affordanceNote} [layout:${specialistId}|Open ${label}]`;
  const response = `**${scopedLabel}: ${result.summary}${recs}\n\n${closing}`;

  return { matched: true, specialistId, response };
}
