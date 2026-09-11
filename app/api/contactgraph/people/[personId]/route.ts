/**
 * GET /api/contactgraph/people/[personId] — full ContactPerson detail for
 * aigentMe's Person view (§12): personas, every endpoint under them, and
 * which of the owner's own QubeTalk participants are already linked (a
 * thin cross-reference — actual relationship/conversation content still
 * flows through QubeTalk's own routes, never duplicated here).
 *
 * Unlike GET /people (the bounded projection, summaries only), this route
 * returns FULL contact data including raw endpoint identifiers — that is
 * correct here because the caller is asking to open ONE person they
 * already own, the same "drill into a bounded item you were already
 * granted" pattern QubeTalk's own channel-detail routes use.
 *
 * Auth: spine (getActivePersona); every read below is ownership-checked by
 * its own service function.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveOwnerAuthProfileId } from '@/services/contactGraph/ownerResolution';
import { getContactPerson } from '@/services/contactGraph/contactPersons';
import { listContactPersonas } from '@/services/contactGraph/contactPersonas';
import { listContactEndpoints } from '@/services/contactGraph/contactEndpoints';
import { listParticipantsLinkedToContactPerson } from '@/services/contactGraph/qubetalkBridge';
import type { ContactEndpoint, ContactPersona } from '@/types/contactGraph';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ personId: string }> },
): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401, headers: NO_STORE });
  const { personId } = await params;

  const owner = await resolveOwnerAuthProfileId(persona.personaId);
  if (!owner.ok) return NextResponse.json({ ok: false, error: owner.error }, { status: 500, headers: NO_STORE });

  const person = await getContactPerson(owner.value, personId);
  if (!person.ok) {
    const status = person.code === 'not_found' ? 404 : 500;
    return NextResponse.json({ ok: false, error: person.error }, { status, headers: NO_STORE });
  }

  const personas = await listContactPersonas(owner.value, personId);
  if (!personas.ok) return NextResponse.json({ ok: false, error: personas.error }, { status: 500, headers: NO_STORE });

  const personasWithEndpoints: Array<ContactPersona & { endpoints: ContactEndpoint[] }> = [];
  for (const p of personas.value) {
    const endpoints = await listContactEndpoints(owner.value, p.id);
    personasWithEndpoints.push({ ...p, endpoints: endpoints.ok ? endpoints.value : [] });
  }

  const linkedParticipants = await listParticipantsLinkedToContactPerson(persona.personaId, personId);

  return NextResponse.json(
    {
      ok: true,
      person: person.value,
      personas: personasWithEndpoints,
      linkedQubeTalkParticipants: linkedParticipants.ok ? linkedParticipants.value : [],
    },
    { headers: NO_STORE },
  );
}
