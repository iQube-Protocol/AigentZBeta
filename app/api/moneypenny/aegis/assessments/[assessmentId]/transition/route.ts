/**
 * POST /api/moneypenny/aegis/assessments/[assessmentId]/transition —
 * advances an assessment through draft -> evidence_locked -> running ->
 * review_required, or fails it outright. Ratification has its own route
 * (../ratify) because it carries a decision payload this one does not.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { beginRunning, requireReview, failAssessment } from '@/services/aegis/aegisAssessmentService';
import { respondError } from '../../../../factor/_lib/respondError';

export const dynamic = 'force-dynamic';

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

  try {
    if (body.action === 'begin-running') {
      const assessment = await beginRunning(admin, assessmentId);
      return NextResponse.json({ ok: true, assessment });
    }
    if (body.action === 'require-review') {
      const assessment = await requireReview(admin, assessmentId);
      return NextResponse.json({ ok: true, assessment });
    }
    if (body.action === 'fail') {
      const reason = typeof body.reason === 'string' ? body.reason : 'unspecified';
      const assessment = await failAssessment(admin, assessmentId, reason);
      return NextResponse.json({ ok: true, assessment });
    }
    return NextResponse.json({ ok: false, error: 'unknown-action', detail: "action must be one of 'begin-running' | 'require-review' | 'fail'." }, { status: 400 });
  } catch (err) {
    return respondError(err);
  }
}
