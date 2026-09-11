/**
 * POST /api/moneypenny/factor/cases/[caseId]/decide-admission — the ONE
 * route that may move a case into 'admitted' | 'conditionally_admitted' |
 * 'rejected' (PRD Journey C, §2 hard invariant 3). Delegates entirely to
 * services/moneypenny/admissionAuthority.ts's decideAdmission — this route
 * adds no admission logic of its own, it only authenticates the caller
 * and forwards the decision.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { decideAdmission, type AdmissionDecision } from '@/services/moneypenny/admissionAuthority';
import { respondError, resolveTenantId } from '../../../_lib/respondError';

export const dynamic = 'force-dynamic';

const DECISIONS: AdmissionDecision[] = ['admitted', 'conditionally_admitted', 'rejected'];

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
  if (!DECISIONS.includes(body.decision as AdmissionDecision)) {
    return NextResponse.json({ ok: false, error: 'invalid-decision', detail: `decision must be one of: ${DECISIONS.join(', ')}.` }, { status: 400 });
  }

  try {
    const result = await decideAdmission(admin, {
      caseId,
      tenantId: resolveTenantId(body.tenantId),
      decision: body.decision as AdmissionDecision,
      decidingPersonaId: persona.personaId,
      conditions: Array.isArray(body.conditions) ? body.conditions.filter((c): c is string => typeof c === 'string') : undefined,
      reason: typeof body.reason === 'string' ? body.reason : undefined,
      idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
    });
    return NextResponse.json({ ok: true, case: result.case, packet: result.packet, replay: result.replay });
  } catch (err) {
    return respondError(err);
  }
}
