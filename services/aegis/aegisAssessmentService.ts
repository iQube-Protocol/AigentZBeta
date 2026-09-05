/**
 * aegisAssessmentService — Aegis 0.1's evidence-bound, versioned, immutable
 * assessment engine (PRD Journey B, §6.2, §8.3), reconciled onto
 * spec/moneypenny-mpy2-3.
 *
 * Separation of powers (PRD §2 hard invariants 1-2): Aegis can assess and
 * recommend; it cannot admit. This service never writes
 * `factor_cases.state` and never calls
 * services/moneypenny/admissionAuthority.ts. It refuses outright to assess
 * a candidate when the requesting agent IS the subject being assessed
 * (Factor cannot assess itself — PRD Journey 0 step 8, §9.10), enforced
 * BOTH in application code and by `chk_aegis_assessments_not_self_assessed`
 * at the DB layer (defense in depth).
 *
 * State machine: draft -> evidence_locked -> running -> review_required ->
 *   ratified | failed. Ratified/failed rows are immutable — this service is
 *   the ONLY writer path to 'ratified', and the DB trigger
 *   `trg_aegis_assessments_immutable` is defense-in-depth against any other
 *   write path.
 *
 * Modelled on services/marketa/admissionAssessmentStore.ts +
 * admissionAssessmentRunner.ts's proven append-only/superseding pattern —
 * NOT an extension of that table (Aegis is an independent assessor from
 * Marketa; see the reconciliation migration's header comment for the full
 * reasoning). Aegis's findings/scores/dossiers live ONLY in
 * aegis_assessments/aegis_findings — never in Crystal/Track2's
 * `invariants`/`discovery_candidates`/`research_objects` schema (operator
 * directive, 2026-09-04): Crystal may at most be READ as one evidence
 * source cited in a finding's `evidenceRefs`, never written to.
 */

import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { commit } from '../factor/canonical';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export type AegisAssessmentState = 'draft' | 'evidence_locked' | 'running' | 'review_required' | 'ratified' | 'failed';

/**
 * What Aegis can assess. Widened (Factor + Aegis Bankr PRD, Phase 4,
 * migration 20260930230000) to admit 'token_launch' (subject_ref =
 * token_launches.id) alongside the original 'factor_case'/'agent' —
 * Aegis's assessment mechanics (self-assessment refusal, critical-finding-
 * blocks-admissible, append-only/superseding, post-ratification
 * immutability) are already subject-generic; only the DB CHECK constraint
 * and this type needed to grow, additively, never a second engine.
 */
export type AegisSubjectType = 'factor_case' | 'agent' | 'token_launch';
export type AegisDecision = 'admissible' | 'admissible_with_conditions' | 'insufficient_evidence' | 'not_admissible';
export type AegisFindingResult = 'pass' | 'fail' | 'inconclusive';

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
  subject_type: AegisSubjectType;
  subject_ref: string;
  case_id: string | null;
  state: AegisAssessmentState;
  decision: AegisDecision | null;
  policy_version: string;
  evidence_snapshot: Record<string, unknown>;
  evidence_snapshot_hash: string | null;
  conditions: unknown[];
  assessment_hash: string | null;
  requested_by_agent_ref: string;
  assessed_by_agent_ref: string;
  rationale: string | null;
  actor_persona_id: string;
  receipt_ref: string | null;
  supersedes_assessment_id: string | null;
  superseded_by: string | null;
  created_at: string;
  updated_at: string;
  ratified_at: string | null;
}

export interface CreateAssessmentInput {
  subjectType: AegisSubjectType;
  subjectRef: string;
  caseId?: string | null;
  policyVersion: string;
  /** The immutable evidence snapshot (already assembled by the caller from
   *  factor_evidence_items) — Journey B step 1. */
  evidenceSnapshot: Record<string, unknown>;
  /** The agent ref that is submitting this request for assessment (normally
   *  Factor's own ref). Must differ from `assessedByAgentRef` (default
   *  'aigent-aegis') and — critically — from the subject being assessed. */
  requestedByAgentRef: string;
  assessedByAgentRef?: string;
  actorPersonaId: string;
}

/**
 * Creates a new (super-ceding, if a current one exists) assessment for a
 * subject. The prior CURRENT row is NEVER updated — only its
 * `superseded_by` is set (PRD Journey B step 7).
 *
 * Refuses when subjectRef === requestedByAgentRef (self-assessment — PRD
 * §9.10).
 */
