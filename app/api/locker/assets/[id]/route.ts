/**
 * GET   /api/locker/assets/[id] — fetch one asset (owner only) + renditions.
 * PATCH /api/locker/assets/[id] — update lifecycle/sharing/sensitivity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getAsset, listRenditions, updateAssetStatus } from '@/services/locker/assetRegistry';
import type { LifecycleStatus, SharingStatus, Sensitivity } from '@/types/locker';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const { id } = await ctx.params;

  const [asset, renditions] = await Promise.all([
    getAsset(id, context.personaId),
    listRenditions(id, context.personaId),
  ]);
  if (!asset.ok) return NextResponse.json({ error: asset.error }, { status: asset.code === 'not_found' ? 404 : 403 });
  return NextResponse.json({
    asset: asset.value,
    renditions: renditions.ok ? renditions.value : [],
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const { id } = await ctx.params;

  let body: { lifecycleStatus?: LifecycleStatus; sharingStatus?: SharingStatus; sensitivity?: Sensitivity | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const result = await updateAssetStatus(id, context.personaId, body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code === 'not_found' ? 404 : 403 });
  return NextResponse.json({ asset: result.value });
}
