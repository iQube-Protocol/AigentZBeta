/**
 * Token-launch domain — a PROVIDER-NEUTRAL governed aggregate (Factor +
 * Aegis Bankr PRD, Phase 4). Not a Factor-only table: `beneficiaryAgent
 * RuntimeId` names who the launch is for, `preparingAgentRuntimeId` names
 * who is preparing it (Factor today; nothing here assumes it always is).
 *
 * Lifecycle (server-validated, mirroring factorCaseService.ts's
 * FORWARD_TRANSITIONS discipline):
 *
 *   draft -> preparing -> preflighted -> aegis_review_pending
 *     -> { revision_required | approval_pending }
 *   revision_required -> preparing
 *   approval_pending -> { approved | revision_required }
 *   approved -> { submitting | revision_required (term drift) | cancelled }
 *   submitting -> { submitted | failed }
 *   submitted -> { confirmed | failed }
 *   confirmed / cancelled / failed: terminal via transitionState (a FAILED
 *   launch may still be revised — see reviseWithNewVersion)
 *   superseded: reached ONLY via reviseWithNewVersion, never transitionState
 *
 * IMMUTABILITY: once a row reaches 'approved' or later, the DB trigger
 * (20260930220000_token_launches.sql) refuses any change to a spec-bearing
 * field — this service never attempts one; a revision always goes through
 * `reviseWithNewVersion`, which creates a NEW row and marks the OLD row's
 * `superseded_by`, never editing it.
 *
 * Server-side only.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { commit } from '@/services/factor/canonical';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { getCurrentAssessment } from '@/services/aegis/aegisAssessmentService';

export type TokenLaunchState =
  | 'draft'
  | 'preparing'
  | 'preflighted'
  | 'aegis_review_pending'
  | 'revision_required'
  | 'approval_pending'
  | 'approved'
  | 'submitting'
  | 'submitted'
  | 'confirmed'
  | 'failed'
  | 'cancelled'
  | 'superseded';

const FORWARD_TRANSITIONS: Record<TokenLaunchState, TokenLaunchState[]> = {
  draft: ['preparing', 'cancelled'],
  preparing: ['preflighted', 'cancelled'],
  preflighted: ['aegis_review_pending', 'revision_required', 'cancelled'],
  aegis_review_pending: ['revision_required', 'approval_pending', 'cancelled'],
  revision_required: ['preparing', 'cancelled'],
  approval_pending: ['approved', 'revision_required', 'cancelled'],
  approved: ['submitting', 'revision_required', 'cancelled'],
  submitting: ['submitted', 'failed'],
  submitted: ['confirmed', 'failed'],
  confirmed: [],
  failed: ['revision_required'],
  cancelled: [],
  superseded: [],
};

const TERMINAL_STATES = new Set<TokenLaunchState>(['confirmed', 'cancelled', 'superseded']);

export class TokenLaunchError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'TokenLaunchError';
  }
}

export interface TokenLaunchRow {
  id: string;
  tenant_id: string;
  beneficiary_agent_runtime_id: string;
  requesting_principal_persona_id: string;
  preparing_agent_runtime_id: string;
  provider: 'bankr';
  provider_wallet_binding_id: string | null;
  state: TokenLaunchState;
  execution_mode: 'dry_run' | 'live';
  chain: string;
  token_name: string;
  token_symbol: string;
  description: string | null;
  utility_claims: unknown[];
  image_url: string | null;
  metadata_url: string | null;
  website_url: string | null;
  social_refs: unknown[];
  fee_recipient: string | null;
  paired_asset: string | null;
  vesting_config: Record<string, unknown> | null;
  bankr_terms: Record<string, unknown> | null;
  bankr_terms_source_url: string | null;
  bankr_terms_retrieved_at: string | null;
  bankr_terms_hash: string | null;
  conflict_disclosures: unknown[];
  risk_disclosures: unknown[];
  aegis_assessment_id: string | null;
  spec_hash: string | null;
  approval_hash: string | null;
  approved_by_persona_id: string | null;
  approved_at: string | null;
  idempotency_key: string | null;
  bankr_job_id: string | null;
  transaction_hash: string | null;
  token_address: string | null;
  pool_address: string | null;
  explorer_url: string | null;
  version: number;
  supersedes_id: string | null;
  superseded_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Every field the DB trigger treats as spec-bearing (frozen once approved+)
 *  — the exact hash input for `spec_hash`. Kept as one named list so the
 *  hash, the trigger's own column set, and this service's understanding of
 *  "the spec" can never silently disagree. */
