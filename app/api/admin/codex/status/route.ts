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
import { randomUUID } from 'crypto';
import { getSupabaseServer } from '../../../_lib/supabaseServer';

// CORS headers for cross-origin requests from thin client
export async function OPTIONS() {
  return new NextResponse(null);
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
  purchaseId?: string;
  priceUsd?: number;
  priceKnyt?: number;
  hasStillMaster: boolean;
  hasMotionMaster: boolean;
  hasPrintRare: boolean;
  hasPrintEpic: boolean;
  hasPrintLegendary: boolean;
  hasPrintCommon: boolean;
  stillMasterId?: string;
  // Still master CID / lite URL — exposes the episode_still content row's
  // auto_drive_cid and pdf_lite_url so the frontend can render the readable
  // version. In legacy fixtures the "still" master row carries the readable
  // PDF for the episode (the printRare* fields are populated only for the
  // explicit print-tier drops, not every readable episode).
  stillMasterCid?: string;
  stillMasterLiteUrl?: string;
  motionMasterId?: string;
  motionMasterCid?: string; // CID for motion comic video streaming
  printRareCid?: string;
  printEpicCid?: string;
  printLegendaryCid?: string;
  printCommonCid?: string;
  // Lite URLs: forwarded only for free content (episode 0 = GN); gated content URLs stay server-side
  printCommonLiteUrl?: string;
  printRareLiteUrl?: string;
  printEpicLiteUrl?: string;
  printLegendaryLiteUrl?: string;
  // masterId fields: TEXT pk from master_content_qubes (e.g. mk_ep01_print_common)
  printCommonMasterId?: string;
  printRareMasterId?: string;
  printEpicMasterId?: string;
  printLegendaryMasterId?: string;
  coverCount: number;
  coverImageCid?: string; // CID of primary cover for display
  coverThumbUrl?: string; // Supabase Storage cover thumbnail URL
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
  totalRaBadges: number;
  totalBundles: number;
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

    // Get master content details (include auto_drive_cid and pdf_lite_url for PDF viewing)
    const { data: masters, error: mastersError } = await supabase
      .from('master_content_qubes')
      .select('id, episode_number, content_type, edition_tier, title, status, auto_drive_cid, pdf_lite_url')
      .eq('series', series)
      .eq('status', 'active')
      .order('episode_number', { ascending: true });

    if (mastersError) {
      console.error('[CodexStatus] Masters query error:', mastersError);
    }

    // Get asset counts by episode and kind
    const { data: assetCountsData, error: assetError } = await supabase
      .from('codex_media_assets')
      .select('episode_number, asset_kind')
      .eq('series', series)
      .eq('status', 'active');

    if (assetError) {
      console.error('[CodexStatus] Asset counts error:', assetError);
    }
    let assetCountsList = assetCountsData ?? [];

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
    const { data: coversData, error: coversError } = await supabase
      .from('codex_media_assets')
      .select('episode_number, auto_drive_cid, cover_thumb_url, rarity_tier, asset_kind, mime_type')
      .eq('series', series)
      .eq('status', 'active')
      .in('asset_kind', ['cover_image', 'cover_pdf'])
      .order('asset_kind', { ascending: true })  // cover_image before cover_pdf
      .order('rarity_tier', { ascending: true }); // then by rarity

    if (coversError) {
      console.error('[CodexStatus] Covers query error:', coversError);
    }

    let assetCountRows = assetCountsData;
    let coverRows = coversData;
    const fallbackEpisodeNumber = -1;
   if (false && series === 'metaKnyts') {
      const fallbackBaseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content-media/covers/ep0`;
      const fallbackVariants = [
        { rarity: 'common', key: 'common', file: 'common.png', label: 'Common' },
        { rarity: 'rare', key: 'rare', file: 'rare.png', label: 'Rare' },
        { rarity: 'epic', key: 'epic', file: 'epic.png', label: 'Epic' },
        { rarity: 'legendary', key: 'legendary', file: 'legendary.png', label: 'Legendary' },
      ];
      const existingFallbackCovers = coverRows?.filter(c => c.episode_number === fallbackEpisodeNumber) || [];
      const existingRarities = new Set(existingFallbackCovers.map(c => c.rarity_tier));
      const missingVariants = fallbackVariants.filter(variant => !existingRarities.has(variant.rarity));

      if (missingVariants.length > 0) {
        const insertRecords = missingVariants.map(variant => ({
          title: `Episode -1 ${variant.label} cover`,
          episode_number: fallbackEpisodeNumber,
          asset_kind: 'cover_image',
          series,
          auto_drive_cid: `supabase:content-media/covers/ep0/${variant.file}`,
          mime_type: 'image/png',
          encryption_iv: randomUUID(),
          variant_name: `ep-1-${variant.key}-cover`,
          rarity_tier: variant.rarity,
          cover_thumb_url: `${fallbackBaseUrl}/${variant.file}`,
          status: 'active',
        }));

        try {
          const { error: insertError } = await supabase
            .from('codex_media_assets')
            .insert(insertRecords)
            .select('id');
          if (insertError) {
            console.error('[CodexStatus] fallback insert error:', insertError);
          } else {
            const { data: refreshedAssetCounts, error: refreshedAssetError } = await supabase
              .from('codex_media_assets')
              .select('episode_number, asset_kind')
              .eq('series', series)
              .eq('status', 'active');
            if (refreshedAssetError) {
              console.error('[CodexStatus] Asset counts refresh error:', refreshedAssetError);
            } else {
              assetCountRows = refreshedAssetCounts;
            }

            const { data: refreshedCovers, error: refreshedCoversError } = await supabase
              .from('codex_media_assets')
              .select('episode_number, auto_drive_cid, cover_thumb_url, rarity_tier, asset_kind, mime_type')
              .eq('series', series)
              .eq('status', 'active')
              .in('asset_kind', ['cover_image', 'cover_pdf'])
              .order('asset_kind', { ascending: true })
              .order('rarity_tier', { ascending: true });
            if (refreshedCoversError) {
              console.error('[CodexStatus] Covers refresh error:', refreshedCoversError);
            } else {
              coverRows = refreshedCovers;
            }
          }
        } catch (insertError) {
          console.error('[CodexStatus] Episode -1 fallback insert failed:', insertError);
        }
      }
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

    if (series === 'metaKnyts') {
      const preorderVariants = [
        { episodeNumber: -1, label: 'Common' },
        { episodeNumber: -2, label: 'Rare' },
        { episodeNumber: -3, label: 'Epic' },
        { episodeNumber: -4, label: 'Legendary' },
      ];

      for (const variant of preorderVariants) {
        if (!metadataMap.has(variant.episodeNumber)) {
          metadataMap.set(variant.episodeNumber, {
            displayNumber: `#${variant.episodeNumber}`,
            title: `Episode -1 Preorder Drop (${variant.label})`,
          });
        }
      }
    }

    // Build cover lookup (prefer cover_image over cover_pdf for each episode)
    const coverMap = new Map<number, { cid: string; thumbUrl?: string; isImage: boolean }>();
    if (coverRows) {
      for (const cover of coverRows) {
        if (cover.episode_number === null || cover.episode_number === undefined) continue;
        const existing = coverMap.get(cover.episode_number);
        const isImage = cover.asset_kind === 'cover_image';
        
        // Only set if: no existing cover, OR this is an image and existing is PDF
        if (!existing || (isImage && !existing.isImage)) {
          coverMap.set(cover.episode_number, { 
            cid: cover.auto_drive_cid, 
            thumbUrl: cover.cover_thumb_url,
            isImage 
          });
        }
      }
    }

    if (series === 'metaKnyts') {
      const preorderBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content-media/covers/ep0`;
      coverMap.set(-1, { cid: '', thumbUrl: `${preorderBase}/common.png`, isImage: true });
      coverMap.set(-2, { cid: '', thumbUrl: `${preorderBase}/rare.png`, isImage: true });
      coverMap.set(-3, { cid: '', thumbUrl: `${preorderBase}/epic.png`, isImage: true });
      coverMap.set(-4, { cid: '', thumbUrl: `${preorderBase}/legendary.png`, isImage: true });
    }

    // Fallback: Episode 0 preorder covers come from Supabase Storage directly
    // Insert missing rarity rows so the UI can render four thumbnails
    let insertedCoverRows = 0;
    if (false && series === 'metaKnyts' && !coverMap.has(0)) {
      const fallbackBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content-media/covers/ep0`;
      const fallbackVariants = [
        { rarity: 'common', filename: 'common.png' },
        { rarity: 'rare', filename: 'rare.png' },
        { rarity: 'epic', filename: 'epic.png' },
        { rarity: 'legendary', filename: 'legendary.png' },
      ];
      const commonThumbUrl = `${fallbackBase}/common.png`;
      coverMap.set(0, { cid: '', thumbUrl: commonThumbUrl, isImage: true });

      for (const variant of fallbackVariants) {
        const coverThumbUrl = `${fallbackBase}/${variant.filename}`;
        try {
          const { error: insertError } = await supabase
            .from('codex_media_assets')
            .insert({
              title: `Episode 0 Cover (${variant.rarity})`,
              episode_number: 0,
              asset_kind: 'cover_image',
              series,
              auto_drive_cid: `supabase:content-media/covers/ep0/${variant.filename}`,
              mime_type: 'image/png',
              encryption_alg: 'AES-256-GCM',
              encryption_iv: randomUUID(),
              variant_name: `ep0_${variant.rarity}_cover`,
              rarity_tier: variant.rarity,
              cover_thumb_url: coverThumbUrl,
              status: 'active',
            })
            .select('id');
          if (insertError) {
            console.error('[CodexStatus] fallback insert error:', insertError);
          } else {
            insertedCoverRows += 1;
          }
        } catch (insertError) {
          console.error('[CodexStatus] Episode 0 fallback insert failed:', insertError);
        }
      }
    }

    if (insertedCoverRows > 0) {
      assetCountsList = assetCountsList.concat(
        Array(insertedCoverRows).fill({ episode_number: 0, asset_kind: 'cover_image' })
      );
    }

    // Build episode status map
    const episodeMap = new Map<number, EpisodeStatus>();
