/**
 * POST /api/qubetalk/people/[personId]/channel — "Message" from the People
 * view (QubeTalk Fast-Follow: closing the messaging loop). Resolves-or-
 * creates a relationship anchor for a ContactGraph person, so the People
 * tab's "Message" action can hand the operator straight into a relationship
 * already open with that contact.
 *
 * TWO possible anchor kinds (P0.5, operator-ruled architecture):
 *   - `platform_peer_channel` — the ContactPerson is already linked to a
 *     real platform persona (`linkedPersonhoodRef` set). This resolves-or-
 *     creates the EXISTING `passport_peer_channels` row via
 *     `createOrGetChannel` (unchanged from before this increment).
 *   - `offplatform_contact` — the ContactPerson has NO linked platform
 *     persona. `passport_peer_channels` is personhood-bound by construction
 *     (both principals are identified by a real Polity Public Reference) and
 *     structurally cannot represent this case, so this resolves-or-creates
 *     the sibling `qubetalk_offplatform_relationships` row instead
 *     (services/qubetalk/offplatformRelationships.ts) — never a synthetic
 *     Polity Public Reference invented for an off-platform contact.
 *
 * The response's `channel.kind` field tells the caller honestly which
 * anchor it got — a consumer that only knows how to render a
 * `platform_peer_channel` (e.g. QubeTalkInboxTab, which reads/writes
 * `passport_peer_channels` rows via `/api/qubetalk/peer-channels/*`) MUST
 * check this before assuming the returned id is a valid peer-channel id.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveOwnerAuthProfileId } from '@/services/contactGraph/ownerResolution';
import { getContactPerson } from '@/services/contactGraph/contactPersons';
import { createOrGetChannel } from '@/services/qubetalk/peerChannel';
import { resolveOrCreateOffplatformRelationship } from '@/services/qubetalk/offplatformRelationships';

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
    const offplatform = await resolveOrCreateOffplatformRelationship(owner.value, person.value.id);
    if (!offplatform.ok) return NextResponse.json({ ok: false, error: offplatform.error, code: offplatform.code }, { status: 500, headers: NO_STORE });
    return NextResponse.json(
      { ok: true, channel: { kind: 'offplatform_contact' as const, ...offplatform.value } },
      { headers: NO_STORE },
    );
  }

  const channel = await createOrGetChannel(persona.personaId, person.value.linkedPersonhoodRef);
  if (!channel.ok) return NextResponse.json({ ok: false, error: channel.error, code: channel.code }, { status: 500, headers: NO_STORE });
  return NextResponse.json(
    { ok: true, channel: { kind: 'platform_peer_channel' as const, ...channel.value } },
    { headers: NO_STORE },
  );
}
