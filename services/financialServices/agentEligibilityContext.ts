/**
 * FinancialServiceAgentContext — the Repair F "resolve once" composition.
 *
 * Operator directive (2026-08-23 repair pass, part F): "resolve
 * admission/delegation/verification/Standing once per selected agent
 * request, project it into every service card. Do not call mutation-capable
 * admission resolution once per catalog item plus once for diagnostics."
 *
 * `resolveAgentAdmissionState` self-heals (mints a migrated agent's RootDID,
 * materializes `registryActivated`) — calling it more than once per HTTP
 * request is not semantically harmless, it is a repeated write attempt. This
 * module is the ONE place a Financial Services caller resolves an agent's
 * full eligibility-relevant state; `eligibility.ts` becomes a pure decision
 * function over the resulting context, and `discovery.ts` calls this once
 * per GET and reuses the SAME context for every catalog entry (including the
 * admission diagnostic the operator console renders).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RegistrableAgentConfig } from '@/services/horizen/registrableAgents';
import { resolveAgentAdmissionState, type AgentAdmissionState } from '@/services/journey/agentAdmissionState';
import { readActiveGrant, type DelegationGrantRow } from '@/services/delegation/delegationGrantStore';
import {
  resolveFinancialServicesVerification,
  type FinancialServicesVerificationState,
} from '@/services/journey/agentFinancialServicesVerification';
import { resolveAgentStandingPersonaId } from '@/services/standing/agentStandingPersona';
import { computeStandingScore, type StandingScoreBreakdown } from '@/services/standing/standingScore';

export interface FinancialServiceAgentContext {
  agent: RegistrableAgentConfig;
  /** `undefined` only when the admission read itself threw — an audit gap wider than any single field on it. */
  admission: AgentAdmissionState | undefined;
  /** The AUTHENTICATED caller's own active grant (may target a different agent — see `personaScopedDelegationActive`). */
  activeGrant: DelegationGrantRow | null;
  /**
   * Repair A — "an unexpired active grant for the selected agent under the
   * authenticated principal/persona, not any active row for that RootDID."
   * `undefined` = could not be determined (admission unresolved, or the
   * agent's own root-identity read failed). `false` = a real negative: no
   * root identity for this agent (nothing could target it), or the caller's
   * active grant targets a DIFFERENT agent, or the caller has no active
   * grant / no persona at all.
   */
  personaScopedDelegationActive: boolean | undefined;
  verification: FinancialServicesVerificationState | undefined;
  /** The agent's OWN CRM Standing persona — never a client-supplied value (Repair C). */
  standingPersonaId: string | null | undefined;
  /** Resolved only when `standingPersonaId` is a real id; `null` otherwise (never attempted) or on a failed read. */
  standing: StandingScoreBreakdown | null;
  /** The AUTHENTICATED human caller directing this agent — T0, server-side only. */
  callerPersonaId: string | null;
  callerAuthProfileId: string | null;
}

export async function resolveAgentEligibilityContext(
  admin: SupabaseClient,
  agent: RegistrableAgentConfig,
  callerPersonaId: string | null,
  callerAuthProfileId: string | null,
): Promise<FinancialServiceAgentContext> {
  const admission = await resolveAgentAdmissionState(admin, agent, callerAuthProfileId, callerPersonaId).catch(
    () => undefined,
  );

  let activeGrant: DelegationGrantRow | null = null;
  let personaScopedDelegationActive: boolean | undefined;
  if (!admission) {
    personaScopedDelegationActive = undefined;
  } else if (!admission.agentRootDid) {
    // No root identity for this agent — an audit gap if the read itself
    // failed (never collapse "could not tell" into a refusal), otherwise a
    // real negative: nothing can be delegated to a DID that doesn't exist.
    personaScopedDelegationActive = admission.auditGaps.length > 0 ? undefined : false;
  } else if (!callerPersonaId) {
    // No authenticated principal to hold a grant at all — a real negative.
    personaScopedDelegationActive = false;
  } else {
    activeGrant = await readActiveGrant(callerPersonaId).catch(() => null);
    personaScopedDelegationActive = activeGrant?.agent_root_did === admission.agentRootDid;
  }

  const verification = await resolveFinancialServicesVerification(agent).catch(() => undefined);

  const standingPersonaId = await resolveAgentStandingPersonaId(agent).catch(() => undefined);
  const standing = standingPersonaId ? await computeStandingScore(admin, standingPersonaId).catch(() => null) : null;

  return {
    agent,
    admission,
    activeGrant,
    personaScopedDelegationActive,
    verification,
    standingPersonaId,
    standing,
    callerPersonaId,
    callerAuthProfileId,
  };
}
