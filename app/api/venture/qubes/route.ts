/**
 * /api/venture/qubes — list + create VentureQubes for the active persona.
 *
 * GET  → the persona's active VentureQubes (T1-safe records).
 * POST → create a VentureQube via one of the Founder Office paths
 *        (discover | validate | architect). Body: { name, slug?, path?, stage?, seed? }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  createVentureQube,
  listVentureQubes,
  type CreateVentureInput,
} from '@/services/venture/ventureQubeService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const records = await listVentureQubes(persona.personaId);
  return NextResponse.json({ ok: true, ventures: records });
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  let body: Partial<CreateVentureInput> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body */
  }
  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json({ ok: false, error: 'name is required' }, { status: 400 });
  }
  const result = await createVentureQube({
    personaId: persona.personaId,
    name: body.name,
    slug: body.slug,
    path: body.path,
    stage: body.stage,
    seed: body.seed,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, venture: result.record });
}
