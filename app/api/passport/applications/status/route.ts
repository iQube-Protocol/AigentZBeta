/**
 * GET /api/passport/applications/status — the caller's own applications.
 *
 * PRD §9 step 9 (applicant-facing status). Returns the active persona's
 * application rows with T1-safe fields only — no raw DIDs, no vault content
 * ids (the holder already has their own refs client-side; re-serving them
 * here would widen the exposure surface for no benefit).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
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
      .select(
        'id, passport_class, application_status, passport_grade, personhood_proof_type, submitted_at, decided_at, created_at',
      )
      .eq('persona_id', persona.personaId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      applications: (data ?? []).map((row) => ({
        applicationId: String(row.id),
        passportClass: row.passport_class,
        applicationStatus: row.application_status,
        passportGrade: row.passport_grade,
        personhoodProofType: row.personhood_proof_type,
        submittedAt: row.submitted_at,
        decidedAt: row.decided_at,
        createdAt: row.created_at,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Status lookup failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