const SPEC_FIELDS = [
  'chain', 'token_name', 'token_symbol', 'description', 'utility_claims',
  'image_url', 'metadata_url', 'website_url', 'social_refs', 'fee_recipient',
  'paired_asset', 'vesting_config', 'bankr_terms', 'bankr_terms_hash',
  'conflict_disclosures', 'risk_disclosures', 'aegis_assessment_id',
] as const;

export function computeSpecHash(row: TokenLaunchRow): string {
  const spec: Record<string, unknown> = {};
  for (const field of SPEC_FIELDS) spec[field] = row[field];
  return commit(spec);
}

export interface CreateDraftInput {
  tenantId: string;
  beneficiaryAgentRuntimeId: string;
  requestingPrincipalPersonaId: string;
  preparingAgentRuntimeId: string;
  providerWalletBindingId?: string | null;
  chain: string;
  tokenName: string;
  tokenSymbol: string;
  description?: string | null;
  utilityClaims?: unknown[];
  imageUrl?: string | null;
  metadataUrl?: string | null;
  websiteUrl?: string | null;
  socialRefs?: unknown[];
  feeRecipient?: string | null;
  pairedAsset?: string | null;
  vestingConfig?: Record<string, unknown> | null;
  conflictDisclosures?: unknown[];
  riskDisclosures?: unknown[];
}

export async function createDraft(admin: SupabaseClient, input: CreateDraftInput): Promise<TokenLaunchRow> {
  const { data, error } = await admin
    .from('token_launches')
    .insert({
      id: randomUUID(),
      tenant_id: input.tenantId,
      beneficiary_agent_runtime_id: input.beneficiaryAgentRuntimeId,
      requesting_principal_persona_id: input.requestingPrincipalPersonaId,
      preparing_agent_runtime_id: input.preparingAgentRuntimeId,
      provider: 'bankr',
      provider_wallet_binding_id: input.providerWalletBindingId ?? null,
      state: 'draft',
      execution_mode: 'dry_run',
      chain: input.chain,
      token_name: input.tokenName,
      token_symbol: input.tokenSymbol,
      description: input.description ?? null,
      utility_claims: input.utilityClaims ?? [],
      image_url: input.imageUrl ?? null,
      metadata_url: input.metadataUrl ?? null,
      website_url: input.websiteUrl ?? null,
      social_refs: input.socialRefs ?? [],
      fee_recipient: input.feeRecipient ?? null,
      paired_asset: input.pairedAsset ?? null,
      vesting_config: input.vestingConfig ?? null,
      conflict_disclosures: input.conflictDisclosures ?? [],
      risk_disclosures: input.riskDisclosures ?? [],
      bankr_terms: null,
      bankr_terms_source_url: null,
      bankr_terms_retrieved_at: null,
      bankr_terms_hash: null,
      aegis_assessment_id: null,
      spec_hash: null,
      approval_hash: null,
      approved_by_persona_id: null,
      approved_at: null,
      idempotency_key: null,
      bankr_job_id: null,
      transaction_hash: null,
      token_address: null,
      pool_address: null,
      explorer_url: null,
      version: 1,
      supersedes_id: null,
      superseded_by: null,
    })
    .select('*')
    .single();
  if (error) throw new Error(`createDraft failed: ${error.message}`);

  await createActivityReceipt({
    personaId: input.requestingPrincipalPersonaId,
    activeCartridge: 'moneypenny',
    actionType: 'token_launch_proposed',
    summary: `Token launch draft opened for ${input.beneficiaryAgentRuntimeId}: ${input.tokenName} (${input.tokenSymbol}) on ${input.chain}`,
    agentsInvoked: [input.preparingAgentRuntimeId],
    actionInput: { launchId: (data as TokenLaunchRow).id, chain: input.chain, tokenSymbol: input.tokenSymbol },
  });

  return data as TokenLaunchRow;
}

async function readLaunch(admin: SupabaseClient, id: string, tenantId: string): Promise<TokenLaunchRow> {
  const { data, error } = await admin.from('token_launches').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`readLaunch failed: ${error.message}`);
  if (!data) throw new TokenLaunchError('launch-not-found', `No token_launches row for id ${id}`);
  const row = data as TokenLaunchRow;
  if (row.tenant_id !== tenantId) {
    throw new TokenLaunchError('cross-tenant-denied', `Launch ${id} belongs to tenant '${row.tenant_id}', not '${tenantId}'`);
  }
  return row;
}

export interface TransitionInput {
  id: string;
  tenantId: string;
  toState: TokenLaunchState;
  reason?: string;
  actorPersonaId: string;
}