if (series === 'metaKnyts') {
  const preorderPricing = new Map<number, { usd: number; purchaseId: string }>([
    [-1, { usd: 68, purchaseId: 'metaKnyts_preorder_common' }],
    [-2, { usd: 86, purchaseId: 'metaKnyts_preorder_rare' }],
    [-3, { usd: 186, purchaseId: 'metaKnyts_preorder_epic' }],
    [-4, { usd: 2100, purchaseId: 'metaKnyts_preorder_legendary' }],
  ]);
  for (const epNum of [-1, -2, -3, -4]) {
    if (!coverMap.has(epNum) || episodeMap.has(epNum)) continue;
    const meta = metadataMap.get(epNum);
    const pricing = preorderPricing.get(epNum);
    episodeMap.set(epNum, {
      episodeNumber: epNum,
      displayNumber: meta?.displayNumber || `#${epNum}`,
      title: meta?.title,
      purchaseId: pricing?.purchaseId,
      priceUsd: pricing?.usd,
      priceKnyt: pricing ? Math.round(pricing.usd / 1.4) : undefined,
      hasStillMaster: false,
      hasMotionMaster: false,
      hasPrintRare: true,
      hasPrintEpic: false,
      hasPrintLegendary: false,
      hasPrintCommon: false,
      coverCount: 1,
      coverImageCid: coverMap.get(epNum)?.cid,
      coverThumbUrl: coverMap.get(epNum)?.thumbUrl,
      characterCount: 0,
      totalAssets: 1,
    });
  }
}


    // Provide a minimal entry for Episode -1 when fallback covers exist
    if (series === 'metaKnyts' && coverMap.has(fallbackEpisodeNumber) && !episodeMap.has(fallbackEpisodeNumber)) {
      const meta = metadataMap.get(fallbackEpisodeNumber);
      const coverCount = assetCountRows?.filter(
        asset => asset.episode_number === fallbackEpisodeNumber && 
          (asset.asset_kind === 'cover_image' || asset.asset_kind === 'cover_pdf')
      ).length || 0;

      episodeMap.set(fallbackEpisodeNumber, {
        episodeNumber: fallbackEpisodeNumber,
        displayNumber: meta?.displayNumber || '#-1',
        title: meta?.title,
        hasStillMaster: false,
        hasMotionMaster: false,
        hasPrintRare: false,
        hasPrintEpic: false,
        hasPrintLegendary: false,
      hasPrintCommon: false,
        coverCount,
        coverImageCid: coverMap.get(fallbackEpisodeNumber)?.cid,
        coverThumbUrl: coverMap.get(fallbackEpisodeNumber)?.thumbUrl,
        characterCount: 0,
        totalAssets: 0,
      });
    }

    if (false && series === 'metaKnyts' && coverMap.has(0) && !episodeMap.has(0)) {
      const meta = metadataMap.get(0);
      episodeMap.set(0, {
        episodeNumber: 0,
        displayNumber: meta?.displayNumber || '#0',
        title: meta?.title,
        hasStillMaster: false,
        hasMotionMaster: false,
        hasPrintRare: false,
        hasPrintEpic: false,
        hasPrintLegendary: false,
      hasPrintCommon: false,
        coverCount: 1,
        coverImageCid: coverMap.get(0)?.cid,
        coverThumbUrl: coverMap.get(0)?.thumbUrl,
        characterCount: 0,
        totalAssets: 0,
      });
    }

    // Add masters to map
    if (masters) {
      for (const master of masters) {
        const ep = master.episode_number;
        if (!episodeMap.has(ep)) {
          const meta = metadataMap.get(ep);
          episodeMap.set(ep, {
            episodeNumber: ep,
            displayNumber: meta?.displayNumber || `#${ep}`,
            title: meta?.title,
            hasStillMaster: false,
            hasMotionMaster: false,
            hasPrintRare: false,
            hasPrintEpic: false,
            hasPrintLegendary: false,
      hasPrintCommon: false,
            coverCount: 0,
            coverImageCid: coverMap.get(ep)?.cid,
            coverThumbUrl: coverMap.get(ep)?.thumbUrl,
            characterCount: 0,
            totalAssets: 0,
          });
        }
        const status = episodeMap.get(ep)!;
        if (master.content_type === 'episode_still') {
          status.hasStillMaster = true;
          status.stillMasterId = master.id;
          const cid = master.auto_drive_cid as string | null | undefined;
          const liteUrl = master.pdf_lite_url as string | null | undefined;
          const isUrl = typeof cid === 'string' && (cid.startsWith('http://') || cid.startsWith('https://'));
          if (cid && !isUrl) status.stillMasterCid = cid;
          if (liteUrl) status.stillMasterLiteUrl = liteUrl;
        } else if (master.content_type === 'episode_motion') {
          status.hasMotionMaster = true;
          status.motionMasterId = master.id;
          status.motionMasterCid = master.auto_drive_cid;
        } else if (master.content_type === 'episode_print') {
          const cid = master.auto_drive_cid;
          const liteUrl = master.pdf_lite_url as string | null | undefined;
          const isUrl = typeof cid === 'string' && (cid.startsWith('http://') || cid.startsWith('https://'));
          const tier = master.edition_tier;
          if (tier === 'rare') {
            status.hasPrintRare = true;
            status.printRareMasterId = master.id;
            if (!isUrl) status.printRareCid = cid;
            if (liteUrl) status.printRareLiteUrl = liteUrl;
          } else if (tier === 'epic') {
            status.hasPrintEpic = true;
            status.printEpicMasterId = master.id;
            if (!isUrl) status.printEpicCid = cid;
            if (liteUrl) status.printEpicLiteUrl = liteUrl;
          } else if (tier === 'legendary') {
            status.hasPrintLegendary = true;
            status.printLegendaryMasterId = master.id;
            if (!isUrl) status.printLegendaryCid = cid;
            if (liteUrl) status.printLegendaryLiteUrl = liteUrl;
          } else if (tier === 'common' || !tier) {
            status.hasPrintCommon = true;
            status.printCommonMasterId = master.id;
            if (!isUrl) status.printCommonCid = cid;
            if (liteUrl) status.printCommonLiteUrl = liteUrl;
          }
        }
      }
    }

    // Count assets by episode
    if (assetCountRows) {
      for (const asset of assetCountRows) {
        const ep = asset.episode_number;
        if (ep === null) continue;

        if (!episodeMap.has(ep)) {
          const meta = metadataMap.get(ep);
          episodeMap.set(ep, {
            episodeNumber: ep,
            displayNumber: meta?.displayNumber || `#${ep}`,
            title: meta?.title,
            hasStillMaster: false,
            hasMotionMaster: false,
            hasPrintRare: false,
            hasPrintEpic: false,
            hasPrintLegendary: false,
      hasPrintCommon: false,
            coverCount: 0,
            coverImageCid: coverMap.get(ep)?.cid,
            coverThumbUrl: coverMap.get(ep)?.thumbUrl,
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
      totalRaBadges: dbStats.total_ra_badges || 0,
      totalBundles: dbStats.total_bundles || 0,
      totalAllAssets: dbStats.total_all_assets || 0,
    } : {
      // Fallback if DB function not available
      totalStillMasters: masters?.filter(m => m.content_type === 'episode_still').length || 0,
      totalMotionMasters: masters?.filter(m => m.content_type === 'episode_motion').length || 0,
      totalPrintRare: masters?.filter(m => m.content_type === 'episode_print' && m.edition_tier === 'rare').length || 0,
      totalPrintEpic: masters?.filter(m => m.content_type === 'episode_print' && m.edition_tier === 'epic').length || 0,
      totalPrintLegendary: masters?.filter(m => m.content_type === 'episode_print' && m.edition_tier === 'legendary').length || 0,
      totalCovers: (assetCountRows?.filter(a =>
        a.asset_kind === 'cover_pdf' || a.asset_kind === 'cover_image'
      ) ?? []).length,
      totalCharacters: (assetCountRows?.filter(a => a.asset_kind === 'character_poster') ?? []).length,
      totalLoreDocs: (assetCountRows?.filter(a =>
        ['background_lore_doc', 'powers_sheet', 'twenty_one_sats_concept'].includes(a.asset_kind)
      ) ?? []).length,
      totalGameAssets: (assetCountRows?.filter(a =>
        ['game_concept_doc', 'game_still', 'game_video'].includes(a.asset_kind)
      ) ?? []).length,
      totalSocialAssets: (assetCountRows?.filter(a =>
        ['social_campaign_video', 'social_campaign_image'].includes(a.asset_kind)
      ) ?? []).length,
      totalRaBadges: (assetCountRows?.filter(a => a.asset_kind === 'ra_badge') ?? []).length,
      totalBundles: (assetCountRows?.filter(a => a.asset_kind === 'bundle_pack') ?? []).length,
      totalAllAssets: assetCountRows?.length || 0,
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
    });

  } catch (error) {
    console.error('[CodexStatus] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to get status',
    }, { status: 500,  });
  }
}
