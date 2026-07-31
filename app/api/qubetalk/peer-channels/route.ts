/**
 * /api/qubetalk/peer-channels — QubeTalk Peer Exchange, Phase 1.
 *
 * GET  — list the caller's peer channels (+ the caller's own Polity Public
 *        Reference, the handle a counterparty needs to open a channel back).
 * POST — create (or return the existing) peer channel with a counterparty
 *        principal, identified by their Polity Public Reference.
 *        Body: { counterpartyRef }.
 *
 * Auth: spine (`getActivePersona`). Channels are keyed by principal PUBLIC
 * references (T2-safe); the caller's raw personaId is used only to derive their
 * ref server-side and never leaves.
 *
 * Distinct from /api/qubetalk/channels (tenant/agent runtime) and
 * /api/qubetalk/passport-channels (holder<->delegate) — this is principal<->principal.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { createOrGetChannel, listChannelsForCaller, callerPublicRef } from '@/services/qubetalk/peerChannel';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE });

  const res = await listChannelsForCaller(persona.personaId);
  if (!res.ok) {
    const status = res.code === 'migration_pending' ? 503 : 500;
    return NextResponse.json({ error: res.error, code: res.code }, { status, headers: NO_STORE });
  }
  return NextResponse.json(
    { ok: true, myRef: callerPublicRef(persona.personaId), channels: res.value },
    { headers: NO_STORE },
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE });

  const body = (await req.json().catch(() => ({}))) as { counterpartyRef?: string };
  const counterpartyRef = typeof body.counterpartyRef === 'string' ? body.counterpartyRef.trim() : '';
  if (!counterpartyRef) {
    return NextResponse.json({ error: 'counterpartyRef is required' }, { status: 400, headers: NO_STORE });
  }

  const res = await createOrGetChannel(persona.personaId, counterpartyRef);
  if (!res.ok) {
    const status =
      res.code === 'migration_pending' ? 503 : res.code === 'bad_ref' || res.code === 'self_channel' ? 400 : 500;
    return NextResponse.json({ error: res.error, code: res.code }, { status, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true, channel: res.value }, { headers: NO_STORE });
}
