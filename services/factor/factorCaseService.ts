/**
 * factorCaseService — Factor 0.1 candidate-intake/activation pipeline
 * (PRD Journey A, §6.1), reconciled onto spec/moneypenny-mpy2-3.
 *
 * Server-side only. Every transition is validated against the state
 * machine below and is idempotent when a caller supplies an
 * idempotencyKey — a retried command returns the SAME resulting row,
 * never a duplicate write (PRD §12).
 *
 * This service does NOT decide admission (that is MoneyPenny's sole
 * authority — see services/moneypenny/admissionAuthority.ts) and does NOT
 * assess candidates (that is Aegis's — see
 * services/aegis/aegisAssessmentService.ts). It only manages the CASE's
 * own lifecycle and evidence checklist.
 *
 * Receipts: every constitutionally-relevant write records into
 * `activity_receipts` via `createActivityReceipt` — the SAME sink every
 * other constitutional decision in this codebase uses (e.g.
 * services/marketa/admissionAssessmentRunner.ts), not a parallel ledger.
 * `personaId` is passed RAW, matching that table's own established
 * convention (delegation_grants, marketa_agent_admission_assessments) —
 * the T0/T1/T2 boundary is enforced downstream by the protected DVN
 * pipeline (services/dvn/activityReceiptDvnPipeline.ts), which this
 * service does not touch beyond the one permitted
 * ANCHORABLE_ACTION_TYPES addition.
 */

import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { validateChainForAction } from '@/services/factor/authorityChain';

export type FactorCaseState =
  | 'discovered'
  | 'preparing'
  | 'assessment_pending'
  | 'assessment_in_progress'
  | 'evidence_remediation'
  | 'assessment_complete'
  | 'registry_ready'
  | 'admission_pending'
  | 'admitted'
  | 'conditionally_admitted'
  | 'rejected'
  | 'activation_pending'
  | 'active'
  | 'paused';

export type FactorEvidenceStatus = 'missing' | 'requested' | 'supplied' | 'stale' | 'contradicted';

/**
 * Forward transition table (PRD §6.1). `paused` is reachable from every
 * nonterminal state via pauseCase() and resumes back into
 * `paused_from_state`. `rejected` and `active` are terminal for this state
 * machine.
 */
const FORWARD_TRANSITIONS: Record<FactorCaseState, FactorCaseState[]> = {
  discovered: ['preparing'],
  preparing: ['assessment_pending'],
  assessment_pending: ['assessment_in_progress'],
  assessment_in_progress: ['evidence_remediation', 'assessment_complete'],
  evidence_remediation: ['assessment_pending'],
  assessment_complete: ['registry_ready'],
  registry_ready: ['admission_pending'],
  admission_pending: ['admitted', 'conditionally_admitted', 'rejected'],
  admitted: ['activation_pending'],
  conditionally_admitted: ['activation_pending'],
  rejected: [],
  activation_pending: ['active'],
  active: [],
  paused: [], // resume is a dedicated operation, not a generic forward transition
};

const TERMINAL_STATES: ReadonlySet<FactorCaseState> = new Set<FactorCaseState>(['rejected']);
const ADMISSION_DECISION_STATES: ReadonlySet<FactorCaseState> = new Set<FactorCaseState>(['admitted', 'conditionally_admitted', 'rejected']);

export class FactorCaseTransitionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'FactorCaseTransitionError';
  }
}

