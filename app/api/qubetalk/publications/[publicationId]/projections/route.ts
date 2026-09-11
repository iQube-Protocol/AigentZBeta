/**
 * POST /api/qubetalk/publications/[publicationId]/projections
 *
 * Register (or update) a per-channel projection for an owned publication.
 * Body: { channel, destinationRef? } — destinationRef is the caller's
 * publish intent (e.g. a Discord channel id/invite); left null for a
 * channel that needs no separate destination.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getOwnedPublication, addChannelProjection } from '@/services/qubetalk/publications';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function POST(req: NextRequest, ctx: { params: Promise<{ publicationId: string }> }): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE });

  const { publicationId } = await ctx.params;
  const owned = await getOwnedPublication(persona.personaId, publicationId);
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.code === 'not_found' ? 404 : 500, headers: NO_STORE });

  const body = (await req.json().catch(() => ({}))) as { channel?: string; destinationRef?: string };
  const channel = typeof body.channel === 'string' ? body.channel.trim() : '';
  if (!channel) return NextResponse.json({ error: 'channel is required' }, { status: 400, headers: NO_STORE });

  const result = await addChannelProjection(publicationId, channel, {
    destinationRef: typeof body.destinationRef === 'string' ? body.destinationRef.trim() : null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500, headers: NO_STORE });

  return NextResponse.json({ ok: true, projection: result.value }, { headers: NO_STORE });
}
