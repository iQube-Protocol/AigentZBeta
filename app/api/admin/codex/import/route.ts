/**
 * Admin API: Import Codex Metadata from JSON
 * 
 * POST /api/admin/codex/import
 * 
 * Imports the full metaKnyts codex export JSON with:
 * - characters
 * - knyt_cards
 * - episodes
 * - episode_credits
 * 
 * Supports both file upload and JSON body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Initialize Supabase client
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }
  return createClient(url, key);
}

// Types matching the JSON export
interface Character {
  id: string;
  digiterra_name?: string;
  terra_name?: string;
  profile?: string;
  affiliation?: string;
  height?: string;
  weight?: string;
  origin_ethnicity?: string;
  base?: string;
}

interface KnytCard {
  id: string;
  character_id: string;
  powers?: string;
  primary_weapon?: string;
  secondary_weapons?: string;
  first_appearance?: string;
}

interface Episode {
  id: string;
  season_number?: string;
  issue_number?: string;
  episode_number_raw?: string;
  title: string;
  knytcard_focus?: string;
  synopsis?: string;
  intro_quote?: string;
  editorial_note?: string;
  end_quote?: string;
  cover_ref?: string;
  distribution_channel?: string;
  additional_writers?: string;
  artist?: string;
  colorist?: string;
  letterer?: string;
  // Optional pricing metadata (supports both camelCase and snake_case inputs)
  priceAmount?: number | string;
  price_amount?: number | string;
  paymentType?: 'one-time' | 'subscription' | string;
  payment_type?: 'one-time' | 'subscription' | string;
  paymentSurface?: 'overlay' | 'embedded' | 'liquid' | string;
  payment_surface?: 'overlay' | 'embedded' | 'liquid' | string;
}

interface EpisodeCredits {
  id: string;
  episode_id: string;
  length_raw?: string;
  broadcast?: string;
  creators?: string;
  writers?: string;
  artists?: string;
  colorists?: string;
  letterers?: string;
  copy_editing?: string;
  graphics_and_digital_edits?: string;
  animation?: string;
}

interface CodexExport {
  characters: Character[];
  knyt_cards: KnytCard[];
  episodes: Episode[];
  episode_credits: EpisodeCredits[];
}

// Parse issue number to database episode number (#0 -> 1, #1 -> 2)
function parseIssueNumber(issue?: string): number | null {
  if (!issue) return null;
  const match = issue.match(/#\s*(-?\d+)/);
  if (!match) return null;
  const parsed = parseInt(match[1], 10);
  if (Number.isNaN(parsed)) return null;
  // Preserve negative pre-release episode numbering (e.g. #-1, #-2),
  // while converting documentation #0/#1... to database 1/2...
  return parsed < 0 ? parsed : parsed + 1;
}

type EpisodePricing = {
  amount: number;
  paymentType: 'one-time' | 'subscription';
  paymentSurface: 'overlay' | 'embedded' | 'liquid';
};

function parseEpisodePricing(episode: Episode): EpisodePricing | null {
  const rawAmount = episode.priceAmount ?? episode.price_amount;
  if (rawAmount === undefined || rawAmount === null || String(rawAmount).trim() === '') {
    return null;
  }

  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`Invalid pricing amount "${rawAmount}"`);
  }

  const paymentTypeRaw = (episode.paymentType ?? episode.payment_type ?? 'one-time').toString();
  const paymentSurfaceRaw = (episode.paymentSurface ?? episode.payment_surface ?? 'overlay').toString();

  const paymentType: EpisodePricing['paymentType'] =
    paymentTypeRaw === 'subscription' ? 'subscription' : 'one-time';

  let paymentSurface: EpisodePricing['paymentSurface'] = 'overlay';
  if (paymentSurfaceRaw === 'embedded') paymentSurface = 'embedded';
  if (paymentSurfaceRaw === 'liquid') paymentSurface = 'liquid';

  return {
    amount,
    paymentType,
    paymentSurface,
  };
}

export async function POST(req: NextRequest) {
  try {
    // Skip auth check in development mode
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev) {
      const authHeader = req.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Parse request - support both JSON body and file upload
    let data: CodexExport;
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      const text = await file.text();
      data = JSON.parse(text);
    } else {
      data = await req.json();
    }

    // Validate structure
    if (!data.characters || !data.knyt_cards || !data.episodes || !data.episode_credits) {
      return NextResponse.json({
        error: 'Invalid format. Expected: { characters, knyt_cards, episodes, episode_credits }',
      }, { status: 400 });
    }

    const supabase = getSupabase();
    const series = 'metaKnyts';
    const results = {
      characters: { inserted: 0, errors: 0 },
      knyt_cards: { inserted: 0, errors: 0 },
      episodes: { inserted: 0, errors: 0 },
      episode_credits: { inserted: 0, errors: 0 },
      episode_pricing: { imported: 0, errors: 0 },
    };
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Import characters
    console.log(`[CodexImport] Importing ${data.characters.length} characters...`);
    for (const char of data.characters) {
      try {
        const { error } = await supabase
          .from('codex_characters')
          .upsert({
            id: char.id,
            digiterra_name: char.digiterra_name || null,
            terra_name: char.terra_name || null,
            profile: char.profile || null,
            affiliation: char.affiliation || null,
            height: char.height || null,
            weight: char.weight || null,
            origin_ethnicity: char.origin_ethnicity || null,
            base: char.base || null,
            series,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });

        if (error) throw error;
        results.characters.inserted++;
      } catch (err) {
        results.characters.errors++;
        errors.push(`Character ${char.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // 2. Import KNYT cards
    console.log(`[CodexImport] Importing ${data.knyt_cards.length} KNYT cards...`);
    for (const card of data.knyt_cards) {
      try {
        const { error } = await supabase
          .from('codex_knyt_cards')
          .upsert({
            id: card.id,
            character_id: card.character_id,
            powers: card.powers || null,
            primary_weapon: card.primary_weapon || null,
            secondary_weapons: card.secondary_weapons || null,
            first_appearance: card.first_appearance || null,
            series,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });

        if (error) throw error;
        results.knyt_cards.inserted++;
      } catch (err) {
        results.knyt_cards.errors++;
        errors.push(`KnytCard ${card.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // 3. Import episodes
    console.log(`[CodexImport] Importing ${data.episodes.length} episodes...`);
    for (const ep of data.episodes) {
      try {
        const episodeNumber = parseIssueNumber(ep.issue_number);
        const pricing = parseEpisodePricing(ep);
        
        const { error } = await supabase
          .from('codex_episodes')
          .upsert({
            id: ep.id,
            season_number: ep.season_number || null,
            issue_number: ep.issue_number || null,
            episode_number_raw: ep.episode_number_raw || null,
            episode_number: episodeNumber,
            title: ep.title,
            knytcard_focus: ep.knytcard_focus || null,
            synopsis: ep.synopsis || null,
            intro_quote: ep.intro_quote || null,
            editorial_note: ep.editorial_note || null,
            end_quote: ep.end_quote || null,
            cover_ref: ep.cover_ref || null,
            distribution_channel: ep.distribution_channel || null,
            additional_writers: ep.additional_writers || null,
            artist: ep.artist || null,
            colorist: ep.colorist || null,
            letterer: ep.letterer || null,
            series,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });

        if (error) throw error;
        results.episodes.inserted++;

        // Keep import + upload pricing workflows aligned by storing import pricing in episode_metadata.
        if (pricing && episodeNumber !== null) {
          const displayNumber = ep.issue_number || `#${episodeNumber - 1}`;
          const { error: metadataError } = await supabase.rpc('upsert_episode_metadata', {
            p_episode_number: episodeNumber,
            p_series: series,
            p_title: ep.title,
            p_display_number: displayNumber,
            p_subtitle: null,
            p_synopsis: ep.synopsis || null,
            p_release_date: null,
            p_main_characters: JSON.stringify([]),
            p_supporting_characters: JSON.stringify([]),
            p_themes: JSON.stringify([]),
            p_locations: JSON.stringify([]),
            p_key_events: JSON.stringify([]),
            p_writer: null,
            p_artist: ep.artist || null,
            p_colorist: ep.colorist || null,
            p_letterer: ep.letterer || null,
            p_editor: null,
            p_extra_metadata: JSON.stringify({
              pricing: {
                amount: pricing.amount,
                currency: 'Q¢',
                paymentType: pricing.paymentType,
                paymentSurface: pricing.paymentSurface,
              },
            }),
          });

          if (metadataError) {
            results.episode_pricing.errors++;
            warnings.push(
              `Episode ${ep.id}: pricing metadata import failed (${metadataError.message})`
            );
          } else {
            results.episode_pricing.imported++;
          }
        } else if (pricing && episodeNumber === null) {
          results.episode_pricing.errors++;
          warnings.push(`Episode ${ep.id}: pricing provided but episode number could not be derived from issue_number`);
        }
      } catch (err) {
        results.episodes.errors++;
        errors.push(`Episode ${ep.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // 4. Import episode credits
    console.log(`[CodexImport] Importing ${data.episode_credits.length} episode credits...`);
    for (const credits of data.episode_credits) {
      try {
        const { error } = await supabase
          .from('codex_episode_credits')
          .upsert({
            id: credits.id,
            episode_id: credits.episode_id,
            length_raw: credits.length_raw || null,
            broadcast: credits.broadcast || null,
            creators: credits.creators || null,
            writers: credits.writers || null,
            artists: credits.artists || null,
            colorists: credits.colorists || null,
            letterers: credits.letterers || null,
            copy_editing: credits.copy_editing || null,
            graphics_and_digital_edits: credits.graphics_and_digital_edits || null,
            animation: credits.animation || null,
            series,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });

        if (error) throw error;
        results.episode_credits.inserted++;
      } catch (err) {
        results.episode_credits.errors++;
        errors.push(`EpisodeCredits ${credits.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    const totalInserted = results.characters.inserted + results.knyt_cards.inserted +
                          results.episodes.inserted + results.episode_credits.inserted;
    const totalErrors = results.characters.errors + results.knyt_cards.errors +
                        results.episodes.errors + results.episode_credits.errors;

    console.log(`[CodexImport] Complete: ${totalInserted} inserted, ${totalErrors} errors`);

    return NextResponse.json({
      success: totalErrors === 0,
      message: `Imported ${totalInserted} records with ${totalErrors} errors${results.episode_pricing.errors > 0 ? ` and ${results.episode_pricing.errors} pricing warnings` : ''}`,
      results,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    });

  } catch (error) {
    console.error('[CodexImport] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Import failed',
    }, { status: 500 });
  }
}

// GET endpoint to retrieve imported data
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const collection = searchParams.get('collection');
    const id = searchParams.get('id');
    const series = searchParams.get('series') || 'metaKnyts';

    const supabase = getSupabase();

    if (collection === 'characters') {
      if (id) {
        // Get single character with KNYT card
        const { data, error } = await supabase.rpc('get_codex_character_full', {
          p_character_id: id,
        });
        if (error) throw error;
        return NextResponse.json({ success: true, data: data?.[0] });
      } else {
        const { data, error } = await supabase
          .from('codex_characters')
          .select('*')
          .eq('series', series)
          .order('terra_name');
        if (error) throw error;
        return NextResponse.json({ success: true, count: data?.length, data });
      }
    }

    if (collection === 'episodes') {
      if (id) {
        // Get single episode with full data
        const { data, error } = await supabase.rpc('get_codex_episode_full', {
          p_episode_id: id,
        });
        if (error) throw error;
        return NextResponse.json({ success: true, data: data?.[0] });
      } else {
        const { data, error } = await supabase.rpc('get_codex_episodes_list', {
          p_series: series,
        });
        if (error) throw error;
        return NextResponse.json({ success: true, count: data?.length, data });
      }
    }

    if (collection === 'knyt_cards') {
      const { data, error } = await supabase
        .from('codex_knyt_cards')
        .select('*, character:codex_characters(*)')
        .eq('series', series);
      if (error) throw error;
      return NextResponse.json({ success: true, count: data?.length, data });
    }

    // Default: return summary
    const [chars, cards, eps, credits] = await Promise.all([
      supabase.from('codex_characters').select('id', { count: 'exact' }).eq('series', series),
      supabase.from('codex_knyt_cards').select('id', { count: 'exact' }).eq('series', series),
      supabase.from('codex_episodes').select('id', { count: 'exact' }).eq('series', series),
      supabase.from('codex_episode_credits').select('id', { count: 'exact' }).eq('series', series),
    ]);

    return NextResponse.json({
      success: true,
      series,
      counts: {
        characters: chars.count || 0,
        knyt_cards: cards.count || 0,
        episodes: eps.count || 0,
        episode_credits: credits.count || 0,
      },
    });

  } catch (error) {
    console.error('[CodexImport] GET Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to get data',
    }, { status: 500 });
  }
}
