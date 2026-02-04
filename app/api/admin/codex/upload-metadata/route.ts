/**
 * Admin API: Upload Episode Metadata
 * 
 * POST /api/admin/codex/upload-metadata
 * 
 * Accepts JSON file or JSON body with episode metadata.
 * Creates versioned entries in episode_metadata table.
 * 
 * IMPORTANT: Episode numbering convention:
 * - Database uses 1-indexed (episode_number = 1, 2, 3...)
 * - Documentation uses 0-indexed ("Episode #0", "Episode #1"...)
 * - If uploading with doc numbers, add 1 to get database number
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Initialize Supabase client
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }
  return createClient(url, key);
}

interface EpisodeMetadataInput {
  // Episode identification - accepts either format
  episode_number?: number;      // Database number (1-based)
  doc_number?: number;          // Documentation number (0-based, e.g., 0 for "Episode #0")
  display_number?: string;      // Display string (e.g., "#0")
  
  // Core metadata
  title: string;
  subtitle?: string;
  synopsis?: string;
  release_date?: string;        // ISO date string
  
  // Characters
  main_characters?: Array<{
    name: string;
    role?: string;
    description?: string;
    powers?: string[];
  }>;
  supporting_characters?: Array<{
    name: string;
    role?: string;
    description?: string;
  }>;
  
  // Story elements
  themes?: string[];
  locations?: Array<{
    name: string;
    description?: string;
  }>;
  key_events?: Array<{
    event: string;
    significance?: string;
  }>;
  
  // Production
  writer?: string;
  artist?: string;
  colorist?: string;
  letterer?: string;
  editor?: string;
  
  // Additional
  extra_metadata?: Record<string, unknown>;
}

interface UploadMetadataRequest {
  series?: string;
  episodes: EpisodeMetadataInput[];
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
    let data: UploadMetadataRequest;
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // File upload
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const series = formData.get('series') as string | null;

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      const text = await file.text();
      try {
        const parsed = JSON.parse(text);
        // Support both array format and object with episodes array
        if (Array.isArray(parsed)) {
          data = { series: series || 'metaKnyts', episodes: parsed };
        } else if (parsed.episodes) {
          data = { series: series || parsed.series || 'metaKnyts', episodes: parsed.episodes };
        } else {
          // Single episode
          data = { series: series || 'metaKnyts', episodes: [parsed] };
        }
      } catch {
        return NextResponse.json({ error: 'Invalid JSON file' }, { status: 400 });
      }
    } else {
      // JSON body
      data = await req.json();
    }

    if (!data.episodes || !Array.isArray(data.episodes) || data.episodes.length === 0) {
      return NextResponse.json({ error: 'No episodes provided' }, { status: 400 });
    }

    const series = data.series || 'metaKnyts';
    const supabase = getSupabase();
    const results: Array<{ episode_number: number; display_number: string; id: string; version: number }> = [];
    const errors: Array<{ episode: number; error: string }> = [];

    for (const episode of data.episodes) {
      try {
        // Determine episode number
        // Priority: episode_number > doc_number + 1
        let episodeNumber: number;
        if (episode.episode_number !== undefined) {
          episodeNumber = episode.episode_number;
        } else if (episode.doc_number !== undefined) {
          // Doc number is 0-based, database is 1-based
          episodeNumber = episode.doc_number + 1;
        } else {
          throw new Error('Either episode_number or doc_number is required');
        }

        // Determine display number
        const displayNumber = episode.display_number || `#${episodeNumber - 1}`;

        if (!episode.title) {
          throw new Error('Title is required');
        }

        // Call upsert function
        const { data: result, error } = await supabase.rpc('upsert_episode_metadata', {
          p_episode_number: episodeNumber,
          p_series: series,
          p_title: episode.title,
          p_display_number: displayNumber,
          p_subtitle: episode.subtitle || null,
          p_synopsis: episode.synopsis || null,
          p_release_date: episode.release_date || null,
          p_main_characters: JSON.stringify(episode.main_characters || []),
          p_supporting_characters: JSON.stringify(episode.supporting_characters || []),
          p_themes: JSON.stringify(episode.themes || []),
          p_locations: JSON.stringify(episode.locations || []),
          p_key_events: JSON.stringify(episode.key_events || []),
          p_writer: episode.writer || null,
          p_artist: episode.artist || null,
          p_colorist: episode.colorist || null,
          p_letterer: episode.letterer || null,
          p_editor: episode.editor || null,
          p_extra_metadata: JSON.stringify(episode.extra_metadata || {}),
        });

        if (error) {
          throw error;
        }

        // Get the version number
        const { data: versionData } = await supabase
          .from('episode_metadata')
          .select('version')
          .eq('id', result)
          .single();

        results.push({
          episode_number: episodeNumber,
          display_number: displayNumber,
          id: result,
          version: versionData?.version || 1,
        });

        console.log(`[UploadMetadata] Upserted episode ${episodeNumber} (${displayNumber}): ${episode.title}`);

      } catch (err) {
        const episodeNum = episode.episode_number || (episode.doc_number !== undefined ? episode.doc_number + 1 : 0);
        errors.push({
          episode: episodeNum,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        console.error(`[UploadMetadata] Error for episode ${episodeNum}:`, err);
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      series,
      uploaded: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('[UploadMetadata] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Upload failed',
    }, { status: 500 });
  }
}

// GET endpoint to retrieve current metadata
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const series = searchParams.get('series') || 'metaKnyts';
    const episodeNumber = searchParams.get('episode');

    const supabase = getSupabase();

    if (episodeNumber) {
      // Get single episode
      const { data, error } = await supabase.rpc('get_episode_metadata', {
        p_episode_number: parseInt(episodeNumber, 10),
        p_series: series,
      });

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        data: data?.[0] || null,
      });
    } else {
      // Get all episodes
      const { data, error } = await supabase.rpc('get_all_episode_metadata', {
        p_series: series,
      });

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        series,
        count: data?.length || 0,
        episodes: data || [],
      });
    }
  } catch (error) {
    console.error('[GetMetadata] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to get metadata',
    }, { status: 500 });
  }
}
