/**
 * Video Segments API
 * Fetches motion comic segments for an episode
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const episodeId = req.nextUrl.searchParams.get('episodeId');
  
  if (!episodeId) {
    return NextResponse.json({ error: 'episodeId required' }, { status: 400 });
  }

  const { data: segments, error } = await supabase
    .from('codex_motion_segments')
    .select('id, segment_number, title, auto_drive_cid, is_preview, price_knyt')
    .eq('episode_id', episodeId)
    .order('segment_number', { ascending: true });

  if (error) {
    console.error('[VideoSegments] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(segments || []);
}
