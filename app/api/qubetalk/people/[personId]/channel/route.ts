/**
 * POST /api/qubetalk/people/[personId]/channel — "Message" from the People
 * view (QubeTalk Fast-Follow: closing the messaging loop). Resolves-or-
 * creates the RelationshipQube (`passport_peer_channels`) for a
 * ContactGraph person, so the People tab's "Message" action can hand the
 * operator straight into the Conversations tab already on the right
 * channel.
 *
 * SCOPE BOUNDARY (documented honestly, not silently papered over):
 * `passport_peer_channels` is personhood-bound by construction — both
 * principals are identified by a real Polity Public Reference
 * (peerChannel.ts's own header). This route therefore only works for a
 * ContactPerson already linked to a real platform persona
 * (`linkedPersonhoodRef` set — e.g. via ContactGraph's own confirmation
 * flow, or a prior QubeTalk-side resolution). A purely off-platform
 * ContactGraph contact (no platform persona at all) has no RelationshipQube
 * to create yet — that is a genuine, separate architectural question
 * (extending the relationship model to cover off-platform contacts),
 * raised to the operator as a candidate architectural refinement rather
 * than solved unilaterally here, per this increment's explicit "do not
 * start another architecture pass" instruction. This route returns a clear,
 * honest 409 in that case — never a silently-wrong channel.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveOwnerAuthProfileId } from '@/services/contactGraph/ownerResolution';
import { getContactPerson } from '@/services/contactGraph/contactPersons';
import { createOrGetChannel } from '@/services/qubetalk/peerChannel';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function POST(
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

  if (!person.value.linkedPersonhoodRef) {
    return NextResponse.json(
      {
        ok: false,
        error: 'This contact is not linked to a platform persona yet, so QubeTalk cannot open a relationship for them.',
        code: 'not_linked_to_platform_persona',
      },
      { status: 409, headers: NO_STORE },
    );
  }

  const channel = await createOrGetChannel(persona.personaId, person.value.linkedPersonhoodRef);
  if (!channel.ok) return NextResponse.json({ ok: false, error: channel.error, code: channel.code }, { status: 500, headers: NO_STORE });
  return NextResponse.json({ ok: true, channel: channel.value }, { headers: NO_STORE });
}