export async function transitionState(admin: SupabaseClient, input: TransitionInput): Promise<TokenLaunchRow> {
  const row = await readLaunch(admin, input.id, input.tenantId);
  if (row.state === input.toState) return row; // idempotent replay
  if (TERMINAL_STATES.has(row.state)) {
    throw new TokenLaunchError('terminal-state', `Launch ${input.id} is in terminal state '${row.state}' and cannot transition further.`);
  }
  const allowed = FORWARD_TRANSITIONS[row.state] ?? [];
  if (!allowed.includes(input.toState)) {
    throw new TokenLaunchError(
      'invalid-transition',
      `Launch ${input.id} cannot move from '${row.state}' to '${input.toState}' (allowed: ${allowed.join(', ') || 'none'}).`,
    );
  }
  const { data, error } = await admin
    .from('token_launches')
    .update({ state: input.toState, updated_at: new Date().toISOString() })
    .eq('id', input.id)
    .eq('state', row.state)
    .select('*')
    .single();
  if (error) throw new Error(`transitionState update failed: ${error.message}`);

  if (input.toState === 'revision_required') {
    await createActivityReceipt({
      personaId: input.actorPersonaId,
      activeCartridge: 'moneypenny',
      actionType: 'token_launch_proposed',
      summary: `Token launch ${input.id} sent back for revision: ${input.reason ?? 'no reason given'}`,
      agentsInvoked: [row.preparing_agent_runtime_id],
      actionInput: { launchId: input.id, fromState: row.state },
    });
  }
  return data as TokenLaunchRow;
}

/**
 * Capture Bankr's live-quoted economic terms onto the draft (Phase 4: "no
 * hardcoded Bankr economics"). Only valid before approval — the DB trigger
 * would refuse this once approved+ anyway; checked here too so the error is
 * a clear domain refusal rather than a raw Postgres exception.
 */
