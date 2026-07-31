/**
 * /api/qubetalk/peer-channels/[channelId]/messages — QubeTalk Peer Exchange, Phase 1.
 *
 * GET  — list messages for a channel the caller is a principal of (oldest first).
 * POST — post a typed human message. Body: { type?, body }.
 *
 * Auth: spine (`getActivePersona`). The service enforces principal membership
 * (a caller may only read/post to a channel whose principal set contains their
 * own derived public reference).
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { listMessages, postMessage } from '@/services/qubetalk/peerChannel';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function statusFor(code: string | undefined): number {
  switch (code) {
    case 'not_found':
      return 404;
    case 'revoked':
      return 409;
    case 'bad_type':
    case 'empty':
      return 400;
    case 'migration_pending':
      return 503;
    default:
      return 500;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE });
  const { channelId } = await params;

  const res = await listMessages(persona.personaId, channelId);
  if (!res.ok) return NextResponse.json({ error: res.error, code: res.code }, { status: statusFor(res.code), headers: NO_STORE });
  return NextResponse.json({ ok: true, messages: res.value }, { headers: NO_STORE });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE });
  const { channelId } = await params;

  const body = (await req.json().catch(() => ({}))) as { type?: string; body?: string };
  const text = typeof body.body === 'string' ? body.body : '';
  if (!text.trim()) return NextResponse.json({ error: 'body is required' }, { status: 400, headers: NO_STORE });

  const res = await postMessage(persona.personaId, channelId, { type: body.type, body: text });
  if (!res.ok) return NextResponse.json({ error: res.error, code: res.code }, { status: statusFor(res.code), headers: NO_STORE });
  return NextResponse.json({ ok: true, message: res.value }, { headers: NO_STORE });
}
