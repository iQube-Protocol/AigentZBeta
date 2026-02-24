/**
 * KNYT Cards API
 * 
 * GET /api/codex/knyt-cards
 * 
 * Fetches KNYT card images (character_poster and powers_sheet) from codex_media_assets
 * and joins with character data from codex_characters and codex_knyt_cards.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// CORS headers for cross-origin requests from Vite dev server
export async function OPTIONS() {
  return new NextResponse(null, { status: 204,  });
}

export interface KnytCardAsset {
  id: string;
  title: string;
  episodeNumber: number | null;
  assetKind: 'character_poster' | 'powers_sheet';
  autoDriveCid: string;
  mimeType: string;
  // Character data if linked
  characterId?: string;
  characterName?: string;
  digiterraName?: string;
  affiliation?: string;
  powers?: string;
  primaryWeapon?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const episodeNumber = searchParams.get('episode');
    const requestedSeries = searchParams.get('series') || 'metaKnyts';
    const normalizedSeries = requestedSeries.trim();
    const seriesCandidates = Array.from(
      new Set([
        normalizedSeries,
        'metaKnyts',
        'metaknyts',
        'metaKNYTS',
      ].filter(Boolean))
    );
    const parsedEpisodeNumber = episodeNumber ? Number.parseInt(episodeNumber, 10) : null;
    const hasEpisodeFilter = parsedEpisodeNumber !== null && !Number.isNaN(parsedEpisodeNumber);

    // Fetch character_poster and powers_sheet assets
    let query = supabase
      .from('codex_media_assets')
      .select(`
        id,
        title,
        episode_number,
        asset_kind,
        auto_drive_cid,
        mime_type,
        series
      `)
      .in('series', seriesCandidates)
      .eq('status', 'active')
      .in('asset_kind', ['character_poster', 'powers_sheet'])
      .order('episode_number', { ascending: true })
      .order('title', { ascending: true });

    if (hasEpisodeFilter) {
      query = query.eq('episode_number', parsedEpisodeNumber);
    }

    let { data: assets, error: assetsError } = await query;
    let usedUnscopedAssetsFallback = false;

    if (assetsError) {
      console.error('[KnytCards] Assets query error:', assetsError);
      throw assetsError;
    }

    if (!assets?.length) {
      let fallbackQuery = supabase
        .from('codex_media_assets')
        .select(`
          id,
          title,
          episode_number,
          asset_kind,
          auto_drive_cid,
          mime_type,
          series
        `)
        .in('asset_kind', ['character_poster', 'powers_sheet'])
        .order('episode_number', { ascending: true })
        .order('title', { ascending: true });

      if (hasEpisodeFilter) {
        fallbackQuery = fallbackQuery.eq('episode_number', parsedEpisodeNumber);
      }

      const { data: fallbackAssets, error: fallbackError } = await fallbackQuery;
      if (fallbackError) {
        console.error('[KnytCards] Fallback assets query error:', fallbackError);
      } else {
        assets = fallbackAssets ?? [];
        usedUnscopedAssetsFallback = true;
      }
    }

    // Fetch all characters for matching
    let { data: characters } = await supabase
      .from('codex_characters')
      .select('id, terra_name, digiterra_name, affiliation')
      .in('series', seriesCandidates);

    if (!characters?.length) {
      const { data: fallbackCharacters } = await supabase
        .from('codex_characters')
        .select('id, terra_name, digiterra_name, affiliation');
      characters = fallbackCharacters ?? [];
    }

    // Fetch all KNYT cards for powers/weapons
    let { data: knytCards } = await supabase
      .from('codex_knyt_cards')
      .select('id, character_id, powers, primary_weapon')
      .in('series', seriesCandidates);

    if (!knytCards?.length) {
      const { data: fallbackKnytCards } = await supabase
        .from('codex_knyt_cards')
        .select('id, character_id, powers, primary_weapon');
      knytCards = fallbackKnytCards ?? [];
    }

    if (usedUnscopedAssetsFallback && (assets?.length ?? 0) > 0 && (characters?.length ?? 0) > 0) {
      const nameNeedles = new Set(
        (characters ?? [])
          .flatMap((character) => [character.terra_name, character.digiterra_name])
          .map((value) => (value || '').trim().toLowerCase())
          .filter(Boolean)
      );
      if (nameNeedles.size > 0) {
        assets = assets!.filter((asset) => {
          const titleLower = (asset.title || '').toLowerCase();
          for (const needle of nameNeedles) {
            if (titleLower.includes(needle) || needle.includes(titleLower)) return true;
          }
          return false;
        });
      }
    }

    // Build character lookup maps
    const characterMap = new Map(
      (characters || []).map(c => [c.id, c])
    );
    const knytCardMap = new Map(
      (knytCards || []).map(k => [k.character_id, k])
    );

    // Transform assets and try to match with characters
    const knytCardAssets: KnytCardAsset[] = (assets || []).map(asset => {
      // Try to find matching character by title
      const titleLower = asset.title.toLowerCase();
      let matchedCharacter = null;
      let matchedKnytCard = null;

      for (const [charId, char] of characterMap) {
        const terraLower = (char.terra_name || '').toLowerCase();
        const digiterraLower = (char.digiterra_name || '').toLowerCase();
        
        if (titleLower.includes(terraLower) || titleLower.includes(digiterraLower) ||
            terraLower.includes(titleLower) || digiterraLower.includes(titleLower)) {
          matchedCharacter = char;
          matchedKnytCard = knytCardMap.get(charId);
          break;
        }
      }

      return {
        id: asset.id,
        title: asset.title,
        episodeNumber: asset.episode_number,
        assetKind: asset.asset_kind as 'character_poster' | 'powers_sheet',
        autoDriveCid: asset.auto_drive_cid,
        mimeType: asset.mime_type,
        characterId: matchedCharacter?.id,
        characterName: matchedCharacter?.terra_name,
        digiterraName: matchedCharacter?.digiterra_name,
        affiliation: matchedCharacter?.affiliation,
        powers: matchedKnytCard?.powers,
        primaryWeapon: matchedKnytCard?.primary_weapon,
      };
    });

    // Group by episode for easier rendering
    const byEpisode = new Map<number, { posters: KnytCardAsset[]; sheets: KnytCardAsset[] }>();
    
    for (const asset of knytCardAssets) {
      const ep = asset.episodeNumber || 0;
      if (!byEpisode.has(ep)) {
        byEpisode.set(ep, { posters: [], sheets: [] });
      }
      const group = byEpisode.get(ep)!;
      if (asset.assetKind === 'character_poster') {
        group.posters.push(asset);
      } else {
        group.sheets.push(asset);
      }
    }

    // Convert to sorted array
    const episodeGroups = Array.from(byEpisode.entries())
      .sort(([a], [b]) => a - b)
      .map(([episodeNumber, assets]) => ({
        episodeNumber,
        displayNumber: `#${episodeNumber - 1}`,
        posters: assets.posters,
        sheets: assets.sheets,
        totalCards: assets.posters.length + assets.sheets.length,
      }));

    return NextResponse.json({
      success: true,
      series: normalizedSeries,
      totalPosters: knytCardAssets.filter(a => a.assetKind === 'character_poster').length,
      totalSheets: knytCardAssets.filter(a => a.assetKind === 'powers_sheet').length,
      totalCards: knytCardAssets.length,
      cards: knytCardAssets,
      byEpisode: episodeGroups,
    });

  } catch (error) {
    console.error('[KnytCards] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch KNYT cards' },
      { status: 500,  }
    );
  }
}
