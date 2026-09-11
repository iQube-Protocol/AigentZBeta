/**
 * GET /api/qubetalk/peer-channels/[channelId]/artifacts — QubeTalk Peer Exchange, Phase 1 (2a).
 *
 * List the artifacts shared into a peer channel the caller is a principal of
 * (newest first), each with its rights envelope. Auth: spine; membership
 * enforced by the service.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { listSharedArtifacts } from '@/services/qubetalk/peerChannel';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE });
  const { channelId } = await params;

  const res = await listSharedArtifacts(persona.personaId, channelId);
  if (!res.ok) {
    const status = res.code === 'not_found' ? 404 : res.code === 'migration_pending' ? 503 : 500;
    return NextResponse.json({ error: res.error, code: res.code }, { status, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true, artifacts: res.value }, { headers: NO_STORE });
}
