/**
 * authorityChain — direct vs MoneyPenny-mediated delegation to Factor
 * (PRD §2.1, §9.15-17), reconciled onto spec/moneypenny-mpy2-3.
 *
 *   direct mode:              principal -> Factor
 *   moneypenny_mediated mode: principal -> MoneyPenny -> Factor
 *
 * "A conversational handoff is not itself a delegation" (PRD §2.1) — this
 * module is the only place a factor_authority_chains row is created, and
 * mediated mode is refused unless the caller explicitly asserts
 * subdelegationPermitted=true (never inferred from "a MoneyPenny session
 * exists", per §9.15).
 *
 * RECONCILIATION (vs the stale-base version): `delegation_grants`
 * (20260622500000) already exists on this base and is the canonical
 * (persona, agent) bounded-delegation ledger — `services/delegation/
 * delegationGrantStore.ts`. It CANNOT express principal -> MoneyPenny ->
 * Factor subdelegation (flat pairs, no mediator field, no subdelegation
 * flag) — confirmed per PRD §7's explicit permission to introduce a new
 * representation only in that case. `establishDirectChain` below therefore
 * REQUIRES an existing active `delegation_grants` row for (principal,
 * Factor) and records only the chain-mode overlay
 * (`delegation_grant_id` FK) rather than duplicating allowed_actions/
 * allowed_surfaces — those stay owned by `delegation_grants`.
 * `establishMediatedChain` has no corresponding grant row by construction.
 */

import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readActiveGrantForAgent } from '@/services/delegation/delegationGrantStore';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

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
  principal_persona_id: string;
  chain_mode: AuthorityChainMode;
  mediator_agent_ref: string | null;
  target_agent_ref: string;
  delegation_grant_id: string | null;
  subdelegation_permitted: boolean;
  allowed_actions: unknown[];
  status: 'active' | 'revoked' | 'expired';
  revoked_at: string | null;
  revoke_reason: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EstablishDirectChainInput {
  principalPersonaId: string;
  targetAgentRef: string;
  targetAgentRootDid: string;
  allowedActions: string[];
}

/**
 * principal -> Factor, no mediator. Requires an existing ACTIVE
 * delegation_grants row for (principalPersonaId, targetAgentRootDid) —
 * this function does not itself create authority, it records the
 * chain-mode overlay over authority `delegation_grants` already grants.
 */
export async function establishDirectChain(admin: SupabaseClient, input: EstablishDirectChainInput): Promise<AuthorityChainRow> {
  const grant = await readActiveGrantForAgent(input.principalPersonaId, input.targetAgentRootDid);
  if (!grant) {
    throw new AuthorityChainError(
      'no-active-delegation-grant',
      `Direct authority chain refused: no active delegation_grants row for (persona=${input.principalPersonaId}, agent=${input.targetAgentRootDid}). ` +
        'Establish the bounded-delegation grant first — this module never manufactures authority.',
    );
  }
  return insertChain(admin, {
    principalPersonaId: input.principalPersonaId,
    chainMode: 'direct',
    mediatorAgentRef: null,
    targetAgentRef: input.targetAgentRef,
    delegationGrantId: grant.grant_id,
    subdelegationPermitted: false, // meaningless for direct mode; recorded false for clarity
    allowedActions: input.allowedActions,
    expiresAt: grant.expires_at,
  });
}

export interface EstablishMediatedChainInput {
  principalPersonaId: string;
  mediatorAgentRef: string; // MoneyPenny's own ref
  targetAgentRef: string; // Factor's ref
  /**
   * MUST be explicitly asserted true by the caller after checking
   * MoneyPenny's own capability/delegation limits permit subdelegating this
   * scope (PRD §9.16). This function does not itself resolve MoneyPenny's
   * limits — the caller does that and passes the result in; this
   * function's job is to REFUSE when it is false or omitted, never to
   * assume it.
   */
  subdelegationPermitted: boolean;
  allowedActions: string[];
  expiresAt: string;
}

