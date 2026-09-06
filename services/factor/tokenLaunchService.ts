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
  /** The Factor case (or other journey) this launch rehearsal is bound to
   *  (item 4, 2026-09-07 correction). Null only for rows created before this
   *  column existed. */
  case_ref: string | null;
  /** Deterministic draft-time commitment over {tenantId, caseRef,
   *  beneficiaryAgentRuntimeId, chain, tokenName, tokenSymbol, description}
   *  — see computeDraftIdempotencyKey(). Distinct from `idempotency_key`
   *  (the submission-time key, set only once approved). Unique per tenant
   *  in Postgres (uq_token_launches_draft_idempotency). */
  draft_idempotency_key: string | null;
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
  /** The Factor case (or other journey) this draft is bound to — item 4,
   *  2026-09-07. Optional here (the general, non-Use-Case-Zero
   *  `prepareLaunchProposal` acceptance path never supplied one and must
   *  keep working); required by `createOrResumeDraft` below. */
  caseRef?: string | null;
}

function draftInsertRow(id: string, input: CreateDraftInput, draftIdempotencyKey: string | null) {
  return {
    id,
    tenant_id: input.tenantId,
    beneficiary_agent_runtime_id: input.beneficiaryAgentRuntimeId,
    requesting_principal_persona_id: input.requestingPrincipalPersonaId,
    preparing_agent_runtime_id: input.preparingAgentRuntimeId,
    case_ref: input.caseRef ?? null,
    draft_idempotency_key: draftIdempotencyKey,
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
  };
}

