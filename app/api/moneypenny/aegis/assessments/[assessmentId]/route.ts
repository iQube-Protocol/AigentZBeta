/**
 * GET /api/moneypenny/aegis/assessments/[assessmentId] — reads one
 * assessment plus its findings. No tenant/principal scoping exists on
 * aegis_assessments itself (it is keyed on subjectRef, not tenant_id) —
 * a caller wanting to gate this by case ownership must resolve the
 * parent factor_cases row (via `case_id`) through the tenant-scoped
 * GET /api/moneypenny/factor/cases/[caseId] route first.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { listFindings } from '@/services/aegis/aegisAssessmentService';
import { respondError } from '../../../factor/_lib/respondError';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await params;
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'not-authenticated' }, { status: 401 });
  }
  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'supabase-unavailable' }, { status: 503 });
  }

  try {
    const { data, error } = await admin.from('aegis_assessments').select('*').eq('assessment_id', assessmentId).maybeSingle();
    if (error) throw new Error(`assessment read failed: ${error.message}`);
    if (!data) return NextResponse.json({ ok: false, error: 'assessment-not-found' }, { status: 404 });
    const findings = await listFindings(admin, assessmentId);
    return NextResponse.json({ ok: true, assessment: data, findings });
  } catch (err) {
    return respondError(err);
  }
}
