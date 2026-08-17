/**
 * delegationAuthorityGate — the generic delegation-authority check at the
 * connector-execution seam (Homecoming Closeout WP-C2, operator brief
 * 2026-08-17).
 *
 * Constitutional model (fixed, not reopened by this module):
 *   human/persona → selects aigentMe Agent
 *   Agent capabilities ∩ surface capabilities ∩ active delegation grant ∩
 *   policy/approval = executable authority
 *   aigentMe is the role/surface. The assigned Agent is the actor. The
 *   delegation grant is the authority.
 *
 * This module answers exactly one question: "is the CURRENTLY ASSIGNED
 * aigentMe Agent's active delegation grant wide enough to cover this
 * connector action, on this surface, within its action budget?" It never
 * decides whether the connector itself requires human approval — that gate
 * (connector.requiresApproval + the signed approvalToken) is untouched and
 * always still applies, checked separately and never bypassed by a grant.
 *
 * When to apply: ONLY when a real Agent is assigned to the aigentMe role
 * (ctx.currentAigentMe is non-null). When no Agent is assigned (the Default
 * aigentMe identity), there is no delegate to bound — the check is a no-op
 * and execution proceeds exactly as it did before this module existed. This
 * is what keeps the Default identity from "magically inheriting" whatever
 * agent's grant happens to exist for the persona.
 *
 * Generic by construction: every check below keys off the resolved grant
 * row and the resolved bound-agent record. No agent id is special-cased —
 * Aletheon is the acceptance case, not a special case.
 */

import type { NextRequest } from 'next/server';
import { resolveConstitutionalContext } from '@/services/identity/constitutionalContext';
import { readActiveGrant, incrementActionsTaken, type DelegationGrantRow } from '@/services/delegation/delegationGrantStore';
import { delegatedActionForConnector, type DelegatedActionId } from '@/services/delegation/delegatedActionVocabulary';

export interface DelegatedActionAttribution {
  principalPersonaId: string;
  actingAgentRootId: string;
  actingAgentDid: string;
  actingAgentDisplayName: string;
  actingRole: 'aigentMe';
  delegationGrantId: string;
  delegatedAction: DelegatedActionId;
  executionSurface: string;
  executionMode: 'autonomous' | 'approved';
  connectorId: string;
}

export type DelegationAuthorityResult =
  /** No Agent assigned to the aigentMe role — not a delegated act. Proceed
   *  exactly as before this module existed. */
  | { delegated: false; allowed: true }
  /** A real Agent is assigned and her active grant covers this action. */
  | { delegated: true; allowed: true; attribution: DelegatedActionAttribution }
  /** A real Agent is assigned but the requested action is refused. */
  | { delegated: true; allowed: false; code: string; reason: string; attribution: Omit<DelegatedActionAttribution, 'delegationGrantId'> & { delegationGrantId: string | null } };

function surfaceAllowed(grant: DelegationGrantRow, surface: string): boolean {
  if (!Array.isArray(grant.allowed_surfaces) || grant.allowed_surfaces.length === 0) return false;
  return grant.allowed_surfaces.includes(surface);
}

/**
 * Check delegation authority for a connector action. `requiresApproval` is
 * the connector's OWN flag (services/google/connectors.ts /
 * services/marketa/marketaConnector.ts) — used only to label
 * `executionMode` on the attribution record, never to decide the grant
 * check itself.
 */
export async function checkDelegationAuthority(input: {
  request: NextRequest;
  connectorId: string;
  surface: string;
  requiresApproval: boolean;
}): Promise<DelegationAuthorityResult> {
  const ctx = await resolveConstitutionalContext(input.request);

  // No Agent assigned to the aigentMe role — nothing to bound. This is the
  // "Default Agent Me never inherits delegated authority" invariant: there
  // is no delegate here to check a grant against, so none is required.
  if (!ctx.currentAigentMe) {
    return { delegated: false, allowed: true };
  }

  const bound = ctx.boundAgents.find((a) => a.agentId === ctx.currentAigentMe);
  if (!bound) {
    return { delegated: false, allowed: true };
  }

  // Read-only / non-consequential connectors (search, list) are not named
  // in the delegated-action vocabulary at all — deliberately ungated.
  const delegatedAction = delegatedActionForConnector(input.connectorId);
  if (!delegatedAction) {
    return { delegated: false, allowed: true };
  }

  const executionMode: 'autonomous' | 'approved' = input.requiresApproval ? 'approved' : 'autonomous';
  const attributionBase = {
    principalPersonaId: ctx.persona.personaId ?? '',
    actingAgentRootId: bound.agentId,
    actingAgentDid: bound.agentDid,
    actingAgentDisplayName: bound.displayName,
    actingRole: 'aigentMe' as const,
    delegatedAction,
    executionSurface: input.surface,
    executionMode,
    connectorId: input.connectorId,
  };

  const personaId = ctx.persona.personaId;
  const grant = personaId ? await readActiveGrant(personaId) : null;

  if (!grant) {
    return {
      delegated: true,
      allowed: false,
      code: 'no-active-grant',
      reason: `${bound.displayName} has no active delegation grant.`,
      attribution: { ...attributionBase, delegationGrantId: null },
    };
  }
  if (grant.agent_root_did !== bound.agentDid) {
    return {
      delegated: true,
      allowed: false,
      code: 'grant-agent-mismatch',
      reason: `The active delegation grant belongs to a different Agent than the one currently assigned to the aigentMe role.`,
      attribution: { ...attributionBase, delegationGrantId: grant.grant_id },
    };
  }
  if (!Array.isArray(grant.allowed_actions) || !grant.allowed_actions.includes(delegatedAction)) {
    return {
      delegated: true,
      allowed: false,
      code: 'action-not-granted',
      reason: `"${delegatedAction}" is not in ${bound.displayName}'s active delegation grant.`,
      attribution: { ...attributionBase, delegationGrantId: grant.grant_id },
    };
  }
  if (!surfaceAllowed(grant, input.surface)) {
    return {
      delegated: true,
      allowed: false,
      code: 'surface-not-granted',
      reason: `Surface "${input.surface}" is not in ${bound.displayName}'s active delegation grant.`,
      attribution: { ...attributionBase, delegationGrantId: grant.grant_id },
    };
  }
  if (grant.actions_taken >= grant.max_actions) {
    return {
      delegated: true,
      allowed: false,
      code: 'action-budget-exhausted',
      reason: `${bound.displayName}'s delegation grant has reached its action budget (${grant.max_actions}).`,
      attribution: { ...attributionBase, delegationGrantId: grant.grant_id },
    };
  }

  return {
    delegated: true,
    allowed: true,
    attribution: { ...attributionBase, delegationGrantId: grant.grant_id },
  };
}

export { incrementActionsTaken };
