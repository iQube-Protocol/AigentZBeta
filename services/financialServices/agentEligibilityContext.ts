/**
 * FinancialServiceAgentContext — the Repair F "resolve once" composition.
 * Corrected 2026-08-23 (second pass): eligibility/discovery must be driven by
 * STRUCTURAL admission facts, never by the single-slot runtime delegation
 * grant.
 *
 * Operator correction, verbatim: "`readActiveGrant(personaId)` represents
 * the persona's current runtime authority envelope, and the grant store
 * deliberately allows only one active grant per persona — creating a new one
 * supersedes the old one. Therefore it cannot be used as the multi-agent
 * Financial Services eligibility roster." A persona may have MANY
 * structurally assigned agents (`persona_agent_assignments`); it can have at
 * most ONE currently active delegation grant. Eligibility/discovery is a
 * STRUCTURAL question ("is this agent constitutionally admitted and bound to
 * this principal") — the ACTIVE GRANT is an AUTHORITY-PLANE fact for a later,
 * per-action decision (`constitutionalAuthorityAdapter.ts`), not a
 * discoverability gate.
 *
 * This module still resolves everything ONCE per request (Repair F is
 * unchanged) — it now resolves TWO independent facts instead of conflating
 * them into one: `structurallyAssigned` (persona_agent_assignments, for
 * eligibility) and `activeGrant`/`hasCurrentDelegationToAgent`
 * (delegation_grants, for the Authority Plane only).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RegistrableAgentConfig } from '@/services/horizen/registrableAgents';
import { resolveAgentAdmissionState, type AgentAdmissionState } from '@/services/journey/agentAdmissionState';
import { readActiveGrantForAgent, type DelegationGrantRow } from '@/services/delegation/delegationGrantStore';
import { listAssignments } from '@/services/identity/personaAssignmentStore';
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
  /**
   * STRUCTURAL fact for eligibility/discovery: is this agent structurally
   * assigned/bound to the requesting principal's persona
   * (`persona_agent_assignments`, any role — a persona may have many
   * assigned agents, not just one aigentMe)? `undefined` = could not be
   * determined (the agent's own root-identity read failed, so there is no
   * `agent_root_id` to check assignment against). `false` = a real negative:
   * either the agent has no root identity at all, there is no authenticated
   * principal, or the assignment table genuinely holds no active row for
   * this (persona, agent) pair.
   *
   * Known limitation, disclosed rather than hidden: `listAssignments()`
   * itself soft-fails to `[]` on a migration-pending table or a transient
   * read error (services/identity/personaAssignmentStore.ts's own documented
   * behavior) — so a `false` produced THROUGH that path is not perfectly
   * three-valued at the assignment-table layer itself. This mirrors every
   * other caller of that store today; tightening it is a separate, un-asked-
   * for change to `personaAssignmentStore.ts`.
   */
  structurallyAssigned: boolean | undefined;
  /** The AUTHENTICATED caller's own active grant (may target a different agent — see `hasCurrentDelegationToAgent`). AUTHORITY-PLANE ONLY — never consulted for eligibility/discovery. */
  activeGrant: DelegationGrantRow | null;
  /**
   * Authority-plane fact only (constitutionalAuthorityAdapter.ts's BOUNDED
   * vs ACTIVE derivation) — an unexpired grant for the EXACT target agent
   * under the EXACT authenticated principal. `undefined` = could not be
   * determined; `false` = no such current grant (agent has no root identity,
   * caller has no active grant, or the active grant targets a different
   * agent). NEVER used to decide `eligible` — see the file header.
   */
  hasCurrentDelegationToAgent: boolean | undefined;
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

  // ── Structural assignment (eligibility/discovery) ─────────────────────────
  let structurallyAssigned: boolean | undefined;
  if (!admission) {
    structurallyAssigned = undefined;
  } else if (!admission.agentRootId) {
    structurallyAssigned = admission.auditGaps.length > 0 ? undefined : false;
  } else if (!callerPersonaId) {
    structurallyAssigned = false;
  } else {
    const assignments = await listAssignments(callerPersonaId).catch(() => []);
    structurallyAssigned = assignments.some((a) => a.agent_root_id === admission.agentRootId && a.active);
  }

  // ── Current bounded delegation (Authority Plane only — never eligibility) ─
  let activeGrant: DelegationGrantRow | null = null;
  let hasCurrentDelegationToAgent: boolean | undefined;
  if (!admission) {
    hasCurrentDelegationToAgent = undefined;
  } else if (!admission.agentRootDid) {
    hasCurrentDelegationToAgent = admission.auditGaps.length > 0 ? undefined : false;
  } else if (!callerPersonaId) {
    hasCurrentDelegationToAgent = false;
  } else {
    // A persona may hold many simultaneously active grants, one
    // independently bounded per agent (CFS-024 multi-agent model,
    // 2026-08-23 repair pass) — read THIS agent's own grant, never "the
    // persona's grant" generically. A current MoneyPenny delegation must
    // never make Nakamoto appear delegated, and vice versa.
    activeGrant = await readActiveGrantForAgent(callerPersonaId, admission.agentRootDid).catch(() => null);
    hasCurrentDelegationToAgent = activeGrant !== null;
  }

  const verification = await resolveFinancialServicesVerification(agent).catch(() => undefined);

  const standingPersonaId = await resolveAgentStandingPersonaId(admin, agent, admission?.agentRootDid).catch(
    () => undefined,
  );
  const standing = standingPersonaId ? await computeStandingScore(admin, standingPersonaId).catch(() => null) : null;

  return {
    agent,
    admission,
    structurallyAssigned,
    activeGrant,
    hasCurrentDelegationToAgent,
    verification,
    standingPersonaId,
    standing,
    callerPersonaId,
    callerAuthProfileId,
  };
}
