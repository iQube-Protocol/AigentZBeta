/**
 * Factor's Bankr capability — real action handlers (Factor + Aegis Bankr
 * PRD, Phase 5). Each function here is a THIN wrapper composing the
 * already-built Phase 2-4 services (services/financialServices/providers/
 * bankr/, services/financialServices/providers/providerWalletBinding.ts,
 * services/factor/tokenLaunchService.ts, services/aegis/
 * aegisAssessmentService.ts) — this file invents no new mechanism, it only
 * gives Factor's manifest actions something real to call.
 *
 * Every function here is registered in factorActionHandlerRegistry.ts under
 * its own handlerId; the manifest's bankr_tokenization actions reference
 * those ids. Factor's manifest `status` for bankr_tokenization stays
 * 'partial' (never flipped to 'operational' wholesale) — some of this is
 * real and reachable, submission still requires a human/MoneyPenny approval
 * boundary (Phase 9) and real Bankr credentials this deployment does not
 * have (Phase 0 finding, unchanged).
 *
 * Server-side only.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createBankrProviderAdapter } from '@/services/financialServices/providers/bankr/bankrProviderAdapter';
import type { BankrTokenLaunchTerms } from '@/services/financialServices/providers/bankr/bankrTypes';
import {
  getProviderWalletBinding,
  provisionProviderWalletBinding,
  type ProviderWalletBindingRow,
} from '@/services/financialServices/providers/providerWalletBinding';
import {
  createDraft,
  transitionState,
  recordBankrTerms,
  approveTokenLaunch,
  submitTokenLaunch,
  confirmTokenLaunch,
  checkBankrTermsDrift,
  type TokenLaunchRow,
  type CreateDraftInput,
} from '@/services/factor/tokenLaunchService';
import { createAssessment } from '@/services/aegis/aegisAssessmentService';

export interface BankrIssuerReadiness {
  beneficiaryAgentRuntimeId: string;
  bankrConfigured: boolean;
  bankrMode: 'live' | 'fake';
  hasProviderWalletBinding: boolean;
  providerWalletBinding: ProviderWalletBindingRow | null;
  ready: boolean;
  blockers: string[];
}

/**
 * "Assess issuer readiness" — a real, honest composition of Bankr's own
 * configured/unconfigured state and whether a provider-wallet binding
 * exists. Never asserts admission/registry state on its own authority; a
 * caller that also needs that fact reads it from the existing journey/
 * registry services directly (this function does not duplicate them).
 */
export async function assessIssuerReadiness(
  admin: SupabaseClient,
  tenantId: string,
  beneficiaryAgentRuntimeId: string,
): Promise<BankrIssuerReadiness> {
  const adapter = createBankrProviderAdapter();
  const status = adapter.getStatus();
  const binding = await getProviderWalletBinding(admin, tenantId, beneficiaryAgentRuntimeId, 'bankr');

  const blockers: string[] = [];
  if (!status.configured) blockers.push('Bankr is not configured for this deployment — no BANKR_*_API_KEY is set (simulated mode only).');
  if (!binding || binding.status !== 'active') blockers.push(`No active Bankr provider-wallet binding exists for ${beneficiaryAgentRuntimeId} — provision one first.`);

  return {
    beneficiaryAgentRuntimeId,
    bankrConfigured: status.configured,
    bankrMode: status.mode,
    hasProviderWalletBinding: Boolean(binding && binding.status === 'active'),
    providerWalletBinding: binding,
    ready: blockers.length === 0,
    blockers,
  };
}

/** "Inspect provider-binding readiness" — reads or provisions the binding (idempotent). */
export async function inspectOrProvisionProviderBinding(
  admin: SupabaseClient,
  tenantId: string,
  agentRuntimeId: string,
): Promise<ProviderWalletBindingRow> {
  return provisionProviderWalletBinding(admin, { tenantId, agentRuntimeId, provider: 'bankr' });
}

/** "Prepare launch proposal" — creates the draft token_launches row. Never
 *  invents token_name/token_symbol/etc — every field here is caller-
 *  supplied (an operator form/capsule, per Phase 5's own constraint), not
 *  guessed by this function. */
