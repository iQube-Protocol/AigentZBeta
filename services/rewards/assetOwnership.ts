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
  /**
   * DB-convention episode_number list this SKU grants. NULL = all episodes
   * (full-catalog grants like investor bundles). When set, restricts category
   * grants to these episodes only (e.g. bundle-0-2 → [1,2,3]).
   */
  episode_numbers: number[] | null;
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
 * Does the SKU cover this specific asset, accounting for episode_numbers
 * scoping? GN and lore are not episode-scoped (single-item categories).
 */
function skuCoversAsset(sku: StoreSku, meta: AssetMeta): boolean {
  if (!skuCoversCategory(sku, meta.category)) return false;
  // GN, lore, character cards aren't episode-scoped
  if (meta.category === 'gn' || meta.category === 'lore' || meta.category === 'character_card') return true;
  // For episode categories, honor episode_numbers if set
  if (sku.episode_numbers && sku.episode_numbers.length > 0) {
    if (meta.episodeNumber === null) return false;
    return sku.episode_numbers.includes(meta.episodeNumber);
  }
  return true;
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

  // 2b. category + episode-scope match
  const meta = await getAssetMeta(assetId);
  if (!meta) return { owned: false, via: null };
  for (const sku of ownedSkus) {
    if (skuCoversAsset(sku, meta)) {
      return { owned: true, via: 'sku' };
    }
  }

  return { owned: false, via: null };
}

/**
 * Enumerate every asset the persona owns (direct + SKU-expanded). Used to
 * populate library views and per-card lock state without N+1 fetching.
 *
 * Canonical taxonomy (Phase B — post-retag 2026-05-13):
 *   - GN is a separate content_type='gn_still' with episode_number=-1.
 *     NOT episode_number=0 (which is now display Ep #0, a real episode).
 *   - Episodes have episode_number 0..12 (display Ep #0..#12).
 *   - The grants_gn flag maps to content_type='gn_still' (1 row).
 *   - grants_episodes_still maps to content_type='episode_still' (13 rows).
 *
 * Returns:
 *   direct        — asset_ids granted explicitly (entitlement.asset_id)
 *   expanded      — asset_ids resolved via SKU category-grant expansion
 *   ownedSkus     — sku_ids the persona currently holds
 *   expectedSlots — (Phase B) the full set of (category, episode_number)
 *                   the persona has RIGHTS to per their SKUs. Used by the
 *                   codex UI to render "Owned · Coming Soon" placeholders
 *                   for granted-but-not-yet-uploaded items.
 */
// Canonical episode-number set for fully-stocked KNYT collection.
// DB ep=0..12 = the 13 episodes/characters. AutoDrive labels them 1..13 (off
// by one), but the DB convention is 0-indexed: display "Episode #12" = DB
// episode_number=12 (the 13th issue). GN sits at -1 in its own content_type.
const CANONICAL_EPISODE_NUMBERS: ReadonlyArray<number> = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export interface ExpectedSlot {
  category: AssetCategory;       // 'gn' | 'episode_still' | 'episode_motion' | 'episode_print' | 'character_card' | 'lore'
  episodeNumber: number | null;  // null for ungated categories; -1 for gn; 0..12 for episodes/characters
}

