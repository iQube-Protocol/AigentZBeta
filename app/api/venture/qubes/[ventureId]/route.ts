/**
 * /api/venture/qubes/[ventureId] — read + update a single VentureQube.
 *
 * GET   → the VentureQube record (ownership-checked).
 * PATCH → merge a partial layered patch + re-calibrate. Body:
 *         { layers?: Partial<VentureQubeV1>, stage?, path? }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  getVentureQube,
  updateVentureQube,
} from '@/services/venture/ventureQubeService';
import type { VentureQubeV1, VentureStage, FounderPath } from '@/types/ventureQube';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ventureId: string }> },
) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const { ventureId } = await params;
  const record = await getVentureQube(persona.personaId, ventureId);
  if (!record) {
    return NextResponse.json({ ok: false, error: 'Venture not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, venture: record });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ventureId: string }> },
) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const { ventureId } = await params;
  let body: {
    layers?: Partial<VentureQubeV1>;
    stage?: VentureStage;
    path?: FounderPath;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body */
  }
  const result = await updateVentureQube(persona.personaId, ventureId, body.layers ?? {}, {
    stage: body.stage,
    path: body.path,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, venture: result.record });
}
