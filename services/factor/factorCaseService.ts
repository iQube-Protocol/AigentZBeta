/**
 * factorCaseService — Factor 0.1 candidate-intake/activation pipeline
 * (PRD Journey A, §6.1).
 *
 * Server-side only. Every transition is validated against the state
 * machine below and is idempotent when a caller supplies an
 * idempotencyKey — a retried command returns the SAME resulting row,
 * never a duplicate write (PRD §12: "Command endpoints require
 * idempotency and must return the canonical resulting resource").
 *
 * This service does NOT decide admission (that is MoneyPenny's sole
 * authority — see services/factor/admissionAuthority.ts) and does NOT
 * assess candidates (that is Aegis's — see services/aegis/aegisAssessmentService.ts).
 * It only manages the CASE's own lifecycle and evidence checklist.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { personaRef } from './identityRefs';
import { recordFactorReceipt } from './receipts';

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
 * nonterminal state via pauseCase() (not listed per-row here — enforced
 * separately) and resumes back into `paused_from_state`. `rejected` and
 * `active` are terminal for this state machine (a rejected case may still
 * receive new evidence/superseding cases, but not further FSM transitions;
 * "active" is where ongoing Journey F activity is tracked outside this
 * table).
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

const TERMINAL_STATES: ReadonlySet<FactorCaseState> = new Set(['rejected']);

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
  requested_jurisdictions: string[];
  pathway: 'registry_only' | 'full_horizon';
  state: FactorCaseState;
  paused_from_state: string | null;
  current_aegis_assessment_id: string | null;
  authority_chain_id: string | null;
  idempotency_key: string | null;
  created_by_persona_id: string;
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
  requestedJurisdictions?: string[];
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
 * `factor_cases_tenant_candidate_unique` constraint — this function
 * catches the resulting unique-violation and re-reads the existing row
 * rather than surfacing a 500, so a retried/racing create is always safe.
 */
