/**
 * POST /api/moneypenny/aegis/assessments/[assessmentId]/ratify — the ONLY
 * route that may set state='ratified' (PRD Journey B step 8). Refused
 * when the assessment carries a critical failed finding (PRD §5.2) or is
 * a self-assessment — both enforced in aegisAssessmentService.ratifyAssessment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { ratifyAssessment, type AegisDecision } from '@/services/aegis/aegisAssessmentService';
import { respondError } from '../../../../factor/_lib/respondError';

export const dynamic = 'force-dynamic';

const DECISIONS: AegisDecision[] = ['admissible', 'admissible_with_conditions', 'insufficient_evidence', 'not_admissible'];

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
  if (!DECISIONS.includes(body.decision as AegisDecision)) {
    return NextResponse.json({ ok: false, error: 'invalid-decision', detail: `decision must be one of: ${DECISIONS.join(', ')}.` }, { status: 400 });
  }

  try {
    const assessment = await ratifyAssessment(admin, {
      assessmentId,
      decision: body.decision as AegisDecision,
      conditions: Array.isArray(body.conditions) ? body.conditions : undefined,
      rationale: typeof body.rationale === 'string' ? body.rationale : undefined,
      ratifiedByPersonaId: persona.personaId,
    });
    return NextResponse.json({ ok: true, assessment });
  } catch (err) {
    return respondError(err);
  }
}
