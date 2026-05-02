/**
 * GET /api/entitlements/owns-asset?personaId=xxx&assetId=yyy
 *
 * Single-asset gate check. Returns { owned: boolean, via: 'direct'|'sku'|null }.
 * Use this for one-off "can the user click this read button?" decisions when
 * the per-asset cost is acceptable. For lists, prefer /owned-assets which
 * returns the full Set in one call.
 */

import { NextRequest, NextResponse } from 'next/server';
import { userOwnsAsset } from '@/services/rewards/assetOwnership';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const personaId = searchParams.get('personaId');
  const assetId = searchParams.get('assetId');

  if (!personaId || !assetId) {
    return NextResponse.json({ error: 'personaId and assetId required' }, { status: 400 });
  }

  try {
    const result = await userOwnsAsset(personaId, assetId);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[owns-asset]', e);
    return NextResponse.json({ owned: false, via: null }, { status: 500 });
  }
}
