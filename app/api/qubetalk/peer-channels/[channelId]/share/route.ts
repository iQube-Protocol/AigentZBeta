/**
 * POST /api/qubetalk/peer-channels/[channelId]/share — QubeTalk Peer Exchange, Phase 1 (2a).
 *
 * Share an artifact REFERENCE (+ rights envelope) into a peer channel. Not a
 * byte copy; the counterparty can view it and (later increment) materialise it
 * into their locker if `rights.copyToLocker` is granted.
 *
 * Body: { artifactType, artifactId, title?, locationRef?, relationship?, rights? }.
 * Auth: spine; membership enforced by the service.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { shareArtifact } from '@/services/qubetalk/peerChannel';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function statusFor(code: string | undefined): number {
  switch (code) {
    case 'not_found':
      return 404;
    case 'revoked':
      return 409;
    case 'bad_artifact':
    case 'bad_relationship':
      return 400;
    case 'migration_pending':
      return 503;
    default:
      return 500;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE });
  const { channelId } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    artifactType?: string;
    artifactId?: string;
    title?: string;
    locationRef?: string | null;
    relationship?: string;
    rights?: unknown;
  };
  if (!body.artifactType || !body.artifactId) {
    return NextResponse.json({ error: 'artifactType and artifactId are required' }, { status: 400, headers: NO_STORE });
  }

  const res = await shareArtifact(persona.personaId, channelId, {
    artifactType: body.artifactType,
    artifactId: body.artifactId,
    title: body.title,
    locationRef: body.locationRef,
    relationship: body.relationship,
    rights: body.rights,
  });
  if (!res.ok) return NextResponse.json({ error: res.error, code: res.code }, { status: statusFor(res.code), headers: NO_STORE });
  return NextResponse.json({ ok: true, artifact: res.value }, { headers: NO_STORE });
}
