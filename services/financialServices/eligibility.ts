/**
 * MoneyPenny Financial Services Runtime — eligibility (Phase 3, Stage 3.1).
 *
 * A pre-flight, service-discovery-time check: can this consumer even ATTEMPT
 * this service. It is NOT a second admission or authority decision — it
 * reuses the exact same `resolveAgentAdmissionState()` Gate 1
 * (`services/registry/capabilityInvocationGates.ts`) independently calls,
 * and `computeStandingScore()` (`services/standing/standingScore.ts`), the
 * existing canonical Standing reader. Gate 1 still runs, unchanged, on every
 * actual invocation regardless of what this function decides — this is a
 * clearer, earlier refusal reason for the caller, never a bypass.
 *
 * Three-valued, matching this codebase's house style for every other
 * admission/evidence reader: `eligible: true | false | undefined`, where
 * `undefined` means the check could not be completed (a read failure), never
 * a fabricated "ineligible."
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FinancialServiceDefinition } from '@/types/financialServices';
import { resolveRegistrableAgentByRuntimeId } from '@/services/horizen/registrableAgents';
import { resolveAgentAdmissionState } from '@/services/journey/agentAdmissionState';
import { computeStandingScore } from '@/services/standing/standingScore';

export interface FinancialServiceEligibilityResult {
  eligible: boolean | undefined;
  code: string;
  reason: string;
}

export interface EvaluateFinancialServiceEligibilityInput {
  requestingAgentId: string;
  /** The CRM persona whose Standing is checked when `eligibilityPolicy.minimumStandingScore` is set. Caller-resolved via the existing identity spine — this function never derives it itself. */
  standingPersonaId?: string | null;
  /**
   * The AUTHENTICATED caller's own `authProfileId`/`personaId` (T0 — server-
   * side only, never serialised to a client). Threaded through unchanged to
   * `resolveAgentAdmissionState()` so its migrated-agent RootDID self-heal
   * (see `services/journey/agentAdmissionState.ts`'s "THE MIGRATED-AGENT
   * GAP") can actually run when this eligibility check is the first live
   * boundary to observe a migrated agent's already-approved Delegate
   * Passport. Omitting these does not change any read this function makes —
   * it only leaves that one self-heal a no-op audit gap, exactly as
   * `resolveAgentAdmissionState`'s own doc comment already states for any
   * caller that "doesn't yet resolve caller identity."
   */
  callerAuthProfileId?: string | null;
  actorPersonaId?: string | null;
}

export async function evaluateFinancialServiceEligibility(
  definition: FinancialServiceDefinition,
  input: EvaluateFinancialServiceEligibilityInput,
  admin: SupabaseClient,
): Promise<FinancialServiceEligibilityResult> {
  if (definition.eligibilityPolicy.requiresAdmission) {
    const agent = resolveRegistrableAgentByRuntimeId(input.requestingAgentId);
    if (!agent) {
      return { eligible: false, code: 'UNKNOWN_AGENT', reason: `'${input.requestingAgentId}' is not a canonical registrable agent` };
    }
    const admission = await resolveAgentAdmissionState(
      admin,
      agent,
      input.callerAuthProfileId ?? null,
      input.actorPersonaId ?? null,
    ).catch(() => null);
    if (!admission) {
      return { eligible: undefined, code: 'ADMISSION_UNRESOLVED', reason: 'admission state could not be read' };
    }
    // Three-valued, matching `resolveAgentAdmissionState`'s own discipline:
    // `undefined` is an audit gap ("could not tell"), NEVER collapsed into
    // the real negative `false` ("NOT_ADMITTED"). Conflating the two here
    // would recreate exactly the defect class `agentAdmissionState.ts`'s own
    // header documents and was written to close.
    if (admission.delegationActive === undefined) {
      return {
        eligible: undefined,
        code: 'ADMISSION_UNRESOLVED',
        reason: `'${input.requestingAgentId}' delegation state has an unresolved audit gap: ${admission.auditGaps.join('; ') || 'unknown'}`,
      };
    }
    if (admission.delegationActive === false) {
      return { eligible: false, code: 'NOT_ADMITTED', reason: `'${input.requestingAgentId}' has no active delegation` };
    }
  }

  if (definition.eligibilityPolicy.minimumStandingScore !== null) {
    if (!input.standingPersonaId) {
      return {
        eligible: undefined,
        code: 'STANDING_PERSONA_UNRESOLVED',
        reason: 'a minimum Standing score is required but no CRM persona id was supplied to check it against',
      };
    }
    const standing = await computeStandingScore(admin, input.standingPersonaId).catch(() => null);
    if (!standing) {
      return { eligible: undefined, code: 'STANDING_UNRESOLVED', reason: 'Standing score could not be computed' };
    }
    if (standing.score < definition.eligibilityPolicy.minimumStandingScore) {
      return {
        eligible: false,
        code: 'STANDING_BELOW_THRESHOLD',
        reason: `Standing score ${standing.score} is below the required ${definition.eligibilityPolicy.minimumStandingScore}`,
      };
    }
  }

  return { eligible: true, code: 'ELIGIBLE', reason: 'eligibility policy satisfied' };
}
