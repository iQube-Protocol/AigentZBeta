/**
 * PATCH /api/qubetalk/peer-channels/[channelId] — QubeTalk Peer Exchange.
 *
 * Set (or clear) the caller's OWN private nickname for a channel, so they can
 * distinguish counterparties by name instead of by 16-hex reference. Per-side +
 * local: never visible to the counterparty, never in receipts/DVN/chain.
 *
 * Body: { label }.  Auth: spine; membership enforced by the service.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { setChannelLabel } from '@/services/qubetalk/peerChannel';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE });
  const { channelId } = await params;

  const body = (await req.json().catch(() => ({}))) as { label?: string };
  const label = typeof body.label === 'string' ? body.label : '';

  const res = await setChannelLabel(persona.personaId, channelId, label);
  if (!res.ok) {
    const status = res.code === 'not_found' ? 404 : res.code === 'migration_pending' ? 503 : 500;
    return NextResponse.json({ error: res.error, code: res.code }, { status, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true, channel: res.value }, { headers: NO_STORE });
}
