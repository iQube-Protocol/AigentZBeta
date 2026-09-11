/**
 * GET /api/polity-passport/status/[id] — public machine-readable status.
 *
 * PRD §10 step 6 / §12.3: agents poll their application status by id. The
 * projection is public-safe: status, class, grade, timestamps — no identity
 * refs, no vault refs, no persona/DID fields (T0 rule).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ ok: false, error: 'Invalid application id' }, { status: 400 });
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: 'Supabase configuration missing' },
        { status: 500 },
      );
    }

    const { data, error } = await admin
      .from('polity_passport_applications')
      .select('id, passport_class, application_status, passport_grade, submitted_at, decided_at')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ ok: false, error: 'Application not found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      applicationId: String(data.id),
      passportClass: data.passport_class,
      applicationStatus: data.application_status,
      passportGrade: data.passport_grade,
      submittedAt: data.submitted_at,
      decidedAt: data.decided_at,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Status lookup failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
