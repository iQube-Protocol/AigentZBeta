/**
 * Codex Metadata API
 * 
 * Fetches all codex metadata for the copilot to use as context:
 * - Characters with their KNYT cards
 * - Episodes with synopses and credits
 * - Media assets (covers, masters)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Fetch all characters with their KNYT cards
    const { data: characters, error: charError } = await supabase
      .from('codex_characters')
      .select(`
        id,
        digiterra_name,
        terra_name,
        profile,
        affiliation,
        height,
        weight,
        origin_ethnicity,
        base,
        series
      `)
      .eq('series', 'metaKnyts');

    if (charError) {
      console.error('[CodexMetadata] Characters error:', charError);
    }

    // Fetch KNYT cards
    const { data: knytCards, error: cardError } = await supabase
      .from('codex_knyt_cards')
      .select(`
        id,
        character_id,
        powers,
        primary_weapon,
        secondary_weapons,
        first_appearance
      `)
      .eq('series', 'metaKnyts');

    if (cardError) {
      console.error('[CodexMetadata] KNYT cards error:', cardError);
    }

    // Fetch episodes with credits
    const { data: episodes, error: epError } = await supabase
      .from('codex_episodes')
      .select(`
        id,
        season_number,
        issue_number,
        episode_number,
        title,
        knytcard_focus,
        synopsis,
        intro_quote,
        editorial_note,
        end_quote,
        cover_ref,
        artist,
        colorist,
        letterer
      `)
      .eq('series', 'metaKnyts')
      .eq('is_current', true)
      .order('episode_number');

    if (epError) {
      console.error('[CodexMetadata] Episodes error:', epError);
    }

    // Fetch episode credits
    const { data: credits, error: credError } = await supabase
      .from('codex_episode_credits')
      .select(`
        id,
        episode_id,
        length_raw,
        broadcast,
        creators,
        writers,
        artists,
        colorists,
        letterers,
        animation
      `)
      .eq('series', 'metaKnyts');

    if (credError) {
      console.error('[CodexMetadata] Credits error:', credError);
    }

    // Fetch media assets count
    const { count: coverCount } = await supabase
      .from('codex_media_assets')
      .select('*', { count: 'exact', head: true })
      .eq('asset_type', 'cover');

    const { count: masterCount } = await supabase
      .from('master_content_qubes')
      .select('*', { count: 'exact', head: true });

    // Merge KNYT cards into characters
    const charactersWithCards = (characters || []).map(char => {
      const card = (knytCards || []).find(c => c.character_id === char.id);
      return {
        ...char,
        knyt_card: card || null
      };
    });

    // Merge credits into episodes
    const episodesWithCredits = (episodes || []).map(ep => {
      const credit = (credits || []).find(c => c.episode_id === ep.id);
      return {
        ...ep,
        credits: credit || null
      };
    });

    return NextResponse.json({
      characters: charactersWithCards,
      episodes: episodesWithCredits,
      stats: {
        characterCount: charactersWithCards.length,
        episodeCount: episodesWithCredits.length,
        coverCount: coverCount || 0,
        masterCount: masterCount || 0
      }
    });

  } catch (error) {
    console.error('[CodexMetadata] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch codex metadata' },
      { status: 500 }
    );
  }
}