/**
 * principal -> MoneyPenny -> Factor. Refuses outright when
 * subdelegationPermitted is not explicitly true.
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
    principalPersonaId: input.principalPersonaId,
    chainMode: 'moneypenny_mediated',
    mediatorAgentRef: input.mediatorAgentRef,
    targetAgentRef: input.targetAgentRef,
    delegationGrantId: null,
    subdelegationPermitted: true,
    allowedActions: input.allowedActions,
    expiresAt: input.expiresAt,
  });
}

interface InsertChainInput {
  principalPersonaId: string;
  chainMode: AuthorityChainMode;
  mediatorAgentRef: string | null;
  targetAgentRef: string;
  delegationGrantId: string | null;
  subdelegationPermitted: boolean;
  allowedActions: string[];
  expiresAt: string | null;
}

async function insertChain(admin: SupabaseClient, input: InsertChainInput): Promise<AuthorityChainRow> {
  // Supersede any prior active chain of the SAME (principal, target, mode)
  // shape — a new establishment always wins.
  await admin
    .from('factor_authority_chains')
    .update({ status: 'revoked', revoked_at: new Date().toISOString(), revoke_reason: 'superseded-by-new-chain' })
    .eq('principal_persona_id', input.principalPersonaId)
    .eq('target_agent_ref', input.targetAgentRef)
    .eq('chain_mode', input.chainMode)
    .eq('status', 'active');

  const chainId = randomUUID();
  const { data, error } = await admin
    .from('factor_authority_chains')
    .insert({
      chain_id: chainId,
      principal_persona_id: input.principalPersonaId,
      chain_mode: input.chainMode,
      mediator_agent_ref: input.mediatorAgentRef,
      target_agent_ref: input.targetAgentRef,
      delegation_grant_id: input.delegationGrantId,
      subdelegation_permitted: input.subdelegationPermitted,
      allowed_actions: input.allowedActions,
      expires_at: input.expiresAt,
    })
    .select('*')
    .single();
  if (error) throw new Error(`insertChain failed: ${error.message}`);

  await createActivityReceipt({
    personaId: input.principalPersonaId,
    activeCartridge: 'moneypenny',
    actionType: 'factor_authority_chain_established',
    summary: `Authority chain established: ${input.chainMode} -> ${input.targetAgentRef}`,
    agentsInvoked: [input.targetAgentRef, ...(input.mediatorAgentRef ? [input.mediatorAgentRef] : [])],
    actionInput: { chainId, chainMode: input.chainMode, targetAgentRef: input.targetAgentRef },
  });

  return data as AuthorityChainRow;
}

/**
 * Revocation is immediate (PRD §9.7/§9.17): once a chain's status flips to
 * 'revoked', `validateChainForAction` refuses on the very next check —
 * there is no grace window.
 */
export async function revokeChain(admin: SupabaseClient, chainId: string, revokedByPersonaId: string, reason: string): Promise<void> {
  const { error } = await admin
    .from('factor_authority_chains')
    .update({ status: 'revoked', revoked_at: new Date().toISOString(), revoke_reason: reason })
    .eq('chain_id', chainId)
    .eq('status', 'active');
  if (error) throw new Error(`revokeChain failed: ${error.message}`);
  await createActivityReceipt({
    personaId: revokedByPersonaId,
    activeCartridge: 'moneypenny',
    actionType: 'factor_authority_chain_revoked',
    summary: `Authority chain ${chainId} revoked: ${reason}`,
    agentsInvoked: ['aigent-factor'],
    actionInput: { chainId, reason },
  });
}

export interface ValidateChainInput {
  chainId: string;
  action: string;
}

export type ChainValidation = { allowed: true; chain: AuthorityChainRow } | { allowed: false; code: string; reason: string };

/**
 * The one gate a Factor action MUST pass before executing under a given
 * authority chain. Computes the intersection PRD §9.16 requires between
 * "what this chain grants" and "the specific action requested" — the
 * caller is separately responsible for intersecting Factor's own ratified
 * capability scope and provider policy.
 */
export async function validateChainForAction(admin: SupabaseClient, input: ValidateChainInput): Promise<ChainValidation> {
  const { data, error } = await admin.from('factor_authority_chains').select('*').eq('chain_id', input.chainId).maybeSingle();
  if (error) throw new Error(`validateChainForAction read failed: ${error.message}`);
  if (!data) return { allowed: false, code: 'chain-not-found', reason: `No authority chain ${input.chainId}` };

  const chain = data as AuthorityChainRow;

  if (chain.status !== 'active') {
    return { allowed: false, code: `chain-${chain.status}`, reason: `Authority chain ${input.chainId} is '${chain.status}', not active.` };
  }
  if (chain.expires_at && new Date(chain.expires_at).getTime() <= Date.now()) {
    return { allowed: false, code: 'chain-expired', reason: `Authority chain ${input.chainId} expired at ${chain.expires_at}.` };
  }
  if (chain.chain_mode === 'moneypenny_mediated' && chain.subdelegation_permitted !== true) {
    return { allowed: false, code: 'subdelegation-not-permitted', reason: `Authority chain ${input.chainId} is mediated but subdelegation_permitted is not true.` };
  }
  if (!Array.isArray(chain.allowed_actions) || !chain.allowed_actions.includes(input.action)) {
    return { allowed: false, code: 'action-not-granted', reason: `Action '${input.action}' is not within authority chain ${input.chainId}'s allowed_actions.` };
  }

  return { allowed: true, chain };
}
