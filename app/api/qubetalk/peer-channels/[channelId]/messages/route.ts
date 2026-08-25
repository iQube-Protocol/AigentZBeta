/**
 * /api/qubetalk/peer-channels/[channelId]/messages — QubeTalk Peer Exchange.
 *
 * GET  — list messages for a channel the caller is a principal of (oldest first).
 * POST — the ONE canonical send path for a QubeTalk message, native or
 *        external. Routes through `services/qubetalk/egress.ts`'s
 *        `sendMessageThroughTransport` — never `postMessage` directly —
 *        so every send (regardless of transport) gets the same ownership
 *        check, Agent-authority gate, conversation resolution, and honest
 *        delivery-state recording. `transport` defaults to
 *        `'qubetalk-native'` when omitted, so every existing caller of this
 *        route (the compose box already shipped in QubeTalkInboxTab)
 *        continues to work byte-for-byte unchanged.
 *
 * Body: { type?, body, transport?, destination?: { contactEndpointId? |
 *         discordChannelId? }, actingAgentRootDid? }.
 * Auth: spine (`getActivePersona`). Every downstream check (channel
 * membership, ContactGraph endpoint ownership, Agent-policy grant) is
 * re-verified against the spine-resolved caller — never trusted from the
 * request body.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { listMessages } from '@/services/qubetalk/peerChannel';
import { sendMessageThroughTransport } from '@/services/qubetalk/egress';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function statusFor(code: string | undefined): number {
  switch (code) {
    case 'not_found':
    case 'unknown_transport':
      return 404;
    case 'revoked':
      return 409;
    case 'bad_type':
    case 'empty':
    case 'missing_destination':
    case 'endpoint_platform_mismatch':
    case 'endpoint_unresolvable':
      return 400;
    case 'agent_not_authorized':
    case 'disclosure_denied':
      return 403;
    case 'transport_unsupported':
    case 'transport_not_wired':
      return 422;
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

  const body = (await req.json().catch(() => ({}))) as {
    type?: string;
    body?: string;
    transport?: string;
    destination?: { contactEndpointId?: string; discordChannelId?: string };
    actingAgentRootDid?: string;
  };
  const text = typeof body.body === 'string' ? body.body : '';
  if (!text.trim()) return NextResponse.json({ error: 'body is required' }, { status: 400, headers: NO_STORE });

  const result = await sendMessageThroughTransport({
    callerPersonaId: persona.personaId,
    channelId,
    transport: typeof body.transport === 'string' && body.transport ? body.transport : 'qubetalk-native',
    type: body.type,
    body: text,
    destination: body.destination,
    actingAgentRootDid: typeof body.actingAgentRootDid === 'string' ? body.actingAgentRootDid : null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: statusFor(result.code), headers: NO_STORE });
  return NextResponse.json({ ok: true, message: result.value }, { headers: NO_STORE });
}
