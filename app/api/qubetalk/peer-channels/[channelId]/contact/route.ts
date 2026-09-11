/**
 * GET /api/qubetalk/peer-channels/[channelId]/contact — the ContactGraph
 * entry for a channel's counterparty (QubeTalk Fast-Follow: closing the
 * messaging loop). Powers the message composer's transport picker: "this
 * relationship's counterparty also has a Discord handle registered under
 * their Professional persona — offer it alongside native QubeTalk."
 *
 * Get-or-create, idempotent (services/qubetalk/contactResolution.ts) — the
 * first time a channel's composer is opened, the counterparty's ContactGraph
 * entry is created automatically (matching the operator's north-star: the
 * operator should not need to manually pre-register every relationship's
 * counterparty in ContactGraph before they can pick a transport for them).
 *
 * Auth: spine. Channel membership is verified via `listChannelsForCaller`
 * (the same check every other peer-channel route uses).
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { listChannelsForCaller } from '@/services/qubetalk/peerChannel';
import { resolveContactPersonForChannel } from '@/services/qubetalk/contactResolution';

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
  const channel = channels.value.find((c) => c.id === channelId);
  if (!channel) return NextResponse.json({ ok: false, error: 'channel not found' }, { status: 404, headers: NO_STORE });

  const resolved = await resolveContactPersonForChannel(
    persona.personaId,
    channel.counterpartyRef,
    channel.counterpartyLabel || channel.counterpartyRef,
  );
  if (!resolved.ok) return NextResponse.json({ ok: false, error: resolved.error }, { status: 500, headers: NO_STORE });
  return NextResponse.json({ ok: true, contact: resolved.value }, { headers: NO_STORE });
}
