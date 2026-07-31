/**
 * POST /api/venture/qubes/[ventureId]/autopopulate — re-pull the operator's
 * Standing and re-run the Standing-calibrated metaCommons evaluation, folding
 * verified capability facts + confidence scores back into the VentureQube.
 *
 * This is the "Standing → VentureQube auto-population" bridge.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { autopopulateVentureQube } from '@/services/venture/ventureQubeService';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ventureId: string }> },
) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const { ventureId } = await params;
  const result = await autopopulateVentureQube(persona.personaId, ventureId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, venture: result.record });
}
