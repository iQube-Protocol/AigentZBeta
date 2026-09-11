/**
 * POST /api/contactgraph/personas/[contactPersonaId]/endpoints — add a
 * CommunicationEndpoint under a ContactPersona (§12: "add a handle"). A
 * manually-added handle defaults to `confidence:'user_confirmed'` — the
 * operator typing it in IS the confirmation, unlike an observed/imported
 * endpoint which starts 'unresolved'/'high_confidence' respectively
 * (services/contactGraph/contactEndpoints.ts / reconciliation.ts).
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveOwnerAuthProfileId } from '@/services/contactGraph/ownerResolution';
import { addContactEndpoint } from '@/services/contactGraph/contactEndpoints';
import { CONTACT_ENDPOINT_PLATFORMS, type ContactEndpointPlatform } from '@/types/contactGraph';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function isPlatform(value: unknown): value is ContactEndpointPlatform {
  return typeof value === 'string' && (CONTACT_ENDPOINT_PLATFORMS as readonly string[]).includes(value);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contactPersonaId: string }> },
): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401, headers: NO_STORE });
  const { contactPersonaId } = await params;

  const body = await req.json().catch(() => null);
  if (!isPlatform(body?.platform)) {
    return NextResponse.json({ ok: false, error: 'invalid platform' }, { status: 400, headers: NO_STORE });
  }
  const identifier = typeof body?.identifier === 'string' ? body.identifier.trim() : '';
  if (!identifier) return NextResponse.json({ ok: false, error: 'identifier is required' }, { status: 400, headers: NO_STORE });

  const owner = await resolveOwnerAuthProfileId(persona.personaId);
  if (!owner.ok) return NextResponse.json({ ok: false, error: owner.error }, { status: 500, headers: NO_STORE });

  const created = await addContactEndpoint(owner.value, contactPersonaId, {
    platform: body.platform,
    identifier,
    confidence: 'user_confirmed',
    source: 'manual',
  });
  if (!created.ok) {
    const status = created.code === 'not_found' ? 404 : 500;
    return NextResponse.json({ ok: false, error: created.error }, { status, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true, endpoint: created.value }, { headers: NO_STORE });
}