export async function createAssessment(admin: SupabaseClient, input: CreateAssessmentInput): Promise<AegisAssessmentRow> {
  if (input.subjectRef === input.requestedByAgentRef) {
    throw new AegisAssessmentError(
      'self-assessment-refused',
      `Refusing to create an assessment where the subject ('${input.subjectRef}') and the requester are the same agent — Aegis cannot assess a candidate that is itself.`,
    );
  }

  const { data: priorData, error: priorErr } = await admin
    .from('aegis_assessments')
    .select('assessment_id')
    .eq('subject_type', input.subjectType)
    .eq('subject_ref', input.subjectRef)
    .is('superseded_by', null)
    .maybeSingle();
  if (priorErr) throw new Error(`createAssessment prior-version lookup failed: ${priorErr.message}`);
  const prior = priorData as { assessment_id: string } | null;

  const evidenceSnapshotHash = commit({ v: 'aegis.evidence-set.v1', subjectRef: input.subjectRef, snapshot: input.evidenceSnapshot });
  const assessmentId = `aegis-${input.subjectRef}-${evidenceSnapshotHash.slice(0, 16)}`;

  // Retire the prior CURRENT row's superseded_by BEFORE inserting the new
  // row — never the other way around. The partial unique index
  // (subject_type, subject_ref) WHERE superseded_by IS NULL enforces "one
  // current row" against BOTH rows simultaneously the instant they would
  // otherwise coexist; updating first means the new insert never collides
  // with the row it is about to succeed.
  if (prior) {
    const { error: supersedeErr } = await admin.from('aegis_assessments').update({ superseded_by: assessmentId }).eq('assessment_id', prior.assessment_id);
    if (supersedeErr) throw new Error(`createAssessment supersede-write failed: ${supersedeErr.message}`);
  }

  const { data: inserted, error: insertErr } = await admin
    .from('aegis_assessments')
    .insert({
      assessment_id: assessmentId,
      subject_type: input.subjectType,
      subject_ref: input.subjectRef,
      case_id: input.caseId ?? null,
      policy_version: input.policyVersion,
      evidence_snapshot: input.evidenceSnapshot,
      evidence_snapshot_hash: evidenceSnapshotHash,
      state: 'evidence_locked', // the snapshot handed in is already the immutable one (Journey B step 1)
      requested_by_agent_ref: input.requestedByAgentRef,
      assessed_by_agent_ref: input.assessedByAgentRef ?? 'aigent-aegis',
      actor_persona_id: input.actorPersonaId,
      supersedes_assessment_id: prior?.assessment_id ?? null,
    })
    .select('*')
    .single();
  if (insertErr) throw new Error(`createAssessment insert failed: ${insertErr.message}`);

  const row = inserted as AegisAssessmentRow;
  const receipt = await createActivityReceipt({
    personaId: input.actorPersonaId,
    activeCartridge: 'moneypenny',
    actionType: 'aegis_assessment_requested',
    summary: `Aegis assessment requested for ${input.subjectRef}`,
    agentsInvoked: [input.requestedByAgentRef, row.assessed_by_agent_ref],
    actionInput: { assessmentId, subjectRef: input.subjectRef, evidenceSnapshotHash },
  });
  if (receipt?.id) {
    await admin.from('aegis_assessments').update({ receipt_ref: receipt.id }).eq('assessment_id', assessmentId);
    row.receipt_ref = receipt.id;
  }
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
    throw new AegisAssessmentError('invalid-transition', `Assessment ${assessmentId} cannot move from '${row.state}' to '${toState}' (allowed: ${allowed.join(', ') || 'none'}).`);
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
  await createActivityReceipt({
    personaId: updated.actor_persona_id,
    activeCartridge: 'moneypenny',
    actionType: 'aegis_assessment_failed',
    summary: `Aegis assessment ${assessmentId} failed: ${reason}`,
    agentsInvoked: [updated.assessed_by_agent_ref],
    actionInput: { assessmentId, reason },
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
  confidence: number;
  limitations?: string;
  falsificationCondition: string;
  isCritical?: boolean;
}

export async function addFinding(admin: SupabaseClient, input: AddFindingInput): Promise<{ finding_id: string }> {
  const row = await readAssessment(admin, input.assessmentId);
  if (row.state === 'ratified' || row.state === 'failed') {
    throw new AegisAssessmentError('assessment-closed', `Assessment ${input.assessmentId} is '${row.state}' — findings can no longer be added.`);
  }
  const findingId = randomUUID();
  const { data, error } = await admin
    .from('aegis_findings')
    .insert({
      finding_id: findingId,
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
  rationale?: string;
  ratifiedByPersonaId: string;
}

/**
 * Ratifies an assessment — the ONLY operation that may set
 * state='ratified' (defense-in-depth: the DB trigger additionally refuses
 * any further mutation once this has run).
 *
 * A decision of 'admissible' (or 'admissible_with_conditions') is refused
 * outright if any finding on this assessment is `is_critical = true AND
 * result = 'fail'` — a critical failed invariant overrides aggregate
 * score, regardless of how many other findings passed.
 */
export async function ratifyAssessment(admin: SupabaseClient, input: RatifyAssessmentInput): Promise<AegisAssessmentRow> {
  const row = await readAssessment(admin, input.assessmentId);
  if (row.subject_ref === row.requested_by_agent_ref) {
    throw new AegisAssessmentError('self-assessment-refused', `Assessment ${input.assessmentId} has an identical subject/requester ref — refusing to ratify a self-assessment.`);
  }
  if (row.state !== 'review_required') {
    throw new AegisAssessmentError('invalid-transition', `Assessment ${input.assessmentId} must be 'review_required' to ratify (is '${row.state}').`);
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
          `(${(criticalFails as Array<{ dimension: string }>).map((f) => f.dimension).join(', ')}) — an admissible decision is refused regardless of aggregate score (PRD §5.2).`,
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
    subjectRef: row.subject_ref,
    policyVersion: row.policy_version,
    evidenceSnapshotHash: row.evidence_snapshot_hash,
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
      rationale: input.rationale ?? null,
      assessment_hash: assessmentHash,
      ratified_at: ratifiedAt,
      updated_at: ratifiedAt,
    })
    .eq('assessment_id', input.assessmentId)
    .eq('state', 'review_required')
    .select('*')
    .maybeSingle();
  if (updateErr) throw new Error(`ratifyAssessment update failed: ${updateErr.message}`);
  if (!updated) throw new AegisAssessmentError('concurrent-transition', `Assessment ${input.assessmentId} changed concurrently — retry ratify.`);

  await createActivityReceipt({
    personaId: input.ratifiedByPersonaId,
    activeCartridge: 'moneypenny',
    actionType: 'aegis_assessment_ratified',
    summary: `Aegis ratified assessment ${input.assessmentId} for ${row.subject_ref}: ${input.decision}`,
    agentsInvoked: [row.assessed_by_agent_ref],
    actionInput: { assessmentId: input.assessmentId, decision: input.decision, assessmentHash },
  });
  // Subject-specific receipt, additive to the generic one above — the
  // Factor + Aegis Bankr PRD's own action-type vocabulary
  // (aegis_token_assessment_ratified) names token-launch ratification as a
  // distinct, DVN-anchored event from a generic assessment ratification.
  // Fires here (not from a Bankr-specific caller) so it is emitted
  // regardless of which route/service triggered ratification — the same
  // reason the generic receipt above lives in this one function.
  if (row.subject_type === 'token_launch') {
    await createActivityReceipt({
      personaId: input.ratifiedByPersonaId,
      activeCartridge: 'moneypenny',
      actionType: 'aegis_token_assessment_ratified',
      summary: `Aegis ratified token-launch assessment ${input.assessmentId} for launch ${row.subject_ref}: ${input.decision}`,
      agentsInvoked: [row.assessed_by_agent_ref],
      actionInput: { assessmentId: input.assessmentId, launchId: row.subject_ref, decision: input.decision, assessmentHash },
    });
  }
  if (row.supersedes_assessment_id) {
    await createActivityReceipt({
      personaId: input.ratifiedByPersonaId,
      activeCartridge: 'moneypenny',
      actionType: 'aegis_assessment_superseded',
      summary: `Assessment ${row.supersedes_assessment_id} superseded by ${input.assessmentId}`,
      agentsInvoked: [row.assessed_by_agent_ref],
      actionInput: { supersededAssessmentId: row.supersedes_assessment_id, newAssessmentId: input.assessmentId },
    });
  }

  return updated as AegisAssessmentRow;
}

export async function getCurrentAssessment(admin: SupabaseClient, subjectType: AegisSubjectType, subjectRef: string): Promise<AegisAssessmentRow | null> {
  const { data, error } = await admin.from('aegis_assessments').select('*').eq('subject_type', subjectType).eq('subject_ref', subjectRef).is('superseded_by', null).maybeSingle();
  if (error) throw new Error(`getCurrentAssessment failed: ${error.message}`);
  return data as AegisAssessmentRow | null;
}

export async function listFindings(admin: SupabaseClient, assessmentId: string) {
  const { data, error } = await admin.from('aegis_findings').select('*').eq('assessment_id', assessmentId).order('dimension', { ascending: true });
  if (error) throw new Error(`listFindings failed: ${error.message}`);
  return data ?? [];
}
