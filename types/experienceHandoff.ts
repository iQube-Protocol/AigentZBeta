/**
 * ExperienceHandoff — the minimal provider-neutral contract for moving a
 * person between journeys/surfaces without creating authority (AEE-XP-001
 * §5, `codexes/packs/agentiq/updates/2026-08-31_aee-xp-three-paper-execution-
 * build-spec.md`).
 *
 * This is deliberately NOT `HandoffPayload` (types/orchestration.ts) —
 * that type carries an agent-role-to-agent-role handoff INSIDE one
 * orchestration decision (journey_state_summary, policy_envelope, an
 * open-tasks list scoped to that decision). `ExperienceHandoff` carries a
 * PERSON across two independent journeys/Bridges (KNYTS/CI → Financial
 * Services, Financial Services → IRL, IRL → DevOn, etc.) — a different
 * domain, a different lifecycle, and a different set of fields. Both types
 * share the same discipline `HandoffPayload` already established (continuity
 * fields only, no authority/credential fields, explicit return conditions)
 * and this type is modeled on that discipline rather than reinventing it.
 *
 * Hard rule (spec §5, restated as the type's own contract): a handoff
 * carries continuity, intent and bounded experience context. It may carry an
 * agent CANDIDATE reference, never a fabricated registration/delegation. The
 * RECEIVING journey always resolves authority/current state from its own
 * canonical owners — this object is never itself treated as evidence of
 * anything constitutional.
 */

export interface ExperienceHandoff {
  handoffId: string;
  /** T2-safe or otherwise non-identifying participant reference — never a
   *  raw personaId/authProfileId (Identity & Access Spine, CLAUDE.md). */
  participantRef?: string;
  sourceJourneyId: string;
  sourceStageId?: string;
  targetJourneyId: string;
  targetSurfaceRef?: string;
  intent?: string;
  capabilityFocus?: string[];
  /** A CANDIDATE only — never a registered/delegated agent. The receiving
   *  journey's own Register stage decides whether/how this is used; it is
   *  never treated as proof that registration already occurred. */
  agentCandidateRef?: string;
  recommendedExperienceAltitude?: string;
  experienceEvidenceRefs?: string[];
  returnJourneyId?: string;
  returnStageId?: string;
  rationale?: string;
  createdAt: string;
  expiresAt?: string;
}
