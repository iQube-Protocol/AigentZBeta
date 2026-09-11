/**
 * GET  /api/locker/share-packs — list the caller's Share Packs.
 * POST /api/locker/share-packs — compose a Share Pack (spec §14.1).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { composeSharePack, listSharePacks } from '@/services/locker/sharePack';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const result = await listSharePacks(context.personaId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ sharePacks: result.value }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  let body: {
    title?: unknown; purpose?: unknown; recipientRefs?: unknown; sourceRoomQubeIds?: unknown;
    deliveryChannel?: unknown; messageDraft?: unknown; items?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  if (typeof body.title !== 'string' || !body.title.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 });
  if (!Array.isArray(body.recipientRefs) || body.recipientRefs.length === 0) {
    return NextResponse.json({ error: 'recipientRefs (array of emails) required' }, { status: 400 });
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'items (array of { assetId }) required' }, { status: 400 });
  }

  const result = await composeSharePack({
    ownerPersonaId: context.personaId,
    title: body.title,
    purpose: typeof body.purpose === 'string' ? body.purpose : undefined,
    recipientRefs: body.recipientRefs as string[],
    sourceRoomQubeIds: Array.isArray(body.sourceRoomQubeIds) ? (body.sourceRoomQubeIds as string[]) : undefined,
    deliveryChannel: body.deliveryChannel === 'qubetalk' || body.deliveryChannel === 'link' || body.deliveryChannel === 'other' ? body.deliveryChannel : 'email',
    messageDraft: typeof body.messageDraft === 'string' ? body.messageDraft : undefined,
    items: body.items as Array<{ assetId: string; deliveryMode?: 'link' | 'attachment' | 'embedded' }>,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ sharePack: result.value });
}
