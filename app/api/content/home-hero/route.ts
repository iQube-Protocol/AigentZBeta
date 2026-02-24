/**
 * API Route: Get Home Hero Content
 * GET /api/content/home-hero
 * 
 * Returns live home hero articles from the database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    console.log('[HomeHero] Fetching live home hero content from database');
    
    // Fetch published home hero content from database
    // The placement field is a JSONB column containing { section, tab, position, imageScale, imageX, imageY }
    const { data: heroContent, error } = await supabase
      .from('content')
      .select('*')
      .contains('placement', { section: 'home-hero' })
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[HomeHero] Database error:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch home hero content',
        details: error.message
      }, { status: 500,  });
    }

    console.log(`[HomeHero] Found ${heroContent?.length || 0} published home hero articles`);

    // Sort by position if available
    const sortedContent = (heroContent || []).sort((a: any, b: any) => {
      const posA = a.placement?.position || 999;
      const posB = b.placement?.position || 999;
      return posA - posB;
    });

    // Transform to match Liquid UI format expected by frontend
    const transformedContent = sortedContent.map((item: any) => {
      const placement = item.placement || {};
      const modalities = item.modalities || {};
      
      return {
        id: item.id,
        content_id: item.id,
        slug: item.slug || item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title: item.title,
        excerpt: item.excerpt,
        status: item.status,
        tags: item.tags || [],
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
        created_at: item.created_at,
        published_at: item.published_at
      };
    });

    return NextResponse.json({
      content: transformedContent,
      count: transformedContent.length,
      source: 'database'
    });

  } catch (error) {
    console.error('[HomeHero] Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500,  });
  }
}

export async function OPTIONS() {
  return new Response(null);
}
