/**
 * GET /api/moneypenny/factor/cases/[caseId]/events — the case activity
 * timeline (Candidate Intake workspace upgrade, 2026-09-05, requirement 1).
 * Reads factor_case_events, tenant-scoped via listCaseEvents — the same
 * table every state transition/pause/resume/admission decision already
 * writes to via appendCaseEvent. No new schema, no parallel case service:
 * this route only completes the existing write path's missing reader.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { listCaseEvents } from '@/services/factor/factorCaseService';
import { respondError, resolveTenantId } from '../../../_lib/respondError';

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
    const events = await listCaseEvents(admin, caseId, tenantId);
    return NextResponse.json({ ok: true, events });
  } catch (err) {
    return respondError(err);
  }
}
