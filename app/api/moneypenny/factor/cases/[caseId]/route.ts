/**
 * GET /api/moneypenny/factor/cases/[caseId] — reads one Factor case,
 * tenant-scoped. Uses factorCaseService.getCase, never a raw query —
 * that function is also where the cross-tenant guard (Phase 2 closure of
 * the Phase 1 §8 gap) lives.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getCase, listEvidenceForCase } from '@/services/factor/factorCaseService';
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
    return NextResponse.json({ ok: true, case: caseRow, evidence });
  } catch (err) {
    return respondError(err);
  }
}
