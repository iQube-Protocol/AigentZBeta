/**
 * /api/qubetalk/offplatform-relationships/[relationshipId]/messages —
 * QubeTalk P0.5 widening: the actual off-platform MessageQube send/read
 * path (the "People -> Message" workflow's real completion for a
 * ContactGraph contact with no linked platform persona).
 *
 * GET  — list messages for an off-platform relationship the caller owns
 *        (oldest first).
 * POST — send a message. Gated by transport-honesty
 *        (services/qubetalk/offplatformRelationships.ts's
 *        resolveReachableOffplatformTransport, applied inside
 *        postOffplatformMessage): a contact with no reachable endpoint
 *        refuses with `no_reachable_transport` rather than silently
 *        succeeding or silently failing. Mirrors
 *        /api/qubetalk/peer-channels/[channelId]/messages/route.ts's shape
 *        exactly — same auth, same error-code-to-status mapping discipline.
 *
 * Auth: spine (getActivePersona). Ownership is re-verified server-side on
 * every call via services/qubetalk/offplatformRelationships.ts's own
 * owner-scoped resolution — never trusted from the request body/URL alone.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { listOffplatformMessages, postOffplatformMessage } from '@/services/qubetalk/offplatformRelationships';

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
    case 'owner_required':
      return 400;
    case 'no_reachable_transport':
      return 409;
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
  { params }: { params: Promise<{ relationshipId: string }> },
): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE });
  const { relationshipId } = await params;

  const res = await listOffplatformMessages(persona.personaId, relationshipId);
  if (!res.ok) return NextResponse.json({ error: res.error, code: res.code }, { status: statusFor(res.code), headers: NO_STORE });
  return NextResponse.json({ ok: true, messages: res.value }, { headers: NO_STORE });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ relationshipId: string }> },
): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE });
  const { relationshipId } = await params;

  const body = (await req.json().catch(() => ({}))) as { type?: string; body?: string };
  const text = typeof body.body === 'string' ? body.body : '';
  if (!text.trim()) return NextResponse.json({ error: 'body is required' }, { status: 400, headers: NO_STORE });

  const result = await postOffplatformMessage(persona.personaId, relationshipId, { type: body.type, body: text });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: statusFor(result.code), headers: NO_STORE });
  return NextResponse.json({ ok: true, message: result.value }, { headers: NO_STORE });
}
