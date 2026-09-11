/**
 * POST /api/moneypenny/aegis/assessments — Aegis 0.1 Journey B step 1
 * (PRD §6.2). Opens (or supersedes the current) assessment for a subject.
 * Refuses self-assessment (subjectRef === requestedByAgentRef) — enforced
 * in aegisAssessmentService.createAssessment, defense-in-depth with the DB
 * CHECK constraint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createAssessment } from '@/services/aegis/aegisAssessmentService';
import { respondError } from '../../factor/_lib/respondError';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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

  const subjectRef = typeof body.subjectRef === 'string' ? body.subjectRef : null;
  const policyVersion = typeof body.policyVersion === 'string' ? body.policyVersion : null;
  const evidenceSnapshot = typeof body.evidenceSnapshot === 'object' && body.evidenceSnapshot !== null ? (body.evidenceSnapshot as Record<string, unknown>) : null;
  const requestedByAgentRef = typeof body.requestedByAgentRef === 'string' ? body.requestedByAgentRef : null;
  if (body.subjectType !== 'factor_case' && body.subjectType !== 'agent') {
    return NextResponse.json({ ok: false, error: 'missing-required-field', detail: "subjectType must be 'factor_case' or 'agent'." }, { status: 400 });
  }
  if (!subjectRef || !policyVersion || !evidenceSnapshot || !requestedByAgentRef) {
    return NextResponse.json(
      { ok: false, error: 'missing-required-field', detail: 'subjectRef, policyVersion, evidenceSnapshot, and requestedByAgentRef are required.' },
      { status: 400 },
    );
  }

  try {
    const assessment = await createAssessment(admin, {
      subjectType: body.subjectType,
      subjectRef,
      caseId: typeof body.caseId === 'string' ? body.caseId : null,
      policyVersion,
      evidenceSnapshot,
      requestedByAgentRef,
      assessedByAgentRef: typeof body.assessedByAgentRef === 'string' ? body.assessedByAgentRef : undefined,
      actorPersonaId: persona.personaId,
    });
    return NextResponse.json({ ok: true, assessment });
  } catch (err) {
    return respondError(err);
  }
}
