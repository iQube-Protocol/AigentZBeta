/**
 * Admin API: Codex Status
 * 
 * GET /api/admin/codex/status
 * 
 * Returns aggregated status of all Codex content:
 * - Per-episode: still master, motion master, covers, characters
 * - Global stats: total assets by type
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../_lib/supabaseServer';

// CORS headers for cross-origin requests from thin client
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

// Helper to get Supabase client with null check
function getSupabase() {
  const client = getSupabaseServer();
  if (!client) {
    throw new Error('Supabase client not available');
  }
  return client;
}

export const runtime = 'nodejs';

interface EpisodeStatus {
  episodeNumber: number;
  displayNumber: string;  // Documentation number (e.g., "#0")
  title?: string;         // From metadata
  hasStillMaster: boolean;
  hasMotionMaster: boolean;
  hasPrintRare: boolean;
  hasPrintEpic: boolean;
  hasPrintLegendary: boolean;
  stillMasterId?: string;
  motionMasterId?: string;
  motionMasterCid?: string; // CID for motion comic video streaming
  printRareCid?: string;
  printEpicCid?: string;
  printLegendaryCid?: string;
  coverCount: number;
  coverImageCid?: string; // CID of primary cover for display
  characterCount: number;
  totalAssets: number;
}

interface GlobalStats {
  totalStillMasters: number;
  totalMotionMasters: number;
  totalPrintRare: number;
  totalPrintEpic: number;
  totalPrintLegendary: number;
  totalCovers: number;
  totalCharacters: number;
  totalLoreDocs: number;
  totalGameAssets: number;
  totalSocialAssets: number;
  totalAllAssets: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const series = searchParams.get('series') || 'metaKnyts';

    const supabase = getSupabase();

    // Get per-episode status using the database function
    const { data: episodeData, error: episodeError } = await supabase
      .rpc('get_codex_status', { p_series: series });

    if (episodeError) {
      console.error('[CodexStatus] Episode status error:', episodeError);
      // Fallback to manual query if function doesn't exist
    }

    // Get global stats using the database function
    const { data: globalData, error: globalError } = await supabase
      .rpc('get_codex_global_stats', { p_series: series });

    if (globalError) {
      console.error('[CodexStatus] Global stats error:', globalError);
    }

    // Get master content details (include auto_drive_cid for PDF viewing)
    const { data: masters, error: mastersError } = await supabase
      .from('master_content_qubes')
      .select('id, episode_number, content_type, edition_tier, title, status, auto_drive_cid')
      .eq('series', series)
      .eq('status', 'active')
      .order('episode_number', { ascending: true });

    if (mastersError) {
      console.error('[CodexStatus] Masters query error:', mastersError);
    }

    // Get asset counts by episode and kind
    const { data: assetCounts, error: assetError } = await supabase
      .from('codex_media_assets')
      .select('episode_number, asset_kind')
      .eq('series', series)
      .eq('status', 'active');

    if (assetError) {
      console.error('[CodexStatus] Asset counts error:', assetError);
    }

    // Get episode metadata
    const { data: metadataList, error: metadataError } = await supabase
      .from('episode_metadata')
      .select('episode_number, display_number, title')
      .eq('series', series)
      .eq('is_current', true);

    if (metadataError) {
      console.error('[CodexStatus] Metadata query error:', metadataError);
    }

    // Get cover images for display (prefer cover_image over cover_pdf)
    // Query all covers to see what's actually stored
    const { data: covers, error: coversError } = await supabase
      .from('codex_media_assets')
      .select('episode_number, auto_drive_cid, rarity_tier, asset_kind, mime_type')
      .eq('series', series)
      .eq('status', 'active')
      .in('asset_kind', ['cover_image', 'cover_pdf'])
      .order('asset_kind', { ascending: true })  // cover_image before cover_pdf
      .order('rarity_tier', { ascending: true }); // then by rarity

    if (coversError) {
      console.error('[CodexStatus] Covers query error:', coversError);
    }
    
    // Build metadata lookup - check if episode_metadata table exists
    const metadataMap = new Map<number, { displayNumber: string; title: string }>();
    if (metadataList) {
      for (const meta of metadataList) {
        metadataMap.set(meta.episode_number, {
          displayNumber: meta.display_number || `#${meta.episode_number - 1}`,
          title: meta.title,
        });
      }
    }

    // Also try codex_episodes table for metadata
    const { data: codexEpisodes } = await supabase
      .from('codex_episodes')
      .select('episode_number, issue_number, title')
      .eq('series', series);

    if (codexEpisodes) {
      for (const ep of codexEpisodes) {
        if (ep.episode_number && !metadataMap.has(ep.episode_number)) {
          metadataMap.set(ep.episode_number, {
            displayNumber: ep.issue_number || `#${ep.episode_number - 1}`,
            title: ep.title,
          });
        }
      }
    }

    // Build cover lookup (prefer cover_image over cover_pdf for each episode)
    const coverMap = new Map<number, { cid: string; isImage: boolean }>();
    if (covers) {
      for (const cover of covers) {
        if (!cover.episode_number) continue;
        const existing = coverMap.get(cover.episode_number);
        const isImage = cover.asset_kind === 'cover_image';
        
        // Only set if: no existing cover, OR this is an image and existing is PDF
        if (!existing || (isImage && !existing.isImage)) {
          coverMap.set(cover.episode_number, { cid: cover.auto_drive_cid, isImage });
        }
      }
    }

    // Build episode status map
    const episodeMap = new Map<number, EpisodeStatus>();

    // Add masters to map
    if (masters) {
      for (const master of masters) {
        const ep = master.episode_number;
        if (!episodeMap.has(ep)) {
          const meta = metadataMap.get(ep);
          episodeMap.set(ep, {
            episodeNumber: ep,
            displayNumber: meta?.displayNumber || `#${ep - 1}`,
            title: meta?.title,
            hasStillMaster: false,
            hasMotionMaster: false,
            hasPrintRare: false,
            hasPrintEpic: false,
            hasPrintLegendary: false,
            coverCount: 0,
            coverImageCid: coverMap.get(ep)?.cid,
            characterCount: 0,
            totalAssets: 0,
          });
        }
        const status = episodeMap.get(ep)!;
        if (master.content_type === 'episode_still') {
          status.hasStillMaster = true;
          status.stillMasterId = master.id;
        } else if (master.content_type === 'episode_motion') {
          status.hasMotionMaster = true;
          status.motionMasterId = master.id;
          status.motionMasterCid = master.auto_drive_cid;
        } else if (master.content_type === 'episode_print') {
          // Handle print editions by tier - store CID for PDF viewing
          const tier = master.edition_tier;
          if (tier === 'rare') {
            status.hasPrintRare = true;
            status.printRareCid = master.auto_drive_cid;
          } else if (tier === 'epic') {
            status.hasPrintEpic = true;
            status.printEpicCid = master.auto_drive_cid;
          } else if (tier === 'legendary') {
            status.hasPrintLegendary = true;
            status.printLegendaryCid = master.auto_drive_cid;
          }
        }
      }
    }

    // Count assets by episode
    if (assetCounts) {
      for (const asset of assetCounts) {
        const ep = asset.episode_number;
        if (ep === null) continue;

        if (!episodeMap.has(ep)) {
          const meta = metadataMap.get(ep);
          episodeMap.set(ep, {
            episodeNumber: ep,
            displayNumber: meta?.displayNumber || `#${ep - 1}`,
            title: meta?.title,
            hasStillMaster: false,
            hasMotionMaster: false,
            hasPrintRare: false,
            hasPrintEpic: false,
            hasPrintLegendary: false,
            coverCount: 0,
            coverImageCid: coverMap.get(ep)?.cid,
            characterCount: 0,
            totalAssets: 0,
          });
        }
        const status = episodeMap.get(ep)!;
        status.totalAssets++;

        if (asset.asset_kind === 'cover_pdf' || asset.asset_kind === 'cover_image') {
          status.coverCount++;
        } else if (asset.asset_kind === 'character_poster') {
          status.characterCount++;
        }
      }
    }

    // Convert map to sorted array
    const episodes = Array.from(episodeMap.values())
      .sort((a, b) => a.episodeNumber - b.episodeNumber);

    // Build global stats - map from snake_case DB columns to camelCase
    const dbStats = globalData?.[0];
    const globalStats: GlobalStats = dbStats ? {
      totalStillMasters: dbStats.total_still_masters || 0,
      totalMotionMasters: dbStats.total_motion_masters || 0,
      totalPrintRare: dbStats.total_print_rare || 0,
      totalPrintEpic: dbStats.total_print_epic || 0,
      totalPrintLegendary: dbStats.total_print_legendary || 0,
      totalCovers: dbStats.total_covers || 0,
      totalCharacters: dbStats.total_characters || 0,
      totalLoreDocs: dbStats.total_lore_docs || 0,
      totalGameAssets: dbStats.total_game_assets || 0,
      totalSocialAssets: dbStats.total_social_assets || 0,
      totalAllAssets: dbStats.total_all_assets || 0,
    } : {
      // Fallback if DB function not available
      totalStillMasters: masters?.filter(m => m.content_type === 'episode_still').length || 0,
      totalMotionMasters: masters?.filter(m => m.content_type === 'episode_motion').length || 0,
      totalPrintRare: masters?.filter(m => m.content_type === 'episode_print' && m.edition_tier === 'rare').length || 0,
      totalPrintEpic: masters?.filter(m => m.content_type === 'episode_print' && m.edition_tier === 'epic').length || 0,
      totalPrintLegendary: masters?.filter(m => m.content_type === 'episode_print' && m.edition_tier === 'legendary').length || 0,
      totalCovers: assetCounts?.filter(a => 
        a.asset_kind === 'cover_pdf' || a.asset_kind === 'cover_image'
      ).length || 0,
      totalCharacters: assetCounts?.filter(a => a.asset_kind === 'character_poster').length || 0,
      totalLoreDocs: assetCounts?.filter(a => 
        ['background_lore_doc', 'powers_sheet', 'twenty_one_sats_concept'].includes(a.asset_kind)
      ).length || 0,
      totalGameAssets: assetCounts?.filter(a => 
        ['game_concept_doc', 'game_still', 'game_video'].includes(a.asset_kind)
      ).length || 0,
      totalSocialAssets: assetCounts?.filter(a => 
        ['social_campaign_video', 'social_campaign_image'].includes(a.asset_kind)
      ).length || 0,
      totalAllAssets: assetCounts?.length || 0,
    };

    return NextResponse.json({
      success: true,
      series,
      episodes,
      globalStats,
      summary: {
        totalEpisodes: episodes.length,
        episodesWithStill: episodes.filter(e => e.hasStillMaster).length,
        episodesWithMotion: episodes.filter(e => e.hasMotionMaster).length,
        episodesWithPrint: episodes.filter(e => e.hasPrintRare || e.hasPrintEpic || e.hasPrintLegendary).length,
        episodesWithCovers: episodes.filter(e => e.coverCount > 0).length,
        episodesComplete: episodes.filter(e => 
          (e.hasStillMaster || e.hasPrintRare || e.hasPrintEpic || e.hasPrintLegendary) && e.coverCount > 0
        ).length,
      },
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[CodexStatus] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to get status',
    }, { status: 500, headers: corsHeaders });
  }
}