export interface FactorCaseRow {
  case_id: string;
  tenant_id: string;
  owner_persona_id: string;
  created_by_persona_id: string;
  candidate_identity_key: string;
  candidate_display_name: string;
  candidate_agent_root_did: string | null;
  candidate_registry_asset_id: string | null;
  source: 'operator' | 'marketa_referral' | 'registry_import';
  referral_provenance: Record<string, unknown>;
  declared_capabilities: unknown[];
  declared_endpoints: unknown[];
  code_provenance: Record<string, unknown>;
  requested_services: unknown[];
  requested_jurisdictions: unknown[];
  pathway: 'registry_only' | 'full_horizon';
  state: FactorCaseState;
  paused_from_state: string | null;
  current_aegis_assessment_id: string | null;
  authority_chain_id: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOrResumeCaseInput {
  tenantId?: string;
  ownerPersonaId: string;
  createdByPersonaId: string;
  candidateIdentityKey: string;
  candidateDisplayName: string;
  candidateAgentRootDid?: string | null;
  source?: 'operator' | 'marketa_referral' | 'registry_import';
  referralProvenance?: Record<string, unknown>;
  declaredCapabilities?: unknown[];
  declaredEndpoints?: unknown[];
  codeProvenance?: Record<string, unknown>;
  requestedServices?: unknown[];
  requestedJurisdictions?: unknown[];
  pathway?: 'registry_only' | 'full_horizon';
  idempotencyKey?: string;
  authorityChainId?: string | null;
}

export interface CreateOrResumeCaseResult {
  case: FactorCaseRow;
  created: boolean;
}

/**
 * Journey A steps 2-3: "Factor resolves whether the candidate already
 * exists... creates or resumes ONE candidate case; duplicate cases must
 * not be created." Enforced primarily by the DB's
 * `uq_factor_cases_candidate_per_tenant` constraint — this function
 * catches the resulting unique-violation and re-reads the existing row
 * rather than surfacing a 500, so a retried/racing create is always safe.
 */
export async function createOrResumeCase(
  admin: SupabaseClient,
  input: CreateOrResumeCaseInput,
): Promise<CreateOrResumeCaseResult> {
  const tenantId = input.tenantId ?? 'default';

  if (input.idempotencyKey) {
    const { data: existingByKey, error: keyErr } = await admin
      .from('factor_cases')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('idempotency_key', input.idempotencyKey)
      .maybeSingle();
    if (keyErr) throw new Error(`createOrResumeCase idempotency lookup failed: ${keyErr.message}`);
    if (existingByKey) return { case: existingByKey as FactorCaseRow, created: false };
  }

  const { data: existingByCandidate, error: candErr } = await admin
    .from('factor_cases')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('candidate_identity_key', input.candidateIdentityKey)
    .maybeSingle();
  if (candErr) throw new Error(`createOrResumeCase candidate lookup failed: ${candErr.message}`);
  if (existingByCandidate) return { case: existingByCandidate as FactorCaseRow, created: false };

  const caseId = randomUUID();
  const { data: inserted, error: insertErr } = await admin
    .from('factor_cases')
    .insert({
      case_id: caseId,
      tenant_id: tenantId,
      owner_persona_id: input.ownerPersonaId,
      created_by_persona_id: input.createdByPersonaId,
      candidate_identity_key: input.candidateIdentityKey,
      candidate_display_name: input.candidateDisplayName,
      candidate_agent_root_did: input.candidateAgentRootDid ?? null,
      source: input.source ?? 'operator',
      referral_provenance: input.referralProvenance ?? {},
      declared_capabilities: input.declaredCapabilities ?? [],
      declared_endpoints: input.declaredEndpoints ?? [],
      code_provenance: input.codeProvenance ?? {},
      requested_services: input.requestedServices ?? [],
      requested_jurisdictions: input.requestedJurisdictions ?? [],
      pathway: input.pathway ?? 'registry_only',
      idempotency_key: input.idempotencyKey ?? null,
      authority_chain_id: input.authorityChainId ?? null,
      state: 'discovered',
    })
    .select('*')
    .single();

  if (insertErr) {
    // Unique-violation on either constraint means a concurrent caller won
    // the race — re-read and return that row instead of failing.
    if ((insertErr as { code?: string }).code === '23505') {
      const { data: raceWinner, error: raceErr } = await admin
        .from('factor_cases')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('candidate_identity_key', input.candidateIdentityKey)
        .maybeSingle();
      if (raceErr) throw new Error(`createOrResumeCase race re-read failed: ${raceErr.message}`);
      if (raceWinner) return { case: raceWinner as FactorCaseRow, created: false };
    }
    throw new Error(`createOrResumeCase insert failed: ${insertErr.message}`);
  }

  const row = inserted as FactorCaseRow;
  await createActivityReceipt({
    personaId: input.createdByPersonaId,
    activeCartridge: 'moneypenny',
    actionType: 'factor_case_opened',
    summary: `Factor opened a candidate case for ${row.candidate_display_name}`,
    agentsInvoked: ['aigent-factor'],
    actionInput: { caseId: row.case_id, pathway: row.pathway, source: row.source },
  });
  await appendCaseEvent(admin, {
    caseId: row.case_id,
    eventType: 'case_created',
    toState: 'discovered',
    actorPersonaId: input.createdByPersonaId,
  });

  return { case: row, created: true };
}

export interface AppendCaseEventInput {
  caseId: string;
  eventType: string;
  fromState?: FactorCaseState;
  toState?: FactorCaseState;
  actorPersonaId: string;
  authorityChainId?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
}

export async function appendCaseEvent(admin: SupabaseClient, input: AppendCaseEventInput): Promise<void> {
  const { error } = await admin.from('factor_case_events').insert({
    event_id: randomUUID(),
    case_id: input.caseId,
    event_type: input.eventType,
    from_state: input.fromState ?? null,
    to_state: input.toState ?? null,
    actor_persona_id: input.actorPersonaId,
    authority_chain_id: input.authorityChainId ?? null,
    metadata: input.payload ?? {},
    idempotency_key: input.idempotencyKey ?? null,
  });
  // A duplicate idempotency key on the same case is an intentional no-op
  // (the event was already recorded by a prior attempt) — everything else
  // is a real failure.
  if (error && (error as { code?: string }).code !== '23505') {
    throw new Error(`appendCaseEvent failed: ${error.message}`);
  }
}

export interface TransitionCaseInput {
  caseId: string;
  /**
   * The caller's own tenant scope. REQUIRED — cross-tenant isolation
   * (PRD Journey A; flagged as an open gap in the Phase 1 reconciliation
   * pass, §8) is enforced here, not left to callers to remember: a caseId
   * that resolves to a DIFFERENT tenant is refused before any mutation,
   * exactly like the self-assessment refusal in aegisAssessmentService.ts
   * is enforced unconditionally rather than left optional.
   */
  tenantId: string;
  toState: FactorCaseState;
  actorPersonaId: string;
  authorityChainId?: string | null;
  reason?: string;
  idempotencyKey?: string;
}

/** Shared cross-tenant guard for every case-scoped read/mutation below —
 *  one check, one error shape, never re-derived per call site. */
function assertSameTenant(row: FactorCaseRow, tenantId: string, caseId: string): void {
  if (row.tenant_id !== tenantId) {
    throw new FactorCaseTransitionError(
      'cross-tenant-denied',
      `Case ${caseId} belongs to tenant '${row.tenant_id}', not the caller's tenant '${tenantId}' — refusing cross-tenant access.`,
    );
  }
}

/**
 * The one path by which factor_cases.state changes (besides pause/resume).
 * Validates the transition against FORWARD_TRANSITIONS server-side.
 *
 * IMPORTANT — separation of powers: this function does NOT grant itself
 * the right to move a case into 'admitted'/'conditionally_admitted'/
 * 'rejected'. Callers reaching those target states MUST go through
 * services/moneypenny/admissionAuthority.ts's `decideAdmission`, the only
 * code path attributed to a MoneyPenny actor. A caller invoking THIS
 * function directly for those three target states is refused — Factor
 * cannot author its own admission decision (PRD §2 invariant 3).
 */
export async function transitionCaseState(admin: SupabaseClient, input: TransitionCaseInput): Promise<FactorCaseRow> {
  if (ADMISSION_DECISION_STATES.has(input.toState)) {
    throw new FactorCaseTransitionError(
      'admission-requires-moneypenny-authority',
      `transitionCaseState refuses to set state '${input.toState}' directly — admission decisions must go ` +
        "through services/moneypenny/admissionAuthority.ts's decideAdmission (MoneyPenny is the sole admission authority).",
    );
  }

  const { data: current, error: readErr } = await admin.from('factor_cases').select('*').eq('case_id', input.caseId).maybeSingle();
  if (readErr) throw new Error(`transitionCaseState read failed: ${readErr.message}`);
  if (!current) throw new FactorCaseTransitionError('case-not-found', `No factor_cases row for case_id ${input.caseId}`);

  const row = current as FactorCaseRow;
  assertSameTenant(row, input.tenantId, input.caseId);

  if (row.state === input.toState) return row; // idempotent replay

  if (TERMINAL_STATES.has(row.state)) {
    throw new FactorCaseTransitionError('terminal-state', `Case ${input.caseId} is in terminal state '${row.state}' and cannot transition further.`);
  }

  const allowed = FORWARD_TRANSITIONS[row.state] ?? [];
  if (!allowed.includes(input.toState)) {
    throw new FactorCaseTransitionError(
      'invalid-transition',
      `Case ${input.caseId} cannot move from '${row.state}' to '${input.toState}' (allowed: ${allowed.join(', ') || 'none'}).`,
    );
  }

  // AUTHORITY-CHAIN GATE (Factor runtime-contract closure, Phase 1
  // continuation, 2026-09-05) — validateChainForAction (services/factor/
  // authorityChain.ts) existed but was never called from any transition or
  // admission route (flagged honestly in factorCapabilityManifest.ts's own
  // doc comment as the "authority_chain" capability's real gap). Wired here
  // ONLY when a chain is actually bound to this case (`authority_chain_id`)
  // — a case with no chain bound is unaffected (today's behavior, unchanged;
  // not every case is required to carry one). A BOUND chain, once relied
  // upon, must actually be valid: active, unexpired, and owned by this
  // case's own principal — never merely trusted because it was recorded.
  const chainId = input.authorityChainId ?? row.authority_chain_id;
  if (chainId) {
    const validation = await validateChainForAction(admin, {
      chainId,
      action: input.toState,
      expectedPrincipalPersonaId: row.owner_persona_id,
    });
    if (!validation.allowed) {
      throw new FactorCaseTransitionError(
        'authority-chain-invalid',
        `Case ${input.caseId} cannot transition to '${input.toState}': its bound authority chain ${chainId} ` +
          `is not valid for this action (${validation.code}): ${validation.reason}`,
      );
    }
  }

  const { data: updated, error: updateErr } = await admin
    .from('factor_cases')
    .update({ state: input.toState, updated_at: new Date().toISOString() })
    .eq('case_id', input.caseId)
    .eq('state', row.state) // optimistic-concurrency guard against a racing transition
    .select('*')
    .maybeSingle();
  if (updateErr) throw new Error(`transitionCaseState update failed: ${updateErr.message}`);
  if (!updated) {
    throw new FactorCaseTransitionError('concurrent-transition', `Case ${input.caseId} state changed concurrently — retry the transition.`);
  }

  await appendCaseEvent(admin, {
    caseId: input.caseId,
    eventType: 'state_changed',
    fromState: row.state,
    toState: input.toState,
    actorPersonaId: input.actorPersonaId,
    authorityChainId: input.authorityChainId ?? row.authority_chain_id,
    payload: { reason: input.reason ?? null },
    idempotencyKey: input.idempotencyKey,
  });

  await createActivityReceipt({
    personaId: input.actorPersonaId,
    activeCartridge: 'moneypenny',
    actionType: 'factor_case_state_changed',
    summary: `Factor case ${input.caseId} moved ${row.state} -> ${input.toState}`,
    agentsInvoked: ['aigent-factor'],
    actionInput: { caseId: input.caseId, fromState: row.state, toState: input.toState },
  });

  return updated as FactorCaseRow;
}

/** Pause a nonterminal case, recording the state it should resume into. */
export async function pauseCase(admin: SupabaseClient, caseId: string, tenantId: string, actorPersonaId: string, reason?: string): Promise<FactorCaseRow> {
  const { data: current, error: readErr } = await admin.from('factor_cases').select('*').eq('case_id', caseId).maybeSingle();
  if (readErr) throw new Error(`pauseCase read failed: ${readErr.message}`);
  if (!current) throw new FactorCaseTransitionError('case-not-found', `No factor_cases row for case_id ${caseId}`);
  const row = current as FactorCaseRow;
  assertSameTenant(row, tenantId, caseId);

  if (row.state === 'paused') return row; // idempotent
  if (TERMINAL_STATES.has(row.state)) {
    throw new FactorCaseTransitionError('terminal-state', `Case ${caseId} is terminal ('${row.state}') and cannot be paused.`);
  }

  const { data: updated, error: updateErr } = await admin
    .from('factor_cases')
    .update({ state: 'paused', paused_from_state: row.state, updated_at: new Date().toISOString() })
    .eq('case_id', caseId)
    .eq('state', row.state)
    .select('*')
    .maybeSingle();
  if (updateErr) throw new Error(`pauseCase update failed: ${updateErr.message}`);
  if (!updated) throw new FactorCaseTransitionError('concurrent-transition', `Case ${caseId} changed concurrently — retry pause.`);

  await appendCaseEvent(admin, { caseId, eventType: 'paused', fromState: row.state, toState: 'paused', actorPersonaId, payload: { reason: reason ?? null } });
  return updated as FactorCaseRow;
}

/** Resume a paused case back into its recorded paused_from_state — never
 *  loses state (PRD Journey A step 7). */
export async function resumeCase(admin: SupabaseClient, caseId: string, tenantId: string, actorPersonaId: string): Promise<FactorCaseRow> {
  const { data: current, error: readErr } = await admin.from('factor_cases').select('*').eq('case_id', caseId).maybeSingle();
  if (readErr) throw new Error(`resumeCase read failed: ${readErr.message}`);
  if (!current) throw new FactorCaseTransitionError('case-not-found', `No factor_cases row for case_id ${caseId}`);
  const row = current as FactorCaseRow;
  assertSameTenant(row, tenantId, caseId);

  if (row.state !== 'paused') return row; // idempotent — not paused, nothing to resume
  const resumeState = (row.paused_from_state as FactorCaseState) ?? 'discovered';

  const { data: updated, error: updateErr } = await admin
    .from('factor_cases')
    .update({ state: resumeState, paused_from_state: null, updated_at: new Date().toISOString() })
    .eq('case_id', caseId)
    .eq('state', 'paused')
    .select('*')
    .maybeSingle();
  if (updateErr) throw new Error(`resumeCase update failed: ${updateErr.message}`);
  if (!updated) throw new FactorCaseTransitionError('concurrent-transition', `Case ${caseId} changed concurrently — retry resume.`);

  await appendCaseEvent(admin, { caseId, eventType: 'resumed', fromState: 'paused', toState: resumeState, actorPersonaId });
  return updated as FactorCaseRow;
}

// ─────────────────────────────────────────────────────────────────────────
// Evidence checklist (PRD Journey A step 6, §5.1 "Evidence")
// ─────────────────────────────────────────────────────────────────────────

export interface UpsertEvidenceInput {
  caseId: string;
  /** The caller's own tenant scope — see assertSameTenant / the note on
   *  TransitionCaseInput.tenantId. Verified against the parent case before
   *  any evidence read or write. */
  tenantId: string;
  kind: string;
  status?: FactorEvidenceStatus;
  payload?: Record<string, unknown>;
  sourceRef?: string;
  suppliedByPersonaId?: string;
}

async function assertCaseTenant(admin: SupabaseClient, caseId: string, tenantId: string): Promise<void> {
  const { data: caseRow, error } = await admin.from('factor_cases').select('tenant_id').eq('case_id', caseId).maybeSingle();
  if (error) throw new Error(`assertCaseTenant read failed: ${error.message}`);
  if (!caseRow) throw new FactorCaseTransitionError('case-not-found', `No factor_cases row for case_id ${caseId}`);
  assertSameTenant(caseRow as FactorCaseRow, tenantId, caseId);
}

/**
 * Adds or updates one evidence checklist item. When an item for this kind
 * already exists AND the case's evidence is locked for an active
 * assessment, this creates a superseding row rather than mutating the old
 * one — the evidence a ratified assessment saw must stay exactly what it
 * saw (PRD Journey B step 7).
 */
export async function upsertEvidenceItem(
  admin: SupabaseClient,
  input: UpsertEvidenceInput,
  evidenceIsLockedForAssessment: boolean,
): Promise<{ evidence_item_id: string; status: FactorEvidenceStatus }> {
  await assertCaseTenant(admin, input.caseId, input.tenantId);

  const { data: existing, error: readErr } = await admin
    .from('factor_evidence_items')
    .select('evidence_item_id, status, superseded_by')
    .eq('case_id', input.caseId)
    .eq('kind', input.kind)
    .is('superseded_by', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readErr) throw new Error(`upsertEvidenceItem read failed: ${readErr.message}`);

  const nextStatus = input.status ?? 'supplied';

  if (existing && !evidenceIsLockedForAssessment) {
    const { data: updated, error: updateErr } = await admin
      .from('factor_evidence_items')
      .update({
        status: nextStatus,
        payload: input.payload ?? {},
        source_ref: input.sourceRef ?? null,
        supplied_by_persona_id: input.suppliedByPersonaId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('evidence_item_id', existing.evidence_item_id)
      .select('evidence_item_id, status')
      .single();
    if (updateErr) throw new Error(`upsertEvidenceItem update failed: ${updateErr.message}`);
    await recordEvidenceReceipt(input, nextStatus);
    return updated as { evidence_item_id: string; status: FactorEvidenceStatus };
  }

  const newId = randomUUID();
  const { data: inserted, error: insertErr } = await admin
    .from('factor_evidence_items')
    .insert({
      evidence_item_id: newId,
      case_id: input.caseId,
      kind: input.kind,
      status: nextStatus,
      payload: input.payload ?? {},
      source_ref: input.sourceRef ?? null,
      supplied_by_persona_id: input.suppliedByPersonaId ?? null,
      supersedes_evidence_item_id: existing?.evidence_item_id ?? null,
    })
    .select('evidence_item_id, status')
    .single();
  if (insertErr) throw new Error(`upsertEvidenceItem insert failed: ${insertErr.message}`);

  // Mark the prior (now-superseded) row so readers can tell an evidence
  // snapshot an assessment locked apart from what came after.
  if (existing) {
    await admin.from('factor_evidence_items').update({ status: 'stale', superseded_by: newId }).eq('evidence_item_id', existing.evidence_item_id);
  }

  await recordEvidenceReceipt(input, nextStatus);
  return inserted as { evidence_item_id: string; status: FactorEvidenceStatus };
}

async function recordEvidenceReceipt(input: UpsertEvidenceInput, status: FactorEvidenceStatus): Promise<void> {
  if (!input.suppliedByPersonaId) return;
  await createActivityReceipt({
    personaId: input.suppliedByPersonaId,
    activeCartridge: 'moneypenny',
    actionType: 'factor_evidence_recorded',
    summary: `Evidence '${input.kind}' recorded for Factor case ${input.caseId} (${status})`,
    agentsInvoked: ['aigent-factor'],
    actionInput: { caseId: input.caseId, kind: input.kind, status },
  });
}

/** Tenant-scoped case read — the API layer's one path to fetch a case by
 *  id; never a raw `.from('factor_cases')` query in a route file. */
export async function getCase(admin: SupabaseClient, caseId: string, tenantId: string): Promise<FactorCaseRow> {
  const { data, error } = await admin.from('factor_cases').select('*').eq('case_id', caseId).maybeSingle();
  if (error) throw new Error(`getCase failed: ${error.message}`);
  if (!data) throw new FactorCaseTransitionError('case-not-found', `No factor_cases row for case_id ${caseId}`);
  const row = data as FactorCaseRow;
  assertSameTenant(row, tenantId, caseId);
  return row;
}

export async function listEvidenceForCase(admin: SupabaseClient, caseId: string, tenantId: string) {
  await assertCaseTenant(admin, caseId, tenantId);
  const { data, error } = await admin.from('factor_evidence_items').select('*').eq('case_id', caseId).is('superseded_by', null).order('created_at', { ascending: true });
  if (error) throw new Error(`listEvidenceForCase failed: ${error.message}`);
  return data ?? [];
}

export interface FactorCaseEventRow {
  event_id: string;
  case_id: string;
  event_type: string;
  from_state: string | null;
  to_state: string | null;
  actor_persona_id: string;
  authority_chain_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Tenant-scoped case-activity read — completes appendCaseEvent's write path
 * with the reader it never had (factor_case_events had no GET route at all
 * until this pass). Not a parallel case service: it reads the SAME table
 * every state transition/pause/resume/admission decision already writes to,
 * through the SAME tenant guard every other case-scoped read uses.
 */
export async function listCaseEvents(admin: SupabaseClient, caseId: string, tenantId: string): Promise<FactorCaseEventRow[]> {
  await assertCaseTenant(admin, caseId, tenantId);
  const { data, error } = await admin.from('factor_case_events').select('*').eq('case_id', caseId).order('created_at', { ascending: true });
  if (error) throw new Error(`listCaseEvents failed: ${error.message}`);
  return (data ?? []) as FactorCaseEventRow[];
}
