/**
 * aegisAssessmentService — Aegis 0.1's evidence-bound, versioned, immutable
 * assessment engine (PRD Journey B, §6.2, §8.3, §17).
 *
 * Separation of powers (PRD §2 hard invariants 1-2, acceptance criteria
 * 3-7): Aegis can assess and recommend; it cannot admit. This service never
 * writes `factor_cases.state` and never calls
 * services/factor/admissionAuthority.ts. It also refuses outright to
 * assess a candidate when the requesting agent IS the subject being
 * assessed (Factor cannot assess itself — PRD Journey 0 step 8, §9.10).
 *
 * State machine: draft → evidence_locked → running → review_required →
 *   ratified | failed. Ratified rows are immutable — this service is the
 *   ONLY writer path to `ratified`, and the DB trigger
 *   `trg_aegis_assessments_immutable` is defense-in-depth against any
 *   other write path (including a future one this service doesn't know
 *   about).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { commit } from '../factor/canonical';
import { assertNotRawPersonaId } from '../factor/identityRefs';
import { recordFactorReceipt } from '../factor/receipts';

export type AegisAssessmentState = 'draft' | 'evidence_locked' | 'running' | 'review_required' | 'ratified' | 'failed';
export type AegisDecision = 'admissible' | 'admissible_with_conditions' | 'insufficient_evidence' | 'not_admissible';
export type AegisFindingResult = 'pass' | 'fail' | 'conditional' | 'inconclusive';
export type AegisConfidence = 'low' | 'medium' | 'high';

export class AegisAssessmentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AegisAssessmentError';
  }
}

export interface AegisAssessmentRow {
  assessment_id: string;
  case_id: string;
  version: number;
  supersedes_assessment_id: string | null;
  policy_id: string;
  policy_version: string;
  evidence_snapshot: Record<string, unknown>;
  evidence_set_hash: string;
  state: AegisAssessmentState;
  decision: AegisDecision | null;
  conditions: unknown[];
  assessment_hash: string | null;
  ratified_at: string | null;
  ratified_by_persona_ref: string | null;
  subject_agent_ref: string;
  requested_by_agent_ref: string;
  immutable: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAssessmentInput {
  caseId: string;
  policyId: string;
  policyVersion: string;
  /** The immutable evidence snapshot (already assembled by the caller from
   *  factor_evidence_items) — Journey B step 1. */
  evidenceSnapshot: Record<string, unknown>;
  /** The candidate's own agent ref — who is being assessed. */
  subjectAgentRef: string;
  /** The agent ref that is submitting this request for assessment
   *  (normally Factor's own ref). */
  requestedByAgentRef: string;
}

/**
 * Creates a new assessment version for a case. When a prior version exists
 * for this case, the new row's `supersedes_assessment_id` links to it and
 * `version` increments — the prior row is NEVER updated (PRD Journey B
 * step 7: "historical decisions remain immutable").
 *
 * Refuses when subjectAgentRef === requestedByAgentRef (self-assessment —
 * PRD §9.10, acceptance criterion's "Factor attempts to participate in its
 * own Aegis assessment" failure-path test).
 */
export async function createAssessment(admin: SupabaseClient, input: CreateAssessmentInput): Promise<AegisAssessmentRow> {
  if (input.subjectAgentRef === input.requestedByAgentRef) {
    throw new AegisAssessmentError(
      'self-assessment-refused',
      `Refusing to create an assessment where the subject ('${input.subjectAgentRef}') and the requester are the same agent — Aegis cannot assess a candidate that is itself.`,
    );
  }

  const { data: priorRows, error: priorErr } = await admin
    .from('aegis_assessments')
    .select('assessment_id, version')
    .eq('case_id', input.caseId)
    .order('version', { ascending: false })
    .limit(1);
  if (priorErr) throw new Error(`createAssessment prior-version lookup failed: ${priorErr.message}`);
  const prior = (priorRows ?? [])[0] as { assessment_id: string; version: number } | undefined;

  const evidenceSetHash = commit({ v: 'aegis.evidence-set.v1', caseId: input.caseId, snapshot: input.evidenceSnapshot });

  const { data: inserted, error: insertErr } = await admin
    .from('aegis_assessments')
    .insert({
      case_id: input.caseId,
      version: (prior?.version ?? 0) + 1,
      supersedes_assessment_id: prior?.assessment_id ?? null,
      policy_id: input.policyId,
      policy_version: input.policyVersion,
      evidence_snapshot: input.evidenceSnapshot,
      evidence_set_hash: evidenceSetHash,
      state: 'evidence_locked', // the snapshot handed in is already the immutable one (Journey B step 1)
      subject_agent_ref: input.subjectAgentRef,
      requested_by_agent_ref: input.requestedByAgentRef,
    })
    .select('*')
    .single();
  if (insertErr) throw new Error(`createAssessment insert failed: ${insertErr.message}`);

  const row = inserted as AegisAssessmentRow;
  await recordFactorReceipt(admin, {
    eventType: 'aegis_assessment_submitted',
    caseId: input.caseId,
    assessmentId: row.assessment_id,
    actorPersonaRef: input.requestedByAgentRef,
    fromRole: 'factor',
    toRole: 'aegis',
    metadata: { version: row.version, evidenceSetHash },
  });
  return row;
}