export async function recordBankrTerms(
  admin: SupabaseClient,
  id: string,
  tenantId: string,
  terms: { raw: Record<string, unknown>; sourceUrl: string; retrievedAt: string },
): Promise<TokenLaunchRow> {
  const row = await readLaunch(admin, id, tenantId);
  if (row.state === 'approved' || row.state === 'submitting' || row.state === 'submitted' || row.state === 'confirmed') {
    throw new TokenLaunchError('already-approved', `Launch ${id} is '${row.state}' — Bankr terms are frozen; supersede with a new version instead.`);
  }
  const bankrTermsHash = commit(terms.raw);
  const { data, error } = await admin
    .from('token_launches')
    .update({
      bankr_terms: terms.raw,
      bankr_terms_source_url: terms.sourceUrl,
      bankr_terms_retrieved_at: terms.retrievedAt,
      bankr_terms_hash: bankrTermsHash,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(`recordBankrTerms failed: ${error.message}`);
  return data as TokenLaunchRow;
}

export interface ApproveInput {
  id: string;
  tenantId: string;
  approvedByPersonaId: string;
  approvedAt: string;
}

/**
 * The sole path to 'approved'. Requires: state === 'approval_pending', a
 * ratified Aegis assessment (subject_type='token_launch', subject_ref=id)
 * whose decision supports approval, and Bankr terms already captured
 * (recordBankrTerms) — never approves a launch with no economic terms on
 * record. Computes spec_hash + approval_hash and freezes them onto the row;
 * the DB trigger takes over enforcement from this point.
 */
export async function approveTokenLaunch(admin: SupabaseClient, input: ApproveInput): Promise<TokenLaunchRow> {
  const row = await readLaunch(admin, input.id, input.tenantId);
  if (row.state !== 'approval_pending') {
    throw new TokenLaunchError('not-approval-pending', `Launch ${input.id} is '${row.state}', not 'approval_pending'.`);
  }
  if (!row.bankr_terms || !row.bankr_terms_hash) {
    throw new TokenLaunchError('no-bankr-terms', `Launch ${input.id} has no recorded Bankr terms — call recordBankrTerms before approval.`);
  }
  const assessment = row.aegis_assessment_id
    ? await getCurrentAssessment(admin, 'token_launch', input.id)
    : null;
  if (!assessment || assessment.state !== 'ratified' || !['admissible', 'admissible_with_conditions'].includes(assessment.decision ?? '')) {
    throw new TokenLaunchError(
      'no-ratified-assessment',
      `Launch ${input.id} has no ratified Aegis assessment supporting approval — a critical Aegis finding, or the absence of any assessment, blocks approval.`,
    );
  }

  const specHash = computeSpecHash(row);
  const approvalHash = commit({ specHash, approvedBy: input.approvedByPersonaId, approvedAt: input.approvedAt });

  const { data, error } = await admin
    .from('token_launches')
    .update({
      state: 'approved',
      spec_hash: specHash,
      approval_hash: approvalHash,
      approved_by_persona_id: input.approvedByPersonaId,
      approved_at: input.approvedAt,
      updated_at: input.approvedAt,
    })
    .eq('id', input.id)
    .eq('state', 'approval_pending')
    .select('*')
    .single();
  if (error) throw new Error(`approveTokenLaunch update failed: ${error.message}`);

  await createActivityReceipt({
    personaId: input.approvedByPersonaId,
    activeCartridge: 'moneypenny',
    actionType: 'token_launch_approved',
    summary: `Token launch ${input.id} approved (spec ${specHash.slice(0, 16)}…, approval ${approvalHash.slice(0, 16)}…)`,
    agentsInvoked: [row.preparing_agent_runtime_id],
    actionInput: { launchId: input.id, specHash, approvalHash },
  });

  return data as TokenLaunchRow;
}

export interface TermDriftCheck {
  driftDetected: boolean;
  storedHash: string | null;
  freshHash: string;
}

/**
 * "Changed Bankr economics force reapproval" (Phase 8 acceptance
 * criterion), mechanically: compare a FRESH quote's hash against the
 * approved row's frozen bankr_terms_hash. Pure comparison — never mutates
 * anything; a caller that detects drift must transition the row to
 * 'revision_required' (transitionState) and prepare a new version
 * (reviseWithNewVersion), never edit the approved row.
 */
export function checkBankrTermsDrift(row: TokenLaunchRow, freshTerms: Record<string, unknown>): TermDriftCheck {
  const freshHash = commit(freshTerms);
  return { driftDetected: row.bankr_terms_hash !== freshHash, storedHash: row.bankr_terms_hash, freshHash };
}

export interface SubmitInput {
  id: string;
  tenantId: string;
  actorPersonaId: string;
  idempotencyKey: string;
  bankrJobId: string;
}

/** Requires 'approved'. Duplicate submission is structurally impossible —
 *  `idempotency_key` carries a unique index; a retry with the SAME key
 *  against a row already past 'approved' is refused as a replay, never a
 *  second submission. */
export async function submitTokenLaunch(admin: SupabaseClient, input: SubmitInput): Promise<TokenLaunchRow> {
  const row = await readLaunch(admin, input.id, input.tenantId);
  if (row.state === 'submitting' || row.state === 'submitted' || row.state === 'confirmed') {
    if (row.idempotency_key === input.idempotencyKey) return row; // replay
    throw new TokenLaunchError('already-submitted', `Launch ${input.id} is already '${row.state}'.`);
  }
  if (row.state !== 'approved') {
    throw new TokenLaunchError('not-approved', `Launch ${input.id} is '${row.state}', not 'approved' — no launch may submit without an approved exact-spec hash.`);
  }
  const { data, error } = await admin
    .from('token_launches')
    .update({ state: 'submitting', idempotency_key: input.idempotencyKey, bankr_job_id: input.bankrJobId, updated_at: new Date().toISOString() })
    .eq('id', input.id)
    .eq('state', 'approved')
    .select('*')
    .single();
  if (error) throw new Error(`submitTokenLaunch update failed: ${error.message}`);

  await createActivityReceipt({
    personaId: input.actorPersonaId,
    activeCartridge: 'moneypenny',
    actionType: 'token_launch_submitted',
    summary: `Token launch ${input.id} submitted to Bankr (job ${input.bankrJobId})`,
    agentsInvoked: [row.preparing_agent_runtime_id],
    actionInput: { launchId: input.id, bankrJobId: input.bankrJobId },
  });

  return data as TokenLaunchRow;
}

export interface ConfirmInput {
  id: string;
  tenantId: string;
  actorPersonaId: string;
  transactionHash: string;
  tokenAddress: string;
  poolAddress: string | null;
  explorerUrl: string | null;
}

export async function confirmTokenLaunch(admin: SupabaseClient, input: ConfirmInput): Promise<TokenLaunchRow> {
  const row = await readLaunch(admin, input.id, input.tenantId);
  if (row.state === 'confirmed') return row; // idempotent replay
  if (row.state !== 'submitting' && row.state !== 'submitted') {
    throw new TokenLaunchError('not-submitted', `Launch ${input.id} is '${row.state}' — cannot confirm before submission.`);
  }
  const { data, error } = await admin
    .from('token_launches')
    .update({
      state: 'confirmed',
      transaction_hash: input.transactionHash,
      token_address: input.tokenAddress,
      pool_address: input.poolAddress,
      explorer_url: input.explorerUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
    .select('*')
    .single();
  if (error) throw new Error(`confirmTokenLaunch update failed: ${error.message}`);

  await createActivityReceipt({
    personaId: input.actorPersonaId,
    activeCartridge: 'moneypenny',
    actionType: 'token_launch_confirmed',
    summary: `Token launch ${input.id} confirmed on-chain (tx ${input.transactionHash})`,
    agentsInvoked: [row.preparing_agent_runtime_id],
    actionInput: { launchId: input.id, transactionHash: input.transactionHash, tokenAddress: input.tokenAddress },
  });

  return data as TokenLaunchRow;
}

/**
 * The ONLY path to a new spec version. Never edits the current row (the DB
 * trigger would refuse it past 'approved' anyway) — marks it
 * `superseded_by` and inserts a fresh 'draft' row with `version + 1`,
 * `supersedes_id` pointing back. `overrides` may change ANY spec field,
 * including provider terms — this is exactly the mechanism "changed Bankr
 * economics force reapproval" resolves through.
 */
export async function reviseWithNewVersion(
  admin: SupabaseClient,
  currentId: string,
  tenantId: string,
  overrides: Partial<Pick<CreateDraftInput, 'chain' | 'tokenName' | 'tokenSymbol' | 'description' | 'utilityClaims' | 'imageUrl' | 'metadataUrl' | 'websiteUrl' | 'socialRefs' | 'feeRecipient' | 'pairedAsset' | 'vestingConfig' | 'conflictDisclosures' | 'riskDisclosures'>>,
): Promise<TokenLaunchRow> {
  const current = await readLaunch(admin, currentId, tenantId);
  if (current.superseded_by) {
    throw new TokenLaunchError('already-superseded', `Launch ${currentId} is already superseded by ${current.superseded_by}.`);
  }

  const nextId = randomUUID();
  const { data: created, error: insertErr } = await admin
    .from('token_launches')
    .insert({
      id: nextId,
      tenant_id: current.tenant_id,
      beneficiary_agent_runtime_id: current.beneficiary_agent_runtime_id,
      requesting_principal_persona_id: current.requesting_principal_persona_id,
      preparing_agent_runtime_id: current.preparing_agent_runtime_id,
      provider: current.provider,
      provider_wallet_binding_id: current.provider_wallet_binding_id,
      state: 'draft',
      execution_mode: current.execution_mode,
      chain: overrides.chain ?? current.chain,
      token_name: overrides.tokenName ?? current.token_name,
      token_symbol: overrides.tokenSymbol ?? current.token_symbol,
      description: overrides.description ?? current.description,
      utility_claims: overrides.utilityClaims ?? current.utility_claims,
      image_url: overrides.imageUrl ?? current.image_url,
      metadata_url: overrides.metadataUrl ?? current.metadata_url,
      website_url: overrides.websiteUrl ?? current.website_url,
      social_refs: overrides.socialRefs ?? current.social_refs,
      fee_recipient: overrides.feeRecipient ?? current.fee_recipient,
      paired_asset: overrides.pairedAsset ?? current.paired_asset,
      vesting_config: overrides.vestingConfig ?? current.vesting_config,
      conflict_disclosures: overrides.conflictDisclosures ?? current.conflict_disclosures,
      risk_disclosures: overrides.riskDisclosures ?? current.risk_disclosures,
      // A fresh draft never inherits the superseded row's provider terms or
      // approval state — Bankr terms must be re-quoted, Aegis must
      // re-assess, and approval must happen again from scratch.
      bankr_terms: null,
      bankr_terms_source_url: null,
      bankr_terms_retrieved_at: null,
      bankr_terms_hash: null,
      aegis_assessment_id: null,
      spec_hash: null,
      approval_hash: null,
      approved_by_persona_id: null,
      approved_at: null,
      idempotency_key: null,
      bankr_job_id: null,
      transaction_hash: null,
      token_address: null,
      pool_address: null,
      explorer_url: null,
      version: current.version + 1,
      supersedes_id: currentId,
      superseded_by: null,
    })
    .select('*')
    .single();
  if (insertErr) throw new Error(`reviseWithNewVersion insert failed: ${insertErr.message}`);

  const { error: supersedeErr } = await admin
    .from('token_launches')
    .update({ superseded_by: nextId, state: 'superseded', updated_at: new Date().toISOString() })
    .eq('id', currentId);
  if (supersedeErr) throw new Error(`reviseWithNewVersion supersede failed: ${supersedeErr.message}`);

  return created as TokenLaunchRow;
}
