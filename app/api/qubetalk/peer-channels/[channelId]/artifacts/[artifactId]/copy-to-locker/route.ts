/**
 * POST /api/qubetalk/peer-channels/[channelId]/artifacts/[artifactId]/copy-to-locker
 * — QubeTalk Peer Exchange, Phase 1 (2b).
 *
 * Materialise a shared artifact into the RECIPIENT's own locker. This is a
 * recipient-pull action: only the counterparty (never the sharer) may copy, and
 * only when the sharer granted `rights.copyToLocker`. What lands in the locker is
 * a provenance manifest of the accepted share, not the artifact bytes.
 *
 * Auth: spine (`getActivePersona`). Membership + rights enforced by the service.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { copyToLocker } from '@/services/qubetalk/peerChannel';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function statusFor(code: string | undefined): number {
  switch (code) {
    case 'not_found':
      return 404;
    case 'forbidden':
    case 'not_granted':
      return 403;
    case 'migration_pending':
      return 503;
    default:
      return 500;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string; artifactId: string }> },
): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE });
  const { channelId, artifactId } = await params;

  const res = await copyToLocker(persona.personaId, channelId, artifactId);
  if (!res.ok) return NextResponse.json({ error: res.error, code: res.code }, { status: statusFor(res.code), headers: NO_STORE });
  return NextResponse.json({ ok: true, ...res.value }, { headers: NO_STORE });
}
