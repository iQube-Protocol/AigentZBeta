/**
 * GET /api/journey/commercial-spine — the active persona's position along the
 * metaMe commercial spine (Passport -> aigentMe Delegation -> Standing ->
 * Founder Office -> Venture Lab -> verticals) + the next best step.
 *
 * Backbone for journey-stitching CTAs, golden-path NBEs, and the matrix funnel.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getCommercialSpineState } from '@/services/journey/commercialSpine';

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
  const state = await getCommercialSpineState(admin, persona.personaId);
  return NextResponse.json({ ok: true, ...state });
}
