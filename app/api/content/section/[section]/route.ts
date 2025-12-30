/**
 * API Route: Get Content by Section
 * GET /api/content/section/[section]
 * 
 * Returns live content from the database for any section
 * Supports optional tab query parameter for tabbed sections
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Valid sections
const VALID_SECTIONS = [
  'home-hero',
  'latest-news', 
  'second-hero',
  'pennydrops',
  'scrolls',
  '21knowdz',
  'staybull'
];

export async function GET(
  request: NextRequest,
  { params }: { params: { section: string } }
) {
  try {
    const section = params.section;
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab');
    
    // Validate section
    if (!VALID_SECTIONS.includes(section)) {
      return NextResponse.json({ 
        error: `Invalid section: ${section}. Valid sections: ${VALID_SECTIONS.join(', ')}`
      }, { status: 400, headers: corsHeaders });
    }

    console.log(`[Content/${section}] Fetching content from database${tab ? ` (tab: ${tab})` : ''}`);
    
    // Build query - fetch content with matching section in placement
    let query = supabase
      .from('content')
      .select('*')
      .contains('placement', { section })
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(50);

    // Add tab filter if provided
    if (tab) {
      query = supabase
        .from('content')
        .select('*')
        .contains('placement', { section, tab })
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(50);
    }

    const { data: content, error } = await query;

    if (error) {
      console.error(`[Content/${section}] Database error:`, error);
      return NextResponse.json({ 
        error: 'Failed to fetch content',
        details: error.message
      }, { status: 500, headers: corsHeaders });
    }

    console.log(`[Content/${section}] Found ${content?.length || 0} published items`);

    // Sort by position if available
    const sortedContent = (content || []).sort((a: any, b: any) => {
      const posA = a.placement?.position || 999;
      const posB = b.placement?.position || 999;
      return posA - posB;
    });

    // Transform to match Liquid UI format expected by frontend
    const transformedContent = sortedContent.map((item: any) => {
      const placement = item.placement || {};
      const modalities = item.modalities || {};
      
      // Determine badge based on section/tab
      let badge = 'ARTICLE';
      if (section === 'pennydrops') badge = 'Q¢';
      else if (placement.tab === 'metaknyts') badge = 'METAKNYTS';
      else if (placement.tab === 'synthsims') badge = 'SYNTHSIMS';
      else if (placement.tab === 'dev' || placement.tab === 'developer') badge = 'DEV';
      else if (placement.tab === 'creative') badge = 'CREATIVE';
      else if (placement.tab === 'exec' || placement.tab === 'executive') badge = 'EXEC';
      else if (section === 'latest-news') badge = 'NEWS';
      else if (section === 'home-hero' || section === 'second-hero') badge = 'HERO';
      
      return {
        id: item.id,
        content_id: item.id,
        slug: item.slug || item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title: item.title,
        subtitle: item.excerpt,
        excerpt: item.excerpt,
        status: item.status,
        tags: item.tags || [],
        badge,
        // Image from thumbnail field
        image: item.thumbnail,
        imageScale: placement.imageScale || 100,
        imageX: placement.imageX || 50,
        imageY: placement.imageY || 50,
        position: placement.position || 1,
        // Pass through modalities from database
        modalities: {
          read: modalities.read ? {
            available: true,
            text: modalities.read.text,
            duration: modalities.read.duration || '5 min read',
          } : undefined,
          watch: modalities.watch ? {
            available: true,
            video_url: modalities.watch.video_url,
            duration: modalities.watch.duration,
            type: 'hosted',
          } : undefined,
          listen: modalities.listen ? {
            available: true,
            audio_url: modalities.listen.audio_url,
            duration: modalities.listen.duration,
          } : undefined,
          link: modalities.link ? {
            available: true,
            url: modalities.link.url,
            allow_embed: modalities.link.allow_embed,
          } : undefined,
        },
        contentBlocks: [],
        created_at: item.created_at,
        published_at: item.published_at
      };
    });

    return NextResponse.json({
      content: transformedContent,
      count: transformedContent.length,
      section,
      tab: tab || null,
      source: 'database'
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[Content] Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}
