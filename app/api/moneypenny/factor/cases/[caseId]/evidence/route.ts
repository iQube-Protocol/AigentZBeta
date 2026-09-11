/**
 * GET/POST /api/moneypenny/factor/cases/[caseId]/evidence — Factor 0.1
 * Journey A step 6 (PRD §5.1). GET lists the current (non-superseded)
 * evidence checklist; POST adds or updates one item.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { upsertEvidenceItem, listEvidenceForCase, type FactorEvidenceStatus } from '@/services/factor/factorCaseService';
import { respondError, resolveTenantId } from '../../../_lib/respondError';

export const dynamic = 'force-dynamic';

const EVIDENCE_STATUSES: FactorEvidenceStatus[] = ['missing', 'requested', 'supplied', 'stale', 'contradicted'];

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
    const evidence = await listEvidenceForCase(admin, caseId, tenantId);
    return NextResponse.json({ ok: true, evidence });
  } catch (err) {
    return respondError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'not-authenticated' }, { status: 401 });
  }
  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'supabase-unavailable' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 });
  }
  const kind = typeof body.kind === 'string' ? body.kind : null;
  if (!kind) {
    return NextResponse.json({ ok: false, error: 'missing-required-field', detail: 'kind is required.' }, { status: 400 });
  }
  const status = EVIDENCE_STATUSES.includes(body.status as FactorEvidenceStatus) ? (body.status as FactorEvidenceStatus) : undefined;

  try {
    const item = await upsertEvidenceItem(
      admin,
      {
        caseId,
        tenantId: resolveTenantId(body.tenantId),
        kind,
        status,
        payload: typeof body.payload === 'object' && body.payload !== null ? (body.payload as Record<string, unknown>) : undefined,
        sourceRef: typeof body.sourceRef === 'string' ? body.sourceRef : undefined,
        suppliedByPersonaId: persona.personaId,
      },
      body.evidenceIsLockedForAssessment === true,
    );
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    return respondError(err);
  }
}
