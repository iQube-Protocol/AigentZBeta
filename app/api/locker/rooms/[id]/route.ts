/**
 * GET   /api/locker/rooms/[id] — resolve a RoomQube: room + placements + members.
 * PATCH /api/locker/rooms/[id] — { action: 'archive' }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveRoomQube, archiveRoomQube } from '@/services/locker/roomQube';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const { id } = await ctx.params;
  const result = await resolveRoomQube(id, context.personaId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code === 'not_found' ? 404 : 403 });
  return NextResponse.json(result.value, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const { id } = await ctx.params;

  let body: { action?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  if (body.action !== 'archive') return NextResponse.json({ error: "only { action: 'archive' } is supported" }, { status: 400 });

  const result = await archiveRoomQube(id, context.personaId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code === 'not_found' ? 404 : 403 });
  return NextResponse.json({ archived: true });
}
