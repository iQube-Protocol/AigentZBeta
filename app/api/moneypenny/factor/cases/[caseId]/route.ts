/**
 * GET /api/moneypenny/factor/cases/[caseId] — reads one Factor case,
 * tenant-scoped. Uses factorCaseService.getCase, never a raw query —
 * that function is also where the cross-tenant guard (Phase 2 closure of
 * the Phase 1 §8 gap) lives.
 *
 * Candidate Intake workspace upgrade (2026-09-05) — also resolves the
 * case's CURRENT Aegis assessment (+ its findings), so a reopened/
 * refreshed workspace can restore canonical state without a second round
 * trip. This is the SAME resolution services/factor/admissionPacket.ts
 * already performs (getCurrentAssessment(admin, 'factor_case', caseId)) —
 * reused verbatim, not re-derived, since `factor_cases.current_aegis_
 * assessment_id` is not itself kept in sync anywhere; the live query by
 * (subject_type, subject_ref) is the one real source of truth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getCase, listEvidenceForCase } from '@/services/factor/factorCaseService';
import { getCurrentAssessment, listFindings } from '@/services/aegis/aegisAssessmentService';
import { respondError, resolveTenantId } from '../../_lib/respondError';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'not-authenticated' }, { status: 401 });
  }
  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'supabase-unavailable' }, { status: 503 });
  }

  const tenantId = resolveTenantId(new URL(req.url).searchParams.get('tenantId'));
  try {
    const [caseRow, evidence] = await Promise.all([getCase(admin, caseId, tenantId), listEvidenceForCase(admin, caseId, tenantId)]);
    const assessment = await getCurrentAssessment(admin, 'factor_case', caseId);
    const findings = assessment ? await listFindings(admin, assessment.assessment_id) : [];
    return NextResponse.json({ ok: true, case: caseRow, evidence, assessment, findings });
  } catch (err) {
    return respondError(err);
  }
}
