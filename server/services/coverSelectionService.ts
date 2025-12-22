/**
 * Cover Selection Service
 * 
 * Handles weighted random selection of limited-edition covers for minting.
 * Uses atomic database operations to ensure edition serials are unique.
 */

import { getSupabaseServer } from '../../app/api/_lib/supabaseServer';

// Helper to get Supabase client with null check
function getSupabase() {
  const client = getSupabaseServer();
  if (!client) {
    throw new Error('Supabase client not available');
  }
  return client;
}

export interface CoverSelectionResult {
  assetId: string;
  editionSerial: number;
  variantName: string | null;
  rarityTier: string | null;
  editionMax: number | null;
  title: string;
  autoDriveCid: string;
}

export interface AvailableCover {
  id: string;
  title: string;
  variant_name: string | null;
  rarity_tier: string | null;
  edition_max: number | null;
  edition_minted: number;
  random_weight: number;
  auto_drive_cid: string;
}

/**
 * Select and claim a random cover for an episode
 * Uses the database function for atomic selection
 * 
 * @param episodeNumber - The episode to select a cover for
 * @param series - The series (default: 'metaKnyts')
 * @returns Cover selection result or null if no covers available
 */
export async function selectRandomCoverForEpisode(
  episodeNumber: number,
  series: string = 'metaKnyts'
): Promise<CoverSelectionResult | null> {
  const supabase = getSupabase();

  // Use the atomic database function
  const { data, error } = await supabase
    .rpc('select_and_claim_cover', {
      p_episode_number: episodeNumber,
      p_series: series,
    });

  if (error) {
    console.error('[CoverSelection] Database error:', error);
    throw new Error(`Cover selection failed: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.log(`[CoverSelection] No covers available for Episode ${episodeNumber}`);
    return null;
  }

  const result = data[0];

  // Fetch additional details (CID, title) from the asset
  const { data: asset, error: assetError } = await supabase
    .from('codex_media_assets')
    .select('title, auto_drive_cid')
    .eq('id', result.asset_id)
    .single();

  if (assetError) {
    console.error('[CoverSelection] Failed to fetch asset details:', assetError);
    throw new Error(`Failed to fetch cover details: ${assetError.message}`);
  }

  return {
    assetId: result.asset_id,
    editionSerial: result.edition_serial,
    variantName: result.variant_name,
    rarityTier: result.rarity_tier,
    editionMax: result.edition_max,
    title: asset.title,
    autoDriveCid: asset.auto_drive_cid,
  };
}

/**
 * Get available covers for an episode (for preview/display)
 * Does NOT claim any covers
 */
export async function getAvailableCoversForEpisode(
  episodeNumber: number,
  series: string = 'metaKnyts'
): Promise<AvailableCover[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('codex_media_assets')
    .select(`
      id,
      title,
      variant_name,
      rarity_tier,
      edition_max,
      edition_minted,
      random_weight,
      auto_drive_cid
    `)
    .eq('episode_number', episodeNumber)
    .eq('series', series)
    .in('asset_kind', ['cover_pdf', 'cover_image'])
    .eq('status', 'active')
    .or('edition_max.is.null,edition_minted.lt.edition_max');

  if (error) {
    console.error('[CoverSelection] Failed to fetch available covers:', error);
    throw new Error(`Failed to fetch covers: ${error.message}`);
  }

  return data || [];
}

/**
 * Get cover statistics for an episode
 */
export async function getCoverStatsForEpisode(
  episodeNumber: number,
  series: string = 'metaKnyts'
): Promise<{
  totalVariants: number;
  totalEditionsAvailable: number;
  totalEditionsMinted: number;
  byRarity: Record<string, { available: number; minted: number }>;
}> {
  const covers = await getAvailableCoversForEpisode(episodeNumber, series);

  const stats = {
    totalVariants: covers.length,
    totalEditionsAvailable: 0,
    totalEditionsMinted: 0,
    byRarity: {} as Record<string, { available: number; minted: number }>,
  };

  for (const cover of covers) {
    const available = cover.edition_max 
      ? cover.edition_max - cover.edition_minted 
      : Infinity;
    const minted = cover.edition_minted;

    stats.totalEditionsAvailable += available === Infinity ? 1000 : available; // Cap for display
    stats.totalEditionsMinted += minted;

    const rarity = cover.rarity_tier || 'common';
    if (!stats.byRarity[rarity]) {
      stats.byRarity[rarity] = { available: 0, minted: 0 };
    }
    stats.byRarity[rarity].available += available === Infinity ? 1000 : available;
    stats.byRarity[rarity].minted += minted;
  }

  return stats;
}

/**
 * Check if any covers are available for an episode
 */
export async function hasAvailableCovers(
  episodeNumber: number,
  series: string = 'metaKnyts'
): Promise<boolean> {
  const supabase = getSupabase();

  const { count, error } = await supabase
    .from('codex_media_assets')
    .select('id', { count: 'exact', head: true })
    .eq('episode_number', episodeNumber)
    .eq('series', series)
    .in('asset_kind', ['cover_pdf', 'cover_image'])
    .eq('status', 'active')
    .or('edition_max.is.null,edition_minted.lt.edition_max');

  if (error) {
    console.error('[CoverSelection] Failed to check cover availability:', error);
    return false;
  }

  return (count || 0) > 0;
}

/**
 * Get a specific cover by ID
 */
export async function getCoverById(assetId: string): Promise<AvailableCover | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('codex_media_assets')
    .select(`
      id,
      title,
      variant_name,
      rarity_tier,
      edition_max,
      edition_minted,
      random_weight,
      auto_drive_cid
    `)
    .eq('id', assetId)
    .in('asset_kind', ['cover_pdf', 'cover_image'])
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch cover: ${error.message}`);
  }

  return data;
}

/**
 * Manual cover selection (for admin/testing)
 * Allows selecting a specific cover variant
 */
export async function selectSpecificCover(
  assetId: string
): Promise<CoverSelectionResult | null> {
  const supabase = getSupabase();

  // Atomically increment edition_minted and get the new value
  const { data, error } = await supabase
    .from('codex_media_assets')
    .update({ 
      edition_minted: supabase.rpc('increment_edition_minted', { row_id: assetId }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', assetId)
    .in('asset_kind', ['cover_pdf', 'cover_image'])
    .or('edition_max.is.null,edition_minted.lt.edition_max')
    .select(`
      id,
      title,
      variant_name,
      rarity_tier,
      edition_max,
      edition_minted,
      auto_drive_cid
    `)
    .single();

  if (error) {
    console.error('[CoverSelection] Failed to select specific cover:', error);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    assetId: data.id,
    editionSerial: data.edition_minted,
    variantName: data.variant_name,
    rarityTier: data.rarity_tier,
    editionMax: data.edition_max,
    title: data.title,
    autoDriveCid: data.auto_drive_cid,
  };
}
