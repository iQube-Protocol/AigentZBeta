/**
 * Persistence for Marketa admission assessments (GJR-MKT-001 Phase 4).
 *
 * Append-only / superseding, mirroring
 * services/research/independentReviewStore.ts's markReviewSuperseded
 * discipline exactly (§9): a reassessment inserts a NEW row and marks the
 * prior CURRENT row's `superseded_by`; no row's own decision/rules/rationale
 * is ever mutated after it is written.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MarketaAdmissionAssessment } from './admissionAssessmentEngine';

const TABLE = 'marketa_agent_admission_assessments';

export interface MarketaAdmissionAssessmentRecord extends MarketaAdmissionAssessment {
  assessmentId: string;
  subjectAigentQubeId: string;
  evidenceSnapshotHash: string;
  actorPersonaId: string;
  receiptRef: string | null;
  supersedesAssessmentId: string | null;
  supersededBy: string | null;
  createdAt: string;
}

interface DbRow {
  assessment_id: string;
  subject_aigent_iqube_id: string;
  mode: string;
  decision: string;
  policy_version: string;
  evidence_snapshot_hash: string;
  satisfied_rules: string[];
  missing_rules: string[];
  failed_rules: string[];
  evidence_refs: string[];
  rationale: string;
  actor_persona_id: string;
  receipt_ref: string | null;
  supersedes_assessment_id: string | null;
  superseded_by: string | null;
  created_at: string;
}

function rowToRecord(row: DbRow): MarketaAdmissionAssessmentRecord {
  return {
    assessmentId: row.assessment_id,
    subjectAigentQubeId: row.subject_aigent_iqube_id,
    version: '1.0',
    mode: row.mode as MarketaAdmissionAssessment['mode'],
    decision: row.decision as MarketaAdmissionAssessment['decision'],
    policyVersion: row.policy_version,
    evidenceSnapshotHash: row.evidence_snapshot_hash,
    satisfiedRules: row.satisfied_rules ?? [],
    missingRules: row.missing_rules ?? [],
    failedRules: row.failed_rules ?? [],
    contradictionRefs: [],
    evidenceRefs: row.evidence_refs ?? [],
    rationale: row.rationale,
    actorPersonaId: row.actor_persona_id,
    receiptRef: row.receipt_ref ?? null,
    supersedesAssessmentId: row.supersedes_assessment_id ?? null,
    supersededBy: row.superseded_by ?? null,
    createdAt: row.created_at,
  };
}

function adminOrDefault(admin?: SupabaseClient): SupabaseClient {
  const client = admin ?? getSupabaseServer();
  if (!client) throw new Error('admissionAssessmentStore: Supabase configuration missing');
  return client;
}

export interface CreateMarketaAdmissionAssessmentInput {
  assessmentId: string;
  subjectAigentQubeId: string;
  assessment: MarketaAdmissionAssessment;
  actorPersonaId: string;
  receiptRef: string | null;
  /** The prior current assessment for this subject, if this is a reassessment (§9). */
  supersedesAssessmentId?: string | null;
}

/**
 * Inserts the new row, then — ONLY if `supersedesAssessmentId` is given —
 * marks the prior row's `superseded_by`. Never deletes, never mutates the
 * prior row's decision fields. Both writes happen inside one call so a
 * caller can never insert a new current assessment while leaving a stale
 * "current" row still readable as current.
 */
export async function createMarketaAdmissionAssessment(
  input: CreateMarketaAdmissionAssessmentInput,
  admin?: SupabaseClient,
): Promise<MarketaAdmissionAssessmentRecord> {
  const client = adminOrDefault(admin);
  const { data, error } = await client
    .from(TABLE)
    .insert({
      assessment_id: input.assessmentId,
      subject_aigent_iqube_id: input.subjectAigentQubeId,
      mode: input.assessment.mode,
      decision: input.assessment.decision,
      policy_version: input.assessment.policyVersion,
      evidence_snapshot_hash: (input.assessment as unknown as { evidenceSnapshotHash?: string }).evidenceSnapshotHash ?? '',
      satisfied_rules: input.assessment.satisfiedRules,
      missing_rules: input.assessment.missingRules,
      failed_rules: input.assessment.failedRules,
      evidence_refs: input.assessment.evidenceRefs,
      rationale: input.assessment.rationale,
      actor_persona_id: input.actorPersonaId,
      receipt_ref: input.receiptRef,
      supersedes_assessment_id: input.supersedesAssessmentId ?? null,
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) throw new Error(`createMarketaAdmissionAssessment failed: ${error.message}`);

  if (input.supersedesAssessmentId) {
    const { error: supersedeError } = await client
      .from(TABLE)
      .update({ superseded_by: input.assessmentId })
      .eq('assessment_id', input.supersedesAssessmentId);
    if (supersedeError) throw new Error(`createMarketaAdmissionAssessment supersede-write failed: ${supersedeError.message}`);
  }

  return rowToRecord(data as DbRow);
}

/** The current (non-superseded) assessment for a subject, or null if none exists yet. */
export async function getCurrentMarketaAdmissionAssessment(
  subjectAigentQubeId: string,
  admin?: SupabaseClient,
): Promise<MarketaAdmissionAssessmentRecord | null> {
  const client = adminOrDefault(admin);
  const { data, error } = await client
    .from(TABLE)
    .select('*')
    .eq('subject_aigent_iqube_id', subjectAigentQubeId)
    .is('superseded_by', null)
    .maybeSingle();
  if (error) throw new Error(`getCurrentMarketaAdmissionAssessment failed: ${error.message}`);
  return data ? rowToRecord(data as DbRow) : null;
}

export async function getMarketaAdmissionAssessment(
  assessmentId: string,
  admin?: SupabaseClient,
): Promise<MarketaAdmissionAssessmentRecord | null> {
  const client = adminOrDefault(admin);
  const { data, error } = await client.from(TABLE).select('*').eq('assessment_id', assessmentId).maybeSingle();
  if (error) throw new Error(`getMarketaAdmissionAssessment failed: ${error.message}`);
  return data ? rowToRecord(data as DbRow) : null;
}
