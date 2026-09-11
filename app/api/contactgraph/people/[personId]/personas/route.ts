/**
 * POST /api/contactgraph/people/[personId]/personas — add a new
 * ContactPersona (role/context) under an existing ContactPerson (§12: "add/
 * edit/remove a handle" starts with having a persona/context to file it
 * under). `linkedPlatformPersonaRef` is accepted but the caller must
 * already hold that reference (e.g. from an existing platform-persona
 * picker) — this route never infers or mints one (C3/NC6).
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveOwnerAuthProfileId } from '@/services/contactGraph/ownerResolution';
import { createContactPersona } from '@/services/contactGraph/contactPersonas';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ personId: string }> },
): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401, headers: NO_STORE });
  const { personId } = await params;

  const body = await req.json().catch(() => null);
  const label = typeof body?.label === 'string' ? body.label.trim() : '';
  if (!label) return NextResponse.json({ ok: false, error: 'label is required' }, { status: 400, headers: NO_STORE });
  const linkedPlatformPersonaRef = typeof body?.linkedPlatformPersonaRef === 'string' ? body.linkedPlatformPersonaRef : null;

  const owner = await resolveOwnerAuthProfileId(persona.personaId);
  if (!owner.ok) return NextResponse.json({ ok: false, error: owner.error }, { status: 500, headers: NO_STORE });

  const created = await createContactPersona(owner.value, personId, { label, linkedPlatformPersonaRef });
  if (!created.ok) {
    const status = created.code === 'not_found' ? 404 : 500;
    return NextResponse.json({ ok: false, error: created.error }, { status, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true, persona: created.value }, { headers: NO_STORE });
}
