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
import { getPassportApplicationStatus } from '@/services/passport/passportStatusRead';

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

    const applications = await getPassportApplicationStatus(admin, persona.personaId);
    return NextResponse.json({ ok: true, applications });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Status lookup failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
