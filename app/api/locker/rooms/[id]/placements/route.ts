/**
 * POST   /api/locker/rooms/[id]/placements — add an asset to a RoomQube.
 * DELETE /api/locker/rooms/[id]/placements?placementId=... — remove a
 *   placement (never deletes the underlying asset — spec §4.3).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { addAssetToRoomQube, removeRoomQubePlacement } from '@/services/locker/roomQube';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const { id } = await ctx.params;

  let body: { assetId?: unknown; labelOverride?: unknown; section?: unknown; order?: unknown; versionPolicy?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  if (typeof body.assetId !== 'string' || !body.assetId) return NextResponse.json({ error: 'assetId required' }, { status: 400 });

  const result = await addAssetToRoomQube({
    roomQubeId: id,
    assetId: body.assetId,
    callerPersonaId: context.personaId,
    labelOverride: typeof body.labelOverride === 'string' ? body.labelOverride : undefined,
    section: typeof body.section === 'string' ? body.section : undefined,
    order: typeof body.order === 'number' ? body.order : undefined,
    versionPolicy: body.versionPolicy as never,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code === 'not_found' ? 404 : result.code === 'forbidden' ? 403 : 400 });
  return NextResponse.json({ placement: result.value });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const placementId = new URL(request.url).searchParams.get('placementId');
  if (!placementId) return NextResponse.json({ error: 'placementId query param required' }, { status: 400 });

  const result = await removeRoomQubePlacement(placementId, context.personaId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code === 'not_found' ? 404 : 403 });
  return NextResponse.json({ removed: true });
}