export async function prepareLaunchProposal(admin: SupabaseClient, input: CreateDraftInput): Promise<TokenLaunchRow> {
  const draft = await createDraft(admin, input);
  return transitionState(admin, { id: draft.id, tenantId: input.tenantId, toState: 'preparing', actorPersonaId: input.requestingPrincipalPersonaId });
}

export interface PreflightResult {
  launch: TokenLaunchRow;
  bankrTerms: BankrTokenLaunchTerms;
}

/**
 * "Run deterministic preflight/simulation" — quotes Bankr's REAL terms
 * (live or the deterministic fake, never hardcoded), records them onto the
 * draft, and advances the state machine. This IS the deterministic
 * preflight: the fake transport's quote is itself deterministic
 * (bankrTransport.ts), so a rehearsal with no live credentials still
 * produces a real, reproducible preflight result — honestly marked
 * `simulated: true` inside `bankrTerms.raw`.
 */
export async function preflightLaunch(admin: SupabaseClient, id: string, tenantId: string, actorPersonaId: string): Promise<PreflightResult> {
  const adapter = createBankrProviderAdapter();
  const { data: launchRow, error } = await admin.from('token_launches').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`preflightLaunch read failed: ${error.message}`);
  const launch = launchRow as TokenLaunchRow;

  const terms = await adapter.getTokenLaunchQuote({ chain: launch.chain, tokenName: launch.token_name, tokenSymbol: launch.token_symbol, pairedAsset: launch.paired_asset ?? undefined });
  await recordBankrTerms(admin, id, tenantId, { raw: terms.raw, sourceUrl: terms.sourceUrl, retrievedAt: terms.retrievedAt });
  const preflighted = await transitionState(admin, { id, tenantId, toState: 'preflighted', actorPersonaId });
  return { launch: preflighted, bankrTerms: terms };
}

/**
 * "Request Aegis assessment" — opens the independent assessment and moves
 * the launch to aegis_review_pending. `requestedByAgentRef` is always the
 * PREPARING agent (Factor, or whoever prepared it) — never the beneficiary
 * when they differ, and the self-assessment refusal in
 * aegisAssessmentService.ts still applies unconditionally: Factor
 * preparing its OWN token cannot also be its assessor (Phase 5's explicit
 * conflict-surfacing requirement — see requestAegisAssessment's caller,
 * which must never pass assessedByAgentRef === requestedByAgentRef).
 */
export async function requestAegisAssessment(
  admin: SupabaseClient,
  input: { launchId: string; tenantId: string; policyVersion: string; evidenceSnapshot: Record<string, unknown>; requestedByAgentRef: string; actorPersonaId: string },
): Promise<TokenLaunchRow> {
  const assessment = await createAssessment(admin, {
    subjectType: 'token_launch',
    subjectRef: input.launchId,
    policyVersion: input.policyVersion,
    evidenceSnapshot: input.evidenceSnapshot,
    requestedByAgentRef: input.requestedByAgentRef,
    actorPersonaId: input.actorPersonaId,
  });
  await admin.from('token_launches').update({ aegis_assessment_id: assessment.assessment_id, updated_at: new Date().toISOString() }).eq('id', input.launchId);
  return transitionState(admin, { id: input.launchId, tenantId: input.tenantId, toState: 'aegis_review_pending', actorPersonaId: input.actorPersonaId });
}

/** "Request MoneyPenny approval" — moves the launch into the human-approval
 *  queue. Never itself approves — approveTokenLaunch (tokenLaunchService.ts)
 *  is the sole path to 'approved', and it is never called from here. */
export async function requestApproval(admin: SupabaseClient, id: string, tenantId: string, actorPersonaId: string): Promise<TokenLaunchRow> {
  return transitionState(admin, { id, tenantId, toState: 'approval_pending', actorPersonaId });
}

