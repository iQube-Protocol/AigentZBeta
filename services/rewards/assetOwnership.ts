/**
 * Asset Ownership Resolver
 *
 * Single source of truth for "does this persona own this asset?". Combines
 * direct entitlements (asset_id explicitly granted) with SKU-expanded grants
 * (persona owns a bundle SKU whose category flags cover the asset).
 *
 * Used by:
 *   /api/entitlements/owns-asset   — single-asset gate check
 *   /api/entitlements/owned-assets — full enumeration for a persona's library
 *
 * The category model lives in the store_skus table. To grant a new category
 * (e.g. lore) to an SKU, flip the boolean column — no code change needed.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEntitlementService } from './entitlementService';

interface StoreSku {
  sku_id: string;
  grants_episodes_still: boolean;
  grants_episodes_motion: boolean;
  grants_episodes_print: boolean;
  grants_character_cards: boolean;
  grants_gn: boolean;
  grants_lore: boolean;
  extra_asset_ids: string[] | null;
  series: string | null;
}

type AssetCategory =
  | 'episode_still'
  | 'episode_motion'
  | 'episode_print'
  | 'character_card'
  | 'gn'
  | 'lore'
  | 'other';

interface AssetMeta {
  category: AssetCategory;
  series: string;
  episodeNumber: number | null;
}

let cachedClient: SupabaseClient | null = null;
function supa(): SupabaseClient {
  if (cachedClient) return cachedClient;
  cachedClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  return cachedClient;
}

/**
 * Categorise an asset by its DB row. Episode 0 (DB convention) is the GN.
 * Anything else is mapped from content_type / asset_kind.
 */
async function getAssetMeta(assetId: string): Promise<AssetMeta | null> {
  // master_content_qubes uses TEXT id (e.g. mk_ep00_print_common)
  const { data: master } = await supa()
    .from('master_content_qubes')
    .select('id, content_type, episode_number, series')
    .eq('id', assetId)
    .maybeSingle();

  if (master) {
    const ep = master.episode_number as number | null;
    let category: AssetCategory = 'other';
    if (ep === 0) {
      category = 'gn';
    } else if (master.content_type === 'episode_still') {
      category = 'episode_still';
    } else if (master.content_type === 'episode_motion') {
      category = 'episode_motion';
    } else if (master.content_type === 'episode_print') {
      category = 'episode_print';
    }
    return { category, series: (master.series as string) || 'metaKnyts', episodeNumber: ep };
  }

  // codex_media_assets uses UUID id
  const { data: asset } = await supa()
    .from('codex_media_assets')
    .select('id, asset_kind, episode_number, series')
    .eq('id', assetId)
    .maybeSingle();

  if (asset) {
    const kind = asset.asset_kind as string;
    let category: AssetCategory = 'other';
    if (kind === 'character_poster') category = 'character_card';
    else if (kind === 'background_lore_doc' || kind === 'powers_sheet' || kind === 'twenty_one_sats_concept') category = 'lore';
    return {
      category,
      series: (asset.series as string) || 'metaKnyts',
      episodeNumber: (asset.episode_number as number | null) ?? null,
    };
  }

  // Bundle ids and other non-asset entitlements aren't gateable assets per se.
  return null;
}

async function getOwnedSkus(personaId: string): Promise<StoreSku[]> {
  const ents = await getEntitlementService().getPersonaEntitlements(personaId);
  const skuIds = Array.from(new Set(ents.map((e) => e.assetId).filter((s): s is string => !!s)));
  if (skuIds.length === 0) return [];

  const { data } = await supa()
    .from('store_skus')
    .select('*')
    .in('sku_id', skuIds)
    .eq('is_active', true);

  return (data ?? []) as StoreSku[];
}

function skuCoversCategory(sku: StoreSku, cat: AssetCategory): boolean {
  switch (cat) {
    case 'episode_still':  return !!sku.grants_episodes_still;
    case 'episode_motion': return !!sku.grants_episodes_motion;
    case 'episode_print':  return !!sku.grants_episodes_print;
    case 'character_card': return !!sku.grants_character_cards;
    case 'gn':             return !!sku.grants_gn;
    case 'lore':           return !!sku.grants_lore;
    default:               return false;
  }
}

/**
 * Does the persona own the asset, either directly or via an SKU grant?
 */
