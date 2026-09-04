/**
 * authorityChain — direct vs MoneyPenny-mediated delegation to Factor
 * (PRD §2.1, §9.15-17, acceptance criteria 24/25).
 *
 *   direct mode:              principal → Factor
 *   moneypenny_mediated mode: principal → MoneyPenny → Factor
 *
 * "A conversational handoff is not itself a delegation" (PRD §2.1) — this
 * module is the only place a factor_authority_chains row is created, and
 * mediated mode is refused unless the caller explicitly asserts
 * subdelegationPermitted=true (never inferred from "a MoneyPenny session
 * exists", per §9.15).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { personaRef } from './identityRefs';

export class AuthorityChainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AuthorityChainError';
  }
}

export type AuthorityChainMode = 'direct' | 'moneypenny_mediated';

export interface AuthorityChainRow {
  chain_id: string;
  tenant_id: string;
  principal_persona_id: string;
  mode: AuthorityChainMode;
  mediating_agent_root_did: string | null;
  delegate_agent_root_did: string;
  subdelegation_permitted: boolean;
  allowed_actions: unknown[];
  scope: Record<string, unknown>;
  status: 'active' | 'revoked' | 'expired';
  revoked_at: string | null;
  revoke_reason: string | null;
  created_by_persona_ref: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface EstablishDirectChainInput {
  tenantId?: string;
  principalPersonaId: string;
  delegateAgentRootDid: string;
  allowedActions: string[];
  scope: Record<string, unknown>;
  expiresAt: string;
}

/** principal → Factor, no mediator. Reuses the same bounded-mandate shape
 *  (allowed actions, scope, expiry) Journey G step 5 requires. */
export async function establishDirectChain(admin: SupabaseClient, input: EstablishDirectChainInput): Promise<AuthorityChainRow> {
  return insertChain(admin, {
    tenantId: input.tenantId ?? 'default',
    principalPersonaId: input.principalPersonaId,
    mode: 'direct',
    mediatingAgentRootDid: null,
    delegateAgentRootDid: input.delegateAgentRootDid,
    subdelegationPermitted: false, // meaningless for direct mode; recorded false for clarity
    allowedActions: input.allowedActions,
    scope: input.scope,
    expiresAt: input.expiresAt,
  });
}

export interface EstablishMediatedChainInput {
  tenantId?: string;
  principalPersonaId: string;
  mediatingAgentRootDid: string; // MoneyPenny's own DID
  delegateAgentRootDid: string; // Factor's DID
  /**
   * MUST be explicitly asserted true by the caller after checking
   * MoneyPenny's own capability/delegation limits permit subdelegating this
   * scope (PRD §9.16: "the intersection of the principal mandate,
   * MoneyPenny's capability/delegation limits, Factor's ratified capability
   * scope and provider policy"). This function does not itself resolve
   * MoneyPenny's limits — the caller (MoneyPenny's own invocation code)
   * does that and passes the result in; this function's job is to REFUSE
   * when it is false or omitted, never to assume it.
   */
  subdelegationPermitted: boolean;
  allowedActions: string[];
  scope: Record<string, unknown>;
  expiresAt: string;
}

/**
 * principal → MoneyPenny → Factor. Refuses outright when
 * subdelegationPermitted is not explicitly true (PRD acceptance criterion
 * 24: "fails if subdelegation is absent or prohibited").
 */
export async function establishMediatedChain(admin: SupabaseClient, input: EstablishMediatedChainInput): Promise<AuthorityChainRow> {
  if (input.subdelegationPermitted !== true) {
    throw new AuthorityChainError(
      'subdelegation-not-permitted',
      'MoneyPenny-mediated invocation refused: subdelegation to Factor is absent or not explicitly permitted. ' +
        'A MoneyPenny session alone is never sufficient authority to delegate to Factor (PRD §9.15).',
    );
  }
  return insertChain(admin, {
    tenantId: input.tenantId ?? 'default',
    principalPersonaId: input.principalPersonaId,
    mode: 'moneypenny_mediated',
    mediatingAgentRootDid: input.mediatingAgentRootDid,
    delegateAgentRootDid: input.delegateAgentRootDid,
    subdelegationPermitted: true,
    allowedActions: input.allowedActions,
    scope: input.scope,
    expiresAt: input.expiresAt,
  });
}

