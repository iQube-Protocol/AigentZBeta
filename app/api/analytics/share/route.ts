/**
 * API Route: Track Article Share Analytics
 * POST /api/analytics/share
 * 
 * Tracks when articles are shared across different platforms
 * Includes persona tracking and deep link analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ShareAnalyticsData {
  articleId: string;
  personaId?: string;
  platform: string;
  timestamp: string;
  deepLink: string;
  userAgent?: string;
  referrer?: string;
}

export async function POST(request: NextRequest) {
  try {
    const data: ShareAnalyticsData = await request.json();
    
    console.log('[Analytics/Share] Tracking share:', {
      articleId: data.articleId,
      platform: data.platform,
      personaId: data.personaId,
      timestamp: data.timestamp,
    });

    // Validate required fields
    if (!data.articleId || !data.platform || !data.timestamp) {
      return NextResponse.json({ 
        error: 'Missing required fields: articleId, platform, timestamp' 
      }, { status: 400,  });
    }

    // Store in Supabase analytics table
    const { error } = await supabase
      .from('share_analytics')
      .insert({
        article_id: data.articleId,
        persona_id: data.personaId || null,
        platform: data.platform,
        timestamp: data.timestamp,
        deep_link: data.deepLink,
        user_agent: data.userAgent || null,
        referrer: data.referrer || null,
        ip_address: request.ip || null,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[Analytics/Share] Database error:', error);
      return NextResponse.json({ 
        error: 'Failed to store analytics',
        details: error.message 
      }, { status: 500,  });
    }

    // Also update share count in content table
    try {
      await supabase.rpc('increment_share_count', {
        content_id: data.articleId
      });
    } catch (error) {
      console.warn('[Analytics/Share] Failed to increment share count:', error);
    }

    return NextResponse.json({
      success: true,
      tracked: {
        articleId: data.articleId,
        platform: data.platform,
        personaId: data.personaId,
        timestamp: data.timestamp,
      }
    });

  } catch (error) {
    console.error('[Analytics/Share] Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500,  });
  }
}

export async function OPTIONS() {
  return new Response(null);
}