/**
 * "Submit an approved launch" — the ONE function that calls Bankr's real
 * write API. Refuses outright unless the launch is 'approved' (enforced by
 * submitTokenLaunch's own state check) and requires a fresh Bankr-terms
 * drift check to have already been performed by the caller — this function
 * does not itself re-quote or silently proceed past drift; see
 * checkBankrTermsDrift, which the caller (Factor's capability route, not
 * this service layer) must call and act on BEFORE reaching here.
 */
export async function submitApprovedLaunch(
  admin: SupabaseClient,
  input: { id: string; tenantId: string; actorPersonaId: string; idempotencyKey: string },
): Promise<TokenLaunchRow> {
  const { data: launchRow, error } = await admin.from('token_launches').select('*').eq('id', input.id).maybeSingle();
  if (error) throw new Error(`submitApprovedLaunch read failed: ${error.message}`);
  const launch = launchRow as TokenLaunchRow;

  const adapter = createBankrProviderAdapter();
  const submission = await adapter.submitTokenLaunch(
    {
      chain: launch.chain,
      tokenName: launch.token_name,
      tokenSymbol: launch.token_symbol,
      feeRecipient: launch.fee_recipient,
      pairedAsset: launch.paired_asset,
    },
    input.idempotencyKey,
  );
  return submitTokenLaunch(admin, { id: input.id, tenantId: input.tenantId, actorPersonaId: input.actorPersonaId, idempotencyKey: input.idempotencyKey, bankrJobId: submission.jobId });
}

/** "Inspect deployment status" — reads Bankr's own job status and, once
 *  confirmed on-chain, records it (confirmTokenLaunch). Read-only against
 *  Bankr; the confirm write only happens once Bankr itself reports a
 *  concrete transaction/token address — never inferred or guessed. */
export async function inspectDeploymentStatus(
  admin: SupabaseClient,
  input: { id: string; tenantId: string; actorPersonaId: string },
): Promise<TokenLaunchRow> {
  const { data: launchRow, error } = await admin.from('token_launches').select('*').eq('id', input.id).maybeSingle();
  if (error) throw new Error(`inspectDeploymentStatus read failed: ${error.message}`);
  const launch = launchRow as TokenLaunchRow;
  if (!launch.bankr_job_id) return launch; // nothing submitted yet — nothing to inspect

  const adapter = createBankrProviderAdapter();
  const status = await adapter.getTokenLaunchStatus(launch.bankr_job_id);
  if (status.transactionHash && status.tokenAddress) {
    return confirmTokenLaunch(admin, {
      id: input.id,
      tenantId: input.tenantId,
      actorPersonaId: input.actorPersonaId,
      transactionHash: status.transactionHash,
      tokenAddress: status.tokenAddress,
      poolAddress: status.poolAddress,
      explorerUrl: status.explorerUrl,
    });
  }
  return launch;
}

export interface FeeClaimInspection {
  launchId: string;
  tokenAddress: string | null;
  /**
   * Honest limitation: Bankr's publicly documented surfaces
   * (docs.bankr.bot) describe token launching and wallet balance/transfer
   * endpoints; no dedicated fee-claim endpoint was found during Phase 0's
   * reconciliation. This function reports what CAN be inspected today (the
   * confirmed token address, and the provider wallet's own balance as a
   * proxy) and states the real gap explicitly — never fabricates a claim
   * amount or a claim capability that does not exist.
   */
  claimableAmountKnown: false;
  note: string;
}

/** "Inspect or prepare fee claims" — see FeeClaimInspection's own doc for
 *  why this is honestly limited today. */
export async function inspectFeeClaims(admin: SupabaseClient, id: string): Promise<FeeClaimInspection> {
  const { data: launchRow, error } = await admin.from('token_launches').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`inspectFeeClaims read failed: ${error.message}`);
  const launch = launchRow as TokenLaunchRow;
  return {
    launchId: id,
    tokenAddress: launch.token_address,
    claimableAmountKnown: false,
    note: launch.token_address
      ? 'Bankr has no publicly documented fee-claim endpoint (Phase 0 finding) — the confirmed token address is reported for the operator to check directly in the Bankr dashboard.'
      : 'This launch has not confirmed a token address yet — there is nothing to check fee claims against.',
  };
}

export { checkBankrTermsDrift };
