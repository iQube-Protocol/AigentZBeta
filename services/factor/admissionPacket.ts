/**
 * admissionPacket — read-only packet assembly for MoneyPenny's admission
 * decision (PRD Journey C step 3), reconciled onto spec/moneypenny-mpy2-3.
 *
 * Composes the current ratified Aegis assessment for a case with whatever
 * live readiness facts this environment can actually resolve. Legs this
 * environment has no live source for are reported as
 * `verified: false, reason: 'not-available-in-this-environment'` rather
 * than fabricated as passing (CLAUDE.md "No Guessing").
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FactorCaseRow } from './factorCaseService';
import { getCurrentAssessment, type AegisDecision } from '@/services/aegis/aegisAssessmentService';

export interface AdmissionPacket {
  caseId: string;
  ratifiedAssessment: { verified: boolean; decision: AegisDecision | null; assessmentHash: string | null; assessmentId: string | null };
  registryReadiness: { verified: boolean; reason: string };
}

export async function buildAdmissionPacket(admin: SupabaseClient, caseId: string): Promise<AdmissionPacket> {
  const { data: caseRow, error } = await admin.from('factor_cases').select('*').eq('case_id', caseId).maybeSingle();
  if (error) throw new Error(`buildAdmissionPacket case read failed: ${error.message}`);
  const c = caseRow as FactorCaseRow | null;

  const assessment = c ? await getCurrentAssessment(admin, 'factor_case', c.case_id) : null;
  const ratified = assessment && assessment.state === 'ratified';

  return {
    caseId,
    ratifiedAssessment: {
      verified: !!ratified,
      decision: ratified ? assessment!.decision : null,
      assessmentHash: ratified ? assessment!.assessment_hash : null,
      assessmentId: ratified ? assessment!.assessment_id : null,
    },
    registryReadiness: {
      verified: !!c?.candidate_registry_asset_id,
      reason: c?.candidate_registry_asset_id ? 'registry_asset_bound' : 'not-available-in-this-environment',
    },
  };
}
