import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Performance Aggregation API
 * Collects performance data from all partner tenants and aggregates it in AGQ
 * Ensures AGQ remains the comprehensive source of truth across all estates
 */

interface PerformanceAggregationRequest {
  campaign_id: string;
  tenant_id: string;
  performance_data: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    conversions: number;
    revenue: number;
    cost?: number;
  };
  metadata?: {
    platform: string;
    segment_id?: string;
    a_b_test_variant?: string;
    lvb_version?: string;
    sync_timestamp: string;
  };
}

interface AggregatedPerformanceResponse {
  campaign_id: string;
  total_metrics: {
    total_sent: number;
    total_delivered: number;
    total_opened: number;
    total_clicked: number;
    total_conversions: number;
    total_revenue: number;
    total_cost: number;
    delivery_rate: number;
    open_rate: number;
    click_rate: number;
    conversion_rate: number;
    roi: number;
  };
  tenant_breakdown: Array<{
    tenant_id: string;
    tenant_name: string;
    metrics: any;
    contribution_percentage: number;
  }>;
  insights: {
    top_performing_tenant: string;
    best_conversion_rate: number;
    total_roi: number;
    performance_trend: 'improving' | 'declining' | 'stable';
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: PerformanceAggregationRequest = await request.json();
    const personaId = request.headers.get('x-persona-id');

    if (!personaId) {
      return NextResponse.json(
        { error: 'Missing persona identification' },
        { status: 401 }
      );
    }

    // Get persona and tenant info
    const { data: persona, error: personaError } = await supabase
      .from('crm_personas')
      .select('tenant_id, crm_tenants(id, name, type)')
      .eq('id', personaId)
      .single();

    if (personaError || !persona) {
      return NextResponse.json(
        { error: 'Invalid persona' },
        { status: 401 }
      );
    }

    const { campaign_id, tenant_id, performance_data, metadata } = body;

    // Validate tenant matches persona's tenant
    if (tenant_id !== persona.tenant_id) {
      return NextResponse.json(
        { error: 'Tenant mismatch' },
        { status: 403 }
      );
    }

    // Validate campaign exists and tenant is participant
    const { data: campaignValidation, error: campaignError } = await supabase
      .from('marketa_campaigns')
      .select(`
        id,
        status,
        marketa_multi_tenant_campaigns(
          owner_tenant_id,
          participating_tenants,
          is_multi_tenant
        )
      `)
      .eq('id', campaign_id)
      .single();

    if (campaignError) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    const multiTenantInfo = Array.isArray(campaignValidation.marketa_multi_tenant_campaigns)
      ? campaignValidation.marketa_multi_tenant_campaigns[0]
      : campaignValidation.marketa_multi_tenant_campaigns;
    if (multiTenantInfo?.is_multi_tenant) {
      const isOwner = multiTenantInfo.owner_tenant_id === tenant_id;
      const isParticipant = multiTenantInfo.participating_tenants?.includes(tenant_id);
      
      if (!isOwner && !isParticipant) {
        return NextResponse.json(
          { error: 'Tenant not authorized for this campaign' },
          { status: 403 }
        );
      }
    }

    // Update or insert performance metrics for this tenant
    const { data: metricsRecord, error: metricsError } = await supabase
      .from('marketa_campaign_metrics')
      .upsert({
        campaign_id,
        tenant_id,
        sent: performance_data.sent,
        delivered: performance_data.delivered,
        opened: performance_data.opened,
        clicked: performance_data.clicked,
        conversions: performance_data.conversions,
        revenue: performance_data.revenue,
        cost: performance_data.cost || 0,
        updated_at: new Date().toISOString(),
        metadata: {
          ...metadata,
          last_sync_from_lvb: new Date().toISOString(),
          sync_source: 'lvb_bridge'
        }
      })
      .select()
      .single();

    if (metricsError) {
      console.error('Metrics update error:', metricsError);
      return NextResponse.json(
        { error: 'Failed to update performance metrics' },
        { status: 500 }
      );
    }

    // Track the sync in LVB sync tracking
    await supabase.rpc('track_lvb_sync', {
      p_tenant_id: tenant_id,
      p_sync_type: 'performance',
      p_source_id: campaign_id,
      p_direction: 'lvb_to_agq',
      p_data_payload: performance_data,
      p_lvb_version: metadata?.lvb_version,
      p_lvb_build: metadata?.lvb_version
    });

    // Create delivery log entry
    await supabase
      .from('marketa_delivery_logs')
      .insert({
        campaign_id,
        tenant_id,
        platform: metadata?.platform || 'unknown',
        status: 'delivered',
        recipient_count: performance_data.sent,
        metadata: {
          ...metadata,
          metrics_id: metricsRecord.id,
          sync_timestamp: new Date().toISOString()
        }
      });

    // Get updated aggregated performance across all tenants
    const { data: aggregatedPerformance, error: aggregationError } = await supabase
      .rpc('get_multi_tenant_performance', { p_campaign_id: campaign_id });

    if (aggregationError) {
      console.error('Aggregation error:', aggregationError);
    }

    // Get individual tenant breakdown for insights
    const { data: tenantBreakdownRaw } = await supabase
      .from('marketa_campaign_metrics')
      .select(`
        tenant_id,
        sent,
        delivered,
        opened,
        clicked,
        conversions,
        revenue,
        delivery_rate,
        open_rate,
        click_rate,
        crm_tenants(id, name)
      `)
      .eq('campaign_id', campaign_id);

    const tenantBreakdown = tenantBreakdownRaw || [];

    const insights = {
      top_performing_tenant: tenantBreakdown?.reduce((max, current) => 
        current.conversions > max.conversions ? current.tenant_id : max.tenant_id, 
        tenantBreakdown[0]?.tenant_id || ''
      ) || '',
      best_conversion_rate: tenantBreakdown?.reduce((max, current) => 
        (current.conversions / Math.max(current.sent, 1)) > (max.conversions / Math.max(max.sent, 1)) ? current : current, 
        tenantBreakdown[0] || { conversions: 0, sent: 1 }
      ).conversions / Math.max(tenantBreakdown[0]?.sent || 1, 1),
      total_roi: aggregatedPerformance?.[0]?.total_cost > 0 
        ? (aggregatedPerformance[0].total_revenue - aggregatedPerformance[0].total_cost) / aggregatedPerformance[0].total_cost 
        : 0,
      performance_trend: 'stable' as const // Could be calculated from historical data
    };

    return NextResponse.json({
      success: true,
      metrics_updated: metricsRecord.id,
      aggregated_performance: aggregatedPerformance?.[0] || null,
      tenant_breakdown: tenantBreakdown?.map(tenant => ({
        tenant_id: tenant.tenant_id,
        tenant_name: tenant.crm_tenants?.[0]?.name || 'Unknown',
        metrics: {
          sent: tenant.sent,
          delivered: tenant.delivered,
          opened: tenant.opened,
          clicked: tenant.clicked,
          conversions: tenant.conversions,
          revenue: tenant.revenue,
          delivery_rate: tenant.delivery_rate,
          open_rate: tenant.open_rate,
          click_rate: tenant.click_rate
        },
        contribution_percentage: aggregatedPerformance?.[0]?.total_sent > 0 
          ? (tenant.sent / aggregatedPerformance[0].total_sent) * 100 
          : 0
      })) || [],
      insights,
      sync_status: {
        synced_at: new Date().toISOString(),
        sync_id: metricsRecord.id,
        source: 'lvb_bridge'
      }
    });

  } catch (error) {
    console.error('Performance aggregation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const campaign_id = searchParams.get('campaign_id');
    const tenant_id = searchParams.get('tenant_id');
    const aggregate = searchParams.get('aggregate') === 'true';
    const personaId = request.headers.get('x-persona-id');

    if (!personaId) {
      return NextResponse.json(
        { error: 'Missing persona identification' },
        { status: 401 }
      );
    }

    // Get persona and tenant info
    const { data: persona, error: personaError } = await supabase
      .from('crm_personas')
      .select('tenant_id, crm_tenants(id, name, type)')
      .eq('id', personaId)
      .single();

    if (personaError || !persona) {
      return NextResponse.json(
        { error: 'Invalid persona' },
        { status: 401 }
      );
    }

    if (campaign_id) {
      if (aggregate) {
        // Get aggregated performance for a campaign
        return await getAggregatedPerformance(campaign_id, persona.tenant_id);
      } else {
        // Get performance for specific tenant
        return await getTenantPerformance(campaign_id, tenant_id || persona.tenant_id, persona.tenant_id);
      }
    } else {
      // Get performance summary for all campaigns
      return await getPerformanceSummary(persona.tenant_id);
    }

  } catch (error) {
    console.error('Performance fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getAggregatedPerformance(campaignId: string, requestorTenantId: string): Promise<NextResponse> {
  // Validate campaign exists and requestor has access
  const { data: campaign, error: campaignError } = await supabase
    .from('marketa_multi_tenant_campaigns')
    .select('*')
    .eq('campaign_id', campaignId)
    .single();

  if (campaignError) {
    return NextResponse.json(
      { error: 'Multi-tenant campaign not found' },
      { status: 404 }
    );
  }

  const isOwner = campaign.owner_tenant_id === requestorTenantId;
  const isParticipant = campaign.participating_tenants?.includes(requestorTenantId);
  
  if (!isOwner && !isParticipant) {
    return NextResponse.json(
      { error: 'Access denied' },
      { status: 403 }
    );
  }

  // Get aggregated performance
  const { data: aggregatedPerformance, error: aggregationError } = await supabase
    .rpc('get_multi_tenant_performance', { p_campaign_id: campaignId });

  if (aggregationError) {
    console.error('Aggregation error:', aggregationError);
    return NextResponse.json(
      { error: 'Failed to get aggregated performance' },
      { status: 500 }
    );
  }

  // Get detailed breakdown
  const { data: detailedBreakdownRaw } = await supabase
    .from('marketa_campaign_metrics')
    .select(`
      tenant_id,
      sent,
      delivered,
      opened,
      clicked,
      conversions,
      revenue,
      cost,
      delivery_rate,
      open_rate,
      click_rate,
      updated_at,
      crm_tenants(id, name, type)
    `)
    .eq('campaign_id', campaignId);

  const detailedBreakdown = detailedBreakdownRaw || [];

  const response: AggregatedPerformanceResponse = {
    campaign_id: campaignId,
    total_metrics: aggregatedPerformance?.[0] || {
      total_sent: 0,
      total_delivered: 0,
      total_opened: 0,
      total_clicked: 0,
      total_conversions: 0,
      total_revenue: 0,
      total_cost: 0,
      delivery_rate: 0,
      open_rate: 0,
      click_rate: 0,
      conversion_rate: 0,
      roi: 0
    },
    tenant_breakdown: detailedBreakdown?.map(tenant => ({
      tenant_id: tenant.tenant_id,
      tenant_name: tenant.crm_tenants?.[0]?.name || 'Unknown',
      metrics: {
        sent: tenant.sent,
        delivered: tenant.delivered,
        opened: tenant.opened,
        clicked: tenant.clicked,
        conversions: tenant.conversions,
        revenue: tenant.revenue,
        cost: tenant.cost,
        delivery_rate: tenant.delivery_rate,
        open_rate: tenant.open_rate,
        click_rate: tenant.click_rate
      },
      contribution_percentage: aggregatedPerformance?.[0]?.total_sent > 0 
        ? (tenant.sent / aggregatedPerformance[0].total_sent) * 100 
        : 0
    })) || [],
    insights: {
      top_performing_tenant: detailedBreakdown?.reduce((max, current) => 
        current.conversions > max.conversions ? current.tenant_id : max.tenant_id, 
        detailedBreakdown[0]?.tenant_id || ''
      ) || '',
      best_conversion_rate: detailedBreakdown?.reduce((max, current) => 
        (current.conversions / Math.max(current.sent, 1)) > (max.conversions / Math.max(max.sent, 1)) ? current : max, 
        detailedBreakdown[0] || { conversions: 0, sent: 1 }
      ).conversions / Math.max(detailedBreakdown[0]?.sent || 1, 1),
      total_roi: aggregatedPerformance?.[0]?.total_cost > 0 
        ? (aggregatedPerformance[0].total_revenue - aggregatedPerformance[0].total_cost) / aggregatedPerformance[0].total_cost 
        : 0,
      performance_trend: 'stable' // Could be calculated from historical data
    }
  };

  return NextResponse.json({
    success: true,
    ...response
  });
}

async function getTenantPerformance(campaignId: string, targetTenantId: string, requestorTenantId: string): Promise<NextResponse> {
  // Validate access
  if (targetTenantId !== requestorTenantId) {
    return NextResponse.json(
      { error: 'Can only view performance for your own tenant' },
      { status: 403 }
    );
  }

  const { data: performance, error: performanceError } = await supabase
    .from('marketa_campaign_metrics')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('tenant_id', targetTenantId)
    .single();

  if (performanceError) {
    return NextResponse.json(
      { error: 'Performance data not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    performance,
    insights: {
      delivery_rate: performance.delivery_rate,
      open_rate: performance.open_rate,
      click_rate: performance.click_rate,
      conversion_rate: performance.sent > 0 ? performance.conversions / performance.sent : 0,
      revenue_per_send: performance.sent > 0 ? performance.revenue / performance.sent : 0
    }
  });
}

async function getPerformanceSummary(tenantId: string): Promise<NextResponse> {
  // Get all campaigns for this tenant
  const { data: campaigns, error: campaignsError } = await supabase
    .from('marketa_campaign_metrics')
    .select(`
      campaign_id,
      sent,
      delivered,
      opened,
      clicked,
      conversions,
      revenue,
      cost,
      delivery_rate,
      open_rate,
      click_rate,
      updated_at,
      marketa_campaigns(id, name, status, phase, created_at)
    `)
    .eq('tenant_id', tenantId);

  if (campaignsError) {
    console.error('Campaigns fetch error:', campaignsError);
    return NextResponse.json(
      { error: 'Failed to fetch campaign performance' },
      { status: 500 }
    );
  }

  // Calculate totals and averages
  const totals = campaigns?.reduce((acc, campaign) => ({
    total_sent: acc.total_sent + campaign.sent,
    total_delivered: acc.total_delivered + campaign.delivered,
    total_opened: acc.total_opened + campaign.opened,
    total_clicked: acc.total_clicked + campaign.clicked,
    total_conversions: acc.total_conversions + campaign.conversions,
    total_revenue: acc.total_revenue + campaign.revenue,
    total_cost: acc.total_cost + campaign.cost,
    active_campaigns: acc.active_campaigns + (campaign.marketa_campaigns?.[0]?.status === 'active' ? 1 : 0)
  }), {
    total_sent: 0,
    total_delivered: 0,
    total_opened: 0,
    total_clicked: 0,
    total_conversions: 0,
    total_revenue: 0,
    total_cost: 0,
    active_campaigns: 0
  }) || {
    total_sent: 0,
    total_delivered: 0,
    total_opened: 0,
    total_clicked: 0,
    total_conversions: 0,
    total_revenue: 0,
    total_cost: 0,
    active_campaigns: 0
  };

  const averages = {
    avg_delivery_rate: totals.total_sent > 0 ? totals.total_delivered / totals.total_sent : 0,
    avg_open_rate: totals.total_delivered > 0 ? totals.total_opened / totals.total_delivered : 0,
    avg_click_rate: totals.total_opened > 0 ? totals.total_clicked / totals.total_opened : 0,
    avg_conversion_rate: totals.total_sent > 0 ? totals.total_conversions / totals.total_sent : 0,
    avg_roi: totals.total_cost > 0 ? (totals.total_revenue - totals.total_cost) / totals.total_cost : 0
  };

  return NextResponse.json({
    success: true,
    summary: {
      ...totals,
      ...averages,
      total_campaigns: campaigns?.length || 0,
      last_updated: new Date().toISOString()
    },
    campaign_breakdown: campaigns?.map(campaign => ({
      campaign_id: campaign.campaign_id,
      campaign_name: campaign.marketa_campaigns?.[0]?.name || 'Unknown',
      status: campaign.marketa_campaigns?.[0]?.status,
      phase: campaign.marketa_campaigns?.[0]?.phase,
      performance: {
        sent: campaign.sent,
        delivered: campaign.delivered,
        conversions: campaign.conversions,
        revenue: campaign.revenue,
        delivery_rate: campaign.delivery_rate,
        conversion_rate: campaign.sent > 0 ? campaign.conversions / campaign.sent : 0
      },
      last_updated: campaign.updated_at
    })) || []
  });
}
