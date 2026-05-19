/**
 * GET  /api/mycanvas/entries/[id]/invite — list invites for an entry (owner only)
 * POST /api/mycanvas/entries/[id]/invite — invite a persona to this entry
 *
 * Cross-persona invite resolution is stubbed — the body just carries a
 * raw `invitedPersonaId` string. A real invite-acceptance flow lands later.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { inviteToEntry, listInvites } from '@/services/mycanvas/canvasService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  ctx: { params: { id: string } },
): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const invites = await listInvites(context.personaId, ctx.params.id);
  return NextResponse.json({ invites }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(
  request: NextRequest,
  ctx: { params: { id: string } },
): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  let body: { invitedPersonaId?: unknown; role?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const invitedPersonaId = typeof body.invitedPersonaId === 'string' ? body.invitedPersonaId.trim() : '';
  if (!invitedPersonaId) {
    return NextResponse.json({ error: 'invitedPersonaId-required' }, { status: 400 });
  }
  const role = body.role === 'commenter' ? 'commenter' : 'viewer';
  const invite = await inviteToEntry(context.personaId, ctx.params.id, invitedPersonaId, role);
  if (!invite) return NextResponse.json({ error: 'not-found-or-forbidden' }, { status: 404 });
  return NextResponse.json({ invite }, { headers: { 'Cache-Control': 'no-store' } });
}