export async function getOwnedAssetIds(personaId: string, series: string = 'metaKnyts'): Promise<{
  direct: string[];
  expanded: string[];
  ownedSkus: string[];
  expectedSlots: ExpectedSlot[];
}> {
  const ents = await getEntitlementService().getPersonaEntitlements(personaId);
  const direct = ents.map((e) => e.assetId).filter((s): s is string => !!s);
  const ownedSkus = await getOwnedSkus(personaId);
  const ownedSkuIds = ownedSkus.map((s) => s.sku_id);

  if (ownedSkus.length === 0) {
    return { direct, expanded: [], ownedSkus: ownedSkuIds, expectedSlots: [] };
  }

  // Determine the union of episode_number filters across owned SKUs and the
  // global category set. If ANY owned SKU has unscoped (episode_numbers=NULL)
  // grants for a category, that category is considered global. Otherwise the
  // union of per-SKU episode_numbers limits the expansion.
  const globalCats = new Set<AssetCategory>();
  const scopedEpsByCat = new Map<AssetCategory, Set<number>>();
  const extras = new Set<string>();

  function addScoped(cat: AssetCategory, sku: StoreSku) {
    if (!sku.episode_numbers || sku.episode_numbers.length === 0) {
      globalCats.add(cat);
      scopedEpsByCat.delete(cat);
      return;
    }
    if (globalCats.has(cat)) return;
    let s = scopedEpsByCat.get(cat);
    if (!s) { s = new Set<number>(); scopedEpsByCat.set(cat, s); }
    sku.episode_numbers.forEach((n) => s!.add(n));
  }

  for (const sku of ownedSkus) {
    if (sku.grants_episodes_still)  addScoped('episode_still', sku);
    if (sku.grants_episodes_motion) addScoped('episode_motion', sku);
    if (sku.grants_episodes_print)  addScoped('episode_print', sku);
    if (sku.grants_character_cards) globalCats.add('character_card');
    if (sku.grants_gn)              globalCats.add('gn');
    if (sku.grants_lore)            globalCats.add('lore');
    (sku.extra_asset_ids ?? []).forEach((id) => extras.add(id));
  }

  const expanded = new Set<string>(extras);

  // Master content rows (gn / episodes still / motion / print)
  // CANONICAL: GN is content_type='gn_still' with episode_number=-1.
  // Episodes are content_type='episode_{still,motion,print}' with
  // episode_number 0..12. The legacy ep===0 heuristic is gone.
  const masterContentTypes: string[] = [];
  if (globalCats.has('gn'))                                                       masterContentTypes.push('gn_still');
  if (globalCats.has('episode_still')  || scopedEpsByCat.has('episode_still'))  masterContentTypes.push('episode_still');
  if (globalCats.has('episode_motion') || scopedEpsByCat.has('episode_motion')) masterContentTypes.push('episode_motion');
  if (globalCats.has('episode_print')  || scopedEpsByCat.has('episode_print'))  masterContentTypes.push('episode_print');

  if (masterContentTypes.length > 0) {
    const { data: masters } = await supa()
      .from('master_content_qubes')
      .select('id, content_type, episode_number')
      .eq('series', series)
      .eq('status', 'active')
      .in('content_type', masterContentTypes);

    function categoryAllows(cat: AssetCategory, ep: number | null): boolean {
      if (globalCats.has(cat)) return true;
      const scope = scopedEpsByCat.get(cat);
      if (!scope) return false;
      if (ep === null) return false;
      return scope.has(ep);
    }

    for (const m of masters ?? []) {
      const ep = m.episode_number as number | null;
      const ct = m.content_type as string;
      // GN is its own row keyed on content_type — no episode_number heuristics.
      if (ct === 'gn_still' && globalCats.has('gn')) {
        expanded.add(m.id);
        continue;
      }
      if (ct === 'episode_still'  && categoryAllows('episode_still',  ep)) expanded.add(m.id);
      if (ct === 'episode_motion' && categoryAllows('episode_motion', ep)) expanded.add(m.id);
      if (ct === 'episode_print'  && categoryAllows('episode_print',  ep)) expanded.add(m.id);
    }
  }

  // Codex media assets
  const mediaKinds: string[] = [];
  if (globalCats.has('character_card')) mediaKinds.push('character_poster');
  if (globalCats.has('lore'))           mediaKinds.push('background_lore_doc', 'powers_sheet', 'twenty_one_sats_concept');

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

  // ── Phase B: compute expectedSlots ─────────────────────────────────────
  // For each category the persona has rights to, enumerate every
  // (category, episode_number) pair the SKU grants. The UI uses this to
  // render "Owned · Coming Soon" placeholders for items not yet uploaded.
  //
  // Resolution rule per category:
  //   - global (episode_numbers=NULL on any owned SKU) → CANONICAL range
  //   - scoped → exactly the union of episode_numbers from owning SKUs
  //   - 'gn'           → single slot at episode_number=-1
  //   - 'character_card' / 'lore' → ungated; null episode_number
  const expectedSlots: ExpectedSlot[] = [];

  if (globalCats.has('gn')) {
    expectedSlots.push({ category: 'gn', episodeNumber: -1 });
  }

  const episodeCategories: AssetCategory[] = ['episode_still', 'episode_motion', 'episode_print'];
  for (const cat of episodeCategories) {
    if (globalCats.has(cat)) {
      for (const n of CANONICAL_EPISODE_NUMBERS) {
        expectedSlots.push({ category: cat, episodeNumber: n });
      }
    } else {
      const scoped = scopedEpsByCat.get(cat);
      if (scoped) {
        // Sort scoped episode numbers so the UI gets a stable order.
        Array.from(scoped).sort((a, b) => a - b).forEach((n) => {
          expectedSlots.push({ category: cat, episodeNumber: n });
        });
      }
    }
  }

  if (globalCats.has('character_card')) {
    // Character cards mirror episode numbering 0..12 (the 13 canonical slots).
    // Note: codex_media_assets.character_poster.episode_number is 1-indexed
    // in the DB (1..13) — the consumer (api/codex/owned) translates the
    // 0..12 slot to the 1..13 DB row when matching uploaded characters.
    for (const n of CANONICAL_EPISODE_NUMBERS) {
      expectedSlots.push({ category: 'character_card', episodeNumber: n });
    }
  }

  if (globalCats.has('lore')) {
    expectedSlots.push({ category: 'lore', episodeNumber: null });
  }

  return { direct, expanded: Array.from(expanded), ownedSkus: ownedSkuIds, expectedSlots };
}
