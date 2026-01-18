import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * LVB-AGQ Bridge API
 * Enables Lovable thin client to work with AGQ multi-tenant architecture
 * while maintaining simplicity and ensuring AGQ remains source of truth
 */

// Enhanced LVB Configuration with Multi-Tenant Support
interface LVBTenantConfig {
  tenant_id: string;
  persona_id: string;
  tenant_name: string;
  role: 'partner' | 'admin' | 'viewer';
  capabilities: {
    create_campaigns: boolean;
    view_analytics: boolean;
    manage_partners: boolean;
    multi_tenant: boolean;
  };
  feature_flags: {
    advanced_analytics: boolean;
    multi_tenant: boolean;
    custom_branding: boolean;
    real_time_sync: boolean;
  };
  ui_config: {
    theme: string;
    primary_color: string;
    layout: 'minimal' | 'full';
    show_advanced_features: boolean;
  };
}

// Simplified Campaign Summary for LVB
interface LVBCampaignSummary {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  phase: string;
  budget: number;
  performance: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    conversion_rate: number;
  };
  created_at: string;
  is_multi_tenant: boolean;
  tenant_count?: number;
}

// Partner Performance Data
interface LVBPartnerPerformance {
  tenant_id: string;
  tenant_name: string;
  campaign_count: number;
  total_budget: number;
  total_sent: number;
  total_delivered: number;
  delivery_rate: number;
  total_conversions: number;
  revenue_generated: number;
  last_activity: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
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
      .select(`
        tenant_id: tenantId,
        fio_handle,
        default_identity_state,
        crm_tenants(id, name, type, settings)
      `)
      .eq('id', personaId)
      .single();

    if (personaError || !persona) {
      return NextResponse.json(
        { error: 'Invalid persona' },
        { status: 401 }
      );
    }

    const tenant = Array.isArray(persona.crm_tenants) ? persona.crm_tenants[0] : persona.crm_tenants;

