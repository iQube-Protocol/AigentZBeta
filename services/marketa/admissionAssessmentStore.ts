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

/**
 * Is this store usable RIGHT NOW — asked before, not during, the ceremony.
 *
 * ── WHY THIS EXISTS (operator, 2026-08-03) ───────────────────────────────
 *
 * `partner_authorization_requests` (Verify) had this exact gap earlier the
 * same day: a table referenced by code but never migrated onto this
 * deployment. There the fix was `checkAuthorizationStoreAvailable`, checked
 * BEFORE calling Horizen. This is the identical shape one layer over: Claim's
 * `runMarketaAdmissionAssessment` called `getCurrentMarketaAdmissionAssessment`
 * with no guard, so a missing `marketa_agent_admission_assessments` table
 * THREW — after `agent_control_proven` had already been written, and before
 * Marketa could write even `marketa_eligibility_assessed`. Repeated clicks
 * therefore produced repeated control-proof receipts and NOTHING from
 * Marketa, with no visible cause until the route's own try/catch (added the
 * same day) finally surfaced `Could not find the table … in the schema
 * cache` instead of an empty response body.
 *
 * Mirrors `checkAuthorizationStoreAvailable` exactly — one shared shape for
 * "is this durable store reachable", not a second implementation of it.
 */
export type MarketaStoreAvailability =
  | { available: true }
  | {
      available: false;
      kind: 'no-client' | 'table-absent' | 'permission-denied' | 'unknown';
      detail: string;
      remedy: string;
    };

export async function checkMarketaAssessmentStoreAvailable(admin?: SupabaseClient): Promise<MarketaStoreAvailability> {
  const client = admin ?? getSupabaseServer();
  if (!client) {
    return {
      available: false,
      kind: 'no-client',
      detail: 'no server Supabase client is configured in this environment',
      remedy: 'Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL for this deployment, then redeploy.',
    };
  }

  const { error } = await client.from(TABLE).select('assessment_id', { head: true, count: 'exact' }).limit(1);
  if (!error) return { available: true };

  const code = (error as { code?: string }).code ?? '';
  const message = error.message ?? String(error);
  if (code === 'PGRST205' || code === '42P01' || /schema cache|does not exist/i.test(message)) {
    return {
      available: false,
      kind: 'table-absent',
      detail: message,
      remedy:
        `Apply supabase/migrations/20260930000600_marketa_agent_admission_assessments.sql to this project, ` +
        `then reload PostgREST's schema cache: NOTIFY pgrst, 'reload schema';`,
    };
  }
  if (code === '42501' || /permission denied|row-level security/i.test(message)) {
    return {
      available: false,
      kind: 'permission-denied',
      detail: message,
      remedy: `The table exists but this caller cannot read it — check that the route uses the service-role client, and the RLS policy on ${TABLE}.`,
    };
  }
  return {
    available: false,
    kind: 'unknown',
    detail: message,
    remedy: `Read the error above against ${TABLE}; it is neither a missing table nor a permissions refusal.`,
  };
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
