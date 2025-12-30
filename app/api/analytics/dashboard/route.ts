/**
 * API Route: Get comprehensive share analytics
 * GET /api/analytics/dashboard
 * 
 * Returns comprehensive analytics data for the admin dashboard
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
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '7d'; // 7d, 30d, 90d
    const limit = parseInt(searchParams.get('limit') || '100');

    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    switch (timeframe) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    // Get overall stats
    const { data: totalStats, error: totalError } = await supabase
      .from('share_analytics')
      .select('*')
      .gte('timestamp', startDate.toISOString());

    if (totalError) throw totalError;

    // Get platform breakdown
    const { data: platformData, error: platformError } = await supabase
      .from('share_analytics')
      .select('platform')
      .gte('timestamp', startDate.toISOString());

    if (platformError) throw platformError;

    // Get top articles
    const { data: topArticles, error: articlesError } = await supabase
      .from('share_analytics_summary')
      .select('*')
      .order('total_shares', { ascending: false })
      .limit(limit);

    if (articlesError) throw articlesError;

    // Get persona leaderboard
    const { data: personaLeaderboard, error: personaError } = await supabase
      .from('persona_sharing_leaderboard')
      .select('*')
      .order('shares_made', { ascending: false })
      .limit(limit);

    if (personaError) throw personaError;

    // Get daily trends
    const { data: dailyTrends, error: trendsError } = await supabase
      .from('platform_analytics')
      .select('*')
      .gte('share_date', startDate.toISOString().split('T')[0])
      .order('share_date', { ascending: true });

    if (trendsError) throw trendsError;

    // Process platform breakdown
    const platformStats = platformData?.reduce((acc: any, item) => {
      acc[item.platform] = (acc[item.platform] || 0) + 1;
      return acc;
    }, {}) || {};

    // Process daily trends
    const trendsByDate = dailyTrends?.reduce((acc: any, item) => {
      if (!acc[item.share_date]) {
        acc[item.share_date] = { date: item.share_date, total: 0, platforms: {} };
      }
      acc[item.share_date].total += item.total_shares;
      acc[item.share_date].platforms[item.platform] = item.total_shares;
      return acc;
    }, {}) || {};

    const analytics = {
      overview: {
        totalShares: totalStats?.length || 0,
        uniqueArticles: new Set(totalStats?.map(s => s.article_id)).size,
        uniquePersonas: new Set(totalStats?.filter(s => s.persona_id).map(s => s.persona_id)).size,
        platforms: Object.keys(platformStats).length,
        timeframe,
        dateRange: {
          start: startDate.toISOString(),
          end: now.toISOString(),
        }
      },
      platformBreakdown: Object.entries(platformStats).map(([platform, count]) => ({
        platform,
        shares: count as number,
        percentage: ((count as number / (totalStats?.length || 1)) * 100).toFixed(1)
      })),
      topArticles: topArticles?.map(article => ({
        id: article.article_id,
        title: article.title || 'Unknown Article',
        totalShares: article.total_shares,
        uniquePersonas: article.unique_personas,
        platformsUsed: article.platforms_used,
        lastShared: article.last_shared
      })) || [],
      personaLeaderboard: personaLeaderboard?.map((persona, index) => ({
        rank: index + 1,
        personaId: persona.persona_id,
        sharesMade: persona.shares_made,
        uniqueArticles: persona.unique_articles_shared,
        platformsUsed: persona.platforms_used,
        lastShared: persona.last_shared
      })) || [],
      dailyTrends: Object.values(trendsByDate).map((trend: any) => ({
        date: trend.date,
        totalShares: trend.total,
        platforms: trend.platforms
      }))
    };

    return NextResponse.json(analytics, { headers: corsHeaders });

  } catch (error) {
    console.error('[Analytics/Dashboard] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch analytics data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}