async function readAssessment(admin: SupabaseClient, assessmentId: string): Promise<AegisAssessmentRow> {
  const { data, error } = await admin.from('aegis_assessments').select('*').eq('assessment_id', assessmentId).maybeSingle();
  if (error) throw new Error(`readAssessment failed: ${error.message}`);
  if (!data) throw new AegisAssessmentError('assessment-not-found', `No aegis_assessments row for ${assessmentId}`);
  return data as AegisAssessmentRow;
}

const ALLOWED_TRANSITIONS: Record<AegisAssessmentState, AegisAssessmentState[]> = {
  draft: ['evidence_locked'],
  evidence_locked: ['running'],
  running: ['review_required', 'failed'],
  review_required: ['ratified', 'failed'],
  ratified: [],
  failed: [],
};

async function moveState(admin: SupabaseClient, assessmentId: string, toState: AegisAssessmentState): Promise<AegisAssessmentRow> {
  const row = await readAssessment(admin, assessmentId);
  if (row.state === toState) return row; // idempotent
  const allowed = ALLOWED_TRANSITIONS[row.state] ?? [];
  if (!allowed.includes(toState)) {
    throw new AegisAssessmentError(
      'invalid-transition',
      `Assessment ${assessmentId} cannot move from '${row.state}' to '${toState}' (allowed: ${allowed.join(', ') || 'none'}).`,
    );
  }
  const { data: updated, error } = await admin
    .from('aegis_assessments')
    .update({ state: toState, updated_at: new Date().toISOString() })
    .eq('assessment_id', assessmentId)
    .eq('state', row.state)
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`moveState update failed: ${error.message}`);
  if (!updated) throw new AegisAssessmentError('concurrent-transition', `Assessment ${assessmentId} changed concurrently.`);
  return updated as AegisAssessmentRow;
}

export const beginRunning = (admin: SupabaseClient, assessmentId: string) => moveState(admin, assessmentId, 'running');
export const requireReview = (admin: SupabaseClient, assessmentId: string) => moveState(admin, assessmentId, 'review_required');

export async function failAssessment(admin: SupabaseClient, assessmentId: string, reason: string): Promise<AegisAssessmentRow> {
  const updated = await moveState(admin, assessmentId, 'failed');
  await recordFactorReceipt(admin, {
    eventType: 'aegis_assessment_failed',
    caseId: updated.case_id,
    assessmentId,
    actorPersonaRef: updated.requested_by_agent_ref,
    fromRole: 'aegis',
    toRole: 'factor',
    reason,
  });
  return updated;
}

export interface AddFindingInput {
  assessmentId: string;
  dimension: string;
  claim: string;
  evidenceRefs?: unknown[];
  method: string;
  result: AegisFindingResult;
  confidence: AegisConfidence;
  limitations?: string;
  falsificationCondition: string;
  isCritical?: boolean;
}

export async function addFinding(admin: SupabaseClient, input: AddFindingInput): Promise<{ finding_id: string }> {
  const row = await readAssessment(admin, input.assessmentId);
  if (row.state === 'ratified' || row.state === 'failed') {
    throw new AegisAssessmentError('assessment-closed', `Assessment ${input.assessmentId} is '${row.state}' — findings can no longer be added.`);
  }
  const { data, error } = await admin
    .from('aegis_findings')
    .insert({
      assessment_id: input.assessmentId,
      dimension: input.dimension,
      claim: input.claim,
      evidence_refs: input.evidenceRefs ?? [],
      method: input.method,
      result: input.result,
      confidence: input.confidence,
      limitations: input.limitations ?? null,
      falsification_condition: input.falsificationCondition,
      is_critical: input.isCritical ?? false,
    })
    .select('finding_id')
    .single();
  if (error) throw new Error(`addFinding failed: ${error.message}`);
  return data as { finding_id: string };
}

export interface RatifyAssessmentInput {
  assessmentId: string;
  decision: AegisDecision;
  conditions?: unknown[];
  ratifiedByPersonaRef: string;
}

