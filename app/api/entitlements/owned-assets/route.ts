/**
 * GET /api/entitlements/owned-assets?personaId=xxx&series=metaKnyts
 *
 * Enumerates every asset_id the persona owns — directly granted plus all SKU-
 * expanded assets. Used by the client `useOwnedAssets` hook to populate per-
 * card lock state across surfaces (Scrolls, Characters, GN reader, Terra,
 * Digiterra, Community) without N+1 ownership checks.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOwnedAssetIds } from '@/services/rewards/assetOwnership';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const personaId = searchParams.get('personaId');
  const series = searchParams.get('series') || 'metaKnyts';

  if (!personaId) {
    return NextResponse.json({ error: 'personaId required' }, { status: 400 });
  }

  try {
    const result = await getOwnedAssetIds(personaId, series);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[owned-assets]', e);
    return NextResponse.json({ direct: [], expanded: [], ownedSkus: [] }, { status: 500 });
  }
}
