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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET(request: NextRequest) {
  try {
    console.log('[HomeHero] Fetching live home hero content from database');
    
    // Fetch published home hero content from database
    const { data: heroContent, error } = await supabase
      .from('content')
      .select(`
        id,
        title,
        excerpt,
        content,
        status,
        published_at,
        image_url,
        image_scale,
        image_x,
        image_y,
        content_type,
        tags,
        created_at,
        updated_at
      `)
      .eq('domain', 'home')
      .eq('placement->>\'section\'', 'home-hero')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(10); // Limit to 10 most recent articles

    if (error) {
      console.error('[HomeHero] Database error:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch home hero content' 
      }, { status: 500, headers: corsHeaders });
    }

    console.log(`[HomeHero] Found ${heroContent?.length || 0} published home hero articles`);

    // Transform to match Liquid UI format
    const transformedContent = (heroContent || []).map(item => ({
      id: item.id,
      content_id: item.id,
      slug: item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: item.title,
      excerpt: item.excerpt,
      status: item.status,
      content_type: item.content_type,
      tags: item.tags || [],
      image: item.image_url,
      imageScale: item.image_scale || 100,
      imageX: item.image_x || 50,
      imageY: item.image_y || 50,
      modalities: {
        read: {
          available: true,
          duration: '5 min read',
          word_count_approx: item.content?.split(' ').length || 500,
          content_preview: item.excerpt || '',
          content_ref: {
            type: 'database',
            ref_id: item.id
          }
        }
      },
      created_at: item.created_at,
      published_at: item.published_at
    }));

    return NextResponse.json({
      content: transformedContent,
      count: transformedContent.length,
      source: 'database'
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[HomeHero] Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}
