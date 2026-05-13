/**
 * GET /api/entitlements/owned-assets?personaId=xxx&series=metaKnyts
 *
 * Enumerates every asset_id the persona owns — directly granted plus all SKU-
 * expanded assets. Used by the client `useOwnedAssets` hook to populate per-
 * card lock state across surfaces (Scrolls, Characters, GN reader, Terra,
 * Digiterra, Community) without N+1 ownership checks.
 *
 * FIO handle resolution: callers may pass a FIO handle (contains '@') instead
 * of a UUID. Mirrors the same resolution in /api/entitlements/list and
 * /api/codex/owned so all three routes behave consistently.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOwnedAssetIds } from '@/services/rewards/assetOwnership';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const personaId = searchParams.get('personaId');
  const series = searchParams.get('series') || 'metaKnyts';

  if (!personaId) {
    return NextResponse.json({ error: 'personaId required' }, { status: 400 });
  }

  // FIO handle resolution — entitlements are stored by persona UUID.
  // If the caller passes a FIO handle (contains '@'), resolve it to UUID first.
  let resolvedPersonaId = personaId;
  if (personaId.includes('@')) {
    const supabase = getSupabaseServer();
    if (supabase) {
      const { data: personaRow } = await supabase
        .from('personas')
        .select('id')
        .eq('fio_handle', personaId)
        .single();
      if (personaRow?.id) resolvedPersonaId = personaRow.id;
    }
  }

  try {
    const result = await getOwnedAssetIds(resolvedPersonaId, series);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[owned-assets]', e);
    return NextResponse.json({ direct: [], expanded: [], ownedSkus: [] }, { status: 500 });
  }
}
