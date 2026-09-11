/**
 * POST /api/qubetalk/peer-channels/[channelId]/artifacts/[artifactId]/open
 * — QubeTalk Peer Exchange, Phase 1 (3).
 *
 * Mark a shared artifact as OPENED by the recipient. Idempotent; stamps
 * `opened_at` once and writes a consequential `qubetalk_artifact_opened`
 * receipt (DVN-anchorable, T2-safe payload) on the first open. The sharer
 * opening their own share is a no-op.
 *
 * Auth: spine (`getActivePersona`). Membership enforced by the service.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { markArtifactOpened } from '@/services/qubetalk/peerChannel';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function statusFor(code: string | undefined): number {
  switch (code) {
    case 'not_found':
      return 404;
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

  const res = await markArtifactOpened(persona.personaId, channelId, artifactId);
  if (!res.ok) return NextResponse.json({ error: res.error, code: res.code }, { status: statusFor(res.code), headers: NO_STORE });
  return NextResponse.json({ ok: true, artifact: res.value }, { headers: NO_STORE });
}
