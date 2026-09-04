/**
 * POST /api/moneypenny/aegis/assessments/[assessmentId]/findings —
 * records one evidence-bound finding (PRD Journey B step 4). Refused once
 * the parent assessment is ratified/failed (aegisAssessmentService.addFinding,
 * defense-in-depth with the trg_aegis_findings_immutable DB trigger).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { addFinding, type AegisFindingResult } from '@/services/aegis/aegisAssessmentService';
import { respondError } from '../../../../factor/_lib/respondError';

export const dynamic = 'force-dynamic';

const RESULTS: AegisFindingResult[] = ['pass', 'fail', 'inconclusive'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await params;
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

  const dimension = typeof body.dimension === 'string' ? body.dimension : null;
  const claim = typeof body.claim === 'string' ? body.claim : null;
  const method = typeof body.method === 'string' ? body.method : null;
  const falsificationCondition = typeof body.falsificationCondition === 'string' ? body.falsificationCondition : null;
  const confidence = typeof body.confidence === 'number' ? body.confidence : null;
  const result = RESULTS.includes(body.result as AegisFindingResult) ? (body.result as AegisFindingResult) : null;
  if (!dimension || !claim || !method || !falsificationCondition || confidence === null || !result) {
    return NextResponse.json(
      { ok: false, error: 'missing-required-field', detail: 'dimension, claim, method, result, confidence, and falsificationCondition are required.' },
      { status: 400 },
    );
  }

  try {
    const finding = await addFinding(admin, {
      assessmentId,
      dimension,
      claim,
      method,
      result,
      confidence,
      falsificationCondition,
      evidenceRefs: Array.isArray(body.evidenceRefs) ? body.evidenceRefs : undefined,
      limitations: typeof body.limitations === 'string' ? body.limitations : undefined,
      isCritical: body.isCritical === true,
    });
    return NextResponse.json({ ok: true, finding });
  } catch (err) {
    return respondError(err);
  }
}
