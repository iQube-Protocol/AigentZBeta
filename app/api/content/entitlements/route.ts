/**
 * GET /api/content/entitlements?personaId=xxx
 *
 * Returns the UNION of:
 *   1. content_entitlements rows (legacy SmartTriad content table)
 *   2. user_entitlements rows (where bundle purchases land)
 *   3. SKU-expanded asset ids (bundle owners virtually own every asset their
 *      bundle's category grants cover)
 *
 * Used by SmartTriadProvider to populate `ownedContentIds`, which every
 * surface consults via `actions.checkOwnership(assetId)`. Without the union
 * step here, bundle owners would look unowned across the cartridge tabs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSmartContentService } from '@/services/content';
import { getEntitlementService } from '@/services/rewards/entitlementService';
import { getOwnedAssetIds } from '@/services/rewards/assetOwnership';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getKnytPurchaseAssetIds(personaId: string): Promise<string[]> {
  const { data } = await supabase
    .from('knyt_purchases')
    .select('asset_id')
    .eq('persona_id', personaId)
    .eq('status', 'completed');
  return (data ?? []).map((r) => r.asset_id as string).filter(Boolean);
}

export async function GET(request: NextRequest) {
  try {
    const personaId = request.nextUrl.searchParams.get('personaId');

    if (!personaId) {
      return NextResponse.json(
        { success: false, error: 'Missing required query param: personaId' },
        { status: 400 }
      );
    }

    // FIO handle resolution — entitlements are stored by persona UUID.
    // If caller passes a handle (e.g. arkagent@knyt), resolve it first so
    // this endpoint matches /api/codex/owned behaviour.
    let resolvedPersonaId = personaId;
    if (personaId.includes('@')) {
      const { data: personaRow } = await supabase
        .from('personas')
        .select('id')
        .eq('fio_handle', personaId)
        .single();
      if (personaRow?.id) resolvedPersonaId = personaRow.id;
    }

    // Pull all four sources in parallel. knyt_purchases captures direct
    // character/asset buys via the KNYT cartridge purchase modal — without
    // this, codex character owned badges miss directly-purchased posters.
    const [legacy, userDirect, expanded, knytDirect] = await Promise.all([
      getSmartContentService().getEntitlementsByPersona(resolvedPersonaId).catch(() => []),
      getEntitlementService().getPersonaEntitlements(resolvedPersonaId).catch(() => []),
      getOwnedAssetIds(resolvedPersonaId, 'metaKnyts').catch(() => ({ direct: [], expanded: [], ownedSkus: [] })),
      getKnytPurchaseAssetIds(resolvedPersonaId).catch(() => [] as string[]),
    ]);

    // Union by content/asset id. Legacy rows pass through as-is; user_entitlements
    // and SKU expansion contribute synthetic rows shaped like { contentId, source }
    // so the existing client mapper (item.contentId || item.content_id) picks them up.
    const seen = new Set<string>();
    const merged: Array<Record<string, unknown>> = [];

    for (const ent of legacy) {
      const id = (ent as { contentId?: string; content_id?: string }).contentId
              ?? (ent as { contentId?: string; content_id?: string }).content_id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(ent as Record<string, unknown>);
    }

    for (const ent of userDirect) {
      const id = ent.assetId;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push({ contentId: id, source: 'user_entitlements_direct' });
    }

    for (const id of expanded.expanded) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push({ contentId: id, source: 'sku_expansion' });
    }

    for (const id of knytDirect) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push({ contentId: id, source: 'knyt_purchases' });
    }

    return NextResponse.json({
      success: true,
      data: merged,
      counts: {
        legacy: legacy.length,
        userDirect: userDirect.length,
        skuExpanded: expanded.expanded.length,
        knytDirect: knytDirect.length,
        union: merged.length,
      },
    });
  } catch (error: unknown) {
    console.error('Failed to get entitlements:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