    switch (action) {
      case 'config':
        return await getTenantConfig(personaId, tenant);
      
      case 'campaigns':
        return await getCampaignSummaries(tenant.id, personaId);
      
      case 'performance':
        return await getPerformanceData(tenant.id, personaId);
      
      case 'partner-overview':
        return await getPartnerOverview(tenant.id, personaId);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: config, campaigns, performance, partner-overview' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('LVB Bridge error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;
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

    switch (action) {
      case 'sync-campaign':
        return await syncCampaignFromLVB(persona.tenant_id, personaId, data);
      
      case 'sync-performance':
        return await syncPerformanceFromLVB(persona.tenant_id, personaId, data);
      
      case 'update-config':
        return await updateLVBConfig(persona.tenant_id, personaId, data);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: sync-campaign, sync-performance, update-config' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('LVB Bridge POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get tenant configuration for LVB
async function getTenantConfig(personaId: string, tenant: any): Promise<NextResponse> {
  const config: LVBTenantConfig = {
    tenant_id: tenant.id,
    persona_id: personaId,
    tenant_name: tenant.name,
    role: tenant.type,
    capabilities: {
      create_campaigns: true,
      view_analytics: true,
      manage_partners: tenant.type === 'admin',
      multi_tenant: true // Enable multi-tenant for LVB
    },
    feature_flags: {
      advanced_analytics: true, // Upgrade from LVB's false
      multi_tenant: true,      // Upgrade from LVB's false
      custom_branding: tenant.settings?.custom_branding || false,
      real_time_sync: true
    },
    ui_config: {
      theme: tenant.settings?.theme || 'minimal',
      primary_color: tenant.settings?.primary_color || '#3b82f6',
      layout: 'minimal', // Keep LVB minimal
      show_advanced_features: false // Keep LVB simple
    }
  };

  return NextResponse.json({
    success: true,
    config,
    bridge_version: '1.0.0',
    features: {
      multi_tenant_campaigns: true,
      performance_aggregation: true,
      real_time_sync: true,
      simplified_ui: true
    }
  });
}

// Get simplified campaign summaries for LVB
async function getCampaignSummaries(tenantId: string, personaId: string): Promise<NextResponse> {
  // Get campaigns for this tenant
  const { data: campaigns, error: campaignsError } = await supabase
    .from('marketa_campaigns')
    .select(`
      id,
      name,
      status,
      phase,
      budget,
      created_at,
      marketa_campaign_metrics(
        sent,
        delivered,
        opened,
        clicked,
        conversions
      ),
      marketa_multi_tenant_campaigns(
        is_multi_tenant,
        tenant_count
      )
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (campaignsError) {
    console.error('Campaign fetch error:', campaignsError);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }

  // Transform to LVB format
  const summaries: LVBCampaignSummary[] = campaigns.map(campaign => ({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    phase: campaign.phase,
    budget: campaign.budget,
    performance: {
      sent: campaign.marketa_campaign_metrics?.[0]?.sent || 0,
      delivered: campaign.marketa_campaign_metrics?.[0]?.delivered || 0,
      opened: campaign.marketa_campaign_metrics?.[0]?.opened || 0,
      clicked: campaign.marketa_campaign_metrics?.[0]?.clicked || 0,
      conversion_rate: campaign.marketa_campaign_metrics?.[0]?.sent > 0 
        ? (campaign.marketa_campaign_metrics?.[0]?.conversions || 0) / campaign.marketa_campaign_metrics?.[0]?.sent 
        : 0
    },
    created_at: campaign.created_at,
    is_multi_tenant: campaign.marketa_multi_tenant_campaigns?.[0]?.is_multi_tenant || false,
    tenant_count: campaign.marketa_multi_tenant_campaigns?.[0]?.tenant_count
  }));

  return NextResponse.json({
    success: true,
    campaigns: summaries,
    total: summaries.length,
    multi_tenant_enabled: true
  });
}

// Get performance data for LVB
async function getPerformanceData(tenantId: string, personaId: string): Promise<NextResponse> {
  // Get aggregated performance for this tenant
  const { data: performance, error: performanceError } = await supabase
    .from('marketa_campaign_metrics')
    .select(`
      sent,
      delivered,
      opened,
      clicked,
      conversions,
      revenue,
      marketa_campaigns(id, name, status)
    `)
    .eq('tenant_id', tenantId);

  if (performanceError) {
    console.error('Performance fetch error:', performanceError);
    return NextResponse.json(
      { error: 'Failed to fetch performance data' },
      { status: 500 }
    );
  }

  // Calculate aggregates
  const totals = performance.reduce((acc, metric) => ({
    total_sent: acc.total_sent + (metric.sent || 0),
    total_delivered: acc.total_delivered + (metric.delivered || 0),
    total_opened: acc.total_opened + (metric.opened || 0),
    total_clicked: acc.total_clicked + (metric.clicked || 0),
    total_conversions: acc.total_conversions + (metric.conversions || 0),
    total_revenue: acc.total_revenue + (metric.revenue || 0)
  }), {
    total_sent: 0,
    total_delivered: 0,
    total_opened: 0,
    total_clicked: 0,
    total_conversions: 0,
    total_revenue: 0
  });

  const delivery_rate = totals.total_sent > 0 ? totals.total_delivered / totals.total_sent : 0;
  const open_rate = totals.total_delivered > 0 ? totals.total_opened / totals.total_delivered : 0;
  const click_rate = totals.total_opened > 0 ? totals.total_clicked / totals.total_opened : 0;

  return NextResponse.json({
    success: true,
    performance: {
      ...totals,
      delivery_rate,
      open_rate,
      click_rate,
      conversion_rate: totals.total_sent > 0 ? totals.total_conversions / totals.total_sent : 0
    },
    campaign_count: performance.length,
    active_campaigns: performance.filter(m => m.marketa_campaigns?.[0]?.status === 'active').length
  });
}

// Get partner overview for multi-tenant campaigns
async function getPartnerOverview(tenantId: string, personaId: string): Promise<NextResponse> {
  // Get multi-tenant campaigns where this tenant is the owner
  const { data: multiTenantCampaigns, error: campaignsError } = await supabase
    .from('marketa_multi_tenant_campaigns')
    .select(`
      campaign_id,
      tenant_count,
      participating_tenants,
      marketa_campaigns(id, name, budget, status)
    `)
    .eq('owner_tenant_id', tenantId)
    .eq('is_multi_tenant', true);

  if (campaignsError) {
    console.error('Multi-tenant campaign fetch error:', campaignsError);
    return NextResponse.json(
      { error: 'Failed to fetch partner data' },
      { status: 500 }
    );
  }

  // Get performance data for participating tenants
  const partnerPerformances: LVBPartnerPerformance[] = [];
  
  for (const campaign of multiTenantCampaigns) {
    if (campaign.participating_tenants) {
      for (const participantTenantId of campaign.participating_tenants) {
        // Get performance for this participant
        const { data: participantMetrics } = await supabase
          .from('marketa_campaign_metrics')
          .select('sent, delivered, opened, clicked, conversions, revenue')
          .eq('campaign_id', campaign.campaign_id)
          .eq('tenant_id', participantTenantId)
          .single();

        // Get tenant info
        const { data: participantTenant } = await supabase
          .from('crm_tenants')
          .select('name')
          .eq('id', participantTenantId)
          .single();

        if (participantTenant && participantMetrics) {
          partnerPerformances.push({
            tenant_id: participantTenantId,
            tenant_name: participantTenant.name,
            campaign_count: 1,
            total_budget: campaign.marketa_campaigns?.[0]?.budget || 0,
            total_sent: participantMetrics.sent || 0,
            total_delivered: participantMetrics.delivered || 0,
            delivery_rate: participantMetrics.sent > 0 
              ? (participantMetrics.delivered || 0) / participantMetrics.sent 
              : 0,
            total_conversions: participantMetrics.conversions || 0,
            revenue_generated: participantMetrics.revenue || 0,
            last_activity: new Date().toISOString()
          });
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    partners: partnerPerformances,
    summary: {
      total_partners: partnerPerformances.length,
      total_campaigns: multiTenantCampaigns.length,
      total_budget: multiTenantCampaigns.reduce((sum, c) => sum + (c.marketa_campaigns?.[0]?.budget || 0), 0),
      total_revenue: partnerPerformances.reduce((sum, p) => sum + p.revenue_generated, 0)
    }
  });
}

// Sync campaign data from LVB to AGQ (Source of Truth)
async function syncCampaignFromLVB(tenantId: string, personaId: string, data: any): Promise<NextResponse> {
  const { campaign, lvb_metadata } = data;

  // Store campaign in AGQ as source of truth
  const { data: insertedCampaign, error: insertError } = await supabase
    .from('marketa_campaigns')
    .insert({
      id: campaign.id,
      tenant_id: tenantId,
      name: campaign.name,
      status: campaign.status || 'draft',
      phase: campaign.phase || 'codex1',
      budget: campaign.budget || 0,
      created_at: campaign.created_at || new Date().toISOString(),
      metadata: {
        ...campaign.metadata,
        lvb_sync: true,
        lvb_version: lvb_metadata?.client_version || '1.0.0',
        lvb_build: lvb_metadata?.build_version,
        sync_timestamp: new Date().toISOString()
      }
    })
    .select()
    .single();

  if (insertError) {
    console.error('Campaign sync error:', insertError);
    return NextResponse.json(
      { error: 'Failed to sync campaign to AGQ' },
      { status: 500 }
    );
  }

  // If it's a multi-tenant campaign, set up multi-tenant tracking
  if (campaign.is_multi_tenant && campaign.participating_tenants) {
    await supabase
      .from('marketa_multi_tenant_campaigns')
      .insert({
        campaign_id: campaign.id,
        owner_tenant_id: tenantId,
        is_multi_tenant: true,
        tenant_count: campaign.participating_tenants.length,
        participating_tenants: campaign.participating_tenants,
        created_at: new Date().toISOString()
      });
  }

  return NextResponse.json({
    success: true,
    campaign_id: insertedCampaign.id,
    synced_at: new Date().toISOString(),
    message: 'Campaign successfully synced to AGQ source of truth'
  });
}

// Sync performance data from LVB to AGQ
async function syncPerformanceFromLVB(tenantId: string, personaId: string, data: any): Promise<NextResponse> {
  const { campaign_id, performance_metrics, lvb_metadata } = data;

  // Update performance metrics in AGQ
  const { data: updatedMetrics, error: updateError } = await supabase
    .from('marketa_campaign_metrics')
    .upsert({
      campaign_id,
      tenant_id: tenantId,
      sent: performance_metrics.sent || 0,
      delivered: performance_metrics.delivered || 0,
      opened: performance_metrics.opened || 0,
      clicked: performance_metrics.clicked || 0,
      conversions: performance_metrics.conversions || 0,
      revenue: performance_metrics.revenue || 0,
      updated_at: new Date().toISOString(),
      metadata: {
        lvb_sync: true,
        lvb_version: lvb_metadata?.client_version,
        sync_timestamp: new Date().toISOString()
      }
    })
    .select()
    .single();

  if (updateError) {
    console.error('Performance sync error:', updateError);
    return NextResponse.json(
      { error: 'Failed to sync performance to AGQ' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    metrics_id: updatedMetrics.id,
    synced_at: new Date().toISOString(),
    message: 'Performance data successfully synced to AGQ source of truth'
  });
}

// Update LVB configuration
async function updateLVBConfig(tenantId: string, personaId: string, data: any): Promise<NextResponse> {
  const { config_updates } = data;

  // Update tenant settings in AGQ
  const { error: updateError } = await supabase
    .from('crm_tenants')
    .update({
      settings: {
        theme: config_updates.ui_config?.theme,
        primary_color: config_updates.ui_config?.primary_color,
        custom_branding: config_updates.feature_flags?.custom_branding,
        lvb_config_updated: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', tenantId);

  if (updateError) {
    console.error('Config update error:', updateError);
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    updated_at: new Date().toISOString(),
    message: 'LVB configuration updated in AGQ'
  });
}
