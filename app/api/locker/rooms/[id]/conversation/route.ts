/**
 * POST /api/locker/rooms/[id]/conversation — open the RoomQube's QubeTalk
 * conversation context (spec §11.5, §16.4 openRoomConversation). Idempotent.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { openRoomConversation } from '@/services/locker/roomQube';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const { id } = await ctx.params;

  const result = await openRoomConversation(id, context.personaId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code === 'not_found' ? 404 : 403 });
  return NextResponse.json({ room: result.value });
}