export async function createDraft(admin: SupabaseClient, input: CreateDraftInput): Promise<TokenLaunchRow> {
  const { data, error } = await admin
    .from('token_launches')
    .insert(draftInsertRow(randomUUID(), input, null))
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

/**
 * The one tenant-checked read for this table — exported so every OTHER
 * caller (bankrCapabilityHandlers.ts, API routes) reads a launch through
 * the SAME tenant guard every write path here already uses, rather than
 * each reinventing its own `.eq('id', id)` select with no tenant_id check
 * (the exact cross-tenant read gap this export closes).
 */
export async function getTokenLaunch(admin: SupabaseClient, id: string, tenantId: string): Promise<TokenLaunchRow> {
  return readLaunch(admin, id, tenantId);
}

/**
 * The canonical idempotent lookup for "does a token launch already exist for
 * THIS CASE?" (item 4, 2026-09-07 correction — replaces the earlier
 * beneficiary-only `findLatestTokenLaunchForBeneficiary`, which conflated
 * every case/journey a beneficiary might ever run and could not tell "the
 * same case, asked twice" apart from "a genuinely different case"). Orders
 * by `version` descending so a superseded chain always resolves to its
 * current head. Case-bound, not spec-bound — this is the read the
 * governedOperationRehearsal READINESS LEG uses to answer "has a rehearsal
 * been completed for this case", regardless of the exact spec; the
 * exact-spec, idempotent CREATE-time guarantee is a separate concern,
 * provided by `createOrResumeDraft` below via the `draft_idempotency_key`
 * unique index.
 */
export async function findLatestTokenLaunchForCase(
  admin: SupabaseClient,
  tenantId: string,
  caseRef: string,
): Promise<TokenLaunchRow | null> {
  const { data, error } = await admin
    .from('token_launches')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('case_ref', caseRef)
    .order('version', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findLatestTokenLaunchForCase failed: ${error.message}`);
  return (data as TokenLaunchRow | null) ?? null;
}

/**
 * Deterministic draft-time commitment (item 4) over exactly the fields that
 * define "the same rehearsal request" — tenant, case, beneficiary, and the
 * operator-supplied spec fields. Computed BEFORE Bankr terms exist (terms
 * are quoted only once a draft is preflighted), so this is intentionally a
 * narrower hash than `computeSpecHash` (which also covers bankr_terms and is
 * only ever computed at APPROVAL time). Any field changing — including the
 * spec — produces a DIFFERENT key, so a changed specification can never
 * collide with, resume, or trigger a preflight against an older draft.
 */
export function computeDraftIdempotencyKey(input: {
  tenantId: string;
  caseRef: string;
  beneficiaryAgentRuntimeId: string;
  chain: string;
  tokenName: string;
  tokenSymbol: string;
  description?: string | null;
}): string {
  return commit({
    tenantId: input.tenantId,
    caseRef: input.caseRef,
    beneficiaryAgentRuntimeId: input.beneficiaryAgentRuntimeId,
    chain: input.chain,
    tokenName: input.tokenName,
    tokenSymbol: input.tokenSymbol,
    description: input.description ?? null,
  });
}

export interface CreateOrResumeDraftInput extends CreateDraftInput {
  /** Required here (optional on the general CreateDraftInput/
   *  prepareLaunchProposal path) — case-bound idempotency has nothing to
   *  scope by without it. */
  caseRef: string;
}

export interface CreateOrResumeDraftResult {
  launch: TokenLaunchRow;
  /** True only when THIS call's own insert won an atomic create race (or no
   *  prior row existed) — false when an existing, unchanged-spec row was
   *  resumed instead. */
  created: boolean;
  /** True when the incoming spec DIFFERED from the current row's spec and
   *  this call therefore superseded it with a new immutable version
   *  (reviseWithNewVersion) — never an independent duplicate. */
  superseded: boolean;
}

/**
 * The one tenant-checked read for "the CURRENT (non-superseded) launch for
 * this beneficiary" — the exact scope `uq_token_launches_current` enforces
 * in Postgres (tenant, beneficiary, provider, superseded_by IS NULL). At
 * most one row can ever match; the DB constraint is the real guarantee,
 * this is just the matching read.
 */
export async function findCurrentLaunchForBeneficiary(
  admin: SupabaseClient,
  tenantId: string,
  beneficiaryAgentRuntimeId: string,
): Promise<TokenLaunchRow | null> {
  const { data, error } = await admin
    .from('token_launches')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('beneficiary_agent_runtime_id', beneficiaryAgentRuntimeId)
    .eq('provider', 'bankr')
    .is('superseded_by', null)
    .maybeSingle();
  if (error) throw new Error(`findCurrentLaunchForBeneficiary failed: ${error.message}`);
  return (data as TokenLaunchRow | null) ?? null;
}

/**
 * The ONE atomic create-or-resume operation for a rehearsal draft (item 4,
 * corrected 2026-09-07 after review: the first version created BOTH a
 * PostgREST `ON CONFLICT` inference defect — a partial unique index cannot
 * be targeted by `onConflict`, only a full one — AND a governance defect —
 * a changed spec created an independent duplicate row instead of a
 * versioned, superseding revision, silently dropping the one-current-
 * launch invariant). Three cases, checked against
 * `findCurrentLaunchForBeneficiary` (the SAME scope `uq_token_launches_
 * current` enforces):
 *
 *   1. No current launch exists yet -> atomic first-create via
 *      `INSERT ... ON CONFLICT (tenant_id, draft_idempotency_key) DO
 *      NOTHING` (a FULL, non-partial index — PostgREST can infer it) +
 *      read-back. Two concurrent first-time callers with an IDENTICAL spec
 *      collapse onto the same row; `uq_token_launches_current` is the
 *      second, independent backstop against ever having two non-superseded
 *      rows for the same beneficiary even if this application logic were
 *      ever wrong.
 *   2. A current launch exists with the SAME draft_idempotency_key (exact
 *      same case + spec) -> resume it directly. No write at all.
 *   3. A current launch exists with a DIFFERENT key (the specification
 *      changed) -> `reviseWithNewVersion` supersedes it with a NEW
 *      immutable version carrying the new spec — never an independent
 *      duplicate. `reviseWithNewVersion` itself uses the same ON CONFLICT
 *      DO NOTHING + read-back pattern for its insert, so two concurrent
 *      "revise to the same new spec" callers also collapse onto one row.
 */
export async function createOrResumeDraft(admin: SupabaseClient, input: CreateOrResumeDraftInput): Promise<CreateOrResumeDraftResult> {
  const draftIdempotencyKey = computeDraftIdempotencyKey(input);
  const current = await findCurrentLaunchForBeneficiary(admin, input.tenantId, input.beneficiaryAgentRuntimeId);

  if (current && current.draft_idempotency_key === draftIdempotencyKey) {
    // Exact same case + spec as the CURRENT version — resume, no write.
    return { launch: current, created: false, superseded: false };
  }

  if (!current) {
    const { launch, created } = await insertDraftOrResumeByKey(admin, input, draftIdempotencyKey);
    return { launch, created, superseded: false };
  }

  // A current launch exists but the specification changed — this is a
  // REVISION, never an independent duplicate (governance correction).
  const revised = await reviseWithNewVersion(
    admin,
    current.id,
    input.tenantId,
    {
      chain: input.chain,
      tokenName: input.tokenName,
      tokenSymbol: input.tokenSymbol,
      description: input.description,
      utilityClaims: input.utilityClaims,
      imageUrl: input.imageUrl,
      metadataUrl: input.metadataUrl,
      websiteUrl: input.websiteUrl,
      socialRefs: input.socialRefs,
      feeRecipient: input.feeRecipient,
      pairedAsset: input.pairedAsset,
      vestingConfig: input.vestingConfig,
      conflictDisclosures: input.conflictDisclosures,
      riskDisclosures: input.riskDisclosures,
    },
    { caseRef: input.caseRef, draftIdempotencyKey, actorPersonaId: input.requestingPrincipalPersonaId },
  );
  return { launch: revised, created: true, superseded: true };
}

/** The atomic `INSERT ... ON CONFLICT (tenant_id, draft_idempotency_key) DO
 *  NOTHING` + read-back primitive shared by `createOrResumeDraft`'s
 *  first-create path and `reviseWithNewVersion`'s new-version insert. The
 *  target index MUST be a full (non-partial) unique index — PostgREST/
 *  PostgREST-shaped `upsert(..., { onConflict })` generates a plain
 *  column-list `ON CONFLICT` clause, which Postgres can only resolve
 *  against an index with no partial predicate
 *  (uq_token_launches_draft_idempotency, migration 20260930260000). */
async function insertDraftOrResumeByKey(
  admin: SupabaseClient,
  input: CreateDraftInput & { caseRef: string },
  draftIdempotencyKey: string,
): Promise<{ launch: TokenLaunchRow; created: boolean }> {
  const candidateId = randomUUID();
  const row = draftInsertRow(candidateId, input, draftIdempotencyKey);

  const { error: upsertErr } = await admin
    .from('token_launches')
    .upsert(row, { onConflict: 'tenant_id,draft_idempotency_key', ignoreDuplicates: true });
  if (upsertErr) throw new Error(`insertDraftOrResumeByKey upsert failed: ${upsertErr.message}`);

  const { data, error } = await admin
    .from('token_launches')
    .select('*')
    .eq('tenant_id', input.tenantId)
    .eq('draft_idempotency_key', draftIdempotencyKey)
    .single();
  if (error || !data) throw new Error(`insertDraftOrResumeByKey read-back failed: ${error?.message ?? 'no row found for the computed idempotency key'}`);

  const launch = data as TokenLaunchRow;
  const created = launch.id === candidateId;
  if (created) {
    await createActivityReceipt({
      personaId: input.requestingPrincipalPersonaId,
      activeCartridge: 'moneypenny',
      actionType: 'token_launch_proposed',
      summary: `Token launch draft opened for ${input.beneficiaryAgentRuntimeId} (case ${input.caseRef}): ${input.tokenName} (${input.tokenSymbol}) on ${input.chain}`,
      agentsInvoked: [input.preparingAgentRuntimeId],
      actionInput: { launchId: launch.id, caseRef: input.caseRef, chain: input.chain, tokenSymbol: input.tokenSymbol },
    });
  }
  return { launch, created };
}

/**
 * Atomically CLAIMS a 'draft' row for preflight — the only permitted
 * `draft -> preparing` writer (item 4 correction). A conditional `UPDATE
 * ... WHERE state = 'draft'` either affects exactly this row (this caller
 * won — `claimed: true`) or affects zero rows (someone else already
 * claimed it, or it was never 'draft' — `claimed: false`, and the CURRENT
 * row is read back instead). Never two callers may believe they both won;
 * only the winner may proceed to quote Bankr terms and write the
 * `bankr_launch_preflighted` receipt, which is what makes that receipt
 * idempotent — it is written at most once per row, by construction, never
 * de-duplicated after the fact.
 */
export async function claimDraftForPreflight(
  admin: SupabaseClient,
  id: string,
  tenantId: string,
): Promise<{ claimed: boolean; launch: TokenLaunchRow }> {
  const { data, error } = await admin
    .from('token_launches')
    .update({ state: 'preparing', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('state', 'draft')
    .select('*');
  if (error) throw new Error(`claimDraftForPreflight failed: ${error.message}`);
  const rows = (data as TokenLaunchRow[] | null) ?? [];
  if (rows.length === 1) return { claimed: true, launch: rows[0] };
  // Lost the claim (or the row was never 'draft') — read back whatever the
  // winner (or a prior call) left behind, rather than erroring.
  const launch = await readLaunch(admin, id, tenantId);
  return { claimed: false, launch };
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
 * economics force reapproval" resolves through, and (2026-09-07 correction)
 * exactly the mechanism `createOrResumeDraft` uses for a changed rehearsal
 * specification — never an independent duplicate row.
 *
 * `idempotency` is optional (every OTHER caller of this function predates
 * case-bound idempotency and must keep working unchanged): when supplied,
 * the new row's insert goes through the SAME atomic `ON CONFLICT (tenant_id,
 * draft_idempotency_key) DO NOTHING` + read-back primitive
 * `createOrResumeDraft` uses, so two concurrent callers revising the SAME
 * current row to the SAME new specification collapse onto one new version,
 * never two. The OLD row's own `draft_idempotency_key` is always cleared on
 * supersession (regardless of whether `idempotency` was supplied) — a
 * superseded row's key is meaningless going forward, and freeing it lets a
 * later, genuinely new draft reuse that exact key if a spec is ever
 * resubmitted, without colliding with a key retained on a defunct row.
 */
export async function reviseWithNewVersion(
  admin: SupabaseClient,
  currentId: string,
  tenantId: string,
  overrides: Partial<Pick<CreateDraftInput, 'chain' | 'tokenName' | 'tokenSymbol' | 'description' | 'utilityClaims' | 'imageUrl' | 'metadataUrl' | 'websiteUrl' | 'socialRefs' | 'feeRecipient' | 'pairedAsset' | 'vestingConfig' | 'conflictDisclosures' | 'riskDisclosures'>>,
  idempotency?: { caseRef: string; draftIdempotencyKey: string; actorPersonaId: string },
): Promise<TokenLaunchRow> {
  const current = await readLaunch(admin, currentId, tenantId);
  if (current.superseded_by) {
    throw new TokenLaunchError('already-superseded', `Launch ${currentId} is already superseded by ${current.superseded_by}.`);
  }

  const nextRow = {
    tenant_id: current.tenant_id,
    beneficiary_agent_runtime_id: current.beneficiary_agent_runtime_id,
    requesting_principal_persona_id: current.requesting_principal_persona_id,
    preparing_agent_runtime_id: current.preparing_agent_runtime_id,
    case_ref: idempotency?.caseRef ?? current.case_ref,
    draft_idempotency_key: idempotency?.draftIdempotencyKey ?? null,
    provider: current.provider,
    provider_wallet_binding_id: current.provider_wallet_binding_id,
    state: 'draft' as const,
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
  };

  let createdRow: TokenLaunchRow;
  if (idempotency) {
    const candidateId = randomUUID();
    const { error: upsertErr } = await admin
      .from('token_launches')
      .upsert({ id: candidateId, ...nextRow }, { onConflict: 'tenant_id,draft_idempotency_key', ignoreDuplicates: true });
    if (upsertErr) throw new Error(`reviseWithNewVersion upsert failed: ${upsertErr.message}`);
    const { data, error } = await admin
      .from('token_launches')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('draft_idempotency_key', idempotency.draftIdempotencyKey)
      .single();
    if (error || !data) throw new Error(`reviseWithNewVersion read-back failed: ${error?.message ?? 'no row found for the computed idempotency key'}`);
    createdRow = data as TokenLaunchRow;
  } else {
    const { data, error: insertErr } = await admin
      .from('token_launches')
      .insert({ id: randomUUID(), ...nextRow })
      .select('*')
      .single();
    if (insertErr) throw new Error(`reviseWithNewVersion insert failed: ${insertErr.message}`);
    createdRow = data as TokenLaunchRow;
  }

  // Mark the OLD row superseded — idempotent-safe even if a concurrent
  // caller's identical revision already pointed it at the SAME winning new
  // row (createdRow.id is shared via the upsert+read-back above), and
  // always clears the old row's own key (see this function's own doc).
  const { error: supersedeErr } = await admin
    .from('token_launches')
    .update({ superseded_by: createdRow.id, state: 'superseded', draft_idempotency_key: null, updated_at: new Date().toISOString() })
    .eq('id', currentId);
  if (supersedeErr) throw new Error(`reviseWithNewVersion supersede failed: ${supersedeErr.message}`);

  return createdRow;
}