/**
 * Ratifies an assessment — the ONLY operation that may set state='ratified'
 * (defense-in-depth: the DB trigger additionally refuses any further
 * mutation once this has run).
 *
 * Enforces PRD acceptance criterion 5: "A critical failed invariant
 * prevents an admissible decision regardless of aggregate score" — a
 * decision of 'admissible' is refused outright if any finding on this
 * assessment is `is_critical = true AND result = 'fail'`.
 *
 * Re-checks the self-assessment guard (defense-in-depth against a caller
 * that bypassed createAssessment's check, e.g. by hand-inserting a row —
 * belt AND suspenders, matching this PRD's "never silently weaken an
 * invariant" instruction).
 */
export async function ratifyAssessment(admin: SupabaseClient, input: RatifyAssessmentInput): Promise<AegisAssessmentRow> {
  assertNotRawPersonaId(input.ratifiedByPersonaRef, 'ratifyAssessment.ratifiedByPersonaRef');

  const row = await readAssessment(admin, input.assessmentId);
  if (row.subject_agent_ref === row.requested_by_agent_ref) {
    throw new AegisAssessmentError(
      'self-assessment-refused',
      `Assessment ${input.assessmentId} has an identical subject/requester ref — refusing to ratify a self-assessment.`,
    );
  }
  if (row.state !== 'review_required') {
    throw new AegisAssessmentError(
      'invalid-transition',
      `Assessment ${input.assessmentId} must be 'review_required' to ratify (is '${row.state}').`,
    );
  }

  if (input.decision === 'admissible' || input.decision === 'admissible_with_conditions') {
    const { data: criticalFails, error: findErr } = await admin
      .from('aegis_findings')
      .select('finding_id, dimension')
      .eq('assessment_id', input.assessmentId)
      .eq('is_critical', true)
      .eq('result', 'fail');
    if (findErr) throw new Error(`ratifyAssessment critical-finding check failed: ${findErr.message}`);
    if ((criticalFails ?? []).length > 0) {
      throw new AegisAssessmentError(
        'critical-failure-blocks-admission',
        `Assessment ${input.assessmentId} has ${criticalFails!.length} critical failed finding(s) ` +
          `(${criticalFails!.map((f: any) => f.dimension).join(', ')}) — an admissible decision is refused ` +
          'regardless of aggregate score (PRD §5.2 / acceptance criterion 5).',
      );
    }
  }

  const { data: findings, error: findingsErr } = await admin
    .from('aegis_findings')
    .select('dimension, claim, method, result, confidence, limitations, falsification_condition, is_critical')
    .eq('assessment_id', input.assessmentId)
    .order('dimension', { ascending: true });
  if (findingsErr) throw new Error(`ratifyAssessment findings read failed: ${findingsErr.message}`);

  const conditions = input.conditions ?? [];
  const ratifiedAt = new Date().toISOString();
  const assessmentHash = commit({
    v: 'aegis.assessment.v1',
    caseId: row.case_id,
    version: row.version,
    policyId: row.policy_id,
    policyVersion: row.policy_version,
    evidenceSetHash: row.evidence_set_hash,
    decision: input.decision,
    conditions,
    findings,
  });

  const { data: updated, error: updateErr } = await admin
    .from('aegis_assessments')
    .update({
      state: 'ratified',
      decision: input.decision,
      conditions,
      assessment_hash: assessmentHash,
      ratified_at: ratifiedAt,
      ratified_by_persona_ref: input.ratifiedByPersonaRef,
      immutable: true,
      updated_at: ratifiedAt,
    })
    .eq('assessment_id', input.assessmentId)
    .eq('state', 'review_required')
    .select('*')
    .maybeSingle();
  if (updateErr) throw new Error(`ratifyAssessment update failed: ${updateErr.message}`);
  if (!updated) throw new AegisAssessmentError('concurrent-transition', `Assessment ${input.assessmentId} changed concurrently — retry ratify.`);

  await recordFactorReceipt(admin, {
    eventType: 'aegis_assessment_ratified',
    caseId: row.case_id,
    assessmentId: input.assessmentId,
    actorPersonaRef: input.ratifiedByPersonaRef,
    fromRole: 'aegis',
    toRole: 'factor',
    metadata: { decision: input.decision, assessmentHash, version: row.version },
  });

  return updated as AegisAssessmentRow;
}

export async function listFindings(admin: SupabaseClient, assessmentId: string) {
  const { data, error } = await admin
    .from('aegis_findings')
    .select('*')
    .eq('assessment_id', assessmentId)
    .order('dimension', { ascending: true });
  if (error) throw new Error(`listFindings failed: ${error.message}`);
  return data ?? [];
}
