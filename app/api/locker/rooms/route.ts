/**
 * GET  /api/locker/rooms — list the caller's RoomQubes.
 * POST /api/locker/rooms — create a RoomQube (any roomType — spec §11.1,
 *   one primitive for data-room/research-room/partner-room/etc).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { createRoomQube, listRoomQubes } from '@/services/locker/roomQube';
import type { RoomType } from '@/types/locker';

export const dynamic = 'force-dynamic';

const ROOM_TYPES = new Set<RoomType>([
  'data-room', 'research-room', 'project-room', 'partner-room',
  'board-room', 'briefing-room', 'cohort-room', 'custom',
]);

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const result = await listRoomQubes(context.personaId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ rooms: result.value }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  let body: { title?: unknown; purpose?: unknown; roomType?: unknown; ventureId?: unknown; intendedAudience?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const title = typeof body.title === 'string' ? body.title : '';
  const roomTypeRaw = typeof body.roomType === 'string' ? body.roomType : '';
  if (!title.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 });
  if (!ROOM_TYPES.has(roomTypeRaw as RoomType)) {
    return NextResponse.json({ error: `roomType must be one of: ${Array.from(ROOM_TYPES).join(', ')}` }, { status: 400 });
  }

  const result = await createRoomQube({
    ownerPersonaId: context.personaId,
    title,
    purpose: typeof body.purpose === 'string' ? body.purpose : undefined,
    roomType: roomTypeRaw as RoomType,
    ventureId: typeof body.ventureId === 'string' ? body.ventureId : undefined,
    intendedAudience: typeof body.intendedAudience === 'string' ? body.intendedAudience : undefined,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ room: result.value });
}
