/**
 * GET /api/experience/matrix-calibration — the active persona's matrix position,
 * derived from their experience-guide setup (experience model + personalGuide)
 * and their VentureQube(s).
 *
 * This is the SHARED source-of-truth feed that aligns all three matrix surfaces
 * (aigentMe, metaMe Studio, Venture Lab) on the same persona position. T1-safe;
 * persona-scoped (resolved through the spine).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { deriveMatrixCalibration } from '@/services/strategy/experienceMatrixDeriver';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'database unavailable' }, { status: 503 });
  }
  const calibration = await deriveMatrixCalibration(admin, persona.personaId);
  return NextResponse.json({ ok: true, ...calibration });
}
