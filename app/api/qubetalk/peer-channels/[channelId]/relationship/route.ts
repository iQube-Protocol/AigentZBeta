/**
 * GET /api/qubetalk/peer-channels/[channelId]/relationship — QubeTalk
 * Communications Membrane, RelationshipQube read (§4).
 *
 * Membership is verified the SAME way every other peer-channel route does —
 * by reusing services/qubetalk/peerChannel.ts's own `listChannelsForCaller`
 * (its private `loadOwnedChannel` membership check is not exported, so this
 * route checks membership via the one already-exported list function rather
 * than re-implementing the principal-ref comparison a second time).
 *
 * Auth: spine (getActivePersona). Deny-all RLS on qubetalk_relationship_state
 * — this route (service-role) is the only reader.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { listChannelsForCaller } from '@/services/qubetalk/peerChannel';
import { getOrCreateRelationshipState } from '@/services/qubetalk/relationships';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401, headers: NO_STORE });
  const { channelId } = await params;

  const channels = await listChannelsForCaller(persona.personaId);
  if (!channels.ok) return NextResponse.json({ ok: false, error: channels.error }, { status: 500, headers: NO_STORE });
  if (!channels.value.some((c) => c.id === channelId)) {
    return NextResponse.json({ ok: false, error: 'channel not found' }, { status: 404, headers: NO_STORE });
  }

  const state = await getOrCreateRelationshipState({ kind: 'peer-channel', channelId });
  if (!state.ok) {
    const status = state.code === 'not_found' ? 404 : 500;
    return NextResponse.json({ ok: false, error: state.error }, { status, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true, relationship: state.value }, { headers: NO_STORE });
}
