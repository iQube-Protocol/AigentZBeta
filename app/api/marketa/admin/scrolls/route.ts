import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const contentId = searchParams.get('id');
    // Fetch metaKnyts scrolls content
    let query = supabase
      .from('content')
      .select('*');
    if (contentId) {
      query = query.eq('id', contentId);
    } else {
      query = query
        .contains('placement', { section: 'scrolls', tab: 'metaknyts' })
        .order('created_at', { ascending: true });
    }
    const { data: scrolls, error } = await query;

    if (error) {
      console.error('Error fetching scrolls:', error);
      return NextResponse.json(
        { error: 'Failed to fetch scrolls' },
        { status: 500 }
      );
    }

    // Filter for 21 Awakenings content (Shards)
    const awakeningScrolls = scrolls?.filter(scroll => 
      scroll.title?.includes('Shard #') || 
      scroll.title?.includes('Awakening') ||
      scroll.content?.watch?.video_url?.includes('theqriptopian')
    ) || [];

    // Transform the data for campaign sequence items
    const sequenceItems = awakeningScrolls.map((scroll, index) => {
      const dayNumber = index + 1;
      const assetRef = scroll.content?.watch?.video_url?.match(/id=([^&]+)/)?.[1] || '';
      const description = scroll.content?.read?.text?.substring(0, 200) || 'Part of your 21-day consciousness expansion journey.';
      
      return {
        day_number: dayNumber,
        title: scroll.title,
        description: description,
        asset_ref: `smart_content_qubes:${assetRef}`,
        cta_url: scroll.content?.watch?.video_url || 'https://knyt.ai/claim-reward',
        explainer: dayNumber === 1, // Day 1 is also an explainer
        status: 'ready',
        thumbnail_url: scroll.content?.watch?.thumbnail || 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=450&fit=crop',
        duration_seconds: 300,
        tags: [`awakening`, `day${dayNumber}`]
      };
    });

    return NextResponse.json({
      success: true,
      scrolls: awakeningScrolls,
      sequenceItems: sequenceItems,
      total: awakeningScrolls.length
    });

  } catch (error: any) {
    console.error('Scrolls API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
