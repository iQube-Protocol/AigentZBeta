/**
 * API: Fetch Codex Media Assets by kind
 * GET /api/content/assets?kinds=background_lore_doc,twenty_one_sats_concept
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// CORS headers for cross-origin requests from thin client
export async function OPTIONS() {
  return new NextResponse(null);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const kindsParam = searchParams.get('kinds');
    const episodeNumber = searchParams.get('episode');
    
    if (!kindsParam) {
      return NextResponse.json({ error: 'Missing kinds parameter' }, { status: 400,  });
    }

    const kinds = kindsParam.split(',').map(k => k.trim());

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabase
      .from('codex_media_assets')
      .select('id, title, asset_kind, auto_drive_cid, episode_number, display_mode, extracted_text, created_at')
      .in('asset_kind', kinds)
      .order('created_at', { ascending: false });

    if (episodeNumber) {
      query = query.eq('episode_number', parseInt(episodeNumber, 10));
    }

    const { data, error } = await query;

    if (error) {
      console.error('[assets] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500,  });
    }

    return NextResponse.json({ assets: data || [] });
  } catch (err) {
    console.error('[assets] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500,  });
  }
}
