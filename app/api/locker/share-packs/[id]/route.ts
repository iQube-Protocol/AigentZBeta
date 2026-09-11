/**
 * GET  /api/locker/share-packs/[id] — preview (spec §14.2: exact
 *   recipients, assets/versions, delivery modes, before anything sends).
 * POST /api/locker/share-packs/[id] — { action: 'approve' | 'send' | 'revoke' }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { previewSharePack, approveSharePack, sendSharePack, revokeSharePack } from '@/services/locker/sharePack';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const { id } = await ctx.params;
  const result = await previewSharePack(id, context.personaId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code === 'not_found' ? 404 : 403 });
  return NextResponse.json(result.value, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const { id } = await ctx.params;

  let body: { action?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  if (body.action === 'approve') {
    const result = await approveSharePack(id, context.personaId);
    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.code === 'not_found' ? 404 : result.code === 'forbidden' ? 403 : 400 });
    return NextResponse.json({ sharePack: result.value });
  }
  if (body.action === 'send') {
    const result = await sendSharePack(id, context.personaId);
    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.code === 'not_found' ? 404 : result.code === 'forbidden' ? 403 : 400 });
    return NextResponse.json({ sharePack: result.value });
  }
  if (body.action === 'revoke') {
    const result = await revokeSharePack(id, context.personaId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code === 'not_found' ? 404 : 403 });
    return NextResponse.json({ sharePack: result.value });
  }
  return NextResponse.json({ error: "action must be one of 'approve' | 'send' | 'revoke'" }, { status: 400 });
}