export async function createOrResumeCase(
  admin: SupabaseClient,
  input: CreateOrResumeCaseInput,
): Promise<CreateOrResumeCaseResult> {
  const tenantId = input.tenantId ?? 'default';

  // Idempotency-key fast path: an exact retry returns the same row.
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

  // Candidate-dedupe fast path: resolve whether this candidate already has
  // a case in this tenant before attempting an insert.
  const { data: existingByCandidate, error: candErr } = await admin
    .from('factor_cases')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('candidate_identity_key', input.candidateIdentityKey)
    .maybeSingle();
  if (candErr) throw new Error(`createOrResumeCase candidate lookup failed: ${candErr.message}`);
  if (existingByCandidate) return { case: existingByCandidate as FactorCaseRow, created: false };

  const { data: inserted, error: insertErr } = await admin
    .from('factor_cases')
    .insert({
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
    // the race — re-read and return that row instead of failing. Postgres
    // unique_violation is SQLSTATE 23505.
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
  await recordFactorReceipt(admin, {
    eventType: 'factor_case_created',
    caseId: row.case_id,
    actorPersonaRef: personaRef(input.createdByPersonaId),
    metadata: { pathway: row.pathway, source: row.source },
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
    case_id: input.caseId,
    event_type: input.eventType,
    from_state: input.fromState ?? null,
    to_state: input.toState ?? null,
    actor_persona_ref: personaRef(input.actorPersonaId),
    authority_chain_id: input.authorityChainId ?? null,
    payload: input.payload ?? {},
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
  toState: FactorCaseState;
  actorPersonaId: string;
  authorityChainId?: string | null;
  reason?: string;
  idempotencyKey?: string;
}

/**
 * The one path by which factor_cases.state changes (besides pause/resume).
 * Validates the transition against FORWARD_TRANSITIONS server-side (PRD
 * §6.1: "Transitions must be validated server-side and idempotent").
 *
 * IMPORTANT — separation of powers: this function does NOT grant itself
 * the right to move a case into 'admitted'/'conditionally_admitted'/
 * 'rejected'. Callers reaching those target states MUST go through
 * services/factor/admissionAuthority.ts's `decideAdmission`, which is the
 * only code path attributed to a MoneyPenny actor. A caller invoking THIS
 * function directly for those three target states is refused — Factor
 * cannot author its own admission decision (PRD invariant 2/3, acceptance
 * criterion 9).
 */
export async function transitionCaseState(
  admin: SupabaseClient,
  input: TransitionCaseInput,
): Promise<FactorCaseRow> {
  const ADMISSION_DECISION_STATES: ReadonlySet<FactorCaseState> = new Set([
    'admitted',
    'conditionally_admitted',
    'rejected',
  ]);
  if (ADMISSION_DECISION_STATES.has(input.toState)) {
    throw new FactorCaseTransitionError(
      'admission-requires-moneypenny-authority',
      `transitionCaseState refuses to set state '${input.toState}' directly — admission decisions must go ` +
        "through services/factor/admissionAuthority.ts's decideAdmission (MoneyPenny is the sole admission authority).",
    );
  }

  const { data: current, error: readErr } = await admin
    .from('factor_cases')
    .select('*')
    .eq('case_id', input.caseId)
    .maybeSingle();
  if (readErr) throw new Error(`transitionCaseState read failed: ${readErr.message}`);
  if (!current) throw new FactorCaseTransitionError('case-not-found', `No factor_cases row for case_id ${input.caseId}`);

  const row = current as FactorCaseRow;

  // Idempotent replay: already in the requested state — return as-is.
  if (row.state === input.toState) return row;

  if (TERMINAL_STATES.has(row.state)) {
    throw new FactorCaseTransitionError(
      'terminal-state',
      `Case ${input.caseId} is in terminal state '${row.state}' and cannot transition further.`,
    );
  }

  const allowed = FORWARD_TRANSITIONS[row.state] ?? [];
  if (!allowed.includes(input.toState)) {
    throw new FactorCaseTransitionError(
      'invalid-transition',
      `Case ${input.caseId} cannot move from '${row.state}' to '${input.toState}' (allowed: ${allowed.join(', ') || 'none'}).`,
    );
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
    throw new FactorCaseTransitionError(
      'concurrent-transition',
      `Case ${input.caseId} state changed concurrently — retry the transition.`,
    );
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

  return updated as FactorCaseRow;
}

/** Pause a nonterminal case, recording the state it should resume into. */
export async function pauseCase(
  admin: SupabaseClient,
  caseId: string,
  actorPersonaId: string,
  reason?: string,
): Promise<FactorCaseRow> {
  const { data: current, error: readErr } = await admin
    .from('factor_cases')
    .select('*')
    .eq('case_id', caseId)
    .maybeSingle();
  if (readErr) throw new Error(`pauseCase read failed: ${readErr.message}`);
  if (!current) throw new FactorCaseTransitionError('case-not-found', `No factor_cases row for case_id ${caseId}`);
  const row = current as FactorCaseRow;

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

  await appendCaseEvent(admin, {
    caseId,
    eventType: 'paused',
    fromState: row.state,
    toState: 'paused',
    actorPersonaId,
    payload: { reason: reason ?? null },
  });
  return updated as FactorCaseRow;
}

/** Resume a paused case back into its recorded paused_from_state — never
 *  loses state (PRD Journey A step 7). */
export async function resumeCase(admin: SupabaseClient, caseId: string, actorPersonaId: string): Promise<FactorCaseRow> {
  const { data: current, error: readErr } = await admin
    .from('factor_cases')
    .select('*')
    .eq('case_id', caseId)
    .maybeSingle();
  if (readErr) throw new Error(`resumeCase read failed: ${readErr.message}`);
  if (!current) throw new FactorCaseTransitionError('case-not-found', `No factor_cases row for case_id ${caseId}`);
  const row = current as FactorCaseRow;

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

  await appendCaseEvent(admin, {
    caseId,
    eventType: 'resumed',
    fromState: 'paused',
    toState: resumeState,
    actorPersonaId,
  });
  return updated as FactorCaseRow;
}

// ─────────────────────────────────────────────────────────────────────────
// Evidence checklist (PRD Journey A step 6, §5.1 "Evidence")
// ─────────────────────────────────────────────────────────────────────────

export interface UpsertEvidenceInput {
  caseId: string;
  category: string;
  status?: FactorEvidenceStatus;
  description?: string;
  evidenceRef?: Record<string, unknown>;
  suppliedByPersonaId?: string;
}

/**
 * Adds or updates one evidence checklist item. When an item for this
 * category already exists in a terminal-for-assessment state ('supplied'
 * behind a LOCKED assessment), this creates a superseding row rather than
 * mutating the old one — the evidence a ratified assessment saw must stay
 * exactly what it saw (PRD Journey B step 7: "Changes to candidate
 * evidence create a new assessment version; historical decisions remain
 * immutable" — the evidence feeding that immutability follows the same
 * discipline).
 */
export async function upsertEvidenceItem(
  admin: SupabaseClient,
  input: UpsertEvidenceInput,
  evidenceIsLockedForAssessment: boolean,
): Promise<{ evidence_id: string; status: FactorEvidenceStatus }> {
  const { data: existing, error: readErr } = await admin
    .from('factor_evidence_items')
    .select('evidence_id, status, superseded_by')
    .eq('case_id', input.caseId)
    .eq('category', input.category)
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
        description: input.description ?? null,
        evidence_ref: input.evidenceRef ?? {},
        supplied_at: nextStatus === 'supplied' ? new Date().toISOString() : null,
        supplied_by_persona_ref: input.suppliedByPersonaId ? personaRef(input.suppliedByPersonaId) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('evidence_id', existing.evidence_id)
      .select('evidence_id, status')
      .single();
    if (updateErr) throw new Error(`upsertEvidenceItem update failed: ${updateErr.message}`);
    return updated as { evidence_id: string; status: FactorEvidenceStatus };
  }

  const { data: inserted, error: insertErr } = await admin
    .from('factor_evidence_items')
    .insert({
      case_id: input.caseId,
      category: input.category,
      status: nextStatus,
      description: input.description ?? null,
      evidence_ref: input.evidenceRef ?? {},
      supplied_at: nextStatus === 'supplied' ? new Date().toISOString() : null,
      supplied_by_persona_ref: input.suppliedByPersonaId ? personaRef(input.suppliedByPersonaId) : null,
    })
    .select('evidence_id, status')
    .single();
  if (insertErr) throw new Error(`upsertEvidenceItem insert failed: ${insertErr.message}`);

  // Mark the prior (now-superseded) row so readers can tell an evidence
  // snapshot an assessment locked apart from what came after.
  if (existing) {
    await admin
      .from('factor_evidence_items')
      .update({ status: 'stale', superseded_by: (inserted as { evidence_id: string }).evidence_id })
      .eq('evidence_id', existing.evidence_id);
  }

  return inserted as { evidence_id: string; status: FactorEvidenceStatus };
}

export async function listEvidenceForCase(admin: SupabaseClient, caseId: string) {
  const { data, error } = await admin
    .from('factor_evidence_items')
    .select('*')
    .eq('case_id', caseId)
    .is('superseded_by', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`listEvidenceForCase failed: ${error.message}`);
  return data ?? [];
}