export async function userOwnsAsset(personaId: string, assetId: string): Promise<{ owned: boolean; via: 'direct' | 'sku' | null }> {
  const ents = await getEntitlementService().getPersonaEntitlements(personaId);

  // 1. Direct grant
  if (ents.some((e) => e.assetId === assetId)) {
    return { owned: true, via: 'direct' };
  }

  // 2. SKU expansion
  const ownedSkus = await getOwnedSkus(personaId);
  if (ownedSkus.length === 0) return { owned: false, via: null };

  // 2a. extra_asset_ids escape hatch
  for (const sku of ownedSkus) {
    if (sku.extra_asset_ids && sku.extra_asset_ids.includes(assetId)) {
      return { owned: true, via: 'sku' };
    }
  }

  // 2b. category match
  const meta = await getAssetMeta(assetId);
  if (!meta) return { owned: false, via: null };
  for (const sku of ownedSkus) {
    if (skuCoversCategory(sku, meta.category)) {
      return { owned: true, via: 'sku' };
    }
  }

  return { owned: false, via: null };
}

/**
 * Enumerate every asset the persona owns (direct + SKU-expanded). Used to
 * populate library views and per-card lock state without N+1 fetching.
 */
export async function getOwnedAssetIds(personaId: string, series: string = 'metaKnyts'): Promise<{
  direct: string[];
  expanded: string[];
  ownedSkus: string[];
}> {
  const ents = await getEntitlementService().getPersonaEntitlements(personaId);
  const direct = ents.map((e) => e.assetId).filter((s): s is string => !!s);
  const ownedSkus = await getOwnedSkus(personaId);
  const ownedSkuIds = ownedSkus.map((s) => s.sku_id);

  if (ownedSkus.length === 0) {
    return { direct, expanded: [], ownedSkus: ownedSkuIds };
  }

  // Compute expansion: for each granted category, query the matching assets in
  // master_content_qubes / codex_media_assets and add their ids.
  const grantedCats = new Set<AssetCategory>();
  const extras = new Set<string>();
  for (const sku of ownedSkus) {
    if (sku.grants_episodes_still)  grantedCats.add('episode_still');
    if (sku.grants_episodes_motion) grantedCats.add('episode_motion');
    if (sku.grants_episodes_print)  grantedCats.add('episode_print');
    if (sku.grants_character_cards) grantedCats.add('character_card');
    if (sku.grants_gn)              grantedCats.add('gn');
    if (sku.grants_lore)            grantedCats.add('lore');
    (sku.extra_asset_ids ?? []).forEach((id) => extras.add(id));
  }

  const expanded = new Set<string>(extras);

  // Master content rows (gn / episodes still / motion / print)
  const masterContentTypes: string[] = [];
  if (grantedCats.has('episode_still'))  masterContentTypes.push('episode_still');
  if (grantedCats.has('episode_motion')) masterContentTypes.push('episode_motion');
  if (grantedCats.has('episode_print') || grantedCats.has('gn')) masterContentTypes.push('episode_print');

  if (masterContentTypes.length > 0) {
    const { data: masters } = await supa()
      .from('master_content_qubes')
      .select('id, content_type, episode_number')
      .eq('series', series)
      .eq('status', 'active')
      .in('content_type', masterContentTypes);

    for (const m of masters ?? []) {
      const isGn = (m.episode_number as number) === 0;
      const ct = m.content_type as string;
      if (isGn && grantedCats.has('gn'))                                                expanded.add(m.id);
      if (!isGn && ct === 'episode_still'  && grantedCats.has('episode_still'))         expanded.add(m.id);
      if (!isGn && ct === 'episode_motion' && grantedCats.has('episode_motion'))        expanded.add(m.id);
      if (!isGn && ct === 'episode_print'  && grantedCats.has('episode_print'))         expanded.add(m.id);
    }
  }

  // Codex media assets
  const mediaKinds: string[] = [];
  if (grantedCats.has('character_card')) mediaKinds.push('character_poster');
  if (grantedCats.has('lore'))           mediaKinds.push('background_lore_doc', 'powers_sheet', 'twenty_one_sats_concept');

  if (mediaKinds.length > 0) {
    const { data: media } = await supa()
      .from('codex_media_assets')
      .select('id, asset_kind')
      .eq('series', series)
      .eq('status', 'active')
      .in('asset_kind', mediaKinds);

    for (const a of media ?? []) {
      expanded.add(a.id as string);
    }
  }

  return { direct, expanded: Array.from(expanded), ownedSkus: ownedSkuIds };
}
