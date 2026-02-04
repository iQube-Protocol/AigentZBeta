/**
 * Partner Asset Management API
 * 
 * Enables partners to discover, reference, and use QubeBase content in their campaigns
 * Provides asset catalog, resolution, and usage analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface RouteContext {
  params: Promise<Record<string, never>>;
}

// Initialize Supabase client with marketa schema
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: {
      schema: 'marketa'
    }
  }
);

/**
 * GET /api/marketa/admin/assets
 * 
 * Query parameters:
 * - action: catalog|resolve|analytics|usage
 * - asset_ref: Asset reference to resolve
 * - app_filter: Filter by app (Qriptopian, metaKnyts, etc.)
 * - content_type_filter: Filter by content type
 * - tenant_id: Filter by tenant for usage analytics
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'catalog';
    const personaId = request.headers.get('x-persona-id');
    const tenantId = request.headers.get('x-tenant-id');

    // Validate admin access
    if (!personaId || !tenantId) {
      return NextResponse.json(
        { success: false, error: 'Missing persona or tenant identification' },
        { status: 401 }
      );
    }

    // Set tenant context for RLS
    await supabase.rpc('set_tenant_context', { p_tenant_id: tenantId });

    switch (action) {
      case 'catalog':
        return await handleAssetCatalog(searchParams);
      
      case 'resolve':
        return await handleAssetResolution(searchParams);
      
      case 'analytics':
        return await handleAssetAnalytics(searchParams);
      
      case 'usage':
        return await handleAssetUsage(searchParams);
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Asset management API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/marketa/admin/assets
 * 
 * Create or update asset references in campaigns
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const body = await request.json();
    const personaId = request.headers.get('x-persona-id');
    const tenantId = request.headers.get('x-tenant-id');

    // Validate admin access
    if (!personaId || !tenantId) {
      return NextResponse.json(
        { success: false, error: 'Missing persona or tenant identification' },
        { status: 401 }
      );
    }

    // Set tenant context for RLS
    await supabase.rpc('set_tenant_context', { p_tenant_id: tenantId });

    const { action } = body;

    switch (action) {
      case 'validate_asset_refs':
        return await handleAssetValidation(body);
      
      case 'bulk_asset_import':
        return await handleBulkAssetImport(body);
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Asset management POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// =============================================================================
// HANDLER FUNCTIONS
// =============================================================================

async function handleAssetCatalog(searchParams: URLSearchParams) {
  const appFilter = searchParams.get('app_filter');
  const contentTypeFilter = searchParams.get('content_type_filter');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const { data, error } = await supabase.rpc('get_partner_asset_catalog', {
    p_tenant_id: null, // Available to all tenants
    p_app_filter: appFilter,
    p_content_type_filter: contentTypeFilter
  });

  if (error) {
    console.error('Asset catalog error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  // Apply pagination
  const paginatedData = data?.slice(offset, offset + limit) || [];

  return NextResponse.json({
    success: true,
    data: {
      assets: paginatedData,
      pagination: {
        total: data?.length || 0,
        limit,
        offset,
        has_more: (offset + limit) < (data?.length || 0)
      },
      filters: {
        app_filter: appFilter,
        content_type_filter: contentTypeFilter
      }
    }
  });
}

async function handleAssetResolution(searchParams: URLSearchParams) {
  const assetRef = searchParams.get('asset_ref');

  if (!assetRef) {
    return NextResponse.json(
      { success: false, error: 'asset_ref parameter is required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc('resolve_asset_reference', {
    p_asset_ref: assetRef
  });

  if (error) {
    console.error('Asset resolution error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Asset not found or not available' },
      { status: 404 }
    );
  }

  const asset = data[0];

  return NextResponse.json({
    success: true,
    data: {
      assetRef,
      content_id: asset.content_id,
      title: asset.title,
      description: asset.description,
      app: asset.app,
      content_type: asset.content_type,
      thumbnail_url: asset.thumbnail_url,
      duration_seconds: asset.duration_seconds,
      external_url: asset.external_url,
      modalities: asset.modalities,
      status: asset.status,
      availability: asset.status === 'published' ? 'available' : 'unavailable'
    }
  });
}

async function handleAssetAnalytics(searchParams: URLSearchParams) {
  const assetRef = searchParams.get('asset_ref');

  if (!assetRef) {
    return NextResponse.json(
      { success: false, error: 'asset_ref parameter is required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc('get_asset_usage_analytics', {
    p_asset_ref: assetRef
  });

  if (error) {
    console.error('Asset analytics error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  const analytics = data?.[0] || {
    campaign_count: 0,
    total_deliveries: 0,
    unique_tenants: 0,
    last_used: null,
    performance_summary: {}
  };

  return NextResponse.json({
    success: true,
    data: {
      assetRef,
      analytics,
      insights: generateAssetInsights(analytics)
    }
  });
}

async function handleAssetUsage(searchParams: URLSearchParams) {
  const campaignId = searchParams.get('campaign_id');
  const tenantId = searchParams.get('tenant_id');

  if (!campaignId) {
    return NextResponse.json(
      { success: false, error: 'campaign_id parameter is required' },
      { status: 400 }
    );
  }

  let query = supabase
    .from('v_campaign_assets')
    .select('*')
    .eq('campaign_id', campaignId);

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data, error } = await query.order('day_number', { ascending: true });

  if (error) {
    console.error('Asset usage error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      campaign_id: campaignId,
      assets: data || [],
      summary: {
        total_assets: data?.length || 0,
        available_assets: data?.filter(a => a.asset_status === 'published').length || 0,
        video_assets: data?.filter(a => a.content_type === 'video').length || 0,
        article_assets: data?.filter(a => a.content_type === 'article').length || 0
      }
    }
  });
}

async function handleAssetValidation(body: any) {
  const { asset_refs } = body;

  if (!Array.isArray(asset_refs)) {
    return NextResponse.json(
      { success: false, error: 'asset_refs must be an array' },
      { status: 400 }
    );
  }

  const validationResults = await Promise.all(
    asset_refs.map(async (assetRef: string) => {
      const { data, error } = await supabase.rpc('resolve_asset_reference', {
        p_asset_ref: assetRef
      });

      return {
        asset_ref: assetRef,
        valid: !error && data && data.length > 0,
        asset: data?.[0] || null,
        error: error?.message || null
      };
    })
  );

  const validAssets = validationResults.filter(r => r.valid);
  const invalidAssets = validationResults.filter(r => !r.valid);

  return NextResponse.json({
    success: true,
    data: {
      validation_results: validationResults,
      summary: {
        total: asset_refs.length,
        valid: validAssets.length,
        invalid: invalidAssets.length
      }
    }
  });
}

async function handleBulkAssetImport(body: any) {
  const { campaign_id, assets } = body;

  if (!campaign_id || !Array.isArray(assets)) {
    return NextResponse.json(
      { success: false, error: 'campaign_id and assets array are required' },
      { status: 400 }
    );
  }

  const importResults = await Promise.all(
    assets.map(async (asset: any) => {
      try {
        const { data, error } = await supabase
          .from('marketa_sequence_items')
          .upsert({
            campaign_id,
            day_number: asset.day_number,
            title: asset.title,
            description: asset.description,
            asset_ref: asset.asset_ref,
            copy_variants: asset.copy_variants || {},
            cta_url: asset.cta_url,
            explainer: asset.explainer || false,
            thumbnail_url: asset.thumbnail_url,
            duration_seconds: asset.duration_seconds,
            tags: asset.tags || [],
            status: 'ready'
          })
          .select()
          .single();

        return {
          asset_ref: asset.asset_ref,
          success: !error,
          data: data,
          error: error?.message || null
        };
      } catch (err: any) {
        return {
          asset_ref: asset.asset_ref,
          success: false,
          data: null,
          error: err.message
        };
      }
    })
  );

  const successfulImports = importResults.filter(r => r.success);
  const failedImports = importResults.filter(r => !r.success);

  return NextResponse.json({
    success: true,
    data: {
      import_results: importResults,
      summary: {
        total: assets.length,
        imported: successfulImports.length,
        failed: failedImports.length
      }
    }
  });
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function generateAssetInsights(analytics: any) {
  const insights = [];

  if (analytics.campaign_count === 0) {
    insights.push({
      type: 'opportunity',
      message: 'This asset has not been used in any campaigns yet',
      recommendation: 'Consider featuring this content in a partner campaign'
    });
  }

  if (analytics.total_deliveries > 0) {
    const engagementRate = analytics.performance_summary?.avg_engagement_rate;
    if (engagementRate && engagementRate > 50) {
      insights.push({
        type: 'performance',
        message: `High engagement rate (${engagementRate.toFixed(1)}%)`,
        recommendation: 'This content performs well - consider using it in more campaigns'
      });
    } else if (engagementRate && engagementRate < 20) {
      insights.push({
        type: 'optimization',
        message: `Low engagement rate (${engagementRate.toFixed(1)}%)`,
        recommendation: 'Consider updating the copy or targeting for this content'
      });
    }
  }

  if (analytics.unique_tenants > 5) {
    insights.push({
      type: 'popularity',
      message: `Used by ${analytics.unique_tenants} different partners`,
      recommendation: 'This is a proven asset - highlight it in the partner catalog'
    });
  }

  return insights;
}