interface InsertChainInput {
  tenantId: string;
  principalPersonaId: string;
  mode: AuthorityChainMode;
  mediatingAgentRootDid: string | null;
  delegateAgentRootDid: string;
  subdelegationPermitted: boolean;
  allowedActions: string[];
  scope: Record<string, unknown>;
  expiresAt: string;
}

async function insertChain(admin: SupabaseClient, input: InsertChainInput): Promise<AuthorityChainRow> {
  // Supersede any prior active chain of the SAME (principal, delegate, mode)
  // shape — mirrors delegation_grants' single-active-grant-per-agent
  // pattern (see implementation-map doc). A NEW establishment always wins;
  // callers that want to keep an old grant should not call this again.
  await admin
    .from('factor_authority_chains')
    .update({ status: 'revoked', revoked_at: new Date().toISOString(), revoke_reason: 'superseded-by-new-grant' })
    .eq('tenant_id', input.tenantId)
    .eq('principal_persona_id', input.principalPersonaId)
    .eq('delegate_agent_root_did', input.delegateAgentRootDid)
    .eq('mode', input.mode)
    .eq('status', 'active');

  const { data, error } = await admin
    .from('factor_authority_chains')
    .insert({
      tenant_id: input.tenantId,
      principal_persona_id: input.principalPersonaId,
      mode: input.mode,
      mediating_agent_root_did: input.mediatingAgentRootDid,
      delegate_agent_root_did: input.delegateAgentRootDid,
      subdelegation_permitted: input.subdelegationPermitted,
      allowed_actions: input.allowedActions,
      scope: input.scope,
      created_by_persona_ref: personaRef(input.principalPersonaId),
      expires_at: input.expiresAt,
    })
    .select('*')
    .single();
  if (error) throw new Error(`insertChain failed: ${error.message}`);
  return data as AuthorityChainRow;
}

/**
 * Revocation is immediate at this layer (PRD §9.7 / §9.17): once a chain's
 * status flips to 'revoked', `validateChainForAction` below refuses on the
 * very next check — there is no grace window.
 */
export async function revokeChain(admin: SupabaseClient, chainId: string, reason: string): Promise<void> {
  const { error } = await admin
    .from('factor_authority_chains')
    .update({ status: 'revoked', revoked_at: new Date().toISOString(), revoke_reason: reason })
    .eq('chain_id', chainId)
    .eq('status', 'active');
  if (error) throw new Error(`revokeChain failed: ${error.message}`);
}

export interface ValidateChainInput {
  chainId: string;
  action: string;
}

export type ChainValidation =
  | { allowed: true; chain: AuthorityChainRow }
  | { allowed: false; code: string; reason: string };

/**
 * The one gate a Factor action MUST pass before executing under a given
 * authority chain. Computes the intersection PRD §9.16 requires between
 * "what this chain grants" and "the specific action requested" — the
 * caller is responsible for separately intersecting Factor's own ratified
 * capability scope and any provider policy (this module owns only the
 * delegation-chain leg of that intersection).
 */
export async function validateChainForAction(admin: SupabaseClient, input: ValidateChainInput): Promise<ChainValidation> {
  const { data, error } = await admin.from('factor_authority_chains').select('*').eq('chain_id', input.chainId).maybeSingle();
  if (error) throw new Error(`validateChainForAction read failed: ${error.message}`);
  if (!data) return { allowed: false, code: 'chain-not-found', reason: `No authority chain ${input.chainId}` };

  const chain = data as AuthorityChainRow;

  if (chain.status !== 'active') {
    return { allowed: false, code: `chain-${chain.status}`, reason: `Authority chain ${input.chainId} is '${chain.status}', not active.` };
  }
  if (new Date(chain.expires_at).getTime() <= Date.now()) {
    return { allowed: false, code: 'chain-expired', reason: `Authority chain ${input.chainId} expired at ${chain.expires_at}.` };
  }
  if (chain.mode === 'moneypenny_mediated' && chain.subdelegation_permitted !== true) {
    return {
      allowed: false,
      code: 'subdelegation-not-permitted',
      reason: `Authority chain ${input.chainId} is mediated but subdelegation_permitted is not true.`,
    };
  }
  if (!Array.isArray(chain.allowed_actions) || !chain.allowed_actions.includes(input.action)) {
    return { allowed: false, code: 'action-not-granted', reason: `Action '${input.action}' is not within authority chain ${input.chainId}'s allowed_actions.` };
  }

  return { allowed: true, chain };
}
